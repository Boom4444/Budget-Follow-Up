import { useState, useEffect } from 'react'
import { useStore } from './store/useStore'
import { refreshExchangeRates } from './data/currencies'
import DashboardScreen from './screens/DashboardScreen'
import ExpensesScreen from './screens/ExpensesScreen'
import RecurringScreen from './screens/RecurringScreen'
import SettingsScreen from './screens/SettingsScreen'
import BudgetScreen from './screens/BudgetScreen'
import HelpScreen from './screens/HelpScreen'
import AIChatScreen from './screens/AIChatScreen'
import OutilsScreen from './screens/OutilsScreen'
import UpdatePrompt from './components/UpdatePrompt'
import { useAutoBackupToDrive } from './hooks/useAutoBackupToDrive'
import { useDriveSync } from './hooks/useDriveSync'
import { loadApiKey, storeApiKey } from './utils/secureStorage'

type Tab = 'dashboard' | 'expenses' | 'budget' | 'recurring' | 'outils' | 'ai' | 'settings'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Tableau',  icon: '📊' },
  { id: 'expenses',  label: 'Dépenses', icon: '💸' },
  { id: 'budget',    label: 'Budget',   icon: '🎯' },
  { id: 'recurring', label: 'Récur.',   icon: '🔄' },
  { id: 'outils',    label: 'Outils',   icon: '📐' },
  { id: 'ai',        label: 'IA',       icon: '🤖' },
  { id: 'settings',  label: 'Réglages', icon: '⚙️' },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [showHelp, setShowHelp] = useState(false)
  const { settings, updateSettings, setClaudeApiKey } = useStore()
  useAutoBackupToDrive()
  useDriveSync()

  // Items deleted more than 30 days ago leave the trash permanently
  useEffect(() => {
    useStore.getState().purgeExpiredTrash()
  }, [])

  // Load Claude API key from secure storage; migrate old plaintext key if present
  useEffect(() => {
    loadApiKey().then(stored => {
      if (stored) {
        setClaudeApiKey(stored)
      } else if (settings.claudeApiKey) {
        // One-time migration from localStorage → IndexedDB encrypted storage
        storeApiKey(settings.claudeApiKey).then(() => {
          setClaudeApiKey(settings.claudeApiKey!)
          updateSettings({ claudeApiKey: undefined })
        })
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    refreshExchangeRates()
  }, [])

  // Dismiss keyboard on scroll (iOS)
  useEffect(() => {
    const dismiss = () => { (document.activeElement as HTMLElement)?.blur() }
    document.addEventListener('touchmove', dismiss, { passive: true })
    return () => document.removeEventListener('touchmove', dismiss)
  }, [])

  useEffect(() => {
    const html = document.documentElement
    if (settings.theme === 'dark') {
      html.classList.add('dark')
      return
    }
    if (settings.theme === 'light') {
      html.classList.remove('dark')
      return
    }
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    html.classList.toggle('dark', mql.matches)
    const handler = (e: MediaQueryListEvent) => html.classList.toggle('dark', e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [settings.theme])

  return (
    <div className="flex flex-col h-full bg-[#f2f2f7] dark:bg-[#1c1c1e]">
      <UpdatePrompt />

      {/* Screen content */}
      <div className="flex-1 overflow-hidden">
        {tab === 'dashboard'  && <DashboardScreen />}
        {tab === 'expenses'   && <ExpensesScreen />}
        {tab === 'budget'     && <BudgetScreen />}
        {tab === 'recurring'  && <RecurringScreen />}
        {tab === 'outils'     && <OutilsScreen />}
        {tab === 'ai'         && <AIChatScreen />}
        {tab === 'settings'   && <SettingsScreen onShowHelp={() => setShowHelp(true)} />}
      </div>

      {/* Tab bar */}
      <nav className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex-shrink-0"
           style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors
                ${tab === t.id ? 'text-blue-600' : 'text-gray-400 dark:text-gray-500'}`}
            >
              <span className="text-xl leading-none">{t.icon}</span>
              <span className={`text-[10px] font-medium ${tab === t.id ? 'text-blue-600' : 'text-gray-400 dark:text-gray-500'}`}>
                {t.label}
              </span>
            </button>
          ))}
        </div>
      </nav>

      {/* Help overlay — slides over the whole app */}
      {showHelp && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#f2f2f7] dark:bg-[#1c1c1e]">
          {/* Back bar */}
          <div className="flex-shrink-0 flex items-center px-4 py-3 bg-[#f2f2f7] dark:bg-[#1c1c1e] border-b border-gray-200 dark:border-gray-700"
               style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}>
            <button
              onClick={() => setShowHelp(false)}
              className="flex items-center gap-1 text-blue-600 text-[16px] font-medium"
            >
              <span className="text-[20px] leading-none">‹</span>
              Réglages
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <HelpScreen />
          </div>
        </div>
      )}
    </div>
  )
}
