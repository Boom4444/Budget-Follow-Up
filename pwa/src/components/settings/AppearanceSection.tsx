import { useStore } from '../../store/useStore'
import type { AppTheme } from '../../models/types'

const THEME_OPTIONS: { value: AppTheme; label: string; icon: string }[] = [
  { value: 'light',  label: 'Clair',    icon: '☀️' },
  { value: 'dark',   label: 'Sombre',   icon: '🌙' },
  { value: 'system', label: 'Système',  icon: '⚙️' },
]

export default function AppearanceSection() {
  const { settings, updateSettings } = useStore()
  return (
    <>
      <p className="section-header">Apparence</p>
      <div className="card mx-4 overflow-hidden">
        <div className="flex p-1.5 gap-1">
          {THEME_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => updateSettings({ theme: opt.value })}
              className={`flex-1 flex flex-col items-center py-2.5 rounded-xl text-[12px] font-semibold transition-colors
                ${settings.theme === opt.value
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400'}`}>
              <span className="text-lg mb-0.5">{opt.icon}</span>
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
