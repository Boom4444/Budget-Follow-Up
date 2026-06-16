import { useEffect, useRef } from 'react'
import { useStore, getValidDriveToken } from '../store/useStore'
import { ensureDriveToken } from '../utils/driveSession'

// Refresh this long before the token actually expires, so a continuously
// open session never lapses mid-use.
const REFRESH_MARGIN_MS = 2 * 60_000

/**
 * Keeps the Google Drive connection alive WITHOUT a backend. Google Identity
 * Services issues no refresh token, so truly offline persistence is
 * impossible; instead we make the connection behave deterministically:
 *
 * - On launch and when returning to the foreground, if the user is connected
 *   (`driveConnected`) but the access token has expired, attempt a SILENT
 *   re-grant. While the browser's Google session is alive this succeeds with
 *   no UI, so the connection effectively SURVIVES INDEFINITELY across
 *   relaunches.
 * - If the silent re-grant fails (Google session truly gone), DISCONNECT
 *   cleanly — clear the token and the connection flag — so the UI returns to
 *   a plain "Connecter Google Drive" state instead of a stale, unusable token.
 * - While a valid token is held, schedule a proactive silent refresh shortly
 *   before expiry, forming a self-renewing loop for long-lived sessions.
 */
export function useDriveTokenKeepAlive() {
  const driveToken = useStore(s => s.driveToken)
  const driveTokenExpiresAt = useStore(s => s.driveTokenExpiresAt)
  const driveConnected = useStore(s => s.driveConnected)
  const clientId = useStore(s => s.settings.googleDriveClientId)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Restore (or cleanly drop) the connection on launch + foreground.
  useEffect(() => {
    async function restore() {
      const s = useStore.getState()
      if (!s.driveConnected) return
      if (!s.settings.googleDriveClientId?.trim()) return
      if (getValidDriveToken(s)) return
      const token = await ensureDriveToken({ interactive: false })
      if (!token) useStore.getState().disconnectDrive()
    }
    void restore()

    function onVisible() {
      if (document.visibilityState === 'visible') void restore()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Proactive refresh shortly before expiry, while a valid token is held.
  useEffect(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    if (!driveConnected || !clientId?.trim() || !driveToken || driveTokenExpiresAt == null) return
    const delay = driveTokenExpiresAt - Date.now() - REFRESH_MARGIN_MS
    if (delay <= 0) return // about to expire — the launch/foreground path handles it
    timerRef.current = setTimeout(() => {
      void ensureDriveToken({ interactive: false, force: true }).then(token => {
        // A failure mid-session is left soft: the token simply expires and the
        // next foreground cleanly disconnects if the session is really gone.
        if (!token) useStore.getState().setDriveToken(null)
      })
    }, delay)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [driveToken, driveTokenExpiresAt, driveConnected, clientId])
}
