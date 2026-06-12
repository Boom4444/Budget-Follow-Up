import { useStore, getValidDriveToken } from '../store/useStore'
import { requestDriveToken } from './googleDrive'

/**
 * Returns a valid Drive access token, reusing the persisted one when it has
 * >60s of life left, otherwise attempting a token refresh against the
 * configured Google client. With `interactive: false` (default) the refresh
 * is silent — it succeeds only when the user has an active Google session
 * with prior consent; otherwise null is returned and the caller should
 * surface a "reconnect" state instead of throwing.
 */
export async function ensureDriveToken(opts: { interactive?: boolean } = {}): Promise<string | null> {
  const s = useStore.getState()
  const valid = getValidDriveToken(s)
  if (valid) return valid
  const clientId = s.settings.googleDriveClientId?.trim()
  if (!clientId) return null
  try {
    const { token, expiresIn } = await requestDriveToken(clientId, { silent: !opts.interactive })
    s.setDriveToken(token, expiresIn)
    return token
  } catch {
    return null
  }
}
