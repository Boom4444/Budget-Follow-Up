import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts'
import { useStore } from '../store/useStore'
import { CATEGORY_MAP, getCategoryMeta, getActiveCategories } from '../data/categories'
import { CURRENCIES, CURRENCY_MAP } from '../data/currencies'
import { formatAmount, formatPercent } from '../utils/formatters'
import { currentYear, shortMonth, longMonth } from '../utils/dates'
import { personShareFraction } from '../utils/split'
import { computeBudgetTracking } from '../utils/budgetTracking'
import type { Expense, CurrencyCode } from '../models/types'
import AddExpenseModal from '../components/AddExpenseModal'
import SummaryStrip from '../components/SummaryStrip'
import type { StripFilter } from '../components/SummaryStrip'
import CategoryDrillDown from '../components/CategoryDrillDown'

export default function DashboardScreen() {
  const { expenses, budgets, settings, updateExpense } = useStore()
  const customCategories = settings.customCategories ?? []
  const sortedCategories = useMemo(
    () => getActiveCategories(customCategories, settings.deletedBuiltinCategories),
    [customCategories, settings.deletedBuiltinCategories]  // eslint-disable-line react-hooks/exhaustive-deps
  )
  const base = settings.baseCurrency

  const [year, setYear] = useState(currentYear())
  const [month, setMonth] = useState<number | null>(null)
  const [filterPerson, setFilterPerson] = useState<'all' | 'person1' | 'person2' | 'shared'>('all')
  const [viewCurrency, setViewCurrency] = useState<'all' | CurrencyCode>('all')
  const [chartRange, setChartRange] = useState<6 | 12 | 24>(12)
  const [showAdd, setShowAdd] = useState(false)
  const [showAddRevenu, setShowAddRevenu] = useState(false)
  const [selectedCat, setSelectedCat] = useState<string | null>(null)
  const [stripFilter, setStripFilter] = useState<StripFilter>('all')
  const [drillCatId, setDrillCatId] = useState<string | null>(null)

  const NOW = currentYear()
  const isDark = document.documentElement.classList.contains('dark')

  const tooltipStyle = {
    borderRadius: 8, border: 'none',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    fontSize: 12,
    background: isDark ? '#1f2937' : '#fff',
    color: isDark ? '#f9fafb' : '#111827',
  }

  // Currencies that actually appear in expense data
  const availableCurrencies = useMemo(() => {
    const seen = new Set<CurrencyCode>()
    expenses.forEach(e => seen.add(e.currency))
    return CURRENCIES.filter(c => seen.has(c.code))
  }, [expenses])

  const showCurrencyFilter = availableCurrencies.length > 1

  // Display currency and symbol
  const displayCurr: CurrencyCode = viewCurrency === 'all' ? base : viewCurrency
  const sym = CURRENCY_MAP[displayCurr]?.symbol ?? displayCurr

  // Fraction of an expense counted in the current person filter. Shared
  // expenses are split between the two persons (per their ratio or the
  // monthly income proration) instead of disappearing from personal views.
  function shareWeight(e: Expense): number {
    if (filterPerson === 'all') return 1
    if (filterPerson === 'shared') return e.person === 'shared' ? 1 : 0
    return personShareFraction(e, filterPerson, budgets, settings)
  }

  // Amount accessor: native currency amount or base-converted, weighted by
  // the person filter (a shared 50/50 expense counts half in a personal view)
  const getAmt = (e: Expense) => (viewCurrency === 'all' ? e.amountInBase : e.amount) * shareWeight(e)

  // Per-person share (accounts for split ratio / income proration on shared expenses)
  function personShareAmt(e: Expense, person: 'person1' | 'person2'): number {
    if (e.type !== 'debit') return 0
    const amt = viewCurrency === 'all' ? e.amountInBase : e.amount
    return amt * personShareFraction(e, person, budgets, settings)
  }

  // Base filter: year + month + person (shared expenses stay visible in
  // personal views since each person bears a part of them)
  const filtered = useMemo(() => expenses.filter(e => {
    const ey = parseInt(e.date.slice(0, 4))
    const em = parseInt(e.date.slice(5, 7))
    if (ey !== year) return false
    if (month !== null && em !== month) return false
    if (filterPerson !== 'all' && shareWeight(e) === 0) return false
    return true
  }), [expenses, year, month, filterPerson, budgets, settings])  // eslint-disable-line react-hooks/exhaustive-deps

  // Currency filter on top of base filter
  const filteredCurr = useMemo(() =>
    viewCurrency === 'all' ? filtered : filtered.filter(e => e.currency === viewCurrency)
  , [filtered, viewCurrency])

  // Unclassified expenses (À classer) — shown in dedicated section, excluded from charts
  const unclassified = useMemo(
    () => filtered.filter(e => e.category === 'a_classer'),
    [filtered]
  )

  const debits         = filteredCurr.filter(e => e.type === 'debit')
  // Only explicit income (category 'revenus') counts as revenue in the dashboard
  const revenusCredits = filteredCurr.filter(e => e.type === 'credit' && e.category === 'revenus')

  const totalDepenses = debits.reduce((s, e) => s + getAmt(e), 0)
  const totalRevenus  = revenusCredits.reduce((s, e) => s + getAmt(e), 0)
  const solde         = totalRevenus - totalDepenses
  const totalFixed    = debits.filter(e => e.isFixed).reduce((s, e) => s + getAmt(e), 0)
  const totalVariable = totalDepenses - totalFixed
  const totalP1       = debits.reduce((s, e) => s + personShareAmt(e, 'person1'), 0)
  const totalP2       = debits.reduce((s, e) => s + personShareAmt(e, 'person2'), 0)
  const sharedP1      = debits.filter(e => e.person === 'shared').reduce((s, e) => s + personShareAmt(e, 'person1'), 0)
  const sharedP2      = debits.filter(e => e.person === 'shared').reduce((s, e) => s + personShareAmt(e, 'person2'), 0)

  // Strip-filtered subsets
  const stripDebits = filteredCurr.filter(e => {
    if (e.type !== 'debit') return false
    if (stripFilter === 'fixed') return e.isFixed
    return stripFilter !== 'credit'
  })
  // Only 'revenus' category credits shown in the revenue strip view
  const stripCredits = filteredCurr.filter(e =>
    e.type === 'credit' && e.category === 'revenus' &&
    stripFilter !== 'debit' && stripFilter !== 'fixed'
  )

  const relevantTotal = stripFilter === 'credit'
    ? stripCredits.reduce((s, e) => s + getAmt(e), 0)
    : stripDebits.reduce((s, e) => s + getAmt(e), 0)

  const stripLabel = stripFilter === 'credit' ? 'Revenus'
    : stripFilter === 'fixed' ? 'Récurrents'
    : stripFilter === 'debit' ? 'Sorties'
    : 'Total dépenses'

  // Rolling window chart: last chartRange months from today
  const monthlyData = useMemo(() => {
    const result: { name: string; fixed: number; variable: number; revenus: number }[] = []
    const now = new Date()
    let y = now.getFullYear()
    let m = now.getMonth() + 1

    for (let i = 0; i < chartRange; i++) {
      const mes = expenses.filter(e => {
        const ey = parseInt(e.date.slice(0, 4))
        const em = parseInt(e.date.slice(5, 7))
        return ey === y && em === m &&
          (filterPerson === 'all' || shareWeight(e) > 0) &&
          (viewCurrency === 'all' || e.currency === viewCurrency)
      })
      const debitMes  = mes.filter(e => e.type === 'debit')
      const creditMes = mes.filter(e => e.type === 'credit' && e.category === 'revenus')
      const a = (e: Expense) => (viewCurrency === 'all' ? e.amountInBase : e.amount) * shareWeight(e)
      result.unshift({
        name: chartRange > 12 ? `${shortMonth(m)}'${String(y).slice(2)}` : shortMonth(m),
        fixed:    Math.round(debitMes.filter(e => e.isFixed).reduce((s, e) => s + a(e), 0)),
        variable: Math.round(debitMes.filter(e => !e.isFixed).reduce((s, e) => s + a(e), 0)),
        revenus:  Math.round(creditMes.reduce((s, e) => s + a(e), 0)),
      })
      if (m === 1) { y--; m = 12 } else { m-- }
    }
    return result
  }, [expenses, chartRange, filterPerson, viewCurrency, budgets, settings])  // eslint-disable-line react-hooks/exhaustive-deps

  // Category data based on strip filter
  const catSourceData = stripFilter === 'credit' ? stripCredits : stripDebits
  const catTotal = stripFilter === 'credit' ? relevantTotal : relevantTotal

  const catData = useMemo(() => {
    const map: Record<string, number> = {}
    // exclude 'a_classer' — shown in its own section
    catSourceData
      .filter(e => e.category !== 'a_classer')
      .forEach(e => { map[e.category] = (map[e.category] ?? 0) + getAmt(e) })
    return Object.entries(map)
      .map(([id, val]) => ({
        id,
        label: CATEGORY_MAP[id as keyof typeof CATEGORY_MAP]?.label ?? id,
        value: val,
        color: CATEGORY_MAP[id as keyof typeof CATEGORY_MAP]?.color ?? '#666',
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [catSourceData, viewCurrency]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Budget tracking (month or whole year, per person filter) ──────────────
  // Foyer budget items and shared expenses are split between the two persons
  // in personal views (50/50 or income proration, per settings/expense).
  // Always computed in the base currency — budgets are stored in base.
  const budgetTracking = useMemo(() => {
    const tracking = computeBudgetTracking(expenses, budgets, settings, year, month, filterPerson)
    if (!tracking) return null
    return {
      ...tracking,
      rows: tracking.rows.map(r => ({ ...r, meta: getCategoryMeta(r.id, customCategories) })),
    }
  }, [expenses, budgets, settings, year, month, filterPerson, customCategories])

  const fmt = (v: number) => v === 0 ? '' : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)

  return (
    <div className="flex flex-col h-full"
         style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      {/* Nav */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700 px-4 pt-3 pb-0 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-[22px] font-bold dark:text-white">Tableau de bord</h1>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowAddRevenu(true)}
              title="Ajouter un revenu"
              className="h-9 px-3 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center gap-1.5 text-green-700 dark:text-green-400 text-[13px] font-semibold shadow-sm">
              💰 Revenu
            </button>
            <button onClick={() => setShowAdd(true)}
              className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center text-white text-xl font-light shadow-sm">
              +
            </button>
          </div>
        </div>

        {/* Year nav */}
        <div className="flex items-center justify-center gap-6 mb-3">
          <button onClick={() => setYear(y => y - 1)} className="text-blue-600 text-2xl px-2">‹</button>
          <span className="text-[17px] font-bold w-16 text-center dark:text-white">{year}</span>
          <button onClick={() => setYear(y => Math.min(y + 1, NOW))}
            className={`text-2xl px-2 ${year >= NOW ? 'text-gray-200 dark:text-gray-600' : 'text-blue-600'}`}>›</button>
        </div>

        {/* Month chips */}
        <div className="flex gap-1.5 overflow-x-auto pb-3 no-scrollbar">
          {[null, 1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
            <button key={m ?? 'all'} onClick={() => setMonth(m)}
              className={`px-3 py-1 rounded-full text-[13px] font-medium whitespace-nowrap flex-shrink-0 transition-colors
                ${month === m
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
              {m === null ? 'Année' : shortMonth(m)}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Strip — sticky below nav */}
      <SummaryStrip
        entries={totalRevenus}
        sorties={totalDepenses}
        recurrents={totalFixed}
        active={stripFilter}
        onSelect={setStripFilter}
        currency={displayCurr}
      />

      <div className="flex-1 overflow-y-auto scroll-ios pb-6">

        {/* Person filter */}
        <div className="flex gap-2 px-4 mt-4 flex-wrap">
          {[
            { v: 'all', label: '👥 Foyer' },
            { v: 'person1', label: settings.person1Name },
            { v: 'person2', label: settings.person2Name },
            { v: 'shared', label: 'Commun' },
          ].map(opt => (
            <button key={opt.v} onClick={() => setFilterPerson(opt.v as typeof filterPerson)}
              className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors
                ${filterPerson === opt.v
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600'}`}>
              {opt.label}
            </button>
          ))}
        </div>

        {/* Currency filter (only shown when multiple currencies present) */}
        {showCurrencyFilter && (
          <div className="flex gap-1.5 overflow-x-auto px-4 mt-2 pb-1 no-scrollbar">
            <button
              onClick={() => setViewCurrency('all')}
              className={`px-3 py-1 rounded-full text-[12px] font-medium whitespace-nowrap flex-shrink-0 transition-colors
                ${viewCurrency === 'all'
                  ? 'bg-violet-600 text-white'
                  : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600'}`}>
              Toutes devises
            </button>
            {availableCurrencies.map(c => (
              <button key={c.code}
                onClick={() => setViewCurrency(viewCurrency === c.code ? 'all' : c.code)}
                className={`px-3 py-1 rounded-full text-[12px] font-medium whitespace-nowrap flex-shrink-0 transition-colors
                  ${viewCurrency === c.code
                    ? 'bg-violet-600 text-white'
                    : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600'}`}>
                {c.flag} {c.code}
              </button>
            ))}
          </div>
        )}

        {/* À classer — alert section */}
        {unclassified.length > 0 && (
          <div className="mx-4 mt-4 rounded-2xl overflow-hidden border border-amber-200 dark:border-amber-800">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-amber-50 dark:bg-amber-950/40">
              <div>
                <p className="text-[14px] font-semibold text-amber-700 dark:text-amber-400">
                  🏷️ {unclassified.length} transaction{unclassified.length > 1 ? 's' : ''} à classer
                </p>
                <p className="text-[11px] text-amber-600 dark:text-amber-500">
                  {formatAmount(
                    unclassified.filter(e => e.type === 'debit').reduce((s, e) => s + getAmt(e), 0),
                    displayCurr
                  )} non catégorisés — sélectionner une catégorie pour classer
                </p>
              </div>
            </div>
            {/* Transaction rows */}
            <div className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
              {unclassified.map(e => {
                const isCredit = e.type === 'credit'
                return (
                  <div key={e.id} className="flex items-center gap-2 px-4 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium truncate dark:text-white">{e.title}</p>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500">{e.date}{e.bank ? ` · ${e.bank}` : ''}</p>
                    </div>
                    <span className={`text-[13px] font-semibold shrink-0 ${isCredit ? 'text-green-600' : 'text-red-500'}`}>
                      {isCredit ? '+' : '-'}{formatAmount(e.amount, e.currency as CurrencyCode)}
                    </span>
                    <select
                      value=""
                      onChange={ev => {
                        const newCat = ev.target.value
                        if (!newCat) return
                        const meta = getCategoryMeta(newCat, customCategories)
                        updateExpense(e.id, {
                          category: newCat,
                          subCategory: meta?.subCategories[0] ?? '',
                        })
                      }}
                      className="text-[12px] text-blue-600 font-medium outline-none bg-transparent shrink-0 max-w-[100px]"
                    >
                      <option value="">Classer…</option>
                      {sortedCategories
                        .filter(c => c.id !== 'a_classer')
                        .map(c => (
                          <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>
                        ))}
                    </select>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Solde card — simplified */}
        <div className="mx-4 mt-3 card p-4">
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-1">
            {month !== null ? `${longMonth(month)} ${year}` : `Solde ${year}`}
            {viewCurrency !== 'all' && (
              <span className="ml-2 text-violet-500 font-medium">· {viewCurrency} seulement</span>
            )}
          </p>
          <p className={`text-[34px] font-bold tracking-tight ${solde >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {solde >= 0 ? '+' : ''}{solde.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} {sym}
          </p>
          <div className="flex gap-4 mt-2">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-red-400 inline-block"></span>
              <span className="text-[12px] text-gray-500 dark:text-gray-400">{formatAmount(totalDepenses, displayCurr)} dépenses</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-green-400 inline-block"></span>
              <span className="text-[12px] text-gray-500 dark:text-gray-400">{formatAmount(totalRevenus, displayCurr)} revenus</span>
            </div>
          </div>
        </div>

        {/* Summary cards */}
        <div className="px-4 mt-3 grid grid-cols-2 gap-3">
          <div className="card p-3">
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-1">💸 Dépenses</p>
            <p className="text-[18px] font-bold text-red-500">{formatAmount(totalDepenses, displayCurr)}</p>
          </div>
          <div className="card p-3">
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-1">💰 Revenus</p>
            <p className="text-[18px] font-bold text-green-600">{formatAmount(totalRevenus, displayCurr)}</p>
          </div>
          <div className="card p-3">
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-1">🔒 Incompressible</p>
            <p className="text-[18px] font-bold text-orange-500">{formatAmount(totalFixed, displayCurr)}</p>
            {totalDepenses > 0 && <p className="text-[11px] text-gray-400 dark:text-gray-500">{formatPercent(totalFixed, totalDepenses)} des dépenses</p>}
          </div>
          <div className="card p-3">
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-1">📈 Variable</p>
            <p className="text-[18px] font-bold text-blue-500">{formatAmount(totalVariable, displayCurr)}</p>
            {totalDepenses > 0 && <p className="text-[11px] text-gray-400 dark:text-gray-500">{formatPercent(totalVariable, totalDepenses)} des dépenses</p>}
          </div>
        </div>

        {/* Per-person cards */}
        <div className="px-4 mt-3 grid grid-cols-2 gap-3">
          <div className="card p-3">
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-1">👤 {settings.person1Name}</p>
            <p className="text-[18px] font-bold dark:text-white">{formatAmount(totalP1, displayCurr)}</p>
            {sharedP1 > 0 && <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">dont {formatAmount(sharedP1, displayCurr)} commun</p>}
          </div>
          <div className="card p-3">
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-1">👤 {settings.person2Name}</p>
            <p className="text-[18px] font-bold dark:text-white">{formatAmount(totalP2, displayCurr)}</p>
            {sharedP2 > 0 && <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">dont {formatAmount(sharedP2, displayCurr)} commun</p>}
          </div>
        </div>

        {/* Budget tracking */}
        {budgetTracking && (() => {
          const { rows, totalBudgeted, totalActual, offBudget } = budgetTracking
          const pct = totalBudgeted > 0 ? (totalActual / totalBudgeted) * 100 : 0
          const barColor = (p: number) => p >= 100 ? 'bg-red-500' : p >= 80 ? 'bg-orange-400' : 'bg-green-500'
          const shown = rows.slice(0, 6)
          return (
            <div className="card mx-4 mt-4 p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[15px] font-semibold dark:text-white">🎯 Suivi du budget</p>
                <p className="text-[12px] text-gray-400 dark:text-gray-500">
                  {month !== null ? `${longMonth(month)} ${year}` : `Année ${year}`}
                </p>
              </div>
              {filterPerson === 'person1' || filterPerson === 'person2' ? (
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-2">
                  Inclut la part du budget foyer ({settings.sharedSplitMode === 'income' ? 'prorata des revenus' : '50/50'})
                </p>
              ) : <div className="mb-2" />}
              {/* Global bar */}
              <div className="flex items-baseline justify-between mb-1">
                <span className={`text-[20px] font-bold ${totalActual > totalBudgeted ? 'text-red-500' : 'dark:text-white'}`}>
                  {formatAmount(totalActual, base)}
                </span>
                <span className="text-[13px] text-gray-400 dark:text-gray-500">
                  sur {formatAmount(totalBudgeted, base)} · {pct.toFixed(0)}%
                </span>
              </div>
              <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden mb-3">
                <div className={`h-full rounded-full transition-all ${barColor(pct)}`}
                  style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
              {/* Per-category bars */}
              <div className="space-y-2">
                {shown.map(r => {
                  const rPct = r.budgeted > 0 ? (r.actual / r.budgeted) * 100 : 0
                  return (
                    <div key={r.id}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[12px] text-gray-600 dark:text-gray-300 truncate">
                          {r.meta?.emoji ?? '📦'} {r.meta?.label ?? r.id}
                        </span>
                        <span className={`text-[11px] ${r.actual > r.budgeted ? 'text-red-500 font-semibold' : 'text-gray-400 dark:text-gray-500'}`}>
                          {formatAmount(r.actual, base)} / {formatAmount(r.budgeted, base)}
                        </span>
                      </div>
                      <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${barColor(rPct)}`}
                          style={{ width: `${Math.min(rPct, 100)}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
              {rows.length > shown.length && (
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-2">
                  + {rows.length - shown.length} autres catégories budgétisées (voir l'onglet Budget)
                </p>
              )}
              {offBudget > 0 && (
                <p className="text-[11px] text-orange-500 mt-2">
                  ⚠️ {formatAmount(offBudget, base)} dépensés hors catégories budgétisées
                </p>
              )}
            </div>
          )
        })()}

        {/* Category donut chart with centered label */}
        {catData.length > 0 && (
          <div className="card mx-4 mt-4 p-4">
            <p className="text-[15px] font-semibold mb-3 dark:text-white">
              {stripFilter === 'credit' ? 'Revenus par catégorie' : 'Dépenses par catégorie'}
            </p>
            <div className="relative">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={catData} dataKey="value" nameKey="label" cx="50%" cy="50%"
                    innerRadius="58%" outerRadius="82%"
                    onClick={d => setSelectedCat(selectedCat === d.id ? null : d.id)}>
                    {catData.map(entry => (
                      <Cell key={entry.id} fill={entry.color}
                        opacity={selectedCat === null || selectedCat === entry.id ? 1 : 0.3} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle}
                    formatter={(v: number) => [`${v.toFixed(0)} ${sym}`, '']}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Centered label */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <p className="text-[24px] font-bold dark:text-white">
                    {relevantTotal.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} {sym}
                  </p>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500">{stripLabel}</p>
                </div>
              </div>
            </div>

            <div className="space-y-1 mt-1">
              {catData.map(c => (
                <button key={c.id}
                  className="w-full flex items-center gap-2 text-left py-1 rounded-xl transition-colors active:bg-gray-50 dark:active:bg-gray-700"
                  onClick={() => setDrillCatId(c.id)}>
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c.color }} />
                  <span className="text-[13px] text-gray-700 dark:text-gray-200 flex-1 truncate">{c.label}</span>
                  <span className="text-[12px] text-gray-400 dark:text-gray-500">{formatPercent(c.value, catTotal)}</span>
                  <span className="text-[13px] font-semibold dark:text-white">{formatAmount(c.value, displayCurr)}</span>
                  <span className="text-gray-300 dark:text-gray-600 text-[16px]">›</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Monthly bar chart with range selector */}
        {monthlyData.some(d => d.fixed + d.variable + d.revenus > 0) && (
          <div className="card mx-4 mt-4 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[15px] font-semibold dark:text-white">Évolution mensuelle</p>
              <div className="flex gap-1">
                {([6, 12, 24] as const).map(r => (
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
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={monthlyData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }} barSize={5} barGap={1} barCategoryGap={4}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: isDark ? '#6b7280' : '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: isDark ? '#6b7280' : '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={fmt} />
                <Tooltip contentStyle={tooltipStyle}
                  cursor={{ fill: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }}
                  formatter={(v: number, name: string) => [
                    `${v} ${sym}`,
                    name === 'fixed' ? 'Incompressible' : name === 'variable' ? 'Variable' : 'Revenus',
                  ]}
                />
                <Bar dataKey="fixed"    stackId="debits" fill="#f87171" radius={[0, 0, 2, 2]} />
                <Bar dataKey="variable" stackId="debits" fill="#60a5fa" radius={[2, 2, 0, 0]} />
                <Bar dataKey="revenus"  stackId="rev"    fill="#4ade80" radius={[2, 2, 2, 2]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 mt-2 flex-wrap">
              <span className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400"><span className="w-3 h-2 rounded-sm bg-red-400 inline-block" /> Incompressible</span>
              <span className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400"><span className="w-3 h-2 rounded-sm bg-blue-400 inline-block" /> Variable</span>
              <span className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400"><span className="w-3 h-2 rounded-sm bg-green-400 inline-block" /> Revenus</span>
            </div>
          </div>
        )}

        {/* Empty state */}
        {filteredCurr.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
            <span className="text-5xl mb-4">📊</span>
            <p className="text-[17px] font-semibold text-gray-700 dark:text-gray-200 mb-1">Aucune dépense</p>
            <p className="text-[14px] text-gray-400 dark:text-gray-500 mb-4">Commencez à saisir vos dépenses</p>
            <button onClick={() => setShowAdd(true)}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-medium text-[15px]">
              Ajouter une dépense
            </button>
          </div>
        )}
      </div>

      {showAdd && <AddExpenseModal onClose={() => setShowAdd(false)} />}
      {showAddRevenu && (
        <AddExpenseModal
          onClose={() => setShowAddRevenu(false)}
          prefill={{ type: 'credit', category: 'revenus', subCategory: 'Salaire' }}
        />
      )}

      {drillCatId && (
        <CategoryDrillDown
          catId={drillCatId}
          year={year}
          month={month}
          filterPerson={filterPerson}
          baseCurrency={displayCurr}
          onClose={() => setDrillCatId(null)}
        />
      )}
    </div>
  )
}
