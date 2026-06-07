import { useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'
import { uploadToDrive, updateDriveFile } from '../utils/googleDrive'

const DEBOUNCE_MS = 1_500

export function useAutoBackupToDrive() {
  const expenses = useStore(s => s.expenses)
  const recurring = useStore(s => s.recurring)
  const budgets = useStore(s => s.budgets)
  const settings = useStore(s => s.settings)
  const driveToken = useStore(s => s.driveToken)
  const setLastAutoBackup = useStore(s => s.setLastAutoBackup)
  const updateSettings = useStore(s => s.updateSettings)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(false)

  useEffect(() => {
    // Skip the initial mount — only react to subsequent changes
    if (!mountedRef.current) {
      mountedRef.current = true
      return
    }
    if (!settings.autoBackupToDrive || !driveToken) return

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      const data = {
        version: 3 as const,
        exportedAt: new Date().toISOString(),
        settings,
        expenses,
        recurring,
        budgets,
      }
      try {
        const existingId = settings.autoBackupFileId
        if (existingId) {
          try {
            // Update the existing file in-place (no new file created)
            await updateDriveFile(driveToken, existingId, data)
          } catch (err: any) {
            // File was deleted or token issue — create a fresh one
            if (err?.message?.includes('404') || err?.message?.includes('403')) {
              const newId = await uploadToDrive(driveToken, data, settings.driveBackupFolder?.id)
              updateSettings({ autoBackupFileId: newId })
            } else {
              throw err
            }
          }
        } else {
          // First-ever auto-backup: create the file and remember its ID
          const newId = await uploadToDrive(driveToken, data, settings.driveBackupFolder?.id)
          updateSettings({ autoBackupFileId: newId })
        }
        setLastAutoBackup({ at: new Date().toISOString(), status: 'ok' })
      } catch {
        setLastAutoBackup({ at: new Date().toISOString(), status: 'error' })
      }
    }, DEBOUNCE_MS)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [expenses, recurring, budgets]) // eslint-disable-line react-hooks/exhaustive-deps
}
