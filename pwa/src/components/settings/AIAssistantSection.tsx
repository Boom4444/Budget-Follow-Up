import { useStore } from '../../store/useStore'
import { storeApiKey, clearApiKey } from '../../utils/secureStorage'

/** Claude API key — encrypted locally (AES/IndexedDB), never included in backups. */
export default function AIAssistantSection() {
  const { settings, updateSettings, claudeApiKey, setClaudeApiKey } = useStore()
  return (
    <>
      <p className="section-header">Assistant IA</p>
      <div className="card mx-4 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <p className="text-[15px] font-medium dark:text-white">Clé API Claude</p>
            <span className="text-[11px] text-gray-400 dark:text-gray-500 flex items-center gap-1">🔒 Chiffrée localement</span>
          </div>
          <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">Obtenez une clé sur console.anthropic.com</p>
        </div>
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <input
            type="password"
            placeholder="sk-ant-…"
            value={claudeApiKey}
            onChange={async e => {
              const key = e.target.value
              setClaudeApiKey(key)
              if (settings.storeApiKeyLocally !== false && key.length > 10) {
                await storeApiKey(key)
              } else if (key.length === 0) {
                await clearApiKey()
              }
            }}
            className="w-full text-[14px] outline-none bg-transparent dark:text-white dark:placeholder-gray-500 font-mono"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-[15px] dark:text-white">Conserver la clé sur l'appareil</p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
              {settings.storeApiKeyLocally !== false
                ? 'Chiffrée (AES) — jamais envoyée dans les sauvegardes'
                : 'Session uniquement — à ressaisir à chaque ouverture'}
            </p>
          </div>
          <button
            role="switch"
            aria-checked={settings.storeApiKeyLocally !== false}
            onClick={async () => {
              const keep = !(settings.storeApiKeyLocally !== false)
              updateSettings({ storeApiKeyLocally: keep })
              if (keep) {
                if (claudeApiKey.length > 10) await storeApiKey(claudeApiKey)
              } else {
                await clearApiKey()
              }
            }}
            className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${settings.storeApiKeyLocally !== false ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.storeApiKeyLocally !== false ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>
        {claudeApiKey.startsWith('sk-') && (
          <div className="px-4 pb-3 flex items-center gap-2">
            <p className="text-[12px] text-green-600 dark:text-green-400">
              ✓ Clé configurée{settings.storeApiKeyLocally !== false ? ' — stockée chiffrée sur cet appareil' : ' — pour cette session uniquement'}
            </p>
          </div>
        )}
      </div>
    </>
  )
}
