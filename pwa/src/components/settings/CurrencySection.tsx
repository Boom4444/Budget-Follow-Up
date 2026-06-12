import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { CURRENCIES } from '../../data/currencies'
import type { CurrencyCode } from '../../models/types'

export default function CurrencySection() {
  const { settings, updateSettings } = useStore()
  const [showRates, setShowRates] = useState(false)
  return (
    <>
      <p className="section-header">Devise</p>
      <div className="card mx-4 overflow-hidden">
        <div className="flex items-center px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <span className="text-gray-400 dark:text-gray-500 text-sm flex-1">Devise de référence</span>
          <select value={settings.baseCurrency}
            onChange={e => updateSettings({ baseCurrency: e.target.value as CurrencyCode })}
            className="text-[15px] text-blue-600 font-medium outline-none bg-transparent">
            {CURRENCIES.map(c => (
              <option key={c.code} value={c.code}>{c.flag} {c.code} – {c.name}</option>
            ))}
          </select>
        </div>
        <button onClick={() => setShowRates(!showRates)}
          className="w-full flex items-center justify-between px-4 py-3 text-left">
          <span className="text-[15px] text-blue-600">Taux de conversion</span>
          <span className="text-gray-300 dark:text-gray-600">{showRates ? '▲' : '▼'}</span>
        </button>
        {showRates && (
          <div className="px-4 pb-3">
            {CURRENCIES.filter(c => c.code !== settings.baseCurrency).map(c => {
              const fromRate = { EUR: 1, USD: 1.08, GBP: 0.86, CHF: 0.96, MAD: 10.85, DZD: 145.2, TND: 3.35, JPY: 162.5, CAD: 1.47, AUD: 1.65, SGD: 1.45, AED: 3.97 }
              const toRate = fromRate[c.code as keyof typeof fromRate] / fromRate[settings.baseCurrency as keyof typeof fromRate]
              const from = CURRENCIES.find(x => x.code === settings.baseCurrency)!
              return (
                <div key={c.code} className="flex justify-between py-1.5 border-b border-gray-50 dark:border-gray-700 last:border-0">
                  <span className="text-[13px] text-gray-500 dark:text-gray-400">{from.flag} 1 {settings.baseCurrency}</span>
                  <span className="text-[13px] font-medium dark:text-white">{toRate.toFixed(4)} {c.code} {c.flag}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
