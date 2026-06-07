import { useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'
import { uploadToDrive } from '../utils/googleDrive'

const DEBOUNCE_MS = 10_000

export function useAutoBackupToDrive() {
  const expenses = useStore(s => s.expenses)
  const recurring = useStore(s => s.recurring)
  const budgets = useStore(s => s.budgets)
  const settings = useStore(s => s.settings)
  const driveToken = useStore(s => s.driveToken)
  const setLastAutoBackup = useStore(s => s.setLastAutoBackup)
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
      try {
        await uploadToDrive(
          driveToken,
          { version: 3, exportedAt: new Date().toISOString(), settings, expenses, recurring, budgets },
          settings.driveBackupFolder?.id,
        )
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
