import { useState, useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { useStore } from '../store/useStore'
import { getCategoryMeta } from '../data/categories'
import { CURRENCY_MAP } from '../data/currencies'
import { formatAmount, formatPercent } from '../utils/formatters'
import { longMonth } from '../utils/dates'
import type { CurrencyCode } from '../models/types'
import TransactionRow from './TransactionRow'
import CategoryAvatar from './CategoryAvatar'

interface Props {
  catId: string
  year: number
  month: number | null
  filterPerson: 'all' | 'person1' | 'person2' | 'shared'
  baseCurrency: CurrencyCode
  onClose: () => void
}

const PIE_COLORS = ['#6366f1','#8b5cf6','#a78bfa','#c4b5fd','#818cf8','#60a5fa','#34d399','#f59e0b']
const FR_MONTHS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre']

function dayLabel(d: string): string {
  const [y, m, day] = d.split('-')
  return `${parseInt(day)} ${FR_MONTHS[parseInt(m) - 1]} ${y}`
}

export default function CategoryDrillDown({ catId, year, month, filterPerson, baseCurrency, onClose }: Props) {
  const { expenses, settings, deleteExpense } = useStore()
  const customCategories = settings.customCategories ?? []
  const isDark = document.documentElement.classList.contains('dark')

  const [activeTab, setActiveTab] = useState<'transactions' | 'repartition'>('transactions')
  const [swipeId, setSwipeId] = useState<string | null>(null)

  const sym = CURRENCY_MAP[baseCurrency]?.symbol ?? baseCurrency
  const cat = getCategoryMeta(catId, customCategories)
  const catColor = cat?.color ?? '#6366f1'

  const tooltipStyle = {
    borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,.15)', fontSize: 12,
    background: isDark ? '#1f2937' : '#fff', color: isDark ? '#f9fafb' : '#111827',
  }

  const catExpenses = useMemo(() =>
    expenses
      .filter(e => {
        if (e.category !== catId) return false
        if (parseInt(e.date.slice(0, 4)) !== year) return false
        if (month !== null && parseInt(e.date.slice(5, 7)) !== month) return false
        if (filterPerson !== 'all' && e.person !== filterPerson) return false
        return true
      })
      .sort((a, b) => b.date.localeCompare(a.date))
  , [expenses, catId, year, month, filterPerson])

  const debits = catExpenses.filter(e => e.type === 'debit')
  const credits = catExpenses.filter(e => e.type === 'credit')
  const totalDebits  = debits.reduce((s, e) => s + e.amountInBase, 0)
  const totalCredits = credits.reduce((s, e) => s + e.amountInBase, 0)
  const displayTotal = totalDebits > 0 ? totalDebits : totalCredits
  const isDebit = totalDebits > 0

  const totalAllDebits = useMemo(() =>
    expenses
      .filter(e => {
        if (e.type !== 'debit') return false
        if (parseInt(e.date.slice(0, 4)) !== year) return false
        if (month !== null && parseInt(e.date.slice(5, 7)) !== month) return false
        if (filterPerson !== 'all' && e.person !== filterPerson) return false
        return true
      })
      .reduce((s, e) => s + e.amountInBase, 0)
  , [expenses, year, month, filterPerson])

  // Group by day for transactions tab
  const dayGroups = useMemo(() => {
    const map: Record<string, typeof catExpenses> = {}
    catExpenses.forEach(e => {
      if (!map[e.date]) map[e.date] = []
      map[e.date].push(e)
    })
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a))
  }, [catExpenses])

  // Group debits by title for répartition tab
  const subData = useMemo(() => {
    const map: Record<string, number> = {}
    debits.forEach(e => {
      const key = e.title || e.subCategory || 'Autre'
      map[key] = (map[key] ?? 0) + e.amountInBase
    })
    return Object.entries(map)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
  }, [debits])

  const periodLabel = month !== null ? `${longMonth(month)} ${year}` : String(year)
  const pct = totalAllDebits > 0 && isDebit ? formatPercent(totalDebits, totalAllDebits) : null

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-[#f2f2f7] dark:bg-[#1c1c1e]"
         style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>

      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700 flex-shrink-0 px-4 py-3 flex items-center gap-3">
        <button onClick={onClose}
          className="text-blue-600 text-[22px] font-light leading-none px-1">‹</button>
        {cat && <CategoryAvatar emoji={cat.emoji} bgColor={cat.bgColor} size="sm" />}
        <p className="text-[17px] font-semibold flex-1 truncate dark:text-white">{cat?.label ?? catId}</p>
        <p className="text-[13px] text-gray-400 dark:text-gray-500 flex-shrink-0">{periodLabel}</p>
      </div>

      {/* Amount hero */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700 px-4 py-4 flex-shrink-0">
        <p className="text-[34px] font-bold tracking-tight leading-none" style={{ color: catColor }}>
          {isDebit ? '−' : '+'}{displayTotal.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} {sym}
        </p>
        <p className="text-[13px] text-gray-400 dark:text-gray-500 mt-1.5">
          {catExpenses.length} transaction{catExpenses.length > 1 ? 's' : ''}
          {pct && <> · {pct} des dépenses</>}
        </p>
      </div>

      {/* Sub-tabs */}
      <div className="flex bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
        {(['transactions', 'repartition'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 text-[14px] font-medium relative transition-colors
              ${activeTab === tab ? 'dark:text-white text-gray-900' : 'text-gray-400 dark:text-gray-500'}`}>
            {tab === 'transactions' ? 'Transactions' : 'Répartition'}
            {activeTab === tab && (
              <div className="absolute bottom-0 left-8 right-8 h-0.5 rounded-t-full"
                style={{ backgroundColor: catColor }} />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scroll-ios pb-6">

        {/* ── Transactions ─────────────────────────────────────────────── */}
        {activeTab === 'transactions' && (
          <>
            {dayGroups.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-center px-8">
                <span className="text-4xl mb-3">{cat?.emoji ?? '📦'}</span>
                <p className="text-[16px] font-semibold dark:text-white mb-1">Aucune transaction</p>
                <p className="text-[13px] text-gray-400 dark:text-gray-500">Pour cette période et ces filtres</p>
              </div>
            ) : (
              dayGroups.map(([date, items]) => {
                const dayDebits  = items.filter(e => e.type === 'debit').reduce((s, e) => s + e.amountInBase, 0)
                const dayCredits = items.filter(e => e.type === 'credit').reduce((s, e) => s + e.amountInBase, 0)
                return (
                  <div key={date}>
                    <div className="flex items-center justify-between px-4 pt-4 pb-1.5">
                      <span className="text-[12px] font-semibold text-gray-400 dark:text-gray-500 capitalize">
                        {dayLabel(date)}
                      </span>
                      <div className="flex gap-2">
                        {dayCredits > 0 && <span className="text-[12px] font-semibold text-green-500">+{formatAmount(dayCredits, baseCurrency)}</span>}
                        {dayDebits > 0 && <span className="text-[12px] font-semibold text-gray-400 dark:text-gray-500">-{formatAmount(dayDebits, baseCurrency)}</span>}
                      </div>
                    </div>
                    <div className="mx-4 rounded-2xl overflow-hidden bg-white dark:bg-gray-800 shadow-sm">
                      {items.map((expense, i) => {
                        const eCat = getCategoryMeta(expense.category, customCategories) ?? null
                        return (
                          <TransactionRow
                            key={expense.id}
                            expense={expense}
                            cat={eCat}
                            baseCurrency={baseCurrency}
                            person1Name={settings.person1Name}
                            person2Name={settings.person2Name}
                            swipeOpen={swipeId === expense.id}
                            onSwipeToggle={() => setSwipeId(swipeId === expense.id ? null : expense.id)}
                            onDelete={() => { deleteExpense(expense.id); setSwipeId(null) }}
                            isLast={i === items.length - 1}
                          />
                        )
                      })}
                    </div>
                  </div>
                )
              })
            )}
          </>
        )}

        {/* ── Répartition ──────────────────────────────────────────────── */}
        {activeTab === 'repartition' && (
          <>
            {subData.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-center px-8">
                <p className="text-[16px] font-semibold dark:text-white">Aucune donnée</p>
                <p className="text-[13px] text-gray-400 dark:text-gray-500 mt-1">Pas de dépenses dans cette catégorie</p>
              </div>
            ) : (
              <>
                <div className="card mx-4 mt-4 p-4">
                  <div className="relative">
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie data={subData} dataKey="value" nameKey="label" cx="50%" cy="50%"
                          innerRadius="58%" outerRadius="80%">
                          {subData.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle}
                          formatter={(v: number) => [`${v.toFixed(0)} ${sym}`, '']}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="text-center">
                        <p className="text-[20px] font-bold dark:text-white">
                          {displayTotal.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} {sym}
                        </p>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500">Somme sorties</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card mx-4 mt-3 overflow-hidden">
                  {subData.map((d, i) => (
                    <div key={d.label}
                      className={`flex items-center gap-3 px-4 py-3 ${i < subData.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''}`}>
                      <span className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-[14px] text-gray-700 dark:text-gray-200 flex-1 truncate">{d.label}</span>
                      <span className="text-[12px] text-gray-400 dark:text-gray-500 mr-1">{formatPercent(d.value, displayTotal)}</span>
                      <span className="text-[14px] font-semibold dark:text-white">{d.value.toFixed(0)} {sym}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
