import { useState, useMemo, useRef } from 'react'
import { useStore } from '../store/useStore'
import { getCategoryMeta, CATEGORIES, CATEGORY_MAP } from '../data/categories'
import { formatAmount } from '../utils/formatters'
import { currentYear, currentMonth, shortMonth, dateYear, dateMonth } from '../utils/dates'
import type { Expense, HouseholdMember } from '../models/types'
import AddExpenseModal from '../components/AddExpenseModal'
import TransactionRow from '../components/TransactionRow'
import { importFromCSV, importFromXLSX, importFromPDF } from '../utils/bankImport'
import type { BankImportResult, ImportedTransaction } from '../utils/bankImport'

function dayLabel(d: string): string {
  const months = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre']
  const [y, m, day] = d.split('-')
  return `${parseInt(day)} ${months[parseInt(m)-1]} ${y}`
}

export default function ExpensesScreen() {
  const { expenses, settings, deleteExpense, addExpense, addBatchExpenses } = useStore()
  const base = settings.baseCurrency
  const customCategories = settings.customCategories ?? []

  // All categories for the import select, sorted alphabetically (built-ins with overrides + new custom)
  const sortedCategoriesForSelect = useMemo(() => {
    const builtinWithOverrides = CATEGORIES.map(c => {
      const ov = customCategories.find(o => o.id === c.id)
      return ov ? { id: c.id, label: ov.label, emoji: ov.emoji } : { id: c.id, label: c.label, emoji: c.emoji }
    })
    const newCustom = customCategories
      .filter(c => !CATEGORY_MAP[c.id])
      .map(c => ({ id: c.id, label: c.label, emoji: c.emoji }))
    return [...builtinWithOverrides, ...newCustom].sort((a, b) => a.label.localeCompare(b.label, 'fr'))
  }, [customCategories])

  const [year, setYear]       = useState(currentYear())
  const [month, setMonth]     = useState<number | null>(currentMonth())
  const [search, setSearch]   = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [swipeId, setSwipeId] = useState<string | null>(null)

  // Bank import state
  const importRef = useRef<HTMLInputElement>(null)
  const [importResult, setImportResult] = useState<BankImportResult | null>(null)
  const [importTxns, setImportTxns] = useState<ImportedTransaction[]>([])
  const [importLoading, setImportLoading] = useState(false)
  const [importError, setImportError] = useState('')
  const [importFilter, setImportFilter] = useState<'all' | 'review'>('all')
  const [importPerson, setImportPerson] = useState<HouseholdMember>('person1')

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
      if (!map[e.date]) map[e.date] = []
      map[e.date].push(e)
    })
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a))
  }, [filtered])

  // ── Bank import handlers ──────────────────────────────────────────────────

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImportError('')
    setImportLoading(true)
    try {
      let result: BankImportResult
      if (file.name.toLowerCase().match(/\.xlsx?$/)) {
        const buf = await file.arrayBuffer()
        result = await importFromXLSX(buf, file.name)
      } else if (file.name.toLowerCase().endsWith('.pdf')) {
        const buf = await file.arrayBuffer()
        result = await importFromPDF(buf, file.name)
      } else {
        const text = await file.text()
        result = importFromCSV(text, file.name)
      }
      if (result.transactions.length === 0) {
        setImportError('Aucune transaction trouvée. Vérifiez le format du fichier.')
        return
      }
      setImportResult(result)
      setImportTxns(result.transactions)
      setImportFilter('all')
    } catch {
      setImportError('Erreur lors de la lecture du fichier.')
    } finally {
      setImportLoading(false)
    }
  }

  function updateTxnField(id: string, patch: Partial<ImportedTransaction>) {
    setImportTxns(ts => ts.map(t => t.id === id ? { ...t, ...patch } : t))
  }

  function removeTxn(id: string) {
    setImportTxns(ts => ts.filter(t => t.id !== id))
  }

  function confirmImport() {
    addBatchExpenses(importTxns.map(t => ({
      title: t.title,
      amount: t.amount,
      currency: t.currency,
      date: t.date,
      category: t.needsReview ? 'a_classer' : t.suggestedCategory,
      subCategory: t.needsReview ? 'Non classé' : t.suggestedSubCategory,
      type: t.type,
      isFixed: false,
      bank: t.bank,
      person: importPerson,
      notes: t.notes,
    })))
    setImportResult(null)
    setImportTxns([])
  }

  const reviewCount = importTxns.filter(t => t.needsReview).length

  const importDateRange = useMemo(() => {
    if (importTxns.length === 0) return null
    const dates = importTxns.map(t => t.date).sort()
    const fmt = (d: string) => {
      const [y, m, day] = d.split('-')
      return `${day}/${m}/${y.slice(2)}`
    }
    return { from: fmt(dates[0]), to: fmt(dates[dates.length - 1]) }
  }, [importTxns])

  const importDebitCount = importTxns.filter(t => t.type === 'debit').length
  const importCreditCount = importTxns.filter(t => t.type === 'credit').length

  const displayedTxns = importFilter === 'review'
    ? [...importTxns.filter(t => t.needsReview), ...importTxns.filter(t => !t.needsReview)]
    : importTxns

  return (
    <div className="flex flex-col h-full"
         style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700 px-4 pt-3 pb-0 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-[22px] font-bold dark:text-white">Dépenses</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => importRef.current?.click()}
              disabled={importLoading}
              title="Importer un relevé bancaire"
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-xl text-[13px] font-medium text-gray-700 dark:text-gray-200">
              {importLoading ? (
                <span className="text-[14px]">…</span>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="12" y1="18" x2="12" y2="12"/>
                  <polyline points="9 15 12 18 15 15"/>
                </svg>
              )}
              Relevé
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center text-white text-[22px] font-light leading-none shadow-sm">
              +
            </button>
          </div>
        </div>

        <input ref={importRef} type="file" accept=".csv,.tsv,.txt,.xls,.xlsx,.pdf" className="hidden"
          onChange={handleImportFile} />

        {importError && (
          <p className="text-[13px] text-red-500 mb-2 px-1">{importError}</p>
        )}

        {/* Search */}
        <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-xl px-3 py-2 mb-3">
          <span className="text-gray-400 mr-2 text-sm">🔍</span>
          <input type="search" placeholder="Rechercher…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-[15px] outline-none dark:text-white dark:placeholder-gray-500" />
          {search && <button onClick={() => setSearch('')} className="text-gray-400 ml-1 text-lg">×</button>}
        </div>

        {/* Year + month filter */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg px-2 py-1">
            <button onClick={() => setYear(y => y - 1)} className="text-blue-600 px-1 text-lg">‹</button>
            <span className="text-[13px] font-semibold w-10 text-center dark:text-white">{year}</span>
            <button onClick={() => setYear(y => Math.min(y + 1, NOW))}
              className={`px-1 text-lg ${year >= NOW ? 'text-gray-200 dark:text-gray-600' : 'text-blue-600'}`}>›</button>
          </div>

          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {[null, 1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
              <button key={m ?? 'all'} onClick={() => setMonth(m)}
                className={`px-2.5 py-1 rounded-full text-[12px] font-medium whitespace-nowrap flex-shrink-0
                  ${month === m
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                {m === null ? 'Tout' : shortMonth(m)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary bar */}
      {filtered.length > 0 && (
        <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700 px-4 py-2.5 flex items-center justify-between flex-shrink-0">
          <span className="text-[13px] text-gray-400 dark:text-gray-500">{filtered.length} opération{filtered.length > 1 ? 's' : ''}</span>
          <div className="flex items-center gap-3">
            {totalCredits > 0 && (
              <span className="text-[13px] font-semibold text-green-600">+{formatAmount(totalCredits, base)}</span>
            )}
            <span className="text-[15px] font-bold text-red-500">-{formatAmount(totalDebits, base)}</span>
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto scroll-ios pb-24">
        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-8">
            <span className="text-4xl mb-3">💸</span>
            <p className="text-[17px] font-semibold text-gray-700 dark:text-gray-200 mb-1">Aucune opération</p>
            <p className="text-[14px] text-gray-400 dark:text-gray-500 mb-4">
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
            {groups.map(([dateKey, items]) => {
              const dayDebits  = items.filter(e => e.type === 'debit').reduce((s, e) => s + e.amountInBase, 0)
              const dayCredits = items.filter(e => e.type === 'credit').reduce((s, e) => s + e.amountInBase, 0)
              return (
                <div key={dateKey}>
                  {/* Day header */}
                  <div className="flex items-center justify-between px-4 pt-5 pb-1.5">
                    <span className="text-[12px] font-semibold text-gray-400 dark:text-gray-500">
                      {dayLabel(dateKey)}
                    </span>
                    <div className="flex items-center gap-2">
                      {dayCredits > 0 && (
                        <span className="text-[12px] font-semibold text-green-500">+{formatAmount(dayCredits, base)}</span>
                      )}
                      {dayDebits > 0 && (
                        <span className="text-[12px] font-semibold text-gray-500 dark:text-gray-400">-{formatAmount(dayDebits, base)}</span>
                      )}
                    </div>
                  </div>

                  {/* Day transactions */}
                  <div className="mx-4 rounded-2xl overflow-hidden bg-white dark:bg-gray-800 shadow-sm">
                    {items.map((expense, i) => {
                      const cat = getCategoryMeta(expense.category, customCategories) ?? null
                      return (
                        <TransactionRow
                          key={expense.id}
                          expense={expense}
                          cat={cat}
                          baseCurrency={base}
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
            })}
            <div className="h-8" />
          </>
        )}
      </div>

      {showAdd && <AddExpenseModal onClose={() => setShowAdd(false)} />}

      {/* ── Bank import review sheet ── */}
      {importResult && (
        <div className="fixed inset-0 z-50 flex flex-col bg-gray-50 dark:bg-gray-900"
             style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>

          {/* Header */}
          <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-3 flex-shrink-0">
            <button onClick={() => { setImportResult(null); setImportTxns([]) }}
              className="text-blue-600 font-medium text-[15px]">Annuler</button>
            <div className="flex-1 text-center">
              <p className="font-semibold text-[16px] dark:text-white">{importResult.bankName}</p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500">
                {importDateRange && `${importDateRange.from} → ${importDateRange.to} · `}
                {importDebitCount} débit{importDebitCount > 1 ? 's' : ''}{importCreditCount > 0 ? `, ${importCreditCount} crédit${importCreditCount > 1 ? 's' : ''}` : ''}
                {reviewCount > 0 && ` · ${reviewCount} à classifier`}
              </p>
            </div>
            <button onClick={confirmImport}
              className="text-blue-600 font-semibold text-[15px]">
              Importer
            </button>
          </div>

          {/* Person selector */}
          <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2 flex items-center gap-3 flex-shrink-0">
            <span className="text-[13px] text-gray-500 dark:text-gray-400 flex-shrink-0">Compte de :</span>
            <div className="flex gap-2">
              {(['person1', 'person2'] as HouseholdMember[]).map(p => (
                <button key={p} onClick={() => setImportPerson(p)}
                  className={`px-3 py-1 rounded-full text-[13px] font-medium transition-colors ${
                    importPerson === p
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                  }`}>
                  {p === 'person1' ? settings.person1Name : settings.person2Name}
                </button>
              ))}
            </div>
          </div>

          {/* Filter */}
          {reviewCount > 0 && (
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2 flex gap-2 flex-shrink-0">
              <button onClick={() => setImportFilter('all')}
                className={`px-3 py-1 rounded-full text-[13px] font-medium ${importFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                Tout ({importTxns.length})
              </button>
              <button onClick={() => setImportFilter('review')}
                className={`px-3 py-1 rounded-full text-[13px] font-medium ${importFilter === 'review' ? 'bg-orange-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                À classifier ({reviewCount}/{importTxns.length})
              </button>
            </div>
          )}

          {/* Transaction list */}
          <div className="flex-1 overflow-y-auto scroll-ios">
            {displayedTxns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <span className="text-3xl mb-2">✅</span>
                <p className="text-gray-500 dark:text-gray-400">Tout est classifié !</p>
              </div>
            ) : (
              <>
                <p className="section-header text-[11px]">
                  Vérifiez et corrigez les catégories avant d'importer
                </p>
                <div className="space-y-0 mx-4">
                  {displayedTxns.map((t, i) => {
                    const catMeta = getCategoryMeta(t.suggestedCategory, customCategories)
                    return (
                      <div key={t.id} className={`bg-white dark:bg-gray-800 px-4 py-3 ${i === 0 ? 'rounded-t-2xl' : ''} ${i === displayedTxns.length - 1 ? 'rounded-b-2xl mb-4' : 'border-b border-gray-100 dark:border-gray-700'}`}>
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0 mt-0.5"
                               style={{ backgroundColor: catMeta?.bgColor ?? '#f3f4f6' }}>
                            {catMeta?.emoji ?? '📦'}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[14px] font-medium truncate dark:text-white">{t.title}</p>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className={`text-[14px] font-semibold ${t.type === 'credit' ? 'text-green-600' : 'dark:text-white'}`}>
                                  {t.type === 'credit' ? '+' : '-'}{t.amount.toFixed(2).replace('.', ',')} {t.currency}
                                </span>
                                <button onClick={() => removeTxn(t.id)}
                                  className="text-gray-300 dark:text-gray-600 text-lg leading-none">×</button>
                              </div>
                            </div>
                            <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-1.5">{t.date} · {t.bank}</p>
                            {/* Category select */}
                            <div className={`flex items-center gap-1.5 ${
                              t.needsReview
                                ? 'bg-orange-50 dark:bg-orange-950 rounded-lg px-2 py-1'
                                : importFilter === 'review' ? 'bg-green-50 dark:bg-green-950/30 rounded-lg px-2 py-1' : ''
                            }`}>
                              {t.needsReview
                                ? <span className="text-orange-500 text-[11px]">⚠</span>
                                : importFilter === 'review' ? <span className="text-green-500 text-[11px]">✓</span> : null
                              }
                              <select
                                value={t.suggestedCategory}
                                onChange={e => {
                                  const newCat = e.target.value
                                  const newMeta = getCategoryMeta(newCat, customCategories)
                                  updateTxnField(t.id, {
                                    suggestedCategory: newCat,
                                    suggestedSubCategory: newMeta?.subCategories[0] ?? '',
                                    needsReview: false,
                                  })
                                }}
                                className="text-[13px] font-medium outline-none bg-transparent dark:text-white"
                                style={{ color: catMeta?.color ?? '#6b7280' }}>
                                {sortedCategoriesForSelect.map(c => (
                                  <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>
                                ))}
                              </select>
                            </div>
                            {/* Notes input */}
                            <input
                              type="text"
                              value={t.notes}
                              onChange={e => updateTxnField(t.id, { notes: e.target.value })}
                              placeholder="✏️ Ajouter un commentaire…"
                              className="mt-1 w-full text-[12px] text-gray-500 dark:text-gray-400 placeholder-gray-300 dark:placeholder-gray-600 outline-none bg-transparent"
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="h-32" />
              </>
            )}
          </div>

          {/* Footer */}
          <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-4 flex-shrink-0"
               style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
            {reviewCount > 0 && (
              <p className="text-[12px] text-orange-500 text-center mb-2">
                {reviewCount} transaction{reviewCount > 1 ? 's' : ''} non classée{reviewCount > 1 ? 's' : ''} — enregistrées dans "À classer" 🏷️
              </p>
            )}
            <button onClick={confirmImport}
              className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-semibold text-[16px]">
              Importer {importTxns.length} transaction{importTxns.length > 1 ? 's' : ''}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
