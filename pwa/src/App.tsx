import { useState } from 'react'
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

  return (
    <div className="flex flex-col h-full">
      {/* Screen content */}
      <div className="flex-1 overflow-hidden">
        {tab === 'dashboard'  && <DashboardScreen />}
        {tab === 'expenses'   && <ExpensesScreen />}
        {tab === 'recurring'  && <RecurringScreen />}
        {tab === 'settings'   && <SettingsScreen />}
      </div>

      {/* Tab bar */}
      <nav className="bg-white border-t border-gray-200 flex-shrink-0"
           style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors
                ${tab === t.id ? 'text-blue-600' : 'text-gray-400'}`}
            >
              <span className="text-xl leading-none">{t.icon}</span>
              <span className={`text-[10px] font-medium ${tab === t.id ? 'text-blue-600' : 'text-gray-400'}`}>
                {t.label}
              </span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
