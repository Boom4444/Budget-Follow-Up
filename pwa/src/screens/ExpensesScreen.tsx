import { useState, useMemo } from 'react'
import { useStore } from '../store/useStore'
import { CATEGORY_MAP } from '../data/categories'
import { CURRENCY_MAP } from '../data/currencies'
import { formatAmount } from '../utils/formatters'
import { currentYear, currentMonth, shortMonth, dateYear, dateMonth, formatDisplayDate } from '../utils/dates'
import type { Expense } from '../models/types'
import AddExpenseModal from '../components/AddExpenseModal'

export default function ExpensesScreen() {
  const { expenses, settings, deleteExpense } = useStore()
  const base = settings.baseCurrency

  const [year, setYear]       = useState(currentYear())
  const [month, setMonth]     = useState<number | null>(currentMonth())
  const [search, setSearch]   = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [swipeId, setSwipeId] = useState<string | null>(null)

  const NOW = currentYear()

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return expenses
      .filter(e => {
        if (dateYear(e.date) !== year) return false
        if (month !== null && dateMonth(e.date) !== month) return false
        if (q && !e.title.toLowerCase().includes(q) && !e.category.toLowerCase().includes(q) && !e.bank.toLowerCase().includes(q)) return false
        return true
      })
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [expenses, year, month, search])

  const totalDebits  = filtered.filter(e => e.type === 'debit').reduce((s, e) => s + e.amountInBase, 0)
  const totalCredits = filtered.filter(e => e.type === 'credit').reduce((s, e) => s + e.amountInBase, 0)

  const groups = useMemo(() => {
    const map: Record<string, Expense[]> = {}
    filtered.forEach(e => {
      const key = e.date.slice(0, 7)
      if (!map[key]) map[key] = []
      map[key].push(e)
    })
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a))
  }, [filtered])

  function groupLabel(key: string): string {
    const [y, m] = key.split('-')
    const months = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
    return `${months[parseInt(m) - 1]} ${y}`
  }

  function personLabel(p: string): string {
    if (p === 'person1') return settings.person1Name
    if (p === 'person2') return settings.person2Name
    return 'Commun'
  }

  return (
    <div className="flex flex-col h-full"
         style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-3 pb-0 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-[22px] font-bold">Dépenses</h1>
          <button onClick={() => setShowAdd(true)}
            className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center text-white text-xl font-light">
            +
          </button>
        </div>

        {/* Search */}
        <div className="flex items-center bg-gray-100 rounded-xl px-3 py-2 mb-3">
          <span className="text-gray-400 mr-2 text-sm">🔍</span>
          <input type="search" placeholder="Rechercher…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-[15px] outline-none" />
          {search && <button onClick={() => setSearch('')} className="text-gray-400 ml-1 text-lg">×</button>}
        </div>

        {/* Year + month filter */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg px-2 py-1">
            <button onClick={() => setYear(y => y - 1)} className="text-blue-600 px-1 text-lg">‹</button>
            <span className="text-[13px] font-semibold w-10 text-center">{year}</span>
            <button onClick={() => setYear(y => Math.min(y + 1, NOW))}
              className={`px-1 text-lg ${year >= NOW ? 'text-gray-200' : 'text-blue-600'}`}>›</button>
          </div>

          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {[null, 1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
              <button key={m ?? 'all'} onClick={() => setMonth(m)}
                className={`px-2.5 py-1 rounded-full text-[12px] font-medium whitespace-nowrap flex-shrink-0
                  ${month === m ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                {m === null ? 'Tout' : shortMonth(m)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary bar */}
      {filtered.length > 0 && (
        <div className="bg-white border-b border-gray-100 px-4 py-2.5 flex items-center justify-between flex-shrink-0">
          <span className="text-[13px] text-gray-400">{filtered.length} opération{filtered.length > 1 ? 's' : ''}</span>
          <div className="flex items-center gap-3">
            {totalCredits > 0 && (
              <span className="text-[13px] font-semibold text-green-600">+{formatAmount(totalCredits, base)}</span>
            )}
            <span className="text-[15px] font-bold text-red-500">-{formatAmount(totalDebits, base)}</span>
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto scroll-ios">
        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-8">
            <span className="text-4xl mb-3">💸</span>
            <p className="text-[17px] font-semibold text-gray-700 mb-1">Aucune opération</p>
            <p className="text-[14px] text-gray-400 mb-4">
              {search ? 'Aucun résultat pour votre recherche' : 'Appuyez sur + pour ajouter'}
            </p>
            {!search && (
              <button onClick={() => setShowAdd(true)}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-medium">
                Ajouter une dépense
              </button>
            )}
          </div>
        ) : (
          <>
            {groups.map(([key, items]) => {
              const groupDebits  = items.filter(e => e.type === 'debit').reduce((s, e) => s + e.amountInBase, 0)
              const groupCredits = items.filter(e => e.type === 'credit').reduce((s, e) => s + e.amountInBase, 0)
              return (
                <div key={key}>
                  <div className="flex items-center justify-between px-4 pt-5 pb-1.5">
                    <span className="text-[12px] font-semibold text-gray-400 uppercase tracking-wide">
                      {groupLabel(key)}
                    </span>
                    <div className="flex items-center gap-2">
                      {groupCredits > 0 && (
                        <span className="text-[12px] font-semibold text-green-500">+{formatAmount(groupCredits, base)}</span>
                      )}
                      <span className="text-[12px] font-semibold text-gray-500">-{formatAmount(groupDebits, base)}</span>
                    </div>
                  </div>
                  <div className="card mx-4 overflow-hidden">
                    {items.map((expense, i) => {
                      const cat = CATEGORY_MAP[expense.category as keyof typeof CATEGORY_MAP]
                      const isSwipe = swipeId === expense.id
                      const isCredit = expense.type === 'credit'
                      return (
                        <div key={expense.id}
                          className={`relative overflow-hidden ${i < items.length - 1 ? 'border-b border-gray-100' : ''}`}>
                          {/* Delete button */}
                          <div className="absolute inset-y-0 right-0 flex items-center justify-center w-20 bg-red-500">
                            <button onClick={() => { deleteExpense(expense.id); setSwipeId(null) }}
                              className="text-white text-[12px] font-semibold w-full h-full flex items-center justify-center">
                              🗑 Suppr.
                            </button>
                          </div>
                          {/* Swipeable row */}
                          <div
                            className={`relative bg-white flex items-center gap-3 px-4 py-3 transition-transform
                              ${isSwipe ? '-translate-x-20' : 'translate-x-0'}`}>
                            {/* Category icon */}
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                              style={{ backgroundColor: isCredit ? '#dcfce7' : (cat?.bgColor ?? '#f3f4f6') }}>
                              {isCredit ? '💚' : (cat?.emoji ?? '📦')}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-[15px] font-medium truncate">{expense.title}</p>
                                {expense.isFixed && <span className="text-[10px]">🔒</span>}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[11px] font-medium" style={{ color: isCredit ? '#16a34a' : (cat?.color ?? '#666') }}>
                                  {cat?.label ?? expense.category}
                                </span>
                                {expense.subCategory && (
                                  <>
                                    <span className="text-[11px] text-gray-300">›</span>
                                    <span className="text-[11px] text-gray-400 truncate">{expense.subCategory}</span>
                                  </>
                                )}
                                <span className="text-[11px] text-gray-300">·</span>
                                <span className="text-[11px] text-gray-400">{personLabel(expense.person)}</span>
                                {expense.bank && <>
                                  <span className="text-[11px] text-gray-300">·</span>
                                  <span className="text-[11px] text-gray-400 truncate">{expense.bank}</span>
                                </>}
                              </div>
                            </div>

                            <div className="text-right flex-shrink-0">
                              <p className={`text-[15px] font-semibold ${isCredit ? 'text-green-600' : ''}`}>
                                {isCredit ? '+' : '-'}{expense.amount.toFixed(2).replace('.', ',')} {CURRENCY_MAP[expense.currency]?.symbol ?? expense.currency}
                              </p>
                              {expense.currency !== base && (
                                <p className="text-[11px] text-gray-400">
                                  {formatAmount(expense.amountInBase, base)}
                                </p>
                              )}
                              <p className="text-[11px] text-gray-300">{formatDisplayDate(expense.date)}</p>
                            </div>

                            {/* Swipe hint */}
                            <button
                              className="ml-1 text-gray-200 text-lg flex-shrink-0 z-10"
                              onClick={e => { e.stopPropagation(); setSwipeId(isSwipe ? null : expense.id) }}>
                              ‹
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
            <div className="h-8" />
          </>
        )}
      </div>

      {showAdd && <AddExpenseModal onClose={() => setShowAdd(false)} />}
    </div>
  )
}
