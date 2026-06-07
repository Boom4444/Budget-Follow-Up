import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
  })

  useEffect(() => {
    if (!offlineReady) return
    const timer = setTimeout(() => setOfflineReady(false), 3000)
    return () => clearTimeout(timer)
  }, [offlineReady, setOfflineReady])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        navigator.serviceWorker?.getRegistration().then(reg => reg?.update())
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  // Robustly activate the waiting service worker and reload.
  // updateServiceWorker(true) posts SKIP_WAITING then waits for the
  // 'controllerchange' event — which iOS WebKit sometimes never fires.
  // We post SKIP_WAITING ourselves and reload after a short grace period.
  async function applyUpdate() {
    setNeedRefresh(false)
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      if (reg?.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' })
      } else {
        // Fallback: let vite-plugin-pwa try its own mechanism
        await updateServiceWorker(false)
      }
    } catch {
      // ignore
    }
    // Small delay lets the SW activate before the reload
    setTimeout(() => window.location.reload(), 300)
  }

  if (!needRefresh && !offlineReady) return null

  return (
    <>
      {needRefresh && (
        <div
          role="alert"
          className={[
            'fixed top-0 inset-x-0 z-[100]',
            'bg-blue-600 dark:bg-blue-700',
            'text-white',
            'flex items-center justify-between gap-3',
            'px-4',
          ].join(' ')}
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.625rem)', paddingBottom: '0.625rem' }}
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <span aria-hidden="true">🔄</span>
            <span>Mise à jour disponible</span>
          </span>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={applyUpdate}
              className={[
                'px-3 py-1 rounded-lg text-sm font-semibold',
                'bg-white text-blue-700',
                'dark:bg-blue-100 dark:text-blue-800',
                'active:opacity-80 transition-opacity',
              ].join(' ')}
            >
              Mettre à jour
            </button>

            <button
              type="button"
              onClick={() => setNeedRefresh(false)}
              className={[
                'w-7 h-7 flex items-center justify-center rounded-full text-lg leading-none',
                'bg-blue-500 dark:bg-blue-600',
                'text-white opacity-80 hover:opacity-100 active:opacity-60',
                'transition-opacity',
              ].join(' ')}
              aria-label="Ignorer la mise à jour"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {offlineReady && !needRefresh && (
        <div
          role="status"
          className={[
            'fixed bottom-0 inset-x-0 z-[100]',
            'bg-green-600 dark:bg-green-700',
            'text-white',
            'flex items-center justify-between gap-3',
            'px-4',
          ].join(' ')}
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.625rem)', paddingTop: '0.625rem' }}
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <span>Application prête hors-ligne ✓</span>
          </span>

          <button
            type="button"
            onClick={() => setOfflineReady(false)}
            className={[
              'w-7 h-7 flex items-center justify-center rounded-full text-lg leading-none',
              'bg-green-500 dark:bg-green-600',
              'text-white opacity-80 hover:opacity-100 active:opacity-60',
              'transition-opacity',
            ].join(' ')}
            aria-label="Fermer la notification"
          >
            ×
          </button>
        </div>
      )}
    </>
  )
}
