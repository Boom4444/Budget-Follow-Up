import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Cell,
} from 'recharts'
import { useStore } from '../store/useStore'
import { CATEGORIES, CATEGORY_MAP } from '../data/categories'
import { formatAmount } from '../utils/formatters'
import { currentYear, currentMonth, longMonth } from '../utils/dates'
import type { CategoryId } from '../models/types'

// ── helpers ───────────────────────────────────────────────────────────────────

function monthKey(y: number, m: number) {
  return `${y}-${String(m).padStart(2, '0')}`
}

function prevMonth(y: number, m: number) {
  return m === 1 ? { year: y - 1, month: 12 } : { year: y, month: m - 1 }
}

function nextMonth(y: number, m: number) {
  return m === 12 ? { year: y + 1, month: 1 } : { year: y, month: m + 1 }
}

// ── component ─────────────────────────────────────────────────────────────────

export default function BudgetScreen() {
  const { expenses, budgets, settings, setBudgetItem, setBudgetItems, copyBudget } = useStore()
  const base = settings.baseCurrency

  const [year, setYear]   = useState(currentYear())
  const [month, setMonth] = useState(currentMonth())
  const [editCat, setEditCat] = useState<CategoryId | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [activeTab, setActiveTab] = useState<'categories' | 'deviations' | 'chart'>('categories')

  const isDark = document.documentElement.classList.contains('dark')

  const budget = budgets.find(b => b.year === year && b.month === month)

  // All debit expenses for this month
  const monthExpenses = useMemo(() =>
    expenses.filter(e =>
      parseInt(e.date.slice(0, 4)) === year &&
      parseInt(e.date.slice(5, 7)) === month &&
      e.type === 'debit'
    ), [expenses, year, month])

  // Actual spend per category
  const actualByCategory = useMemo(() => {
    const map: Record<string, number> = {}
    monthExpenses.forEach(e => {
      map[e.category] = (map[e.category] ?? 0) + e.amountInBase
    })
    return map
  }, [monthExpenses])

  // Build per-category rows (all categories with either budget or actual > 0)
  const rows = useMemo(() =>
    CATEGORIES.map(cat => {
      const budgetItem = budget?.items.find(i => i.categoryId === cat.id)
      const budgeted = budgetItem?.amount ?? 0
      const actual = actualByCategory[cat.id] ?? 0
      const deviation = actual - budgeted
      const pct = budgeted > 0 ? Math.min((actual / budgeted) * 100, 999) : null
      return { cat, budgeted, actual, deviation, pct }
    }).filter(r => r.budgeted > 0 || r.actual > 0),
    [budget, actualByCategory]
  )

  const totalBudgeted = rows.reduce((s, r) => s + r.budgeted, 0)
  const totalActual   = rows.reduce((s, r) => s + r.actual,   0)
  const totalDev      = totalActual - totalBudgeted
  const globalPct     = totalBudgeted > 0 ? Math.min((totalActual / totalBudgeted) * 100, 100) : 0

  // Deviations: only where budgeted > 0, sorted by absolute deviation desc
  const deviationRows = rows
    .filter(r => r.budgeted > 0)
    .sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation))

  // Most recent previous month that has a budget (for copy feature)
  const prevMonthWithBudget = useMemo(() => {
    let { year: y, month: m } = prevMonth(year, month)
    for (let i = 0; i < 24; i++) {
      if (budgets.find(b => b.year === y && b.month === m)) return { year: y, month: m }
      const p = prevMonth(y, m)
      y = p.year; m = p.month
    }
    return null
  }, [budgets, year, month])

  // Chart data: last 6 months budget vs actual
  const chartData = useMemo(() => {
    const months: { year: number; month: number }[] = []
    let { year: y, month: m } = { year, month }
    for (let i = 0; i < 6; i++) {
      months.unshift({ year: y, month: m })
      const p = prevMonth(y, m)
      y = p.year; m = p.month
    }
    return months.map(({ year: y, month: m }) => {
      const b = budgets.find(bx => bx.year === y && bx.month === m)
      const budgeted = b?.items.reduce((s, i) => s + i.amount, 0) ?? 0
      const actual = expenses
        .filter(e =>
          parseInt(e.date.slice(0, 4)) === y &&
          parseInt(e.date.slice(5, 7)) === m &&
          e.type === 'debit'
        )
        .reduce((s, e) => s + e.amountInBase, 0)
      return { name: longMonth(m).slice(0, 4), budgeted: Math.round(budgeted), actual: Math.round(actual) }
    })
  }, [budgets, expenses, year, month])

  // ── Budget edit modal ────────────────────────────────────────────────────────
  function openEdit(catId: CategoryId) {
    const current = budget?.items.find(i => i.categoryId === catId)
    setEditAmount(current ? String(current.amount) : '')
    setEditCat(catId)
  }

  function saveEdit() {
    if (!editCat) return
    const n = parseFloat(editAmount.replace(',', '.'))
    setBudgetItem(year, month, editCat, isNaN(n) ? 0 : n)
    setEditCat(null)
  }

  // ── Auto-populate from recurring ─────────────────────────────────────────────
  const { recurring } = useStore()
  function populateFromRecurring() {
    const map: Record<string, number> = {}
    recurring.forEach(r => {
      map[r.category] = (map[r.category] ?? 0) + r.amount
    })
    const items = Object.entries(map).map(([categoryId, amount]) => ({
      categoryId: categoryId as CategoryId,
      amount: Math.round(amount),
    }))
    setBudgetItems(year, month, items)
  }

  // ── Progress bar color ────────────────────────────────────────────────────────
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

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>

      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700 px-4 py-3 flex-shrink-0">
        <h1 className="text-[22px] font-bold dark:text-white mb-2">Budget</h1>
        {/* Month nav */}
        <div className="flex items-center justify-between">
          <button onClick={() => { const p = prevMonth(year, month); setYear(p.year); setMonth(p.month) }}
            className="text-blue-600 text-2xl px-2">‹</button>
          <span className="text-[16px] font-semibold dark:text-white">
            {longMonth(month)} {year}
          </span>
          <button onClick={() => { const n = nextMonth(year, month); setYear(n.year); setMonth(n.month) }}
            className="text-blue-600 text-2xl px-2">›</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-ios pb-6">

        {/* Summary card */}
        {budget ? (
          <div className="card mx-4 mt-4 p-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="text-[11px] text-gray-400 dark:text-gray-500">Budget prévu</p>
                <p className="text-[20px] font-bold dark:text-white">{formatAmount(totalBudgeted, base)}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-gray-400 dark:text-gray-500">Dépenses réelles</p>
                <p className="text-[20px] font-bold dark:text-white">{formatAmount(totalActual, base)}</p>
              </div>
            </div>
            {/* Global progress bar */}
            <div className="h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden mb-2">
              <div
                className={`h-full rounded-full transition-all ${pctColor(totalBudgeted > 0 ? (totalActual / totalBudgeted) * 100 : null)}`}
                style={{ width: `${globalPct}%` }}
              />
            </div>
            <div className="flex justify-between items-center">
              <p className="text-[12px] text-gray-400 dark:text-gray-500">{globalPct.toFixed(0)}% utilisé</p>
              <p className={`text-[14px] font-semibold ${totalDev <= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {totalDev <= 0 ? '▼' : '▲'} {formatAmount(Math.abs(totalDev), base)}
                {totalDev <= 0 ? ' d\'économie' : ' de dépassement'}
              </p>
            </div>
          </div>
        ) : (
          /* Empty state: no budget set */
          <div className="card mx-4 mt-4 p-5">
            <p className="text-[16px] font-semibold dark:text-white mb-1">Aucun budget défini</p>
            <p className="text-[13px] text-gray-400 dark:text-gray-500 mb-4">
              Définissez un budget prévisionnel pour {longMonth(month)} {year}.
            </p>
            <div className="flex flex-col gap-2">
              {prevMonthWithBudget && (
                <button
                  onClick={() => copyBudget(prevMonthWithBudget.year, prevMonthWithBudget.month, year, month)}
                  className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-medium text-[14px]">
                  📋 Copier depuis {longMonth(prevMonthWithBudget.month)} {prevMonthWithBudget.year}
                </button>
              )}
              {recurring.length > 0 && (
                <button onClick={populateFromRecurring}
                  className="w-full py-2.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-xl font-medium text-[14px]">
                  🔄 Générer depuis les récurrentes
                </button>
              )}
              <p className="text-[12px] text-gray-400 dark:text-gray-500 text-center mt-1">
                Ou appuyez sur une catégorie ci-dessous pour saisir manuellement
              </p>
            </div>
          </div>
        )}

        {/* Copy from another month (when budget already set) */}
        {budget && prevMonthWithBudget && (
          <div className="mx-4 mt-2 flex justify-end">
            <button
              onClick={() => copyBudget(prevMonthWithBudget.year, prevMonthWithBudget.month, year, month)}
              className="text-[12px] text-blue-600 dark:text-blue-400">
              📋 Copier depuis {longMonth(prevMonthWithBudget.month)}
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-0 mx-4 mt-4 card overflow-hidden p-1">
          {([
            { id: 'categories', label: 'Catégories' },
            { id: 'deviations', label: 'Déviations' },
            { id: 'chart', label: 'Graphique' },
          ] as const).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-1.5 text-[13px] font-semibold rounded-xl transition-colors
                ${activeTab === tab.id ? 'bg-blue-600 text-white' : 'text-gray-500 dark:text-gray-400'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Tab: Catégories ──────────────────────────────────────────────── */}
        {activeTab === 'categories' && (
          <>
            <p className="section-header">
              {rows.length === 0 ? 'Toutes les catégories' : `${rows.length} catégorie${rows.length > 1 ? 's' : ''}`}
            </p>
            <div className="card mx-4 overflow-hidden">
              {/* Show all categories, even those without budget yet */}
              {CATEGORIES.map((cat, i) => {
                const row = rows.find(r => r.cat.id === cat.id)
                const budgeted = row?.budgeted ?? 0
                const actual   = row?.actual   ?? 0
                const pct      = row?.pct ?? null
                return (
                  <button key={cat.id}
                    onClick={() => openEdit(cat.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left
                      ${i < CATEGORIES.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''}`}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                      style={{ backgroundColor: cat.bgColor }}>
                      {cat.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[14px] font-medium dark:text-white truncate">{cat.label}</p>
                        <p className="text-[12px] text-gray-400 dark:text-gray-500 ml-2 flex-shrink-0">
                          {formatAmount(actual, base)} / {budgeted > 0 ? formatAmount(budgeted, base) : '—'}
                        </p>
                      </div>
                      {budgeted > 0 && (
                        <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${pctColor(pct)}`}
                            style={{ width: `${Math.min(pct ?? 0, 100)}%` }} />
                        </div>
                      )}
                      {budgeted === 0 && actual === 0 && (
                        <p className="text-[11px] text-gray-300 dark:text-gray-600">Appuyer pour définir un budget</p>
                      )}
                    </div>
                    {pct !== null && pct >= 100 && (
                      <span className="text-[11px] font-bold text-red-500 flex-shrink-0 ml-1">
                        +{(pct - 100).toFixed(0)}%
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </>
        )}

        {/* ── Tab: Déviations ─────────────────────────────────────────────── */}
        {activeTab === 'deviations' && (
          <>
            {deviationRows.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center px-8">
                <span className="text-4xl mb-3">🎯</span>
                <p className="text-[16px] font-semibold dark:text-white mb-1">Aucun budget défini</p>
                <p className="text-[13px] text-gray-400 dark:text-gray-500">
                  Définissez des budgets par catégorie pour voir les déviations
                </p>
              </div>
            ) : (
              <>
                {/* Over-budget categories */}
                {deviationRows.filter(r => r.deviation > 0).length > 0 && (
                  <>
                    <p className="section-header text-red-500">▲ Dépassements</p>
                    <div className="card mx-4 overflow-hidden">
                      {deviationRows.filter(r => r.deviation > 0).map((r, i, arr) => (
                        <div key={r.cat.id}
                          className={`flex items-center gap-3 px-4 py-3 ${i < arr.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''}`}>
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                            style={{ backgroundColor: r.cat.bgColor }}>
                            {r.cat.emoji}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[14px] font-medium dark:text-white">{r.cat.label}</p>
                            <p className="text-[11px] text-gray-400 dark:text-gray-500">
                              {formatAmount(r.actual, base)} sur {formatAmount(r.budgeted, base)} prévus
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-[14px] font-bold text-red-500">
                              +{formatAmount(r.deviation, base)}
                            </p>
                            <p className="text-[11px] text-red-400">
                              +{((r.deviation / r.budgeted) * 100).toFixed(0)}%
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Under-budget categories */}
                {deviationRows.filter(r => r.deviation <= 0).length > 0 && (
                  <>
                    <p className="section-header text-green-600">▼ Dans le budget</p>
                    <div className="card mx-4 overflow-hidden">
                      {deviationRows.filter(r => r.deviation <= 0).map((r, i, arr) => (
                        <div key={r.cat.id}
                          className={`flex items-center gap-3 px-4 py-3 ${i < arr.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''}`}>
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                            style={{ backgroundColor: r.cat.bgColor }}>
                            {r.cat.emoji}
                          </div>
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

        {/* ── Tab: Graphique ──────────────────────────────────────────────── */}
        {activeTab === 'chart' && (
          <>
            {/* Budget vs Actual per category (current month) */}
            {rows.filter(r => r.budgeted > 0).length > 0 && (
              <>
                <p className="section-header">Budget vs Réel — {longMonth(month)}</p>
                <div className="card mx-4 p-4">
                  <ResponsiveContainer width="100%" height={Math.max(rows.filter(r => r.budgeted > 0).length * 36, 160)}>
                    <BarChart
                      layout="vertical"
                      data={rows.filter(r => r.budgeted > 0).map(r => ({
                        name: r.cat.label,
                        Budget: Math.round(r.budgeted),
                        Réel: Math.round(r.actual),
                        over: r.actual > r.budgeted,
                      }))}
                      margin={{ top: 0, right: 10, left: 10, bottom: 0 }}
                      barSize={8}
                      barGap={2}
                    >
                      <XAxis type="number" tick={{ fontSize: 9, fill: isDark ? '#6b7280' : '#9ca3af' }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: isDark ? '#d1d5db' : '#374151' }} axisLine={false} tickLine={false} width={80} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v} ${base}`, '']} />
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
            )}

            {/* Month-over-month: budget vs actual (last 6 months) */}
            {chartData.some(d => d.budgeted > 0 || d.actual > 0) && (
              <>
                <p className="section-header">Évolution sur 6 mois</p>
                <div className="card mx-4 p-4">
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }} barSize={8} barGap={2}>
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: isDark ? '#6b7280' : '#9ca3af' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: isDark ? '#6b7280' : '#9ca3af' }} axisLine={false} tickLine={false}
                        tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                      <Tooltip contentStyle={tooltipStyle}
                        formatter={(v: number, n: string) => [`${v} ${base}`, n]} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="budgeted" name="Budget" fill="#93c5fd" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="actual"   name="Réel"   fill="#f87171" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}

            {rows.filter(r => r.budgeted > 0).length === 0 && (
              <div className="flex flex-col items-center py-12 text-center px-8">
                <span className="text-4xl mb-3">📈</span>
                <p className="text-[16px] font-semibold dark:text-white mb-1">Aucun budget à afficher</p>
                <p className="text-[13px] text-gray-400 dark:text-gray-500">
                  Définissez des budgets dans l'onglet Catégories
                </p>
              </div>
            )}
          </>
        )}

        <div className="h-4" />
      </div>

      {/* ── Edit Budget Modal ───────────────────────────────────────────────── */}
      {editCat && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
          onClick={e => e.target === e.currentTarget && setEditCat(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-t-3xl w-full p-6"
            style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}>
            {(() => {
              const cat = CATEGORY_MAP[editCat]
              const actual = actualByCategory[editCat] ?? 0
              return (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                      style={{ backgroundColor: cat.bgColor }}>{cat.emoji}</div>
                    <div>
                      <p className="text-[17px] font-bold dark:text-white">{cat.label}</p>
                      <p className="text-[12px] text-gray-400 dark:text-gray-500">
                        Réel ce mois: {formatAmount(actual, base)}
                      </p>
                    </div>
                  </div>
                  <p className="text-[13px] text-gray-400 dark:text-gray-500 mb-1">
                    Budget mensuel ({base})
                  </p>
                  <input
                    type="text" inputMode="decimal"
                    placeholder="0"
                    value={editAmount}
                    onChange={e => setEditAmount(e.target.value)}
                    autoFocus
                    className="w-full text-[32px] font-bold outline-none bg-transparent dark:text-white mb-4 border-b-2 border-blue-600 pb-1"
                  />
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
