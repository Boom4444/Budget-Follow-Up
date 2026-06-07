import { useState, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { CATEGORIES, CATEGORY_MAP, FIXED_CATEGORIES, VARIABLE_CATEGORIES } from '../data/categories'
import { CURRENCIES } from '../data/currencies'
import type { RecurringExpense, CurrencyCode, HouseholdMember, RecurrenceFrequency } from '../models/types'

const FREQ_LABELS: Record<RecurrenceFrequency, string> = {
  weekly: 'Hebdomadaire', biweekly: 'Bi-mensuel',
  monthly: 'Mensuel', quarterly: 'Trimestriel', yearly: 'Annuel',
}
const FREQ_SHORT: Record<RecurrenceFrequency, string> = {
  weekly: '/ sem.', biweekly: '/ 2 sem.', monthly: '/ mois', quarterly: '/ trim.', yearly: '/ an',
}
const MONTHLY_MULT: Record<RecurrenceFrequency, number> = {
  weekly: 52/12, biweekly: 26/12, monthly: 1, quarterly: 1/3, yearly: 1/12,
}

export default function RecurringScreen() {
  const { recurring, settings, addRecurring, updateRecurring, deleteRecurring } = useStore()
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  const fixed    = recurring.filter(r => r.isFixed)
  const variable = recurring.filter(r => !r.isFixed)
  const monthlyTotal = recurring.reduce((s, r) => s + r.amount * MONTHLY_MULT[r.frequency], 0)

  function openNew()  { setEditId(null); setShowForm(true) }
  function openEdit(r: RecurringExpense) { setEditId(r.id); setShowForm(true) }

  return (
    <div className="flex flex-col h-full"
         style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <h1 className="text-[22px] font-bold dark:text-white">Récurrentes</h1>
        <button onClick={openNew}
          className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center text-white text-xl font-light">+</button>
      </div>

      <div className="flex-1 overflow-y-auto scroll-ios">
        {recurring.length > 0 && (
          <div className="card mx-4 mt-4 p-4">
            <p className="text-[12px] text-gray-400 dark:text-gray-500">Charge mensuelle estimée</p>
            <p className="text-[28px] font-bold mt-1 dark:text-white">
              {monthlyTotal.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
            </p>
            <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-1">{recurring.length} modèle{recurring.length > 1 ? 's' : ''}</p>
          </div>
        )}

        {fixed.length > 0 && (
          <>
            <p className="section-header">🔒 Charges incompressibles</p>
            <div className="card mx-4 overflow-hidden">
              {fixed.map((r, i) => <RecurringRow key={r.id} r={r} settings={settings} i={i} total={fixed.length} onEdit={() => openEdit(r)} onDelete={() => deleteRecurring(r.id)} />)}
            </div>
          </>
        )}

        {variable.length > 0 && (
          <>
            <p className="section-header">📈 Charges courantes</p>
            <div className="card mx-4 overflow-hidden">
              {variable.map((r, i) => <RecurringRow key={r.id} r={r} settings={settings} i={i} total={variable.length} onEdit={() => openEdit(r)} onDelete={() => deleteRecurring(r.id)} />)}
            </div>
          </>
        )}

        {recurring.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center px-8">
            <span className="text-4xl mb-3">🔄</span>
            <p className="text-[17px] font-semibold text-gray-700 dark:text-gray-200 mb-1">Aucun modèle</p>
            <p className="text-[14px] text-gray-400 dark:text-gray-500 mb-4">Créez des modèles pour vos charges fixes et récurrentes</p>
            <button onClick={openNew}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-medium">Créer un modèle</button>
          </div>
        )}

        <div className="h-8" />
      </div>

      {showForm && (
        <RecurringFormModal
          editItem={editId ? recurring.find(r => r.id === editId) : undefined}
          settings={settings}
          onClose={() => setShowForm(false)}
          onSave={(data) => {
            if (editId) updateRecurring(editId, data)
            else addRecurring(data)
            setShowForm(false)
          }}
        />
      )}
    </div>
  )
}

function RecurringRow({ r, settings, i, total, onEdit, onDelete }: {
  r: RecurringExpense; settings: any; i: number; total: number; onEdit: () => void; onDelete: () => void
}) {
  const cat = CATEGORY_MAP[r.category as keyof typeof CATEGORY_MAP]
  const personName = r.person === 'person1' ? settings.person1Name : r.person === 'person2' ? settings.person2Name : 'Commun'

  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${i < total - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''}`}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
        style={{ backgroundColor: cat?.bgColor ?? '#f3f4f6' }}>
        {cat?.emoji ?? '📦'}
      </div>
      <button className="flex-1 min-w-0 text-left" onClick={onEdit}>
        <div className="flex items-center gap-1.5">
          <p className="text-[15px] font-medium truncate dark:text-white">{r.title}</p>
          {r.isFixed && <span className="text-[10px]">🔒</span>}
        </div>
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
          {r.subCategory && <span className="mr-1">{r.subCategory} ·</span>}
          {FREQ_LABELS[r.frequency]} · {personName}
        </p>
      </button>
      <div className="text-right flex-shrink-0">
        <p className="text-[15px] font-semibold dark:text-white">{r.amount.toFixed(2).replace('.', ',')} {CURRENCIES.find(c => c.code === r.currency)?.symbol}</p>
        <p className="text-[11px] text-gray-400 dark:text-gray-500">{FREQ_SHORT[r.frequency]}</p>
      </div>
      <button onClick={onDelete} className="text-gray-200 dark:text-gray-600 text-xl ml-1 active:text-red-400">×</button>
    </div>
  )
}

function RecurringFormModal({ editItem, settings, onClose, onSave }: {
  editItem?: RecurringExpense
  settings: any
  onClose: () => void
  onSave: (data: Omit<RecurringExpense, 'id'>) => void
}) {
  const [title, setTitle]           = useState(editItem?.title ?? '')
  const [amount, setAmount]         = useState(editItem ? String(editItem.amount) : '')
  const [currency, setCurrency]     = useState<CurrencyCode>(editItem?.currency ?? settings.baseCurrency)
  const [category, setCategory]     = useState<string>(editItem?.category ?? 'nourriture')
  const [subCategory, setSubCategory] = useState(editItem?.subCategory ?? '')
  const [isFixed, setIsFixed]       = useState(editItem?.isFixed ?? false)
  const [bank, setBank]             = useState(editItem?.bank ?? '')
  const [person, setPerson]         = useState<HouseholdMember>(editItem?.person ?? 'person1')
  const [frequency, setFrequency]   = useState<RecurrenceFrequency>(editItem?.frequency ?? 'monthly')
  const [showCatPicker, setShowCatPicker] = useState(false)

  useEffect(() => {
    const cat = CATEGORIES.find(c => c.id === category)
    if (cat) {
      setIsFixed(cat.isFixed)
      if (!editItem) setSubCategory(cat.subCategories[0] ?? '')
    }
  }, [category])

  const cat = CATEGORY_MAP[category]
  const subCategories = cat?.subCategories ?? []
  const isValid = title.trim() && !isNaN(parseFloat(amount.replace(',', '.')))

  function handleSave() {
    const num = parseFloat(amount.replace(',', '.'))
    if (!isValid) return
    onSave({ title: title.trim(), amount: num, currency, category, subCategory, isFixed, bank, person, frequency })
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-50 dark:bg-gray-900"
         style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <button onClick={onClose} className="text-blue-600 font-medium text-[15px]">Annuler</button>
        <span className="font-semibold dark:text-white">{editItem ? 'Modifier' : 'Nouveau modèle'}</span>
        <button onClick={handleSave} disabled={!isValid}
          className="text-blue-600 font-semibold text-[15px] disabled:text-gray-300">
          Enregistrer
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scroll-ios">
        <p className="section-header">Description</p>
        <div className="card mx-4">
          <input type="text" placeholder="Ex : Loyer, Sanitas, Spotify…"
            value={title} onChange={e => setTitle(e.target.value)}
            className="w-full px-4 py-3 text-[17px] outline-none rounded-2xl bg-transparent dark:text-white dark:placeholder-gray-500" />
        </div>

        <p className="section-header">Montant</p>
        <div className="card mx-4 flex items-center px-4 gap-3">
          <input type="text" inputMode="decimal" placeholder="0,00"
            value={amount} onChange={e => setAmount(e.target.value)}
            className="flex-1 py-3 text-[22px] font-semibold outline-none bg-transparent dark:text-white dark:placeholder-gray-500" />
          <div className="h-8 w-px bg-gray-200 dark:bg-gray-600" />
          {/* Custom currency picker — hidden select overlaid for native iOS wheel */}
          <div className="relative flex items-center gap-1 py-3 cursor-pointer">
            <select value={currency} onChange={e => setCurrency(e.target.value as CurrencyCode)}
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" aria-label="Devise">
              {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
            </select>
            <span className="text-[18px] leading-none">{CURRENCIES.find(c => c.code === currency)?.flag}</span>
            <span className="text-[15px] text-blue-600 font-semibold">{currency}</span>
            <span className="text-blue-400 text-[11px] leading-none">▾</span>
          </div>
        </div>

        <p className="section-header">Catégorie</p>
        <div className="card mx-4">
          <button type="button" onClick={() => setShowCatPicker(true)}
            className="w-full flex items-center gap-3 px-4 py-3">
            <span className="text-2xl">{cat.emoji}</span>
            <div className="flex-1 text-left">
              <p className="text-[15px] font-medium dark:text-white">{cat.label}</p>
              {cat.isFixed && <p className="text-xs text-red-500">🔒 Incompressible</p>}
            </div>
            <span className="text-gray-300 dark:text-gray-600 text-lg">›</span>
          </button>
        </div>

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

        <p className="section-header">Charge incompressible</p>
        <div className="card mx-4 px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[15px] font-medium dark:text-white">Charge fixe</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">Loyer, assurance, impôts…</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={isFixed} onChange={e => setIsFixed(e.target.checked)} className="sr-only peer" />
            <div className="w-11 h-6 bg-gray-200 dark:bg-gray-600 rounded-full peer-checked:bg-red-500 peer-checked:after:translate-x-5
              after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full
              after:h-5 after:w-5 after:transition-transform"></div>
          </label>
        </div>

        <p className="section-header">Fréquence</p>
        <div className="card mx-4 overflow-hidden">
          {(['weekly','biweekly','monthly','quarterly','yearly'] as RecurrenceFrequency[]).map((f, i, arr) => (
            <button key={f} type="button" onClick={() => setFrequency(f)}
              className={`w-full flex items-center justify-between px-4 py-3 ${i < arr.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''}`}>
              <span className="text-[15px] dark:text-white">{FREQ_LABELS[f]}</span>
              {frequency === f && <span className="text-blue-600 font-bold">✓</span>}
            </button>
          ))}
        </div>

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
          <div className="px-4 py-2 flex items-center gap-3">
            <span className="text-gray-400 dark:text-gray-500 text-sm w-20">Banque</span>
            <select value={bank} onChange={e => setBank(e.target.value)}
              className="flex-1 text-[15px] text-right outline-none bg-transparent py-1 dark:text-white">
              <option value="">— Non spécifiée —</option>
              {settings.banks.map((b: string) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        </div>

        <div className="h-8" />
      </div>

      {showCatPicker && (
        <div className="absolute inset-0 z-10 flex flex-col bg-gray-50 dark:bg-gray-900"
             style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
            <button onClick={() => setShowCatPicker(false)} className="text-blue-600 font-medium">Annuler</button>
            <span className="font-semibold dark:text-white">Catégorie</span>
            <div className="w-16" />
          </div>
          <div className="flex-1 overflow-y-auto scroll-ios">
            <p className="section-header">Incompressibles</p>
            <div className="card mx-4 overflow-hidden">
              {FIXED_CATEGORIES.map((c, i) => (
                <button key={c.id} type="button" onClick={() => { setCategory(c.id); setIsFixed(true); setShowCatPicker(false) }}
                  className={`w-full flex items-center gap-3 px-4 py-3 ${i < FIXED_CATEGORIES.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''}`}>
                  <span className="text-2xl">{c.emoji}</span>
                  <div className="flex-1 text-left">
                    <p className="text-[15px] dark:text-white">{c.label}</p>
                    <p className="text-xs text-red-400">Incompressible</p>
                  </div>
                  {category === c.id && <span className="text-blue-600 font-bold">✓</span>}
                </button>
              ))}
            </div>
            <p className="section-header">Courantes</p>
            <div className="card mx-4 overflow-hidden mb-8">
              {VARIABLE_CATEGORIES.map((c, i) => (
                <button key={c.id} type="button" onClick={() => { setCategory(c.id); setShowCatPicker(false) }}
                  className={`w-full flex items-center gap-3 px-4 py-3 ${i < VARIABLE_CATEGORIES.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''}`}>
                  <span className="text-2xl">{c.emoji}</span>
                  <div className="flex-1 text-left">
                    <p className="text-[15px] dark:text-white">{c.label}</p>
                    {c.subCategories.length > 0 && (
                      <p className="text-xs text-gray-400 dark:text-gray-500">{c.subCategories.slice(0,3).join(', ')}{c.subCategories.length > 3 ? '…' : ''}</p>
                    )}
                  </div>
                  {category === c.id && <span className="text-blue-600 font-bold">✓</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
