import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Cell,
} from 'recharts'
import { useStore } from '../store/useStore'
import { CATEGORIES, CATEGORY_MAP } from '../data/categories'
import { convertToBase } from '../data/currencies'
import { formatAmount } from '../utils/formatters'
import { currentYear, currentMonth, longMonth } from '../utils/dates'
import { householdRatioForMonth, personShareFraction } from '../utils/split'
import type { HouseholdMember } from '../models/types'

function prevMonth(y: number, m: number) {
  return m === 1 ? { year: y - 1, month: 12 } : { year: y, month: m - 1 }
}
function nextMonth(y: number, m: number) {
  return m === 12 ? { year: y + 1, month: 1 } : { year: y, month: m + 1 }
}

type ActiveTab = 'planifier' | 'suivi' | 'ecarts' | 'graphique'

export default function BudgetScreen() {
  const { expenses, recurring, budgets, settings, setBudgetItem, setBudgetItems, copyBudget, setIncome } = useStore()
  const base = settings.baseCurrency

  const [year, setYear]     = useState(currentYear())
  const [month, setMonth]   = useState(currentMonth())
  const [person, setPerson] = useState<HouseholdMember>('person1')
  const [editCat, setEditCat]             = useState<string | null>(null)
  const [editAmount, setEditAmount]       = useState('')
  const [editingIncome, setEditingIncome] = useState(false)
  const [incomeInput, setIncomeInput]     = useState('')
  const [activeTab, setActiveTab]         = useState<ActiveTab>('planifier')
  const [chartRange, setChartRange]       = useState<3 | 6 | 12>(6)

  const isDark = document.documentElement.classList.contains('dark')

  const personTabs: { id: HouseholdMember; label: string }[] = [
    { id: 'person1', label: settings.person1Name  || 'Moi' },
    { id: 'person2', label: settings.person2Name  || 'Partenaire' },
    { id: 'shared',  label: 'Foyer' },
  ]

  const budget = budgets.find(b => b.year === year && b.month === month && b.person === person)

  // In personal tabs, each person also bears a share of the foyer budget and
  // of the shared expenses (50/50 or income proration, per settings/expense)
  const isPersonTab = person === 'person1' || person === 'person2'
  const foyerBudget = isPersonTab
    ? budgets.find(b => b.year === year && b.month === month && b.person === 'shared')
    : undefined
  const householdRatio = householdRatioForMonth(budgets, settings, year, month)
  const foyerShareFor = (catId: string): number => {
    if (!foyerBudget || !isPersonTab) return 0
    const it = foyerBudget.items.find(i => i.categoryId === catId)
    return it ? it.amount * householdRatio[person as 'person1' | 'person2'] / 100 : 0
  }
  const hasFoyerShare = isPersonTab && (foyerBudget?.items.length ?? 0) > 0

  // ── Fixed amounts from isFixed recurring for this person ──────────────────
  const fixedByCategory = useMemo(() => {
    const map: Record<string, number> = {}
    recurring.filter(r => r.isFixed && r.person === person).forEach(r => {
      map[r.category] = (map[r.category] ?? 0) + convertToBase(r.amount, r.currency, base)
    })
    return map
  }, [recurring, base, person])

  const fixedLinesByCategory = useMemo(() => {
    const map: Record<string, { title: string; amount: number }[]> = {}
    recurring.filter(r => r.isFixed && r.person === person).forEach(r => {
      const amt = convertToBase(r.amount, r.currency, base)
      if (!map[r.category]) map[r.category] = []
      map[r.category].push({ title: r.title, amount: amt })
    })
    return map
  }, [recurring, base, person])

  const totalFixedRecurring = Object.values(fixedByCategory).reduce((s, v) => s + v, 0)
  const fixedCatIds = Object.keys(fixedByCategory)
  const fixedPreFilled = fixedCatIds.length > 0 &&
    fixedCatIds.every(id => budget?.items.some(i => i.categoryId === id))

  // ── Actual spend per category for this person ────────────────────────────
  // Personal tabs include the person's share of shared (foyer) expenses
  const actualByCategory = useMemo(() => {
    const map: Record<string, number> = {}
    expenses
      .filter(e =>
        parseInt(e.date.slice(0, 4)) === year &&
        parseInt(e.date.slice(5, 7)) === month &&
        e.type === 'debit'
      )
      .forEach(e => {
        const w = person === 'shared'
          ? (e.person === 'shared' ? 1 : 0)
          : personShareFraction(e, person as 'person1' | 'person2', budgets, settings)
        if (w > 0) map[e.category] = (map[e.category] ?? 0) + e.amountInBase * w
      })
    return map
  }, [expenses, year, month, person, budgets, settings])

  // ── Rows ─────────────────────────────────────────────────────────────────
  const rows = useMemo(() =>
    CATEGORIES.map(cat => {
      const budgetItem = budget?.items.find(i => i.categoryId === cat.id)
      const foyerPart = foyerShareFor(cat.id)
      const budgeted = (budgetItem?.amount ?? 0) + foyerPart
      const actual   = actualByCategory[cat.id] ?? 0
      const fixed    = fixedByCategory[cat.id] ?? 0
      const variable = Math.max(budgeted - fixed, 0)
      const deviation = actual - budgeted
      const pct = budgeted > 0 ? Math.min((actual / budgeted) * 100, 999) : null
      return { cat, budgeted, actual, fixed, variable, deviation, pct, foyerPart }
    }).filter(r => r.budgeted > 0 || r.actual > 0),
    [budget, actualByCategory, fixedByCategory, foyerBudget, householdRatio]  // eslint-disable-line react-hooks/exhaustive-deps
  )

  const totalBudgeted = rows.reduce((s, r) => s + r.budgeted, 0)
  const totalActual   = rows.reduce((s, r) => s + r.actual,   0)
  const totalFixed    = rows.reduce((s, r) => s + r.fixed,    0)
  const totalVariable = rows.reduce((s, r) => s + r.variable, 0)
  const totalDev      = totalActual - totalBudgeted
  const globalPct     = totalBudgeted > 0 ? Math.min((totalActual / totalBudgeted) * 100, 100) : 0

  const estimatedIncome = budget?.estimatedIncome ?? 0
  const actualIncome = useMemo(() =>
    expenses
      .filter(e =>
        parseInt(e.date.slice(0, 4)) === year &&
        parseInt(e.date.slice(5, 7)) === month &&
        e.type === 'credit' &&
        e.person === person
      )
      .reduce((s, e) => s + e.amountInBase, 0),
    [expenses, year, month, person]
  )
  const plannedBalance = estimatedIncome - totalBudgeted
  const actualBalance  = actualIncome  - totalActual

  const deviationRows = rows
    .filter(r => r.budgeted > 0)
    .sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation))

  // Most recent previous month with budget for this person
  const prevMonthWithBudget = useMemo(() => {
    let { year: y, month: m } = prevMonth(year, month)
    for (let i = 0; i < 24; i++) {
      if (budgets.find(b => b.year === y && b.month === m && b.person === person)) return { year: y, month: m }
      const p = prevMonth(y, m); y = p.year; m = p.month
    }
    return null
  }, [budgets, year, month, person])

  // Chart: last N months for this person
  const chartData = useMemo(() => {
    const months: { year: number; month: number }[] = []
    let { year: y, month: m } = { year, month }
    for (let i = 0; i < chartRange; i++) {
      months.unshift({ year: y, month: m })
      const p = prevMonth(y, m); y = p.year; m = p.month
    }
    return months.map(({ year: y, month: m }) => {
      const b = budgets.find(bx => bx.year === y && bx.month === m && bx.person === person)
      let budgeted = b?.items.reduce((s, i) => s + i.amount, 0) ?? 0
      if (person !== 'shared') {
        const foyer = budgets.find(bx => bx.year === y && bx.month === m && bx.person === 'shared')
        const ratio = householdRatioForMonth(budgets, settings, y, m)
        budgeted += (foyer?.items.reduce((s, i) => s + i.amount, 0) ?? 0) * ratio[person as 'person1' | 'person2'] / 100
      }
      const actual = expenses
        .filter(e => parseInt(e.date.slice(0, 4)) === y && parseInt(e.date.slice(5, 7)) === m && e.type === 'debit')
        .reduce((s, e) => {
          const w = person === 'shared'
            ? (e.person === 'shared' ? 1 : 0)
            : personShareFraction(e, person as 'person1' | 'person2', budgets, settings)
          return s + e.amountInBase * w
        }, 0)
      return {
        name: chartRange > 6 ? `${longMonth(m).slice(0, 3)} ${String(y).slice(2)}` : longMonth(m).slice(0, 4),
        budgeted: Math.round(budgeted),
        actual: Math.round(actual),
      }
    })
  }, [budgets, expenses, year, month, person, chartRange, settings])

  // ── Planifier helpers ────────────────────────────────────────────────────
  function prefillFromFixed() {
    const existing = budget?.items ?? []
    const fixedItems = Object.entries(fixedByCategory).map(([categoryId, amount]) => ({
      categoryId: categoryId, amount: Math.round(amount),
    }))
    const merged = [...existing.filter(i => !fixedByCategory[i.categoryId]), ...fixedItems]
    setBudgetItems(year, month, person, merged)
  }

  function prefillFromRecurring() {
    const map: Record<string, number> = {}
    recurring.filter(r => r.person === person).forEach(r => {
      map[r.category] = (map[r.category] ?? 0) + convertToBase(r.amount, r.currency, base)
    })
    setBudgetItems(year, month, person, Object.entries(map).map(([categoryId, amount]) => ({
      categoryId: categoryId, amount: Math.round(amount),
    })))
  }

  // ── Edit modal ────────────────────────────────────────────────────────────
  function openEdit(catId: string) {
    const current = budget?.items.find(i => i.categoryId === catId)
    setEditAmount(current ? String(current.amount) : '')
    setEditCat(catId)
  }

  function saveEdit() {
    if (!editCat) return
    const n = parseFloat(editAmount.replace(',', '.'))
    setBudgetItem(year, month, person, editCat, isNaN(n) ? 0 : n)
    setEditCat(null)
  }

  // ── Visual ───────────────────────────────────────────────────────────────
  function pctColor(pct: number | null) {
    if (pct === null) return 'bg-blue-400'
    if (pct >= 100) return 'bg-red-500'
    if (pct >= 80)  return 'bg-orange-400'
    return 'bg-green-500'
  }

  const tooltipStyle = {
    borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,.15)', fontSize: 12,
    background: isDark ? '#1f2937' : '#fff', color: isDark ? '#f9fafb' : '#111827',
  }

  const planFixedCats    = CATEGORIES.filter(c => fixedByCategory[c.id] > 0)
  const planVariableCats = CATEGORIES.filter(c => !fixedByCategory[c.id] && c.id !== 'entreprise')

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>

      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700 px-4 py-3 flex-shrink-0">
        <h1 className="text-[22px] font-bold dark:text-white mb-2">Budget</h1>

        {/* Month nav */}
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => { const p = prevMonth(year, month); setYear(p.year); setMonth(p.month) }}
            className="text-blue-600 text-2xl px-2">‹</button>
          <span className="text-[16px] font-semibold dark:text-white">{longMonth(month)} {year}</span>
          <button onClick={() => { const n = nextMonth(year, month); setYear(n.year); setMonth(n.month) }}
            className="text-blue-600 text-2xl px-2">›</button>
        </div>

        {/* Person selector */}
        <div className="flex gap-1.5">
          {personTabs.map(p => (
            <button key={p.id} onClick={() => setPerson(p.id)}
              className={`flex-1 py-1.5 rounded-xl text-[13px] font-semibold transition-colors
                ${person === p.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-ios pb-6">

        {/* Summary card */}
        {(budget || hasFoyerShare) && (
          <div className="card mx-4 mt-4 p-4">
            {/* Expenses row */}
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="text-[11px] text-gray-400 dark:text-gray-500">Dépenses prévues</p>
                <p className="text-[18px] font-bold dark:text-white">{formatAmount(totalBudgeted, base)}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-gray-400 dark:text-gray-500">Dépenses réelles</p>
                <p className="text-[18px] font-bold dark:text-white">{formatAmount(totalActual, base)}</p>
              </div>
            </div>
            {/* Progress bar */}
            <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden mb-3">
              <div className={`h-full rounded-full transition-all ${pctColor(totalBudgeted > 0 ? (totalActual / totalBudgeted) * 100 : null)}`}
                style={{ width: `${globalPct}%` }} />
            </div>
            {/* Income + balance row */}
            {(estimatedIncome > 0 || actualIncome > 0) && (
              <div className="flex justify-between items-center pt-2 border-t border-gray-100 dark:border-gray-700 mt-1">
                <div>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500">Revenus prévus</p>
                  <p className="text-[14px] font-semibold text-green-600">{estimatedIncome > 0 ? formatAmount(estimatedIncome, base) : '—'}</p>
                </div>
                <div className="text-center">
                  <p className="text-[11px] text-gray-400 dark:text-gray-500">Revenus réels</p>
                  <p className="text-[14px] font-semibold text-green-600">{actualIncome > 0 ? formatAmount(actualIncome, base) : '—'}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-gray-400 dark:text-gray-500">Balance prévisionnelle</p>
                  <p className={`text-[14px] font-bold ${plannedBalance >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {plannedBalance >= 0 ? '+' : ''}{formatAmount(plannedBalance, base)}
                  </p>
                </div>
              </div>
            )}
            {/* Deviation */}
            {hasFoyerShare && (
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-2">
                Inclut {householdRatio[person as 'person1' | 'person2']}% du budget foyer
                ({settings.sharedSplitMode === 'income' ? 'prorata des revenus' : '50/50'})
              </p>
            )}
            <div className="flex justify-between items-center mt-2">
              <p className="text-[12px] text-gray-400 dark:text-gray-500">{globalPct.toFixed(0)}% utilisé</p>
              <p className={`text-[13px] font-semibold ${totalDev <= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {totalDev <= 0 ? '▼' : '▲'} {formatAmount(Math.abs(totalDev), base)}
                {totalDev <= 0 ? ' sous budget' : ' dépassement'}
              </p>
            </div>
          </div>
        )}

        {/* Copy from prev month */}
        {budget && prevMonthWithBudget && (
          <div className="mx-4 mt-1.5 flex justify-end">
            <button
              onClick={() => copyBudget(prevMonthWithBudget.year, prevMonthWithBudget.month, person, year, month, person)}
              className="text-[12px] text-blue-600 dark:text-blue-400 py-1">
              📋 Copier depuis {longMonth(prevMonthWithBudget.month)}
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex mx-4 mt-3 card overflow-hidden p-1">
          {([
            { id: 'planifier', label: 'Planifier' },
            { id: 'suivi',     label: 'Suivi'     },
            { id: 'ecarts',    label: 'Écarts'    },
            { id: 'graphique', label: 'Graphique' },
          ] as const).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-1.5 text-[12px] font-semibold rounded-xl transition-colors
                ${activeTab === tab.id ? 'bg-blue-600 text-white' : 'text-gray-500 dark:text-gray-400'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            TAB: PLANIFIER
        ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'planifier' && (
          <>
            {/* Income section */}
            <p className="section-header">💰 Revenus prévus</p>
            {estimatedIncome === 0 ? (
              <button
                onClick={() => { setIncomeInput(''); setEditingIncome(true) }}
                className="mx-4 w-[calc(100%-2rem)] bg-amber-50 dark:bg-amber-900/25 border-2 border-amber-300 dark:border-amber-600/70 rounded-2xl p-4 flex items-center gap-3 text-left">
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-800/60 flex items-center justify-center flex-shrink-0">
                  <span className="text-xl">💰</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold text-amber-800 dark:text-amber-200">Renseigner mon salaire</p>
                  <p className="text-[12px] text-amber-600 dark:text-amber-400 mt-0.5">
                    Requis pour calculer votre solde prévisionnel
                  </p>
                </div>
                <span className="text-amber-400 text-[22px] font-light flex-shrink-0">›</span>
              </button>
            ) : (
              <div className="card mx-4 overflow-hidden">
                <button
                  onClick={() => { setIncomeInput(String(estimatedIncome)); setEditingIncome(true) }}
                  className="w-full flex items-center justify-between px-4 py-3 text-left">
                  <div>
                    <p className="text-[14px] font-medium dark:text-white">
                      {personTabs.find(p2 => p2.id === person)?.label}
                    </p>
                    {actualIncome > 0 && (
                      <p className="text-[11px] text-gray-400 dark:text-gray-500">
                        Réel ce mois : {formatAmount(actualIncome, base)}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-[16px] font-bold text-green-600">{formatAmount(estimatedIncome, base)}</p>
                  </div>
                </button>
                {totalBudgeted > 0 && (
                  <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
                    <span className="text-[12px] text-gray-500 dark:text-gray-400">Balance prévisionnelle</span>
                    <span className={`text-[13px] font-bold ${plannedBalance >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {plannedBalance >= 0 ? '+' : ''}{formatAmount(plannedBalance, base)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Pre-fill banner */}
            {fixedCatIds.length > 0 && !fixedPreFilled && (
              <div className="mx-4 mt-4 bg-blue-50 dark:bg-blue-900/30 rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl flex-shrink-0">🔒</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-blue-800 dark:text-blue-200 mb-0.5">
                      {fixedCatIds.length} charges fixes détectées
                    </p>
                    <p className="text-[12px] text-blue-600 dark:text-blue-300 mb-3">
                      Incompressible : {formatAmount(totalFixedRecurring, base)}/mois
                    </p>
                    <button onClick={prefillFromFixed}
                      className="w-full py-2 bg-blue-600 text-white rounded-xl text-[13px] font-semibold">
                      Pré-remplir les charges fixes
                    </button>
                    {recurring.filter(r => r.person === person).length > 0 && (
                      <button onClick={prefillFromRecurring}
                        className="w-full py-2 mt-1.5 bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 rounded-xl text-[13px] font-medium">
                        Tout pré-remplir (fixes + variables)
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* No budget + no recurring */}
            {!budget && fixedCatIds.length === 0 && (
              <div className="card mx-4 mt-4 p-4">
                <p className="text-[15px] font-semibold dark:text-white mb-1">Commencer la planification</p>
                <p className="text-[13px] text-gray-400 dark:text-gray-500 mb-4">
                  Dépenses prévues pour {personTabs.find(p2 => p2.id === person)?.label} · {longMonth(month)} {year}
                </p>
                {prevMonthWithBudget && (
                  <button
                    onClick={() => copyBudget(prevMonthWithBudget.year, prevMonthWithBudget.month, person, year, month, person)}
                    className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-medium text-[14px]">
                    📋 Copier depuis {longMonth(prevMonthWithBudget.month)} {prevMonthWithBudget.year}
                  </button>
                )}
                <p className="text-[12px] text-gray-400 dark:text-gray-500 text-center mt-3">
                  Ou appuyez sur une catégorie ci-dessous
                </p>
              </div>
            )}

            {/* Charges fixes */}
            {planFixedCats.length > 0 && (
              <>
                <div className="flex items-center justify-between mx-4 mt-4 mb-1">
                  <p className="section-header !mt-0 !mb-0">🔒 Charges fixes</p>
                  <p className="text-[12px] text-gray-400 dark:text-gray-500">
                    {formatAmount(planFixedCats.reduce((s, c) => s + (budget?.items.find(i => i.categoryId === c.id)?.amount ?? 0), 0), base)}
                  </p>
                </div>
                <div className="card mx-4 overflow-hidden">
                  {planFixedCats.map((cat, i) => {
                    const budgetItem = budget?.items.find(bi => bi.categoryId === cat.id)
                    const budgeted   = budgetItem?.amount ?? 0
                    const suggested  = fixedByCategory[cat.id] ?? 0
                    const lines      = fixedLinesByCategory[cat.id] ?? []
                    const isSet      = budgeted > 0
                    const matchesSug = Math.abs(budgeted - suggested) < 1
                    return (
                      <button key={cat.id} onClick={() => openEdit(cat.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left
                          ${i < planFixedCats.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''}`}>
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                          style={{ backgroundColor: cat.bgColor }}>{cat.emoji}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <p className="text-[14px] font-medium dark:text-white truncate">{cat.label}</p>
                            <span className="text-[10px] text-gray-400 dark:text-gray-500">🔒</span>
                          </div>
                          {lines.map((l, li) => (
                            <p key={li} className="text-[11px] text-gray-400 dark:text-gray-500 truncate">
                              {l.title} · {formatAmount(l.amount, base)}
                            </p>
                          ))}
                          {!isSet && (
                            <p className="text-[11px] text-blue-500 font-medium mt-0.5">
                              Suggéré : {formatAmount(suggested, base)}
                            </p>
                          )}
                        </div>
                        <div className="flex-shrink-0 text-right">
                          {isSet ? (
                            <>
                              <p className={`text-[15px] font-semibold ${matchesSug ? 'text-gray-700 dark:text-gray-200' : 'text-blue-600'}`}>
                                {formatAmount(budgeted, base)}
                              </p>
                              {!matchesSug && (
                                <p className="text-[10px] text-gray-400 dark:text-gray-500">
                                  rec. {formatAmount(suggested, base)}
                                </p>
                              )}
                            </>
                          ) : (
                            <p className="text-[13px] text-gray-300 dark:text-gray-600">Définir ›</p>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </>
            )}

            {/* Dépenses variables */}
            <div className="flex items-center justify-between mx-4 mt-4 mb-1">
              <p className="section-header !mt-0 !mb-0">✏️ Dépenses variables</p>
              <p className="text-[12px] text-gray-400 dark:text-gray-500">
                {formatAmount(planVariableCats.reduce((s, c) => s + (budget?.items.find(i => i.categoryId === c.id)?.amount ?? 0), 0), base)}
              </p>
            </div>
            <div className="card mx-4 overflow-hidden">
              {planVariableCats.map((cat, i) => {
                const budgetItem = budget?.items.find(bi => bi.categoryId === cat.id)
                const budgeted   = budgetItem?.amount ?? 0
                return (
                  <button key={cat.id} onClick={() => openEdit(cat.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left
                      ${i < planVariableCats.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''}`}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                      style={{ backgroundColor: cat.bgColor }}>{cat.emoji}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-medium dark:text-white">{cat.label}</p>
                      {budgeted === 0 && (
                        <p className="text-[11px] text-gray-300 dark:text-gray-600">Appuyer pour estimer</p>
                      )}
                    </div>
                    <p className={`text-[15px] font-semibold flex-shrink-0 ${budgeted > 0 ? 'text-gray-700 dark:text-gray-200' : 'text-gray-300 dark:text-gray-600'}`}>
                      {budgeted > 0 ? formatAmount(budgeted, base) : '—'}
                    </p>
                  </button>
                )
              })}
            </div>

            {/* Planning total */}
            {budget && (
              <div className="card mx-4 mt-4 overflow-hidden">
                {estimatedIncome > 0 && (
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                    <span className="text-[13px] text-gray-500 dark:text-gray-400">💰 Revenus prévus</span>
                    <span className="text-[14px] font-medium text-green-600">+{formatAmount(estimatedIncome, base)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-[13px] text-gray-500 dark:text-gray-400">🔒 Charges fixes</span>
                  <span className="text-[14px] font-medium dark:text-white">−{formatAmount(totalFixed, base)}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-[13px] text-gray-500 dark:text-gray-400">✏️ Dépenses variables</span>
                  <span className="text-[14px] font-medium dark:text-white">−{formatAmount(totalVariable, base)}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                  <span className="text-[13px] font-semibold dark:text-white">Total dépenses prévues</span>
                  <span className="text-[15px] font-bold text-blue-600">{formatAmount(totalBudgeted, base)}</span>
                </div>
                {estimatedIncome > 0 && (
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-[14px] font-bold dark:text-white">Balance prévisionnelle</span>
                    <span className={`text-[16px] font-bold ${plannedBalance >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {plannedBalance >= 0 ? '+' : ''}{formatAmount(plannedBalance, base)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB: SUIVI
        ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'suivi' && (
          <>
            {rows.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center px-8">
                <span className="text-4xl mb-3">📋</span>
                <p className="text-[16px] font-semibold dark:text-white mb-1">Aucun budget planifié</p>
                <p className="text-[13px] text-gray-400 dark:text-gray-500 mb-4">
                  Commencez par l'onglet Planifier pour {personTabs.find(p2 => p2.id === person)?.label}.
                </p>
                <button onClick={() => setActiveTab('planifier')}
                  className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-medium text-[14px]">
                  Aller à Planifier
                </button>
              </div>
            ) : (
              <>
                {rows.filter(r => r.fixed > 0).length > 0 && (
                  <>
                    <p className="section-header">🔒 Charges fixes</p>
                    <div className="card mx-4 overflow-hidden">
                      {rows.filter(r => r.fixed > 0).map((row, i, arr) => (
                        <button key={row.cat.id} onClick={() => openEdit(row.cat.id)}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left
                            ${i < arr.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''}`}>
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                            style={{ backgroundColor: row.cat.bgColor }}>{row.cat.emoji}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-[14px] font-medium dark:text-white truncate">{row.cat.label}</p>
                              <p className="text-[12px] text-gray-400 dark:text-gray-500 ml-2 flex-shrink-0">
                                {formatAmount(row.actual, base)} / {formatAmount(row.budgeted, base)}
                              </p>
                            </div>
                            <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${pctColor(row.pct)}`}
                                style={{ width: `${Math.min(row.pct ?? 0, 100)}%` }} />
                            </div>
                          </div>
                          {row.pct !== null && row.pct >= 100 && (
                            <span className="text-[11px] font-bold text-red-500 flex-shrink-0 ml-1">
                              +{(row.pct - 100).toFixed(0)}%
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {rows.filter(r => r.fixed === 0).length > 0 && (
                  <>
                    <p className="section-header">✏️ Dépenses estimées</p>
                    <div className="card mx-4 overflow-hidden">
                      {rows.filter(r => r.fixed === 0).map((row, i, arr) => (
                        <button key={row.cat.id} onClick={() => openEdit(row.cat.id)}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left
                            ${i < arr.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''}`}>
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                            style={{ backgroundColor: row.cat.bgColor }}>{row.cat.emoji}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-[14px] font-medium dark:text-white truncate">{row.cat.label}</p>
                              <p className="text-[12px] text-gray-400 dark:text-gray-500 ml-2 flex-shrink-0">
                                {formatAmount(row.actual, base)}{row.budgeted > 0 ? ` / ${formatAmount(row.budgeted, base)}` : ''}
                              </p>
                            </div>
                            {row.budgeted > 0 ? (
                              <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${pctColor(row.pct)}`}
                                  style={{ width: `${Math.min(row.pct ?? 0, 100)}%` }} />
                              </div>
                            ) : (
                              <p className="text-[11px] text-gray-300 dark:text-gray-600">Non budgétisé</p>
                            )}
                          </div>
                          {row.pct !== null && row.pct >= 100 && (
                            <span className="text-[11px] font-bold text-red-500 flex-shrink-0 ml-1">
                              +{(row.pct - 100).toFixed(0)}%
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {/* Unbudgeted actual */}
                {(() => {
                  const unbudgeted = CATEGORIES.filter(c =>
                    (actualByCategory[c.id] ?? 0) > 0 && !(budget?.items.some(i => i.categoryId === c.id))
                  )
                  if (!unbudgeted.length) return null
                  return (
                    <>
                      <p className="section-header">⚠️ Hors budget</p>
                      <div className="card mx-4 overflow-hidden">
                        {unbudgeted.map((cat, i) => (
                          <button key={cat.id} onClick={() => openEdit(cat.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-left
                              ${i < unbudgeted.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''}`}>
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                              style={{ backgroundColor: cat.bgColor }}>{cat.emoji}</div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[14px] font-medium dark:text-white">{cat.label}</p>
                              <p className="text-[11px] text-gray-400 dark:text-gray-500">Non planifié</p>
                            </div>
                            <p className="text-[14px] font-semibold text-orange-500 flex-shrink-0">
                              {formatAmount(actualByCategory[cat.id], base)}
                            </p>
                          </button>
                        ))}
                      </div>
                    </>
                  )
                })()}
              </>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB: ÉCARTS
        ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'ecarts' && (
          <>
            {deviationRows.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center px-8">
                <span className="text-4xl mb-3">🎯</span>
                <p className="text-[16px] font-semibold dark:text-white mb-1">Aucun budget défini</p>
                <p className="text-[13px] text-gray-400 dark:text-gray-500">
                  Définissez des budgets dans Planifier pour voir les écarts
                </p>
              </div>
            ) : (
              <>
                {deviationRows.filter(r => r.deviation > 0).length > 0 && (
                  <>
                    <p className="section-header text-red-500">▲ Dépassements</p>
                    <div className="card mx-4 overflow-hidden">
                      {deviationRows.filter(r => r.deviation > 0).map((r, i, arr) => (
                        <div key={r.cat.id}
                          className={`flex items-center gap-3 px-4 py-3 ${i < arr.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''}`}>
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                            style={{ backgroundColor: r.cat.bgColor }}>{r.cat.emoji}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[14px] font-medium dark:text-white">{r.cat.label}</p>
                            <p className="text-[11px] text-gray-400 dark:text-gray-500">
                              {formatAmount(r.actual, base)} sur {formatAmount(r.budgeted, base)} prévus
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-[14px] font-bold text-red-500">+{formatAmount(r.deviation, base)}</p>
                            <p className="text-[11px] text-red-400">+{((r.deviation / r.budgeted) * 100).toFixed(0)}%</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {deviationRows.filter(r => r.deviation <= 0).length > 0 && (
                  <>
                    <p className="section-header text-green-600">▼ Dans le budget</p>
                    <div className="card mx-4 overflow-hidden">
                      {deviationRows.filter(r => r.deviation <= 0).map((r, i, arr) => (
                        <div key={r.cat.id}
                          className={`flex items-center gap-3 px-4 py-3 ${i < arr.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''}`}>
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                            style={{ backgroundColor: r.cat.bgColor }}>{r.cat.emoji}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[14px] font-medium dark:text-white">{r.cat.label}</p>
                            <p className="text-[11px] text-gray-400 dark:text-gray-500">
                              {formatAmount(r.actual, base)} sur {formatAmount(r.budgeted, base)} prévus
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-[14px] font-bold text-green-600">
                              {r.deviation === 0 ? '—' : formatAmount(r.deviation, base)}
                            </p>
                            {r.deviation < 0 && (
                              <p className="text-[11px] text-green-500">
                                {((r.deviation / r.budgeted) * 100).toFixed(0)}%
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB: GRAPHIQUE
        ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'graphique' && (
          <>
            {rows.filter(r => r.budgeted > 0).length > 0 ? (
              <>
                <p className="section-header">Budget vs Réel — {longMonth(month)}</p>
                <div className="card mx-4 p-4">
                  <ResponsiveContainer width="100%" height={Math.max(rows.filter(r => r.budgeted > 0).length * 36, 160)}>
                    <BarChart layout="vertical"
                      data={rows.filter(r => r.budgeted > 0).map(r => ({
                        name: r.cat.label, Budget: Math.round(r.budgeted), Réel: Math.round(r.actual),
                      }))}
                      margin={{ top: 0, right: 10, left: 10, bottom: 0 }} barSize={8} barGap={2}>
                      <XAxis type="number" tick={{ fontSize: 9, fill: isDark ? '#6b7280' : '#9ca3af' }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: isDark ? '#d1d5db' : '#374151' }} axisLine={false} tickLine={false} width={80} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v} ${base}`, '']}
                        cursor={{ fill: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="Budget" fill="#93c5fd" radius={[0, 3, 3, 0]} />
                      <Bar dataKey="Réel" radius={[0, 3, 3, 0]}>
                        {rows.filter(r => r.budgeted > 0).map((r, i) => (
                          <Cell key={i} fill={r.actual > r.budgeted ? '#f87171' : '#4ade80'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center py-12 text-center px-8">
                <span className="text-4xl mb-3">📈</span>
                <p className="text-[16px] font-semibold dark:text-white mb-1">Aucun budget à afficher</p>
                <p className="text-[13px] text-gray-400 dark:text-gray-500 mb-4">
                  Définissez des budgets dans l'onglet Planifier
                </p>
                <button onClick={() => setActiveTab('planifier')}
                  className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-medium text-[14px]">
                  Aller à Planifier
                </button>
              </div>
            )}

            {chartData.some(d => d.budgeted > 0 || d.actual > 0) && (
              <>
                <div className="flex items-center justify-between mx-4 mt-4 mb-1">
                  <p className="section-header !mt-0 !mb-0">Évolution budget</p>
                  <div className="flex gap-1">
                    {([3, 6, 12] as const).map(r => (
                      <button key={r} onClick={() => setChartRange(r)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors
                          ${chartRange === r
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
                        {r}M
                      </button>
                    ))}
                  </div>
                </div>
                <div className="card mx-4 p-4">
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }} barSize={8} barGap={2}>
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: isDark ? '#6b7280' : '#9ca3af' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: isDark ? '#6b7280' : '#9ca3af' }} axisLine={false} tickLine={false}
                        tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                      <Tooltip contentStyle={tooltipStyle}
                        cursor={{ fill: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }}
                        formatter={(v: number, n: string) => [`${v} ${base}`, n]} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="budgeted" name="Budget" fill="#93c5fd" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="actual"   name="Réel"   fill="#f87171" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </>
        )}

        <div className="h-4" />
      </div>

      {/* ── Income modal ───────────────────────────────────────────────────── */}
      {editingIncome && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
          onClick={e => e.target === e.currentTarget && setEditingIncome(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-t-3xl w-full p-6"
            style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl bg-green-100">💰</div>
              <div>
                <p className="text-[17px] font-bold dark:text-white">Revenus prévus</p>
                <p className="text-[12px] text-gray-400 dark:text-gray-500">
                  {personTabs.find(p2 => p2.id === person)?.label} · {longMonth(month)} {year}
                </p>
                {actualIncome > 0 && (
                  <p className="text-[12px] text-green-600">Réel : {formatAmount(actualIncome, base)}</p>
                )}
              </div>
            </div>
            <p className="text-[13px] text-gray-400 dark:text-gray-500 mb-1">Montant estimé ({base})</p>
            <input
              type="text" inputMode="decimal" placeholder="0"
              value={incomeInput}
              onChange={e => setIncomeInput(e.target.value)}
              autoFocus
              className="w-full text-[32px] font-bold outline-none bg-transparent dark:text-white mb-4 border-b-2 border-green-500 pb-1"
            />
            <div className="flex gap-3">
              <button onClick={() => setEditingIncome(false)}
                className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-medium">
                Annuler
              </button>
              <button onClick={() => {
                const n = parseFloat(incomeInput.replace(',', '.'))
                setIncome(year, month, person, isNaN(n) ? 0 : n)
                setEditingIncome(false)
              }}
                className="flex-1 py-3 bg-green-600 text-white rounded-xl font-semibold">
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit modal ─────────────────────────────────────────────────────── */}
      {editCat && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
          onClick={e => e.target === e.currentTarget && setEditCat(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-t-3xl w-full p-6"
            style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}>
            {(() => {
              const cat       = CATEGORY_MAP[editCat]
              const actual    = actualByCategory[editCat] ?? 0
              const suggested = fixedByCategory[editCat] ?? 0
              const lines     = fixedLinesByCategory[editCat] ?? []
              return (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                      style={{ backgroundColor: cat.bgColor }}>{cat.emoji}</div>
                    <div>
                      <p className="text-[17px] font-bold dark:text-white">{cat.label}</p>
                      <div className="flex gap-3 mt-0.5 flex-wrap">
                        {actual > 0 && <p className="text-[12px] text-gray-400 dark:text-gray-500">Réel : {formatAmount(actual, base)}</p>}
                        {suggested > 0 && <p className="text-[12px] text-blue-500">🔒 Rec. : {formatAmount(suggested, base)}</p>}
                      </div>
                      {lines.map((l, li) => (
                        <p key={li} className="text-[11px] text-gray-400 dark:text-gray-500">{l.title} · {formatAmount(l.amount, base)}</p>
                      ))}
                    </div>
                  </div>

                  {suggested > 0 && (
                    <button onClick={() => setEditAmount(String(Math.round(suggested)))}
                      className="w-full py-2 mb-3 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 rounded-xl text-[13px] font-medium">
                      Utiliser le montant récurrent · {formatAmount(suggested, base)}
                    </button>
                  )}

                  <p className="text-[13px] text-gray-400 dark:text-gray-500 mb-1">Budget mensuel ({base})</p>
                  <input type="text" inputMode="decimal" placeholder="0" value={editAmount}
                    onChange={e => setEditAmount(e.target.value)} autoFocus
                    className="w-full text-[32px] font-bold outline-none bg-transparent dark:text-white mb-4 border-b-2 border-blue-600 pb-1" />
                  <div className="flex gap-3">
                    <button onClick={() => setEditCat(null)}
                      className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-medium">
                      Annuler
                    </button>
                    <button onClick={saveEdit}
                      className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold">
                      Enregistrer
                    </button>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
