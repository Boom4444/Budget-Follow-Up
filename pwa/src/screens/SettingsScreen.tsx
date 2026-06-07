import { useState, useRef, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { CURRENCIES } from '../data/currencies'
import type { CurrencyCode, AppTheme, MonthlyBudget, CustomCategoryDef } from '../models/types'
import type { Expense, RecurringExpense } from '../models/types'
import { v4 as uuid } from 'uuid'
import {
  exportJSON, exportCSV, exportXLSX, exportPDF,
  parseJSONBackup, parseCSV,
  getAutoBackupSlots, downloadAutoBackup, formatRelativeTime,
} from '../utils/backup'
import type { AutoBackupSlot } from '../utils/backup'
import {
  requestDriveToken, uploadToDrive, listDriveBackups, listDriveFolders, downloadFromDrive,
} from '../utils/googleDrive'
import type { DriveFile, DriveFolder } from '../utils/googleDrive'
import { useRegisterSW } from 'virtual:pwa-register/react'

interface PendingImport {
  expenses: Expense[]
  recurring: RecurringExpense[]
  budgets: MonthlyBudget[]
  label: string
}

interface Props {
  onShowHelp?: () => void
}

const THEME_OPTIONS: { value: AppTheme; label: string; icon: string }[] = [
  { value: 'light',  label: 'Clair',    icon: '☀️' },
  { value: 'dark',   label: 'Sombre',   icon: '🌙' },
  { value: 'system', label: 'Système',  icon: '⚙️' },
]

const EMOJI_GROUPS = [
  { label: 'Logement & Maison', emojis: ['🏠', '🏡', '🏢', '🛋️', '💡', '🔧', '🪴', '🛁', '🚿', '🪑', '🛏️', '🪟'] },
  { label: 'Nourriture', emojis: ['🍽️', '🛒', '🥘', '🍕', '☕', '🧺', '🍷', '🍰', '🥗', '🌮', '🍣', '🍜'] },
  { label: 'Transport', emojis: ['🚗', '✈️', '🚂', '⛽', '🛵', '🚌', '🚕', '🛞', '🚴', '🏍️', '⛵', '🚁'] },
  { label: 'Loisirs & Voyage', emojis: ['🎯', '🎮', '🏖️', '🎬', '🎸', '🎲', '🎨', '🎭', '⛷️', '🏄', '🎃', '🎡'] },
  { label: 'Travail', emojis: ['💼', '💻', '📊', '📱', '📧', '💰', '📝', '🗃️', '📋', '🖊️', '🔒', '📞'] },
  { label: 'Santé', emojis: ['💊', '🏥', '🩺', '💉', '🩹', '🧬', '👓', '🦷', '🩻', '🌡️', '🧪', '💆'] },
  { label: 'Mode', emojis: ['👔', '👗', '💄', '👠', '👟', '🧳', '💍', '👜', '🎩', '👒', '🧣', '🥿'] },
  { label: 'Sport', emojis: ['🏋️', '🏊', '⚽', '🎾', '🚴', '🏃', '🥊', '⛷️', '🤸', '🧘', '🎿', '🏇'] },
  { label: 'Beauté', emojis: ['💇', '💅', '🧴', '🪒', '🪭', '🧖', '🌸', '✨', '💐', '🌺', '🌹', '💋'] },
  { label: 'Famille & Cadeaux', emojis: ['👨‍👩‍👧', '🎁', '💝', '🎂', '👶', '🐾', '🎀', '🧸', '🎈', '🥳', '🎉', '💌'] },
  { label: 'Finance', emojis: ['💳', '🏦', '💸', '💎', '🪙', '💵', '📈', '🧾', '📑', '🏧', '💹', '🔐'] },
  { label: 'Tech', emojis: ['📱', '💻', '📺', '🎧', '📷', '🕹️', '🖥️', '⌚', '🔋', '📡', '🤖', '🖨️'] },
  { label: 'Divers', emojis: ['⭐', '🌟', '✨', '🔖', '📌', '🗓️', '🏷️', '📦', '🗝️', '🔑', '🎗️', '🌈'] },
]

export default function SettingsScreen({ onShowHelp }: Props) {
  const { settings, updateSettings, loadDemoData, expenses, recurring, budgets, importData, clearData } = useStore()
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()
  const [newBank, setNewBank] = useState('')
  const [newCatEmoji, setNewCatEmoji] = useState('📦')
  const [newCatLabel, setNewCatLabel] = useState('')
  const [newCatFixed, setNewCatFixed] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showConfirmDemo, setShowConfirmDemo] = useState(false)
  const [showRates, setShowRates] = useState(false)
  const [backupSlots, setBackupSlots] = useState<AutoBackupSlot[]>([])
  const [pending, setPending] = useState<PendingImport | null>(null)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [importError, setImportError] = useState('')

  // Export format sheet
  const [showExportSheet, setShowExportSheet] = useState(false)

  // Update check status
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'none' | 'available'>('idle')
  const [availableVersion, setAvailableVersion] = useState<string | null>(null)

  // Google Drive state (ephemeral — not persisted)
  const [driveToken, setDriveToken] = useState<string | null>(null)
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([])
  const [driveFolders, setDriveFolders] = useState<DriveFolder[]>([])
  const [showFolderPicker, setShowFolderPicker] = useState(false)
  const [driveLoading, setDriveLoading] = useState(false)
  const [driveError, setDriveError] = useState('')
  const [driveClientIdInput, setDriveClientIdInput] = useState(settings.googleDriveClientId)
  const [showDriveSetup, setShowDriveSetup] = useState(false)

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

  function addCustomCategory() {
    const label = newCatLabel.trim()
    if (!label) return
    const custom = settings.customCategories ?? []
    const newCat: CustomCategoryDef = { id: `custom_${uuid().slice(0, 8)}`, label, emoji: newCatEmoji, isFixed: newCatFixed }
    updateSettings({ customCategories: [...custom, newCat] })
    setNewCatLabel('')
    setNewCatEmoji('📦')
    setNewCatFixed(false)
  }

  function removeCustomCategory(id: string) {
    updateSettings({ customCategories: (settings.customCategories ?? []).filter(c => c.id !== id) })
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
        setPending({ expenses: backup.expenses, recurring: backup.recurring ?? [], budgets: backup.budgets ?? [], label: `${backup.expenses.length} dépenses depuis ${file.name}` })
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
    setBackupSlots(getAutoBackupSlots())
    setPending(null)
  }

  // ── Export helpers ────────────────────────────────────────────────────────

  function handleExport(format: 'json' | 'csv' | 'xlsx' | 'pdf') {
    setShowExportSheet(false)
    if (format === 'json') exportJSON(expenses, recurring, settings, budgets)
    else if (format === 'csv') exportCSV(expenses)
    else if (format === 'xlsx') exportXLSX(expenses)
    else if (format === 'pdf') exportPDF(expenses, settings.baseCurrency)
  }

  // ── Update check ──────────────────────────────────────────────────────────

  async function checkUpdates() {
    if (needRefresh || updateStatus === 'available') {
      updateServiceWorker(true)
      return
    }
    setUpdateStatus('checking')
    try {
      // Trigger the SW to check for a new service worker
      navigator.serviceWorker?.getRegistration().then(reg => reg?.update())
      // Fetch version.json from the server (bypassing cache) to read the latest version number
      const res = await fetch(import.meta.env.BASE_URL + 'version.json', { cache: 'no-store' })
      const json: { version: string } = await res.json()
      if (json.version !== __APP_VERSION__) {
        setAvailableVersion(json.version)
        setUpdateStatus('available')
      } else {
        setUpdateStatus('none')
      }
    } catch {
      setUpdateStatus(needRefresh ? 'available' : 'none')
    }
  }

  // ── Google Drive helpers ──────────────────────────────────────────────────

  async function connectDrive() {
    const clientId = settings.googleDriveClientId.trim()
    if (!clientId) { setShowDriveSetup(true); return }
    setDriveLoading(true)
    setDriveError('')
    try {
      const token = await requestDriveToken(clientId)
      setDriveToken(token)
      const folderId = settings.driveBackupFolder?.id
      const files = await listDriveBackups(token, folderId)
      setDriveFiles(files)
    } catch (err: any) {
      setDriveError(err?.message ?? 'Connexion échouée')
    } finally {
      setDriveLoading(false)
    }
  }

  async function openFolderPicker() {
    if (!driveToken) return
    setDriveLoading(true)
    setDriveError('')
    try {
      const folders = await listDriveFolders(driveToken)
      setDriveFolders(folders)
      setShowFolderPicker(true)
    } catch (err: any) {
      setDriveError(err?.message ?? 'Impossible de lister les dossiers')
    } finally {
      setDriveLoading(false)
    }
  }

  async function selectFolder(folder: DriveFolder) {
    setShowFolderPicker(false)
    updateSettings({ driveBackupFolder: { id: folder.id, name: folder.name } })
    if (!driveToken) return
    setDriveLoading(true)
    try {
      const files = await listDriveBackups(driveToken, folder.id)
      setDriveFiles(files)
    } catch { /* ignore */ } finally {
      setDriveLoading(false)
    }
  }

  async function uploadDrive() {
    if (!driveToken) return
    setDriveLoading(true)
    setDriveError('')
    try {
      const folderId = settings.driveBackupFolder?.id
      await uploadToDrive(driveToken, {
        version: 3,
        exportedAt: new Date().toISOString(),
        settings,
        expenses,
        recurring,
        budgets,
      }, folderId)
      const files = await listDriveBackups(driveToken, folderId)
      setDriveFiles(files)
    } catch (err: any) {
      setDriveError(err?.message ?? 'Échec de l\'envoi')
    } finally {
      setDriveLoading(false)
    }
  }

  async function restoreFromDrive(fileId: string) {
    if (!driveToken) return
    setDriveLoading(true)
    setDriveError('')
    try {
      const text = await downloadFromDrive(driveToken, fileId)
      const backup = parseJSONBackup(text)
      if (!backup) { setDriveError('Fichier invalide'); return }
      setPending({ expenses: backup.expenses, recurring: backup.recurring ?? [], budgets: backup.budgets ?? [], label: `${backup.expenses.length} dépenses depuis Drive` })
    } catch (err: any) {
      setDriveError(err?.message ?? 'Échec du téléchargement')
    } finally {
      setDriveLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full"
         style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700 px-4 py-3 flex-shrink-0">
        <h1 className="text-[22px] font-bold dark:text-white">Réglages</h1>
      </div>

      <div className="flex-1 overflow-y-auto scroll-ios">

        {/* Appearance */}
        <p className="section-header">Apparence</p>
        <div className="card mx-4 overflow-hidden">
          <div className="flex p-1.5 gap-1">
            {THEME_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => updateSettings({ theme: opt.value })}
                className={`flex-1 flex flex-col items-center py-2.5 rounded-xl text-[12px] font-semibold transition-colors
                  ${settings.theme === opt.value
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400'}`}>
                <span className="text-lg mb-0.5">{opt.icon}</span>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Household */}
        <p className="section-header">Foyer</p>
        <div className="card mx-4 overflow-hidden">
          <div className="flex items-center px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <span className="text-gray-400 dark:text-gray-500 text-sm w-28">Personne 1</span>
            <input type="text" value={settings.person1Name}
              onChange={e => updateSettings({ person1Name: e.target.value })}
              className="flex-1 text-[15px] text-right outline-none bg-transparent dark:text-white" placeholder="Prénom" />
          </div>
          <div className="flex items-center px-4 py-3">
            <span className="text-gray-400 dark:text-gray-500 text-sm w-28">Personne 2</span>
            <input type="text" value={settings.person2Name}
              onChange={e => updateSettings({ person2Name: e.target.value })}
              className="flex-1 text-[15px] text-right outline-none bg-transparent dark:text-white" placeholder="Prénom" />
          </div>
        </div>

        {/* Currency */}
        <p className="section-header">Devise</p>
        <div className="card mx-4 overflow-hidden">
          <div className="flex items-center px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <span className="text-gray-400 dark:text-gray-500 text-sm flex-1">Devise de référence</span>
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
            <span className="text-gray-300 dark:text-gray-600">{showRates ? '▲' : '▼'}</span>
          </button>
          {showRates && (
            <div className="px-4 pb-3">
              {CURRENCIES.filter(c => c.code !== settings.baseCurrency).map(c => {
                const fromRate = { EUR: 1, USD: 1.08, GBP: 0.86, CHF: 0.96, MAD: 10.85, DZD: 145.2, TND: 3.35, JPY: 162.5, CAD: 1.47, AUD: 1.65, SGD: 1.45, AED: 3.97 }
                const toRate = fromRate[c.code as keyof typeof fromRate] / fromRate[settings.baseCurrency as keyof typeof fromRate]
                const from = CURRENCIES.find(x => x.code === settings.baseCurrency)!
                return (
                  <div key={c.code} className="flex justify-between py-1.5 border-b border-gray-50 dark:border-gray-700 last:border-0">
                    <span className="text-[13px] text-gray-500 dark:text-gray-400">{from.flag} 1 {settings.baseCurrency}</span>
                    <span className="text-[13px] font-medium dark:text-white">{toRate.toFixed(4)} {c.code} {c.flag}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Custom categories */}
        <p className="section-header">Catégories personnalisées</p>
        <div className="card mx-4 overflow-hidden">
          {(settings.customCategories ?? []).map((cat, i) => (
            <div key={cat.id} className={`flex items-center gap-3 px-4 py-3 ${i < (settings.customCategories ?? []).length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''}`}>
              <span className="text-xl">{cat.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] dark:text-white">{cat.label}</p>
                {cat.isFixed && <p className="text-[11px] text-red-400">Incompressible</p>}
              </div>
              <button onClick={() => removeCustomCategory(cat.id)} className="text-red-400 text-xl">×</button>
            </div>
          ))}
          <div className={`px-4 py-3 ${(settings.customCategories ?? []).length > 0 ? 'border-t border-gray-100 dark:border-gray-700' : ''}`}>
            <div className="flex items-center gap-2 mb-2.5">
              <button
                type="button"
                onClick={() => setShowEmojiPicker(true)}
                className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-[26px] border-2 border-dashed border-gray-300 dark:border-gray-600 flex-shrink-0">
                {newCatEmoji}
              </button>
              <input
                type="text"
                placeholder="Nom de la catégorie…"
                value={newCatLabel}
                onChange={e => setNewCatLabel(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCustomCategory()}
                className="flex-1 text-[15px] outline-none bg-transparent dark:text-white dark:placeholder-gray-500 py-1"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={newCatFixed} onChange={e => setNewCatFixed(e.target.checked)}
                  className="w-4 h-4 accent-red-500" />
                <span className="text-[13px] text-gray-500 dark:text-gray-400">Charge incompressible</span>
              </label>
              <button
                onClick={addCustomCategory}
                disabled={!newCatLabel.trim()}
                className="px-4 py-1.5 bg-blue-600 text-white rounded-xl text-[14px] font-semibold disabled:opacity-30 transition-opacity">
                Ajouter
              </button>
            </div>
          </div>
        </div>

        {/* Claude API */}
        <p className="section-header">Assistant IA</p>
        <div className="card mx-4 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <p className="text-[15px] font-medium dark:text-white mb-0.5">Clé API Claude</p>
            <p className="text-[12px] text-gray-400 dark:text-gray-500">Obtenez une clé sur console.anthropic.com</p>
          </div>
          <div className="px-4 py-3">
            <input
              type="password"
              placeholder="sk-ant-…"
              value={settings.claudeApiKey ?? ''}
              onChange={e => updateSettings({ claudeApiKey: e.target.value })}
              className="w-full text-[14px] outline-none bg-transparent dark:text-white dark:placeholder-gray-500 font-mono"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
          {(settings.claudeApiKey ?? '').length > 10 && (
            <div className="px-4 pb-3">
              <p className="text-[12px] text-green-600 dark:text-green-400">✓ Clé configurée — accédez à l'onglet IA</p>
            </div>
          )}
        </div>

        {/* Banks */}
        <p className="section-header">Banques</p>
        <div className="card mx-4 overflow-hidden">
          {settings.banks.map((bank, i) => (
            <div key={bank} className={`flex items-center gap-3 px-4 py-3 ${i < settings.banks.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''}`}>
              <span className="text-[15px] flex-1 dark:text-white">🏦 {bank}</span>
              <button onClick={() => removeBank(bank)} className="text-red-400 text-xl">×</button>
            </div>
          ))}
          <div className={`flex items-center gap-3 px-4 py-3 ${settings.banks.length > 0 ? 'border-t border-gray-100 dark:border-gray-700' : ''}`}>
            <span className="text-green-500 text-xl">+</span>
            <input type="text" placeholder="Ajouter une banque…"
              value={newBank} onChange={e => setNewBank(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addBank()}
              className="flex-1 text-[15px] outline-none bg-transparent dark:text-white dark:placeholder-gray-500" />
            {newBank && (
              <button onClick={addBank} className="text-blue-600 text-[14px] font-medium">OK</button>
            )}
          </div>
        </div>

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
        </div>

        {/* Google Drive */}
        <p className="section-header">Google Drive</p>
        <div className="card mx-4 overflow-hidden">
          {!settings.googleDriveClientId ? (
            <button onClick={() => setShowDriveSetup(true)}
              className="w-full flex items-center justify-between px-4 py-3 text-left">
              <span className="text-[15px] text-blue-600">Configurer Google Drive…</span>
              <span className="text-gray-400 dark:text-gray-500 text-[13px]">›</span>
            </button>
          ) : !driveToken ? (
            <button onClick={connectDrive} disabled={driveLoading}
              className="w-full flex items-center justify-between px-4 py-3 text-left">
              <span className="text-[15px] text-blue-600">
                {driveLoading ? 'Connexion…' : 'Connecter Google Drive'}
              </span>
              <span className="text-[20px]">☁️</span>
            </button>
          ) : (
            <>
              <button onClick={uploadDrive} disabled={driveLoading}
                className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 text-left">
                <span className="text-[15px] text-blue-600">
                  {driveLoading ? 'En cours…' : '↑ Sauvegarder sur Drive'}
                </span>
                <span className="text-[13px] text-gray-400 dark:text-gray-500">{expenses.length} dépenses</span>
              </button>
              <button onClick={openFolderPicker} disabled={driveLoading}
                className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 text-left">
                <span className="text-[15px] text-blue-600">Dossier de sauvegarde</span>
                <span className="text-[13px] text-gray-400 dark:text-gray-500 truncate max-w-[140px] text-right">
                  {settings.driveBackupFolder?.name ?? 'Budget Foyer Backups'}
                </span>
              </button>
              {driveFiles.length > 0 && driveFiles.slice(0, 5).map((f, i) => (
                <div key={f.id} className={`flex items-center justify-between px-4 py-3 ${i < Math.min(driveFiles.length, 5) - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''}`}>
                  <div>
                    <p className="text-[14px] dark:text-white">{f.name.replace('budget-backup-', '').replace('.json', '')}</p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500">{new Date(f.createdTime).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</p>
                  </div>
                  <button onClick={() => restoreFromDrive(f.id)}
                    className="text-blue-600 text-[13px] font-medium">↓ Restaurer</button>
                </div>
              ))}
              <button onClick={() => { setDriveToken(null); setDriveFiles([]) }}
                className="w-full px-4 py-3 text-left text-gray-400 dark:text-gray-500 text-[14px] border-t border-gray-100 dark:border-gray-700">
                Déconnecter
              </button>
            </>
          )}
          {driveError && (
            <p className="px-4 py-2 text-[13px] text-red-500 border-t border-gray-100 dark:border-gray-700">{driveError}</p>
          )}
        </div>

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

        {/* About */}
        <p className="section-header">À propos</p>
        <div className="card mx-4 overflow-hidden mb-8">
          {onShowHelp && (
            <button onClick={onShowHelp}
              className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 text-left">
              <span className="text-[15px] text-blue-600">❓ Aide &amp; Guide</span>
              <span className="text-gray-400 dark:text-gray-500">›</span>
            </button>
          )}
          {/* Version row */}
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-[15px] text-gray-600 dark:text-gray-300">Version installée</span>
              <span className="text-[15px] font-medium text-gray-500 dark:text-gray-400">{__APP_VERSION__}</span>
            </div>
            {(needRefresh || updateStatus === 'available') && (
              <div className="flex items-center justify-between mt-2">
                <div>
                  <span className="text-[12px] font-semibold text-orange-500">🔄 Mise à jour disponible</span>
                  {availableVersion && (
                    <span className="text-[12px] text-orange-400 ml-1">— v{availableVersion}</span>
                  )}
                </div>
                <button
                  onClick={() => updateServiceWorker(true)}
                  className="px-3 py-1 bg-orange-500 text-white text-[12px] font-bold rounded-lg">
                  Installer
                </button>
              </div>
            )}
            {updateStatus === 'none' && !needRefresh && (
              <p className="text-[12px] text-green-600 dark:text-green-400 mt-1">✓ Vous avez la dernière version</p>
            )}
          </div>
          <button
            onClick={checkUpdates}
            disabled={updateStatus === 'checking'}
            className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 text-left">
            <span className="text-[15px] text-blue-600">
              {updateStatus === 'checking' ? 'Vérification…' : 'Vérifier les mises à jour'}
            </span>
            {updateStatus === 'checking' && (
              <span className="text-gray-400 text-[13px]">…</span>
            )}
          </button>
          <div className="px-4 py-3 flex justify-between">
            <span className="text-[15px] text-gray-600 dark:text-gray-300">Données</span>
            <span className="text-[15px] text-gray-400 dark:text-gray-500">Stockées localement</span>
          </div>
        </div>
      </div>

      {/* Emoji picker sheet */}
      {showEmojiPicker && (
        <div className="fixed inset-0 z-50 flex flex-col"
             style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          <div className="flex-1 bg-black/40" onClick={() => setShowEmojiPicker(false)} />
          <div className="bg-white dark:bg-gray-900 rounded-t-3xl flex flex-col"
               style={{ maxHeight: '70vh' }}>
            <div className="flex items-center justify-between px-5 pt-4 pb-2 flex-shrink-0">
              <span className="text-[17px] font-semibold dark:text-white">Choisir une icône</span>
              <button onClick={() => setShowEmojiPicker(false)}
                className="text-blue-600 font-medium text-[15px]">Fermer</button>
            </div>
            <div className="overflow-y-auto scroll-ios pb-6 px-4">
              {EMOJI_GROUPS.map(group => (
                <div key={group.label} className="mb-4">
                  <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">
                    {group.label}
                  </p>
                  <div className="grid grid-cols-6 gap-2">
                    {group.emojis.map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => { setNewCatEmoji(emoji); setShowEmojiPicker(false) }}
                        className={`h-12 rounded-xl text-[24px] flex items-center justify-center transition-colors
                          ${newCatEmoji === emoji
                            ? 'bg-blue-100 dark:bg-blue-900/40 ring-2 ring-blue-500'
                            : 'bg-gray-100 dark:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700'}`}>
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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

      {/* Drive folder picker */}
      {showFolderPicker && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#f2f2f7] dark:bg-[#1c1c1e]"
             style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-3 flex-shrink-0">
            <button onClick={() => setShowFolderPicker(false)}
              className="text-blue-600 font-medium text-[15px]">Annuler</button>
            <p className="flex-1 text-center font-semibold text-[16px] dark:text-white">Dossier Drive</p>
            <div className="w-16" />
          </div>
          <div className="flex-1 overflow-y-auto scroll-ios">
            <p className="section-header">Choisir un dossier</p>
            <div className="card mx-4 overflow-hidden">
              {driveFolders.length === 0 ? (
                <p className="px-4 py-3 text-[14px] text-gray-400 dark:text-gray-500">Aucun dossier trouvé</p>
              ) : driveFolders.map((f, i) => (
                <button key={f.id} onClick={() => selectFolder(f)}
                  className={`w-full flex items-center justify-between px-4 py-3 text-left
                    ${i < driveFolders.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''}
                    ${settings.driveBackupFolder?.id === f.id ? 'bg-blue-50 dark:bg-blue-950/30' : ''}`}>
                  <span className="text-[15px] dark:text-white">📁 {f.name}</span>
                  {settings.driveBackupFolder?.id === f.id && (
                    <span className="text-blue-600 text-[14px]">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Google Drive setup sheet */}
      {showDriveSetup && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-800 rounded-t-3xl w-full p-6"
               style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}>
            <p className="text-[17px] font-bold text-center mb-2 dark:text-white">Configurer Google Drive</p>
            <p className="text-[13px] text-gray-500 dark:text-gray-400 mb-4">
              Pour activer la sauvegarde Drive, créez un projet sur{' '}
              <span className="font-medium text-blue-600">console.cloud.google.com</span>,
              activez l'API Drive, créez un identifiant OAuth 2.0 (application Web) et ajoutez
              l'origine de cette app dans les origines autorisées.
            </p>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-xl px-4 py-3 mb-4">
              <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">OAuth Client ID</p>
              <input
                type="text"
                placeholder="xxxxxxxx.apps.googleusercontent.com"
                value={driveClientIdInput}
                onChange={e => setDriveClientIdInput(e.target.value)}
                className="w-full text-[14px] bg-transparent outline-none dark:text-white dark:placeholder-gray-500"
              />
            </div>
            <button
              onClick={() => {
                updateSettings({ googleDriveClientId: driveClientIdInput.trim() })
                setShowDriveSetup(false)
              }}
              disabled={!driveClientIdInput.trim()}
              className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-semibold text-[16px] mb-3 disabled:bg-gray-200 dark:disabled:bg-gray-600">
              Enregistrer
            </button>
            <button onClick={() => setShowDriveSetup(false)}
              className="w-full py-3.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-medium text-[16px]">
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
