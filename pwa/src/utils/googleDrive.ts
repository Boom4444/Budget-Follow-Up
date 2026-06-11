import type { BackupData } from './backup'

// Injected at runtime by the GIS script tag
declare const google: any

export interface DriveFile {
  id: string
  name: string
  createdTime: string
}

export interface DriveFolder {
  id: string
  name: string
}

// ── Script loader ─────────────────────────────────────────────────────────────

let scriptLoaded = false

function loadGisScript(): Promise<void> {
  if (scriptLoaded) return Promise.resolve()

  return new Promise((resolve, reject) => {
    const existing = document.querySelector(
      'script[src="https://accounts.google.com/gsi/client"]'
    )
    if (existing) {
      scriptLoaded = true
      resolve()
      return
    }

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => {
      scriptLoaded = true
      resolve()
    }
    script.onerror = () => reject(new Error('Failed to load Google Identity Services script'))
    document.head.appendChild(script)
  })
}

// ── Token request ─────────────────────────────────────────────────────────────

export interface DriveTokenResult {
  token: string
  /** Token lifetime in seconds (typically 3599) */
  expiresIn: number
}

/**
 * Request a Drive access token via GIS popup.
 * Loads the GIS script on the first call.
 * With `silent: true`, no consent screen is shown: if the user has an active
 * Google session with prior consent the popup opens and closes instantly;
 * otherwise the promise rejects (callers should fall back gracefully).
 */
export function requestDriveToken(clientId: string, opts: { silent?: boolean } = {}): Promise<DriveTokenResult> {
  return loadGisScript().then(
    () =>
      new Promise<DriveTokenResult>((resolve, reject) => {
        const client = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'https://www.googleapis.com/auth/drive.file',
          callback: (response: { access_token?: string; expires_in?: number; error?: string }) => {
            if (response.error) {
              reject(new Error(`GIS token error: ${response.error}`))
            } else if (response.access_token) {
              resolve({ token: response.access_token, expiresIn: Number(response.expires_in) || 3600 })
            } else {
              reject(new Error('GIS returned no access token'))
            }
          },
          error_callback: (error: { type: string }) => {
            reject(new Error(`GIS error: ${error.type}`))
          },
        })
        client.requestAccessToken({ prompt: opts.silent ? '' : 'consent' })
      })
  )
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function driveGet<T>(token: string, url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Drive API error ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

/**
 * Find the "Budget Foyer Backups" folder, creating it if it doesn't exist.
 * Returns the folder ID.
 */
async function getOrCreateFolder(token: string): Promise<string> {
  const folderName = 'Budget Foyer Backups'
  const query = encodeURIComponent(
    `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`
  )
  const listUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&pageSize=1`

  const listRes = await driveGet<{ files: Array<{ id: string; name: string }> }>(
    token,
    listUrl
  )

  if (listRes.files.length > 0) {
    return listRes.files[0].id
  }

  // Create the folder
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  })

  if (!createRes.ok) {
    const text = await createRes.text()
    throw new Error(`Failed to create Drive folder: ${createRes.status} ${text}`)
  }

  const created: { id: string } = await createRes.json()
  return created.id
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * List all Google Drive folders accessible to the user (not trashed).
 */
export async function listDriveFolders(token: string): Promise<DriveFolder[]> {
  try {
    const query = encodeURIComponent(`mimeType='application/vnd.google-apps.folder' and trashed=false`)
    const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&orderBy=name&pageSize=100`
    const res = await driveGet<{ files: DriveFolder[] }>(token, url)
    return res.files ?? []
  } catch {
    return []
  }
}

/**
 * Upload a backup JSON file to the specified folder (or "Budget Foyer Backups" if none given).
 * Creates the default folder if it doesn't exist.
 * Returns the Drive file ID.
 */
export async function uploadToDrive(token: string, data: BackupData, folderId?: string): Promise<string> {
  const resolvedFolderId = folderId ?? await getOrCreateFolder(token)

  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const filename = `budget-backup-${today}.json`
  const jsonBody = JSON.stringify(data, null, 2)

  const boundary = '-------BackupBoundary314159265358979'
  const delimiter = `\r\n--${boundary}\r\n`
  const closeDelimiter = `\r\n--${boundary}--`

  const metadata = JSON.stringify({
    name: filename,
    mimeType: 'application/json',
    parents: [resolvedFolderId],
  })

  const multipartBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    metadata +
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    jsonBody +
    closeDelimiter

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary="${boundary}"`,
      },
      body: multipartBody,
    }
  )

  if (!uploadRes.ok) {
    const errJson = await uploadRes.json().catch(() => ({})) as { error?: { message: string } }
    throw new Error(`Drive upload failed: ${errJson.error?.message ?? uploadRes.statusText}`)
  }

  const uploadJson: { id?: string } = await uploadRes.json()

  if (!uploadJson.id) {
    throw new Error('Drive upload returned no file ID')
  }

  return uploadJson.id
}

/**
 * List JSON backup files in the given (or default) folder, newest first.
 * Returns an empty array on any error rather than throwing.
 */
export async function listDriveBackups(token: string, folderId?: string): Promise<DriveFile[]> {
  try {
    const resolvedFolderId = folderId ?? await getOrCreateFolder(token)

    // Escape quotes so an unexpected folder ID can't break out of the query
    const safeId = resolvedFolderId.replace(/['\\]/g, '')
    const query = encodeURIComponent(
      `'${safeId}' in parents and mimeType='application/json' and trashed=false`
    )
    const url =
      `https://www.googleapis.com/drive/v3/files` +
      `?q=${query}&fields=files(id,name,createdTime)&orderBy=createdTime+desc&pageSize=50`

    const res = await driveGet<{ files: DriveFile[] }>(token, url)
    return res.files ?? []
  } catch {
    return []
  }
}

/**
 * Find/list backup files in ANY folder that matches the saved folder name.
 * Used when re-connecting to restore context.
 */
export async function findBackupsInFolder(token: string, folderId: string): Promise<DriveFile[]> {
  return listDriveBackups(token, folderId)
}

/**
 * Update the content of an existing Drive file in-place (PATCH).
 * Throws if the file no longer exists (404) so callers can create a new one.
 */
export async function updateDriveFile(token: string, fileId: string, data: BackupData): Promise<void> {
  const json = JSON.stringify(data, null, 2)
  const boundary = '-------BackupBoundary314159265358979'
  const delimiter = `\r\n--${boundary}\r\n`
  const closeDelimiter = `\r\n--${boundary}--`
  const multipartBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify({ name: 'budget-auto-backup.json', mimeType: 'application/json' }) +
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    json +
    closeDelimiter

  const res = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=multipart`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary="${boundary}"`,
      },
      body: multipartBody,
    }
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Drive update failed ${res.status}: ${text}`)
  }
}

/**
 * Create a new folder in Drive. Returns the new DriveFolder.
 */
export async function createDriveFolder(token: string, name: string): Promise<DriveFolder> {
  const res = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Drive folder creation failed ${res.status}: ${text}`)
  }
  const json: { id: string; name: string } = await res.json()
  return { id: json.id, name: json.name }
}

/**
 * Download the raw JSON string content of a Drive file by ID.
 */
export async function downloadFromDrive(token: string, fileId: string): Promise<string> {
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Drive download failed ${res.status}: ${text}`)
  }

  return res.text()
}
