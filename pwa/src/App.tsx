import { useState, useEffect } from 'react'
import { useStore } from './store/useStore'
import DashboardScreen from './screens/DashboardScreen'
import ExpensesScreen from './screens/ExpensesScreen'
import RecurringScreen from './screens/RecurringScreen'
import SettingsScreen from './screens/SettingsScreen'

type Tab = 'dashboard' | 'expenses' | 'recurring' | 'settings'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Tableau',   icon: '📊' },
  { id: 'expenses',  label: 'Dépenses',  icon: '💸' },
  { id: 'recurring', label: 'Récurrentes', icon: '🔄' },
  { id: 'settings',  label: 'Réglages',  icon: '⚙️' },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const { settings } = useStore()

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
    // system
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    html.classList.toggle('dark', mql.matches)
    const handler = (e: MediaQueryListEvent) => html.classList.toggle('dark', e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [settings.theme])

  return (
    <div className="flex flex-col h-full bg-[#f2f2f7] dark:bg-[#1c1c1e]">
      {/* Screen content */}
      <div className="flex-1 overflow-hidden">
        {tab === 'dashboard'  && <DashboardScreen />}
        {tab === 'expenses'   && <ExpensesScreen />}
        {tab === 'recurring'  && <RecurringScreen />}
        {tab === 'settings'   && <SettingsScreen />}
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
    </div>
  )
}
