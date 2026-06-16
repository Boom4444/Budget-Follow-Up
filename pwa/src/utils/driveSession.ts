import { useStore, getValidDriveToken } from '../store/useStore'
import { requestDriveToken } from './googleDrive'

// Coalesce concurrent refreshes: app launch fires sync + auto-backup +
// keep-alive at roughly the same time, and we want a single GIS request
// rather than three competing ones.
let inFlight: Promise<string | null> | null = null

/**
 * Returns a valid Drive access token, reusing the persisted one when it has
 * >60s of life left, otherwise attempting a token refresh against the
 * configured Google client. With `interactive: false` (default) the refresh
 * is silent — it succeeds only when the user has an active Google session
 * with prior consent; otherwise null is returned and the caller should
 * surface a "reconnect" state instead of throwing.
 *
 * `force: true` skips the still-valid shortcut to refresh a token that is
 * about to expire (used by the proactive keep-alive timer).
 */
export async function ensureDriveToken(opts: { interactive?: boolean; force?: boolean } = {}): Promise<string | null> {
  const s = useStore.getState()
  if (!opts.force) {
    const valid = getValidDriveToken(s)
    if (valid) return valid
  }
  const clientId = s.settings.googleDriveClientId?.trim()
  if (!clientId) return null
  if (inFlight) return inFlight
  inFlight = (async () => {
    try {
      const { token, expiresIn } = await requestDriveToken(clientId, { silent: !opts.interactive })
      useStore.getState().setDriveToken(token, expiresIn)
      return token
    } catch {
      return null
    } finally {
      inFlight = null
    }
  })()
  return inFlight
}
