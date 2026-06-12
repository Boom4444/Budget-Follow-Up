import { useState, useRef, useEffect } from 'react'
import { useStore } from '../store/useStore'
import type { AppSettings } from '../models/types'
import {
  exportJSON, exportCSV, exportXLSX, exportPDF,
  parseJSONBackup, parseCSV,
  getAutoBackupSlots, downloadAutoBackup, formatRelativeTime,
} from '../utils/backup'
import type { AutoBackupSlot } from '../utils/backup'
import TrashSheet from '../components/TrashSheet'
import AppearanceSection from '../components/settings/AppearanceSection'
import HouseholdSection from '../components/settings/HouseholdSection'
import CurrencySection from '../components/settings/CurrencySection'
import CategoriesSection from '../components/settings/CategoriesSection'
import AIAssistantSection from '../components/settings/AIAssistantSection'
import AboutSection from '../components/settings/AboutSection'
import GoogleDriveSection from '../components/settings/GoogleDriveSection'
import type { PendingImport } from '../components/settings/types'

interface Props {
  onShowHelp?: () => void
}

export default function SettingsScreen({ onShowHelp }: Props) {
  const {
    settings, updateSettings, loadDemoData, expenses, recurring, budgets,
    importData, clearData, trashedExpenses, trashedRecurring, purgeExpiredTrash,
  } = useStore()
  const [showConfirmDemo, setShowConfirmDemo] = useState(false)
  const [backupSlots, setBackupSlots] = useState<AutoBackupSlot[]>([])
  const [pending, setPending] = useState<PendingImport | null>(null)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [importError, setImportError] = useState('')

  // Export format sheet
  const [showExportSheet, setShowExportSheet] = useState(false)
  const [showTrash, setShowTrash] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setBackupSlots(getAutoBackupSlots())
  }, [expenses])

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
        setPending({ expenses: backup.expenses, recurring: backup.recurring ?? [], budgets: backup.budgets ?? [], settings: backup.settings, label: `${backup.expenses.length} dépenses depuis ${file.name}` })
      } else {
        const parsed = parseCSV(text, settings.baseCurrency)
        if (parsed.length === 0) {
          setImportError('Aucune dépense trouvée dans le fichier.')
          return
        }
        setPending({ expenses: parsed, recurring: [], budgets: [], label: `${parsed.length} dépenses depuis ${file.name}` })
      }
    }
    reader.readAsText(file, 'utf-8')
    e.target.value = ''
  }

  function confirmImport(merge: boolean) {
    if (!pending) return
    importData(pending.expenses, pending.recurring, pending.budgets, merge)
    // Restore preferences from the backup too (only when replacing, never when
    // merging into existing data). Connection-specific fields are kept local.
    if (!merge && pending.settings) {
      // currentUser is device-specific: restoring a backup made on the
      // partner's phone must not change who this device belongs to
      const { claudeApiKey: _k, autoBackupFileId: _f, currentUser: _u, ...restored } = pending.settings as AppSettings
      updateSettings(restored)
    }
    setBackupSlots(getAutoBackupSlots())
    setPending(null)
  }

  // ── Export helpers ────────────────────────────────────────────────────────

  function handleExport(format: 'json' | 'csv' | 'xlsx' | 'pdf') {
    setShowExportSheet(false)
    if (format === 'json') exportJSON(expenses, recurring, settings, budgets)
    else if (format === 'csv') exportCSV(expenses, budgets)
    else if (format === 'xlsx') exportXLSX(expenses, budgets)
    else if (format === 'pdf') exportPDF(expenses, settings.baseCurrency, budgets)
  }

  return (
    <div className="flex flex-col h-full"
         style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700 px-4 py-3 flex-shrink-0">
        <h1 className="text-[22px] font-bold dark:text-white">Réglages</h1>
      </div>

      <div className="flex-1 overflow-y-auto scroll-ios">

        <AppearanceSection />
        <HouseholdSection />
        <CurrencySection />

        <CategoriesSection />

        <AIAssistantSection />

        {/* Backup & Data */}
        <p className="section-header">Sauvegarde & Données</p>
        <div className="card mx-4 overflow-hidden">
          <button onClick={() => setShowExportSheet(true)}
            className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 text-left">
            <span className="text-[15px] text-blue-600">Exporter…</span>
            <span className="text-gray-400 dark:text-gray-500 text-[13px]">JSON · CSV · Excel · PDF</span>
          </button>
          <button onClick={() => fileRef.current?.click()}
            className="w-full flex items-center justify-between px-4 py-3 text-left">
            <span className="text-[15px] text-blue-600">Importer un fichier…</span>
            <span className="text-gray-400 dark:text-gray-500 text-[13px]">↓ JSON, CSV, Excel ou TXT</span>
          </button>
          <input ref={fileRef} type="file" accept=".json,.tsv,.csv,.txt,.xls,.xlsx" className="hidden" onChange={handleFileChange} />
          {importError && (
            <p className="px-4 py-2 text-[13px] text-red-500 border-t border-gray-100 dark:border-gray-700">{importError}</p>
          )}
          <button onClick={() => { purgeExpiredTrash(); setShowTrash(true) }}
            className="w-full flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-700 text-left">
            <span className="text-[15px] text-blue-600">🗑️ Corbeille</span>
            <span className="text-gray-400 dark:text-gray-500 text-[13px]">
              {trashedExpenses.length + trashedRecurring.length > 0
                ? `${trashedExpenses.length + trashedRecurring.length} élément${trashedExpenses.length + trashedRecurring.length > 1 ? 's' : ''} ›`
                : 'Vide ›'}
            </span>
          </button>
        </div>

        <GoogleDriveSection onRestore={setPending} />

        {/* Auto-backup slots */}
        {backupSlots.length > 0 && (
          <>
            <p className="section-header">Sauvegardes automatiques</p>
            <div className="card mx-4 overflow-hidden">
              {backupSlots.map((slot, i) => (
                <div key={slot.savedAt}
                  className={`flex items-center justify-between px-4 py-3 ${i < backupSlots.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''}`}>
                  <div>
                    <p className="text-[15px] dark:text-white">{formatRelativeTime(slot.savedAt)}</p>
                    <p className="text-[12px] text-gray-400 dark:text-gray-500">{slot.data.expenses.length} dépenses</p>
                  </div>
                  <button onClick={() => downloadAutoBackup(slot)}
                    className="text-blue-600 text-[14px] font-medium">↓ Télécharger</button>
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
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                <p className="text-[15px] text-gray-500 dark:text-gray-400">{expenses.length} dépenses enregistrées</p>
                <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">Stockées localement sur votre appareil</p>
              </div>
              <button onClick={() => setShowConfirmDemo(true)}
                className="w-full px-4 py-3 text-left text-blue-600 text-[15px] border-b border-gray-100 dark:border-gray-700">
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

        <AboutSection onShowHelp={onShowHelp} />
      </div>

      {/* ── Modals ── */}

      {showConfirmDemo && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-800 rounded-t-3xl w-full p-6"
               style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}>
            <p className="text-[17px] font-bold text-center mb-2 dark:text-white">Données de démonstration</p>
            <p className="text-[14px] text-gray-500 dark:text-gray-400 text-center mb-6">
              Ceci va remplacer toutes les données actuelles par des données d'exemple.
            </p>
            <button onClick={() => { loadDemoData(); setShowConfirmDemo(false) }}
              className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-semibold text-[16px] mb-3">
              Charger les données
            </button>
            <button onClick={() => setShowConfirmDemo(false)}
              className="w-full py-3.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-medium text-[16px]">
              Annuler
            </button>
          </div>
        </div>
      )}

      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-800 rounded-t-3xl w-full p-6"
               style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}>
            <p className="text-[17px] font-bold text-center mb-2 dark:text-white">Effacer toutes les données ?</p>
            <p className="text-[14px] text-gray-500 dark:text-gray-400 text-center mb-6">
              Cette action est irréversible. Pensez à exporter une sauvegarde avant.
            </p>
            <button onClick={() => { clearData(); setShowClearConfirm(false) }}
              className="w-full py-3.5 bg-red-500 text-white rounded-xl font-semibold text-[16px] mb-3">
              Effacer définitivement
            </button>
            <button onClick={() => setShowClearConfirm(false)}
              className="w-full py-3.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-medium text-[16px]">
              Annuler
            </button>
          </div>
        </div>
      )}

      {pending && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-800 rounded-t-3xl w-full p-6"
               style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}>
            <p className="text-[17px] font-bold text-center mb-2 dark:text-white">Importer des données</p>
            <p className="text-[14px] text-gray-500 dark:text-gray-400 text-center mb-6">{pending.label}</p>
            <button onClick={() => confirmImport(false)}
              className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-semibold text-[16px] mb-3">
              Remplacer les données existantes
            </button>
            <button onClick={() => confirmImport(true)}
              className="w-full py-3.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-xl font-semibold text-[16px] mb-3">
              Fusionner avec les données existantes
            </button>
            <button onClick={() => setPending(null)}
              className="w-full py-3.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-medium text-[16px]">
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Export format sheet */}
      {showExportSheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-800 rounded-t-3xl w-full p-6"
               style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}>
            <p className="text-[17px] font-bold text-center mb-1 dark:text-white">Exporter les données</p>
            <p className="text-[13px] text-gray-400 dark:text-gray-500 text-center mb-5">{expenses.length} transactions</p>
            <div className="space-y-2.5 mb-4">
              {[
                { fmt: 'json' as const, label: '📄 JSON', desc: 'Sauvegarde complète · restaurable' },
                { fmt: 'csv'  as const, label: '📊 CSV',  desc: 'Compatible Excel, Numbers, LibreOffice' },
                { fmt: 'xlsx' as const, label: '🗂 Excel (.xlsx)', desc: 'Fichier tableur natif' },
                { fmt: 'pdf'  as const, label: '🖨 PDF',  desc: 'Aperçu imprimable' },
              ].map(({ fmt, label, desc }) => (
                <button key={fmt} onClick={() => handleExport(fmt)}
                  className="w-full flex items-center justify-between px-4 py-3.5 bg-gray-50 dark:bg-gray-700 rounded-xl text-left">
                  <span className="text-[15px] font-semibold text-blue-600">{label}</span>
                  <span className="text-[12px] text-gray-400 dark:text-gray-500">{desc}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setShowExportSheet(false)}
              className="w-full py-3.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-medium text-[16px]">
              Annuler
            </button>
          </div>
        </div>
      )}

      {showTrash && <TrashSheet onClose={() => setShowTrash(false)} />}
    </div>
  )
}
