import { useEffect, useRef } from 'react'
import { useStore, getValidDriveToken } from '../store/useStore'
import { requestDriveToken, downloadFromDrive, updateDriveFile, createJsonFile, findFileByName } from '../utils/googleDrive'
import { SYNC_FILE_NAME, mergeSyncData, parseSyncData, canonicalize, emptyTombstones, type SyncData } from '../utils/sync'

const DEBOUNCE_MS = 2_500
// Pull interval: how quickly one phone sees the other's changes at most
const PERIODIC_MS = 60_000

function localSyncData(): SyncData {
  const s = useStore.getState()
  return {
    syncVersion: 1,
    updatedAt: new Date().toISOString(),
    expenses: s.expenses,
    recurring: s.recurring,
    budgets: s.budgets,
    tombstones: s.tombstones ?? emptyTombstones(),
    customCategories: s.settings.customCategories ?? [],
    deletedBuiltinCategories: s.settings.deletedBuiltinCategories ?? [],
  }
}

/**
 * Household sync: both phones connect to the same Google account and share
 * one Drive file (budget-foyer-sync.json). Every cycle does
 * pull → merge → apply locally → push, so the two devices converge without
 * ever overwriting each other (see utils/sync.ts for the merge rules).
 *
 * Triggers: app launch, app coming back to foreground, local data changes
 * (debounced), and a 60s interval so the partner's changes appear without
 * any user action.
 */
export function useDriveSync() {
  const mountedRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const runningRef = useRef(false)
  // Canonical form of the last state applied BY sync — lets the change
  // listener skip the echo of our own applySync()
  const lastAppliedRef = useRef('')

  const expenses = useStore(s => s.expenses)
  const recurring = useStore(s => s.recurring)
  const budgets = useStore(s => s.budgets)
  const tombstones = useStore(s => s.tombstones)
  const syncEnabled = useStore(s => s.settings.driveSyncEnabled ?? false)

  async function getToken(): Promise<string | null> {
    const s = useStore.getState()
    const valid = getValidDriveToken(s)
    if (valid) return valid
    const clientId = s.settings.googleDriveClientId?.trim()
    if (!clientId) return null
    try {
      const { token, expiresIn } = await requestDriveToken(clientId, { silent: true })
      s.setDriveToken(token, expiresIn)
      return token
    } catch {
      return null
    }
  }

  async function runSync() {
    if (runningRef.current) return
    const s = useStore.getState()
    if (!s.settings.driveSyncEnabled) return

    runningRef.current = true
    try {
      const token = await getToken()
      if (!token) {
        s.setLastSync({ at: new Date().toISOString(), status: 'error', reason: 'auth' })
        return
      }
      const folderId = s.settings.driveBackupFolder?.id

      // Locate (or create) the shared file
      let fileId = s.settings.syncFileId ?? null
      if (!fileId) {
        fileId = await findFileByName(token, SYNC_FILE_NAME, folderId)
        if (!fileId) {
          const local = localSyncData()
          fileId = await createJsonFile(token, SYNC_FILE_NAME, local, folderId)
          useStore.getState().updateSettings({ syncFileId: fileId })
          lastAppliedRef.current = canonicalize(local)
          useStore.getState().setLastSync({ at: new Date().toISOString(), status: 'ok' })
          return
        }
        useStore.getState().updateSettings({ syncFileId: fileId })
      }

      // Pull
      let remoteText: string | null = null
      try {
        remoteText = await downloadFromDrive(token, fileId)
      } catch (err: any) {
        if (err?.message?.includes('404') || err?.message?.includes('403')) {
          // Shared file is gone — recreate it from local data
          useStore.getState().updateSettings({ syncFileId: undefined })
          const local = localSyncData()
          const newId = await createJsonFile(token, SYNC_FILE_NAME, local, folderId)
          useStore.getState().updateSettings({ syncFileId: newId })
          lastAppliedRef.current = canonicalize(local)
          useStore.getState().setLastSync({ at: new Date().toISOString(), status: 'ok' })
          return
        }
        throw err
      }

      // Merge — a corrupt remote file must never wipe local data
      const remote = parseSyncData(remoteText)
      const local = localSyncData()
      const merged = remote ? mergeSyncData(local, remote) : local

      const mergedCanon = canonicalize(merged)
      if (mergedCanon !== canonicalize(local)) {
        lastAppliedRef.current = mergedCanon
        useStore.getState().applySync({
          expenses: merged.expenses,
          recurring: merged.recurring,
          budgets: merged.budgets,
          tombstones: merged.tombstones,
          customCategories: merged.customCategories,
          deletedBuiltinCategories: merged.deletedBuiltinCategories,
        })
      }
      if (!remote || mergedCanon !== canonicalize(remote)) {
        await updateDriveFile(token, fileId, merged, SYNC_FILE_NAME)
      }
      useStore.getState().setLastSync({ at: new Date().toISOString(), status: 'ok' })
    } catch (err: any) {
      const auth = err?.message?.includes('401')
      if (auth) useStore.getState().setDriveToken(null)
      useStore.getState().setLastSync({
        at: new Date().toISOString(),
        status: 'error',
        reason: auth ? 'auth' : 'other',
      })
    } finally {
      runningRef.current = false
    }
  }

  // Debounced sync on local data changes (skip initial mount and the echo
  // of changes that sync itself just applied)
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      return
    }
    const s = useStore.getState()
    if (!s.settings.driveSyncEnabled) return
    if (lastAppliedRef.current && lastAppliedRef.current === canonicalize(localSyncData())) return

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(runSync, DEBOUNCE_MS)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [expenses, recurring, budgets, tombstones]) // eslint-disable-line react-hooks/exhaustive-deps

  // Periodic pull so the partner's changes show up on their own
  useEffect(() => {
    if (!syncEnabled) return
    const id = setInterval(() => void runSync(), PERIODIC_MS)
    return () => clearInterval(id)
  }, [syncEnabled]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync when the app returns to the foreground (the usual "open the app,
  // see the partner's expenses" moment) and flush before going background
  useEffect(() => {
    function onVisibility() {
      if (!useStore.getState().settings.driveSyncEnabled) return
      if (document.visibilityState === 'visible') {
        void runSync()
      } else if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
        void runSync()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // On launch, and immediately when the user enables the toggle
  useEffect(() => {
    if (syncEnabled) void runSync()
  }, [syncEnabled]) // eslint-disable-line react-hooks/exhaustive-deps
}
