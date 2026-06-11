import { useEffect, useRef } from 'react'
import { useStore, getValidDriveToken } from '../store/useStore'
import { uploadToDrive, updateDriveFile, requestDriveToken } from '../utils/googleDrive'
import type { BackupData } from '../utils/backup'
import { BACKUP_VERSION } from '../utils/backup'

const DEBOUNCE_MS = 1_500
// Safety net: retry/sync at a fixed interval so a failed change-triggered
// backup (network blip, expired token…) can never linger unnoticed.
const PERIODIC_MS = 5 * 60_000

/**
 * Keeps a single auto-backup file on Google Drive in sync with the store.
 *
 * - Triggers on every change to expenses, recurring, budgets AND settings.
 * - The Drive token is persisted (with its expiry) so backups keep working
 *   across app relaunches within the token's ~1h lifetime.
 * - On an expired/missing token it attempts ONE silent re-auth (no consent
 *   screen); if that fails the status becomes "reconnect needed" and the
 *   Settings screen shows a warning.
 * - Flushes immediately when the app goes to background (iOS may kill the
 *   PWA at any time afterwards).
 * - Never overwrites the Drive backup with a fully empty dataset, so an
 *   accidental "clear data" can't destroy the remote copy.
 */
export function useAutoBackupToDrive() {
  const mountedRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const runningRef = useRef(false)
  const lastChangeAtRef = useRef(0)
  const lastOkAtRef = useRef(0)

  // Subscribe to the pieces that should trigger a backup. The settings key
  // excludes autoBackupFileId (written by the backup itself) to avoid loops.
  const expenses = useStore(s => s.expenses)
  const recurring = useStore(s => s.recurring)
  const budgets = useStore(s => s.budgets)
  const settings = useStore(s => s.settings)
  const settingsKey = JSON.stringify({ ...settings, autoBackupFileId: undefined })

  async function getToken(interactive: boolean): Promise<string | null> {
    const s = useStore.getState()
    const valid = getValidDriveToken(s)
    if (valid) return valid
    const clientId = s.settings.googleDriveClientId?.trim()
    if (!clientId) return null
    try {
      const { token, expiresIn } = await requestDriveToken(clientId, { silent: !interactive })
      s.setDriveToken(token, expiresIn)
      return token
    } catch {
      return null
    }
  }

  async function runBackup() {
    if (runningRef.current) return
    const s = useStore.getState()
    if (!s.settings.autoBackupToDrive) return
    // Refuse to overwrite the remote backup with an empty dataset
    if (s.expenses.length === 0 && s.recurring.length === 0 && s.budgets.length === 0) return

    runningRef.current = true
    try {
      const token = await getToken(false)
      if (!token) {
        s.setLastAutoBackup({ at: new Date().toISOString(), status: 'error', reason: 'auth' })
        return
      }
      // Never ship the (deprecated) API key field to Drive
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { claudeApiKey: _k, ...cleanSettings } = s.settings
      const data: BackupData = {
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        settings: cleanSettings,
        expenses: s.expenses,
        recurring: s.recurring,
        budgets: s.budgets,
      }
      const existingId = s.settings.autoBackupFileId
      if (existingId) {
        try {
          await updateDriveFile(token, existingId, data)
        } catch (err: any) {
          // File deleted / permission lost — create a fresh one
          if (err?.message?.includes('404') || err?.message?.includes('403')) {
            const newId = await uploadToDrive(token, data, s.settings.driveBackupFolder?.id)
            s.updateSettings({ autoBackupFileId: newId })
          } else {
            throw err
          }
        }
      } else {
        const newId = await uploadToDrive(token, data, s.settings.driveBackupFolder?.id)
        s.updateSettings({ autoBackupFileId: newId })
      }
      lastOkAtRef.current = Date.now()
      useStore.getState().setLastAutoBackup({ at: new Date().toISOString(), status: 'ok' })
    } catch (err: any) {
      const auth = err?.message?.includes('401')
      if (auth) useStore.getState().setDriveToken(null)
      useStore.getState().setLastAutoBackup({
        at: new Date().toISOString(),
        status: 'error',
        reason: auth ? 'auth' : 'other',
      })
    } finally {
      runningRef.current = false
    }
  }

  // Debounced backup on any data/settings change (skip the initial mount)
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      return
    }
    lastChangeAtRef.current = Date.now()
    const s = useStore.getState()
    if (!s.settings.autoBackupToDrive) return

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(runBackup, DEBOUNCE_MS)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [expenses, recurring, budgets, settingsKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Periodic safety net: if anything changed since the last successful
  // backup (e.g. a change-triggered upload failed), retry every 5 minutes.
  useEffect(() => {
    const id = setInterval(() => {
      const s = useStore.getState()
      if (!s.settings.autoBackupToDrive) return
      if (lastChangeAtRef.current === 0) return
      if (lastChangeAtRef.current <= lastOkAtRef.current) return
      void runBackup()
    }, PERIODIC_MS)
    return () => clearInterval(id)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Flush a pending backup the moment the app goes to background
  useEffect(() => {
    function onHide() {
      if (document.visibilityState !== 'hidden') return
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
        void runBackup()
      }
    }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // On launch: drop an expired persisted token, then try a silent reconnect
  // so backups resume without any user action when possible.
  useEffect(() => {
    const s = useStore.getState()
    if (s.driveToken && !getValidDriveToken(s)) s.setDriveToken(null)
    if (s.settings.autoBackupToDrive && s.settings.googleDriveClientId && !getValidDriveToken(s)) {
      void getToken(false).then(token => {
        if (token) void runBackup()
      })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}
