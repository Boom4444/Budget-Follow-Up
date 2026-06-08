import { useState, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { FIXED_CATEGORIES, VARIABLE_CATEGORIES, REVENUS_CATEGORY, getCategoryMeta } from '../data/categories'
import { CURRENCIES, prefetchRateForDate, getHistoricalConversionRate } from '../data/currencies'
import { today } from '../utils/dates'
import type { CurrencyCode, HouseholdMember } from '../models/types'

interface Props {
  onClose: () => void
  editId?: string   // when set: edit mode — updates existing expense instead of adding
  prefill?: {
    title?: string
    amount?: number
    currency?: CurrencyCode
    date?: string
    category?: string
    subCategory?: string
    type?: 'debit' | 'credit'
    isFixed?: boolean
    bank?: string
    person?: HouseholdMember
    notes?: string
    splitRatio?: { person1: number; person2: number }
  }
}

export default function AddExpenseModal({ onClose, editId, prefill }: Props) {
  const { expenses, recurring, settings, addExpense, updateExpense } = useStore()
  const customCategories = settings.customCategories ?? []
  const deletedBuiltins = new Set(settings.deletedBuiltinCategories ?? [])

  const [title, setTitle]             = useState(prefill?.title ?? '')
  const [amount, setAmount]           = useState(prefill?.amount != null ? String(prefill.amount) : '')
  const [currency, setCurrency]       = useState<CurrencyCode>(prefill?.currency ?? settings.baseCurrency)
  const [date, setDate]               = useState(prefill?.date ?? today())
  const [category, setCategory]       = useState<string>(prefill?.category ?? 'nourriture')
  const [subCategory, setSubCategory] = useState(prefill?.subCategory ?? '')
  const [type, setType]               = useState<'debit' | 'credit'>(prefill?.type ?? 'debit')
  const [isFixed, setIsFixed]         = useState(prefill?.isFixed ?? false)
  const [bank, setBank]               = useState(prefill?.bank ?? '')
  const [person, setPerson]           = useState<HouseholdMember>(prefill?.person ?? 'person1')
  const [notes, setNotes]             = useState(prefill?.notes ?? '')
  const [showCatPicker, setShowCatPicker] = useState(false)
  const [splitPct, setSplitPct] = useState(prefill?.splitRatio?.person1 ?? 50)
  const [submitting, setSubmitting] = useState(false)

  const suggestions = title.length === 0
    ? recurring.slice(0, 5)
    : recurring.filter(r => r.title.toLowerCase().includes(title.toLowerCase())).slice(0, 4)

  const recentTitles = title.length === 0
    ? []
    : [...new Set(expenses.filter(e => e.title.toLowerCase().includes(title.toLowerCase())).map(e => e.title))].slice(0, 3)

  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    if (!mounted) return   // don't override prefill values on first render
    const cat = getCategoryMeta(category, customCategories)
    if (cat) {
      setIsFixed(cat.isFixed)
      setSubCategory(cat.subCategories[0] ?? '')
    }
  }, [category, mounted])

  // Pre-fetch historical rate in the background whenever date or currency changes
  useEffect(() => {
    if (currency !== settings.baseCurrency) {
      prefetchRateForDate(date)
    }
  }, [date, currency, settings.baseCurrency])

  function applyRecurring(r: typeof recurring[number]) {
    setTitle(r.title)
    setAmount(String(r.amount))
    setCurrency(r.currency)
    setCategory(r.category)
    setSubCategory(r.subCategory)
    setIsFixed(r.isFixed)
    setBank(r.bank)
    setPerson(r.person)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const num = parseFloat(amount.replace(',', '.'))
    if (!title.trim() || isNaN(num) || submitting) return
    setSubmitting(true)
    const base = settings.baseCurrency
    const splitRatio = person === 'shared' ? { person1: splitPct, person2: 100 - splitPct } : undefined
    // Fetch historical rate for the transaction date (uses cache if already prefetched)
    let exchangeRate: number | undefined
    if (currency !== base) {
      await prefetchRateForDate(date)
      exchangeRate = getHistoricalConversionRate(date, currency, base)
    }
    if (editId) {
      updateExpense(editId, { title: title.trim(), amount: num, currency, date, category, subCategory, type, isFixed, bank, person, notes, splitRatio, exchangeRate })
    } else {
      addExpense({ title: title.trim(), amount: num, currency, date, category, subCategory, type, isFixed, bank, person, notes, splitRatio, exchangeRate })
    }
    onClose()
  }

  const cat = getCategoryMeta(category, customCategories)
  const subCategories = cat?.subCategories ?? []

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-50 dark:bg-gray-900"
         style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <button onClick={onClose} className="text-blue-600 font-medium text-[15px]">Annuler</button>
        <span className="font-semibold text-[17px] dark:text-white">{editId ? 'Modifier la dépense' : 'Nouvelle dépense'}</span>
        <button form="expense-form" type="submit"
          className="text-blue-600 font-semibold text-[15px] disabled:text-gray-300"
          disabled={!title.trim() || !amount || submitting}>
          {submitting ? '…' : editId ? 'Enregistrer' : 'Ajouter'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scroll-ios">
        <form id="expense-form" onSubmit={handleSubmit}>

          {/* Suggestions */}
          {(suggestions.length > 0 || recentTitles.length > 0) && (
            <div className="mt-4 px-4">
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Suggestions</p>
              <div className="card overflow-hidden">
                {suggestions.map((r, i) => {
                  const rCat = getCategoryMeta(r.category, customCategories)
                  return (
                    <button key={r.id} type="button" onClick={() => applyRecurring(r)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left active:bg-gray-50 dark:active:bg-gray-700
                        ${i < suggestions.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''}`}>
                      <span className="text-2xl">{rCat?.emoji ?? '📦'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[15px] truncate dark:text-white">{r.title}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">{r.frequency === 'monthly' ? 'Mensuel' : r.frequency} · {r.isFixed ? '🔒 Incompressible' : 'Variable'}</p>
                      </div>
                      <span className="text-blue-600 font-semibold text-[15px] shrink-0">
                        {r.amount.toFixed(2).replace('.', ',')} {CURRENCIES.find(c => c.code === r.currency)?.symbol}
                      </span>
                    </button>
                  )
                })}
                {recentTitles.map((t, i) => (
                  <button key={t} type="button" onClick={() => setTitle(t)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left active:bg-gray-50 dark:active:bg-gray-700
                      ${suggestions.length + i < suggestions.length + recentTitles.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''}`}>
                    <span className="text-xl text-gray-400">🕐</span>
                    <p className="font-medium text-[15px] dark:text-white">{t}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          <p className="section-header">Description <span className="text-red-500">*</span></p>
          <div className="card mx-4">
            <input type="text" placeholder="Ex : Loyer, Courses Lidl…"
              value={title} onChange={e => setTitle(e.target.value)}
              className="w-full px-4 py-3 text-[17px] outline-none rounded-2xl bg-transparent dark:text-white dark:placeholder-gray-500"
              autoFocus={!prefill?.title}
            />
          </div>

          {/* Montant */}
          <p className="section-header">Montant <span className="text-red-500">*</span></p>
          <div className="card mx-4 flex items-center px-4 gap-3">
            <input type="text" inputMode="decimal" placeholder="0,00"
              value={amount} onChange={e => setAmount(e.target.value)}
              className="flex-1 py-3 text-[22px] font-semibold outline-none min-w-0 bg-transparent dark:text-white dark:placeholder-gray-500"
            />
            <div className="h-8 w-px bg-gray-200 dark:bg-gray-600" />
            {/* Custom currency picker — hidden select overlaid for native iOS wheel */}
            <div className="relative flex items-center gap-1 py-3 cursor-pointer">
              <select value={currency} onChange={e => setCurrency(e.target.value as CurrencyCode)}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" aria-label="Devise">
                {CURRENCIES.map(c => (
                  <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                ))}
              </select>
              <span className="text-[18px] leading-none">{CURRENCIES.find(c => c.code === currency)?.flag}</span>
              <span className="text-[15px] text-blue-600 font-semibold">{currency}</span>
              <span className="text-blue-400 text-[11px] leading-none">▾</span>
            </div>
          </div>

          {/* Type */}
          <p className="section-header">Type</p>
          <div className="card mx-4 p-1.5">
            <div className="flex rounded-xl overflow-hidden">
              <button type="button" onClick={() => setType('debit')}
                className={`flex-1 py-2 text-[14px] font-semibold rounded-lg transition-colors
                  ${type === 'debit' ? 'bg-red-500 text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                Débit
              </button>
              <button type="button" onClick={() => setType('credit')}
                className={`flex-1 py-2 text-[14px] font-semibold rounded-lg transition-colors
                  ${type === 'credit' ? 'bg-green-500 text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                Crédit
              </button>
            </div>
          </div>

          {/* Catégorie */}
          <p className="section-header">Catégorie <span className="text-red-500">*</span></p>
          <div className="card mx-4">
            <button type="button" onClick={() => setShowCatPicker(true)}
              className="w-full flex items-center gap-3 px-4 py-3">
              <span className="text-2xl">{cat?.emoji ?? '📦'}</span>
              <div className="flex-1 text-left">
                <p className="text-[15px] font-medium dark:text-white">{cat?.label ?? category}</p>
                {cat?.isFixed && <p className="text-xs text-red-500">🔒 Incompressible</p>}
              </div>
              <span className="text-gray-300 dark:text-gray-600 text-lg">›</span>
            </button>
          </div>

          {/* Sous-catégorie */}
          {subCategories.length > 0 && (
            <>
              <p className="section-header">Sous-catégorie</p>
              <div className="card mx-4 px-4 py-1">
                <select value={subCategory} onChange={e => setSubCategory(e.target.value)}
                  className="w-full py-2.5 text-[15px] outline-none bg-transparent dark:text-white">
                  {subCategories.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </>
          )}

          {/* Charge incompressible */}
          <p className="section-header">Charge incompressible</p>
          <div className="card mx-4 px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-[15px] font-medium dark:text-white">Charge fixe</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">Loyer, assurance, impôts…</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={isFixed} onChange={e => setIsFixed(e.target.checked)}
                className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 dark:bg-gray-600 rounded-full peer-checked:bg-red-500
                peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-0.5
                after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5
                after:transition-transform"></div>
            </label>
          </div>

          {/* Qui & Banque */}
          <p className="section-header">Qui & Banque</p>
          <div className="card mx-4 overflow-hidden">
            <div className="px-4 py-2 flex items-center gap-3 border-b border-gray-100 dark:border-gray-700">
              <span className="text-gray-400 dark:text-gray-500 text-sm w-20">Personne</span>
              <select value={person} onChange={e => setPerson(e.target.value as HouseholdMember)}
                className="flex-1 text-[15px] text-right outline-none bg-transparent py-1 dark:text-white">
                <option value="person1">{settings.person1Name}</option>
                <option value="person2">{settings.person2Name}</option>
                <option value="shared">Commun</option>
              </select>
            </div>
            {person === 'shared' && (
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[12px] font-semibold text-blue-600">{settings.person1Name} · {splitPct}%</span>
                  <span className="text-[12px] text-gray-400 dark:text-gray-500">Répartition</span>
                  <span className="text-[12px] font-semibold text-purple-600">{100 - splitPct}% · {settings.person2Name}</span>
                </div>
                <input type="range" min={0} max={100} step={5}
                  value={splitPct} onChange={e => setSplitPct(Number(e.target.value))}
                  className="w-full accent-blue-600" />
                <p className="text-[11px] text-center text-gray-400 dark:text-gray-500 mt-1">
                  {splitPct === 50 ? 'Partage équitable' : `${settings.person1Name} paie ${splitPct}%, ${settings.person2Name} paie ${100 - splitPct}%`}
                </p>
              </div>
            )}
            <div className="px-4 py-2 flex items-center gap-3">
              <span className="text-gray-400 dark:text-gray-500 text-sm w-20">Banque</span>
              <select value={bank} onChange={e => setBank(e.target.value)}
                className="flex-1 text-[15px] text-right outline-none bg-transparent py-1 dark:text-white">
                <option value="">— Non spécifiée —</option>
                {settings.banks.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          </div>

          {/* Date & Notes */}
          <p className="section-header">Date & Notes</p>
          <div className="card mx-4 overflow-hidden">
            <div className="px-4 py-2 flex items-center gap-3 border-b border-gray-100 dark:border-gray-700">
              <span className="text-gray-400 dark:text-gray-500 text-sm w-20">Date</span>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="flex-1 text-[15px] text-right outline-none bg-transparent py-1 dark:text-white" />
            </div>
            <div className="px-4 py-2">
              <textarea placeholder="Notes (optionnel)" value={notes} onChange={e => setNotes(e.target.value)}
                rows={2}
                className="w-full text-[15px] outline-none resize-none bg-transparent py-1 placeholder-gray-300 dark:text-white dark:placeholder-gray-600" />
            </div>
          </div>

          <div className="h-8" />
        </form>
      </div>

      {/* Category picker sheet */}
      {showCatPicker && (
        <div className="absolute inset-0 z-10 flex flex-col bg-gray-50 dark:bg-gray-900"
             style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
            <button onClick={() => setShowCatPicker(false)} className="text-blue-600 font-medium">Annuler</button>
            <span className="font-semibold dark:text-white">Catégorie</span>
            <div className="w-16" />
          </div>
          <div className="flex-1 overflow-y-auto scroll-ios">
            {/* Revenus — always shown first */}
            <p className="section-header">Revenus</p>
            <div className="card mx-4 overflow-hidden">
              <button type="button" onClick={() => { setCategory(REVENUS_CATEGORY.id); setShowCatPicker(false) }}
                className="w-full flex items-center gap-3 px-4 py-3 active:bg-gray-50 dark:active:bg-gray-700">
                <span className="text-2xl">{REVENUS_CATEGORY.emoji}</span>
                <div className="flex-1 text-left">
                  <p className="text-[15px] dark:text-white">{REVENUS_CATEGORY.label}</p>
                  <p className="text-xs text-green-600 dark:text-green-400">Salaire, prime, don, remboursement global…</p>
                </div>
                {category === REVENUS_CATEGORY.id && <span className="text-blue-600 text-lg font-bold">✓</span>}
              </button>
            </div>
            <p className="section-header">Charges incompressibles</p>
            <div className="card mx-4 overflow-hidden">
              {FIXED_CATEGORIES.filter(c => !deletedBuiltins.has(c.id)).map((c, i, arr) => (
                <button key={c.id} type="button" onClick={() => { setCategory(c.id); setShowCatPicker(false) }}
                  className={`w-full flex items-center gap-3 px-4 py-3 active:bg-gray-50 dark:active:bg-gray-700
                    ${i < arr.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''}`}>
                  <span className="text-2xl">{c.emoji}</span>
                  <div className="flex-1 text-left">
                    <p className="text-[15px] dark:text-white">{c.label}</p>
                    <p className="text-xs text-red-400">Incompressible</p>
                  </div>
                  {category === c.id && <span className="text-blue-600 text-lg font-bold">✓</span>}
                </button>
              ))}
            </div>
            <p className="section-header">Charges courantes</p>
            <div className="card mx-4 overflow-hidden">
              {VARIABLE_CATEGORIES.filter(c => !deletedBuiltins.has(c.id)).map((c, i, arr) => (
                <button key={c.id} type="button" onClick={() => { setCategory(c.id); setShowCatPicker(false) }}
                  className={`w-full flex items-center gap-3 px-4 py-3 active:bg-gray-50 dark:active:bg-gray-700
                    ${i < arr.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''}`}>
                  <span className="text-2xl">{c.emoji}</span>
                  <p className="flex-1 text-[15px] text-left dark:text-white">{c.label}</p>
                  {category === c.id && <span className="text-blue-600 text-lg font-bold">✓</span>}
                </button>
              ))}
            </div>
            {customCategories.length > 0 && (
              <>
                <p className="section-header">Mes catégories</p>
                <div className="card mx-4 overflow-hidden mb-8">
                  {customCategories.map((c, i) => (
                    <button key={c.id} type="button" onClick={() => { setCategory(c.id); setShowCatPicker(false) }}
                      className={`w-full flex items-center gap-3 px-4 py-3 active:bg-gray-50 dark:active:bg-gray-700
                        ${i < customCategories.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''}`}>
                      <span className="text-2xl">{c.emoji}</span>
                      <p className="flex-1 text-[15px] text-left dark:text-white">{c.label}</p>
                      {category === c.id && <span className="text-blue-600 text-lg font-bold">✓</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
            {customCategories.length === 0 && <div className="h-8" />}
          </div>
        </div>
      )}
    </div>
  )
}
