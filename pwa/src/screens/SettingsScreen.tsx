import { useState, useRef, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { CURRENCIES } from '../data/currencies'
import type { CurrencyCode } from '../models/types'
import type { Expense, RecurringExpense } from '../models/types'
import {
  exportJSON, exportCSV,
  parseJSONBackup, parseCSV,
  getAutoBackupSlots, downloadAutoBackup, formatRelativeTime,
} from '../utils/backup'
import type { AutoBackupSlot } from '../utils/backup'

interface PendingImport {
  expenses: Expense[]
  recurring: RecurringExpense[]
  label: string
}

export default function SettingsScreen() {
  const { settings, updateSettings, loadDemoData, expenses, recurring, importData, clearData } = useStore()
  const [newBank, setNewBank] = useState('')
  const [showConfirmDemo, setShowConfirmDemo] = useState(false)
  const [showRates, setShowRates] = useState(false)
  const [backupSlots, setBackupSlots] = useState<AutoBackupSlot[]>([])
  const [pending, setPending] = useState<PendingImport | null>(null)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [importError, setImportError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setBackupSlots(getAutoBackupSlots())
  }, [expenses])

  function addBank() {
    const b = newBank.trim()
    if (!b || settings.banks.includes(b)) { setNewBank(''); return }
    updateSettings({ banks: [...settings.banks, b] })
    setNewBank('')
  }

  function removeBank(bank: string) {
    updateSettings({ banks: settings.banks.filter(b => b !== bank) })
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportError('')
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      if (file.name.toLowerCase().endsWith('.json')) {
        const backup = parseJSONBackup(text)
        if (!backup || backup.expenses.length === 0) {
          setImportError('Fichier JSON invalide ou vide.')
          return
        }
        setPending({
          expenses: backup.expenses,
          recurring: backup.recurring ?? [],
          label: `${backup.expenses.length} dépenses depuis ${file.name}`,
        })
      } else {
        const parsed = parseCSV(text, settings.baseCurrency)
        if (parsed.length === 0) {
          setImportError('Aucune dépense trouvée dans le fichier.')
          return
        }
        setPending({
          expenses: parsed,
          recurring: [],
          label: `${parsed.length} dépenses depuis ${file.name}`,
        })
      }
    }
    reader.readAsText(file, 'utf-8')
    e.target.value = ''
  }

  function confirmImport(merge: boolean) {
    if (!pending) return
    importData(pending.expenses, pending.recurring, merge)
    setBackupSlots(getAutoBackupSlots())
    setPending(null)
  }

  return (
    <div className="flex flex-col h-full"
         style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex-shrink-0">
        <h1 className="text-[22px] font-bold">Réglages</h1>
      </div>

      <div className="flex-1 overflow-y-auto scroll-ios">

        {/* Household */}
        <p className="section-header">Foyer</p>
        <div className="card mx-4 overflow-hidden">
          <div className="flex items-center px-4 py-3 border-b border-gray-100">
            <span className="text-gray-400 text-sm w-28">Personne 1</span>
            <input type="text" value={settings.person1Name}
              onChange={e => updateSettings({ person1Name: e.target.value })}
              className="flex-1 text-[15px] text-right outline-none" placeholder="Prénom" />
          </div>
          <div className="flex items-center px-4 py-3">
            <span className="text-gray-400 text-sm w-28">Personne 2</span>
            <input type="text" value={settings.person2Name}
              onChange={e => updateSettings({ person2Name: e.target.value })}
              className="flex-1 text-[15px] text-right outline-none" placeholder="Prénom" />
          </div>
        </div>

        {/* Currency */}
        <p className="section-header">Devise</p>
        <div className="card mx-4 overflow-hidden">
          <div className="flex items-center px-4 py-3 border-b border-gray-100">
            <span className="text-gray-400 text-sm flex-1">Devise de référence</span>
            <select value={settings.baseCurrency}
              onChange={e => updateSettings({ baseCurrency: e.target.value as CurrencyCode })}
              className="text-[15px] text-blue-600 font-medium outline-none bg-transparent">
              {CURRENCIES.map(c => (
                <option key={c.code} value={c.code}>{c.flag} {c.code} – {c.name}</option>
              ))}
            </select>
          </div>
          <button onClick={() => setShowRates(!showRates)}
            className="w-full flex items-center justify-between px-4 py-3 text-left">
            <span className="text-[15px] text-blue-600">Taux de conversion</span>
            <span className="text-gray-300">{showRates ? '▲' : '▼'}</span>
          </button>
          {showRates && (
            <div className="px-4 pb-3">
              {CURRENCIES.filter(c => c.code !== settings.baseCurrency).map(c => {
                const fromRate = { EUR: 1, USD: 1.08, GBP: 0.86, CHF: 0.96, MAD: 10.85, DZD: 145.2, TND: 3.35, JPY: 162.5, CAD: 1.47, AUD: 1.65, SGD: 1.45, AED: 3.97 }
                const toRate = fromRate[c.code as keyof typeof fromRate] / fromRate[settings.baseCurrency as keyof typeof fromRate]
                const from = CURRENCIES.find(x => x.code === settings.baseCurrency)!
                return (
                  <div key={c.code} className="flex justify-between py-1.5 border-b border-gray-50 last:border-0">
                    <span className="text-[13px] text-gray-500">{from.flag} 1 {settings.baseCurrency}</span>
                    <span className="text-[13px] font-medium">{toRate.toFixed(4)} {c.code} {c.flag}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Banks */}
        <p className="section-header">Banques</p>
        <div className="card mx-4 overflow-hidden">
          {settings.banks.map((bank, i) => (
            <div key={bank} className={`flex items-center gap-3 px-4 py-3 ${i < settings.banks.length - 1 ? 'border-b border-gray-100' : ''}`}>
              <span className="text-[15px] flex-1">🏦 {bank}</span>
              <button onClick={() => removeBank(bank)} className="text-red-400 text-xl">×</button>
            </div>
          ))}
          <div className={`flex items-center gap-3 px-4 py-3 ${settings.banks.length > 0 ? 'border-t border-gray-100' : ''}`}>
            <span className="text-green-500 text-xl">+</span>
            <input type="text" placeholder="Ajouter une banque…"
              value={newBank} onChange={e => setNewBank(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addBank()}
              className="flex-1 text-[15px] outline-none" />
            {newBank && (
              <button onClick={addBank} className="text-blue-600 text-[14px] font-medium">OK</button>
            )}
          </div>
        </div>

        {/* Backup & Data */}
        <p className="section-header">Sauvegarde & Données</p>
        <div className="card mx-4 overflow-hidden">
          <button onClick={() => exportJSON(expenses, recurring, settings)}
            className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-100 text-left">
            <span className="text-[15px] text-blue-600">Exporter JSON</span>
            <span className="text-gray-400 text-[13px]">↑ Sauvegarde complète</span>
          </button>
          <button onClick={() => exportCSV(expenses)}
            className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-100 text-left">
            <span className="text-[15px] text-blue-600">Exporter TSV (tableur)</span>
            <span className="text-gray-400 text-[13px]">↑ Format tableur</span>
          </button>
          <button onClick={() => fileRef.current?.click()}
            className="w-full flex items-center justify-between px-4 py-3 text-left">
            <span className="text-[15px] text-blue-600">Importer un fichier…</span>
            <span className="text-gray-400 text-[13px]">↓ JSON ou TSV/CSV</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,.tsv,.csv,.txt"
            className="hidden"
            onChange={handleFileChange}
          />
          {importError && (
            <p className="px-4 py-2 text-[13px] text-red-500 border-t border-gray-100">{importError}</p>
          )}
        </div>

        {/* Auto-backup slots */}
        {backupSlots.length > 0 && (
          <>
            <p className="section-header">Sauvegardes automatiques</p>
            <div className="card mx-4 overflow-hidden">
              {backupSlots.map((slot, i) => (
                <div key={slot.savedAt}
                  className={`flex items-center justify-between px-4 py-3 ${i < backupSlots.length - 1 ? 'border-b border-gray-100' : ''}`}>
                  <div>
                    <p className="text-[15px]">{formatRelativeTime(slot.savedAt)}</p>
                    <p className="text-[12px] text-gray-400">{slot.data.expenses.length} dépenses</p>
                  </div>
                  <button onClick={() => downloadAutoBackup(slot)}
                    className="text-blue-600 text-[14px] font-medium">
                    ↓ Télécharger
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Data management */}
        <p className="section-header">Données</p>
        <div className="card mx-4 overflow-hidden">
          {expenses.length > 0 ? (
            <>
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-[15px] text-gray-500">{expenses.length} dépenses enregistrées</p>
                <p className="text-[12px] text-gray-400 mt-0.5">Stockées localement sur votre appareil</p>
              </div>
              <button onClick={() => setShowConfirmDemo(true)}
                className="w-full px-4 py-3 text-left text-blue-600 text-[15px] border-b border-gray-100">
                📥 Recharger les données de démonstration
              </button>
              <button onClick={() => setShowClearConfirm(true)}
                className="w-full px-4 py-3 text-left text-red-500 text-[15px]">
                🗑 Effacer toutes les données
              </button>
            </>
          ) : (
            <button onClick={() => setShowConfirmDemo(true)}
              className="w-full px-4 py-3 text-left text-blue-600 text-[15px]">
              📥 Charger des données de démonstration
            </button>
          )}
        </div>

        {/* About */}
        <p className="section-header">À propos</p>
        <div className="card mx-4 overflow-hidden mb-8">
          <div className="px-4 py-3 border-b border-gray-100 flex justify-between">
            <span className="text-[15px] text-gray-600">Version</span>
            <span className="text-[15px] text-gray-400">1.0.0</span>
          </div>
          <div className="px-4 py-3 flex justify-between">
            <span className="text-[15px] text-gray-600">Données</span>
            <span className="text-[15px] text-gray-400">Stockées localement</span>
          </div>
        </div>
      </div>

      {/* Confirm demo data */}
      {showConfirmDemo && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
          <div className="bg-white rounded-t-3xl w-full p-6"
               style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}>
            <p className="text-[17px] font-bold text-center mb-2">Données de démonstration</p>
            <p className="text-[14px] text-gray-500 text-center mb-6">
              Ceci va remplacer toutes les données actuelles par des données d'exemple.
            </p>
            <button onClick={() => { loadDemoData(); setShowConfirmDemo(false) }}
              className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-semibold text-[16px] mb-3">
              Charger les données
            </button>
            <button onClick={() => setShowConfirmDemo(false)}
              className="w-full py-3.5 bg-gray-100 text-gray-700 rounded-xl font-medium text-[16px]">
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Confirm clear */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
          <div className="bg-white rounded-t-3xl w-full p-6"
               style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}>
            <p className="text-[17px] font-bold text-center mb-2">Effacer toutes les données ?</p>
            <p className="text-[14px] text-gray-500 text-center mb-6">
              Cette action est irréversible. Pensez à exporter une sauvegarde avant.
            </p>
            <button onClick={() => { clearData(); setShowClearConfirm(false) }}
              className="w-full py-3.5 bg-red-500 text-white rounded-xl font-semibold text-[16px] mb-3">
              Effacer définitivement
            </button>
            <button onClick={() => setShowClearConfirm(false)}
              className="w-full py-3.5 bg-gray-100 text-gray-700 rounded-xl font-medium text-[16px]">
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Import confirmation */}
      {pending && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
          <div className="bg-white rounded-t-3xl w-full p-6"
               style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}>
            <p className="text-[17px] font-bold text-center mb-2">Importer des données</p>
            <p className="text-[14px] text-gray-500 text-center mb-6">{pending.label}</p>
            <button onClick={() => confirmImport(false)}
              className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-semibold text-[16px] mb-3">
              Remplacer les données existantes
            </button>
            <button onClick={() => confirmImport(true)}
              className="w-full py-3.5 bg-blue-100 text-blue-700 rounded-xl font-semibold text-[16px] mb-3">
              Fusionner avec les données existantes
            </button>
            <button onClick={() => setPending(null)}
              className="w-full py-3.5 bg-gray-100 text-gray-700 rounded-xl font-medium text-[16px]">
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
