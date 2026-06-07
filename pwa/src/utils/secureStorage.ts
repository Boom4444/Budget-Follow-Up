// Stores sensitive values (Claude API key) encrypted in IndexedDB using AES-GCM.
// The CryptoKey is generated once per device with extractable:false — it lives in
// IndexedDB and cannot be read or exported via JavaScript, making the stored
// ciphertext useless outside this origin.

const DB_NAME = 'budget-secure'
const DB_VERSION = 1
const STORE_KEYS = 'keys'
const STORE_DATA = 'data'
const CRYPTO_KEY_NAME = 'main'
const ITEM_CLAUDE_KEY = 'claude-api-key'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_KEYS)
      req.result.createObjectStore(STORE_DATA)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function idbGet<T>(db: IDBDatabase, store: string, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readonly').objectStore(store).get(key)
    req.onsuccess = () => resolve(req.result as T | undefined)
    req.onerror = () => reject(req.error)
  })
}

function idbPut(db: IDBDatabase, store: string, key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readwrite').objectStore(store).put(value, key)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

function idbDelete(db: IDBDatabase, store: string, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readwrite').objectStore(store).delete(key)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

async function getOrCreateCryptoKey(db: IDBDatabase): Promise<CryptoKey> {
  const existing = await idbGet<CryptoKey>(db, STORE_KEYS, CRYPTO_KEY_NAME)
  if (existing) return existing
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable: raw bytes cannot be read via JS
    ['encrypt', 'decrypt'],
  )
  await idbPut(db, STORE_KEYS, CRYPTO_KEY_NAME, key)
  return key
}

export async function storeApiKey(apiKey: string): Promise<void> {
  const db = await openDb()
  const cryptoKey = await getOrCreateCryptoKey(db)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(apiKey)
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, encoded)
  const combined = new Uint8Array(12 + encrypted.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(encrypted), 12)
  await idbPut(db, STORE_DATA, ITEM_CLAUDE_KEY, combined)
}

export async function loadApiKey(): Promise<string> {
  try {
    const db = await openDb()
    const combined = await idbGet<Uint8Array>(db, STORE_DATA, ITEM_CLAUDE_KEY)
    if (!combined || combined.byteLength <= 12) return ''
    const cryptoKey = await getOrCreateCryptoKey(db)
    const iv = combined.slice(0, 12)
    const data = combined.slice(12)
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, data)
    return new TextDecoder().decode(decrypted)
  } catch {
    return ''
  }
}

export async function clearApiKey(): Promise<void> {
  try {
    const db = await openDb()
    await idbDelete(db, STORE_DATA, ITEM_CLAUDE_KEY)
  } catch { /* ignore */ }
}
