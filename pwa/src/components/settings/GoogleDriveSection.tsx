import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { formatRelativeTime, parseJSONBackup } from '../../utils/backup'
import {
  requestDriveToken, uploadToDrive, listDriveBackups, listDriveFolders, downloadFromDrive, createDriveFolder,
} from '../../utils/googleDrive'
import type { DriveFile, DriveFolder } from '../../utils/googleDrive'
import type { PendingImport } from './types'

interface Props {
  onRestore: (pending: PendingImport) => void
}

export default function GoogleDriveSection({ onRestore }: Props) {
  const {
    settings, updateSettings, expenses, recurring, budgets,
    driveToken, setDriveToken, disconnectDrive, lastAutoBackup, lastSync,
  } = useStore()
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([])
  const [driveFolders, setDriveFolders] = useState<DriveFolder[]>([])
  const [showFolderPicker, setShowFolderPicker] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [driveLoading, setDriveLoading] = useState(false)
  const [driveError, setDriveError] = useState('')
  const [driveClientIdInput, setDriveClientIdInput] = useState(settings.googleDriveClientId)
  const [showDriveSetup, setShowDriveSetup] = useState(false)

  async function connectDrive() {
    const clientId = settings.googleDriveClientId.trim()
    if (!clientId) { setShowDriveSetup(true); return }
    setDriveLoading(true)
    setDriveError('')
    try {
      // Try the silent flow first (no consent screen on reconnection);
      // fall back to the full consent prompt for first-time connections.
      const { token, expiresIn } = await requestDriveToken(clientId, { silent: true })
        .catch(() => requestDriveToken(clientId))
      setDriveToken(token, expiresIn)
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
    setNewFolderName('')
    // Reset auto-backup file ID when switching folders (new file will be created)
    updateSettings({ driveBackupFolder: { id: folder.id, name: folder.name }, autoBackupFileId: undefined })
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
      const { claudeApiKey: _k, ...cleanSettings } = settings
      await uploadToDrive(driveToken, {
        version: 3,
        exportedAt: new Date().toISOString(),
        settings: cleanSettings,
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
      onRestore({ expenses: backup.expenses, recurring: backup.recurring ?? [], budgets: backup.budgets ?? [], settings: backup.settings, label: `${backup.expenses.length} dépenses depuis Drive` })
    } catch (err: any) {
      setDriveError(err?.message ?? 'Échec du téléchargement')
    } finally {
      setDriveLoading(false)
    }
  }

  return (
    <>
      <p className="section-header">Google Drive</p>
      <div className="card mx-4 overflow-hidden">
        {!settings.googleDriveClientId ? (
          <button onClick={() => setShowDriveSetup(true)}
            className="w-full flex items-center justify-between px-4 py-3 text-left">
            <span className="text-[15px] text-blue-600">Configurer Google Drive…</span>
            <span className="text-gray-400 dark:text-gray-500 text-[13px]">›</span>
          </button>
        ) : !driveToken ? (
          <>
            {settings.autoBackupToDrive && (
              <p className="px-4 pt-3 pb-1 text-[12px] text-orange-500">
                ⚠️ Sauvegarde automatique en pause — reconnexion requise
                {lastAutoBackup?.status === 'ok' && ` (dernière sauvegarde : ${formatRelativeTime(lastAutoBackup.at)})`}
              </p>
            )}
            <button onClick={connectDrive} disabled={driveLoading}
              className="w-full flex items-center justify-between px-4 py-3 text-left">
              <span className="text-[15px] text-blue-600">
                {driveLoading ? 'Connexion…' : 'Connecter Google Drive'}
              </span>
              <span className="text-[20px]">☁️</span>
            </button>
          </>
        ) : (
          <>
            {/* Auto-backup toggle */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
              <div>
                <p className="text-[15px] dark:text-white">Sauvegarde automatique</p>
                {settings.autoBackupToDrive && lastAutoBackup && (
                  <p className={`text-[11px] mt-0.5 ${lastAutoBackup.status === 'ok' ? 'text-green-500' : 'text-red-400'}`}>
                    {lastAutoBackup.status === 'ok'
                      ? `✓ Sauvegardé ${formatRelativeTime(lastAutoBackup.at)}`
                      : lastAutoBackup.reason === 'auth'
                        ? '✗ Échec — reconnexion Google requise'
                        : `✗ Échec ${formatRelativeTime(lastAutoBackup.at)} — réessaiera à la prochaine modification`}
                  </p>
                )}
                {settings.autoBackupToDrive && !lastAutoBackup && (
                  <p className="text-[11px] text-gray-400 mt-0.5">Active — synchro après chaque modification</p>
                )}
              </div>
              <button
                role="switch"
                aria-checked={!!settings.autoBackupToDrive}
                onClick={() => updateSettings({ autoBackupToDrive: !settings.autoBackupToDrive })}
                className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${settings.autoBackupToDrive ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.autoBackupToDrive ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            {/* Household sync toggle */}
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="pr-3">
                  <p className="text-[15px] dark:text-white">Synchronisation du foyer</p>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                    Les 2 téléphones connectés au même compte Google partagent les mêmes
                    données (fusion automatique, sans doublons ni écrasement)
                  </p>
                  {settings.driveSyncEnabled && lastSync && (
                    <p className={`text-[11px] mt-0.5 ${lastSync.status === 'ok' ? 'text-green-500' : 'text-red-400'}`}>
                      {lastSync.status === 'ok'
                        ? `✓ Synchronisé ${formatRelativeTime(lastSync.at)}`
                        : lastSync.reason === 'auth'
                          ? '✗ Échec — reconnexion Google requise'
                          : `✗ Échec ${formatRelativeTime(lastSync.at)} — nouvel essai automatique`}
                    </p>
                  )}
                </div>
                <button
                  role="switch"
                  aria-checked={!!settings.driveSyncEnabled}
                  onClick={() => updateSettings({ driveSyncEnabled: !settings.driveSyncEnabled })}
                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${settings.driveSyncEnabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.driveSyncEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>

            <button onClick={uploadDrive} disabled={driveLoading}
              className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 text-left">
              <span className="text-[15px] text-blue-600">
                {driveLoading ? 'En cours…' : '↑ Sauvegarder maintenant'}
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
            <button onClick={() => {
                disconnectDrive()
                setDriveFiles([])
                updateSettings({ autoBackupFileId: undefined })
              }}
              className="w-full px-4 py-3 text-left text-red-400 dark:text-red-500 text-[14px] border-t border-gray-100 dark:border-gray-700">
              Déconnecter
            </button>
          </>
        )}
        {driveError && (
          <p className="px-4 py-2 text-[13px] text-red-500 border-t border-gray-100 dark:border-gray-700">{driveError}</p>
        )}
      </div>

      {/* Drive folder picker */}
      {showFolderPicker && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#f2f2f7] dark:bg-[#1c1c1e]"
             style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-3 flex-shrink-0">
            <button onClick={() => { setShowFolderPicker(false); setNewFolderName('') }}
              className="text-blue-600 font-medium text-[15px]">Annuler</button>
            <p className="flex-1 text-center font-semibold text-[16px] dark:text-white">Choisir un dossier</p>
            <div className="w-16" />
          </div>
          <div className="flex-1 overflow-y-auto scroll-ios">
            {/* Create new folder */}
            <p className="section-header">Nouveau dossier</p>
            <div className="card mx-4 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3">
                <input
                  type="text"
                  placeholder="Nom du dossier…"
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  className="flex-1 text-[14px] outline-none bg-transparent dark:text-white dark:placeholder-gray-500"
                />
                <button
                  disabled={!newFolderName.trim() || creatingFolder || !driveToken}
                  onClick={async () => {
                    if (!driveToken || !newFolderName.trim()) return
                    setCreatingFolder(true)
                    try {
                      const folder = await createDriveFolder(driveToken, newFolderName.trim())
                      setDriveFolders(prev => [folder, ...prev])
                      setNewFolderName('')
                      await selectFolder(folder)
                    } catch (err: any) {
                      setDriveError(err?.message ?? 'Création échouée')
                    } finally {
                      setCreatingFolder(false)
                    }
                  }}
                  className="px-3 py-1.5 bg-blue-600 text-white text-[13px] font-semibold rounded-lg disabled:bg-gray-300 dark:disabled:bg-gray-600">
                  {creatingFolder ? '…' : 'Créer'}
                </button>
              </div>
            </div>

            {/* Existing folders */}
            <p className="section-header">Dossiers existants</p>
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
    </>
  )
}
