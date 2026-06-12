import { useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

interface Props {
  onShowHelp?: () => void
}

export default function AboutSection({ onShowHelp }: Props) {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'none' | 'available'>('idle')
  const [availableVersion, setAvailableVersion] = useState<string | null>(null)
  const [showClearCacheConfirm, setShowClearCacheConfirm] = useState(false)
  const [clearingCache, setClearingCache] = useState(false)

  async function applyUpdate() {
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      if (reg?.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' })
      } else {
        await updateServiceWorker(false)
      }
    } catch { /* ignore */ }
    setTimeout(() => window.location.reload(), 300)
  }

  // Force-removes the service worker + all Cache Storage entries, then reloads.
  // Does NOT touch localStorage (expenses, settings, exchange rate caches).
  async function clearAppCache() {
    setClearingCache(true)
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map(r => r.unregister()))
      }
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map(k => caches.delete(k)))
      }
    } catch { /* ignore */ }
    window.location.reload()
  }

  async function checkUpdates() {
    if (needRefresh || updateStatus === 'available') {
      applyUpdate()
      return
    }
    setUpdateStatus('checking')
    try {
      // Trigger the SW to check for a new service worker
      navigator.serviceWorker?.getRegistration().then(reg => reg?.update())
      // Fetch version.json from the server (bypassing cache) to read the latest version number
      const res = await fetch(import.meta.env.BASE_URL + 'version.json', { cache: 'no-store' })
      const json: { version: string } = await res.json()
      if (json.version !== __APP_VERSION__) {
        setAvailableVersion(json.version)
        setUpdateStatus('available')
      } else {
        setUpdateStatus('none')
      }
    } catch {
      setUpdateStatus(needRefresh ? 'available' : 'none')
    }
  }

  return (
    <>
      <p className="section-header">À propos</p>
      <div className="card mx-4 overflow-hidden mb-8">
        {onShowHelp && (
          <button onClick={onShowHelp}
            className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 text-left">
            <span className="text-[15px] text-blue-600">❓ Aide &amp; Guide</span>
            <span className="text-gray-400 dark:text-gray-500">›</span>
          </button>
        )}
        {/* Version row */}
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-[15px] text-gray-600 dark:text-gray-300">Version installée</span>
            <span className="text-[15px] font-medium text-gray-500 dark:text-gray-400">{__APP_VERSION__}</span>
          </div>
          {(needRefresh || updateStatus === 'available') && (
            <div className="flex items-center justify-between mt-2">
              <div>
                <span className="text-[12px] font-semibold text-orange-500">🔄 Mise à jour disponible</span>
                {availableVersion && (
                  <span className="text-[12px] text-orange-400 ml-1">— v{availableVersion}</span>
                )}
              </div>
              <button
                onClick={applyUpdate}
                className="px-3 py-1 bg-orange-500 text-white text-[12px] font-bold rounded-lg">
                Installer
              </button>
            </div>
          )}
          {updateStatus === 'none' && !needRefresh && (
            <p className="text-[12px] text-green-600 dark:text-green-400 mt-1">✓ Vous avez la dernière version</p>
          )}
        </div>
        <button
          onClick={checkUpdates}
          disabled={updateStatus === 'checking'}
          className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 text-left">
          <span className="text-[15px] text-blue-600">
            {updateStatus === 'checking' ? 'Vérification…' : 'Vérifier les mises à jour'}
          </span>
          {updateStatus === 'checking' && (
            <span className="text-gray-400 text-[13px]">…</span>
          )}
        </button>
        <button
          onClick={() => setShowClearCacheConfirm(true)}
          className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 text-left">
          <span className="text-[15px] text-orange-500">🧹 Vider le cache de l'app</span>
          <span className="text-gray-400 dark:text-gray-500 text-[13px]">›</span>
        </button>
        <div className="px-4 py-3 flex justify-between">
          <span className="text-[15px] text-gray-600 dark:text-gray-300">Données</span>
          <span className="text-[15px] text-gray-400 dark:text-gray-500">Stockées localement</span>
        </div>
      </div>

      {showClearCacheConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-800 rounded-t-3xl w-full p-6"
               style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}>
            <p className="text-[17px] font-bold text-center mb-2 dark:text-white">Vider le cache de l'app ?</p>
            <p className="text-[14px] text-gray-500 dark:text-gray-400 text-center mb-6">
              Supprime les fichiers de l'application mis en cache et force le téléchargement de la dernière version.
              Vos dépenses, réglages et catégories ne sont pas touchés.
              L'application va se recharger.
            </p>
            <button onClick={clearAppCache} disabled={clearingCache}
              className="w-full py-3.5 bg-orange-500 text-white rounded-xl font-semibold text-[16px] mb-3 disabled:opacity-50">
              {clearingCache ? 'Nettoyage…' : 'Vider le cache et recharger'}
            </button>
            <button onClick={() => setShowClearCacheConfirm(false)} disabled={clearingCache}
              className="w-full py-3.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-medium text-[16px] disabled:opacity-50">
              Annuler
            </button>
          </div>
        </div>
      )}
    </>
  )
}
