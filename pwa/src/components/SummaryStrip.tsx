import { formatAmount } from '../utils/formatters'
import type { CurrencyCode } from '../models/types'

export type StripFilter = 'all' | 'credit' | 'debit' | 'fixed'

interface Props {
  entries: number
  sorties: number
  recurrents: number
  active: StripFilter
  onSelect: (f: StripFilter) => void
  currency: CurrencyCode
}

export default function SummaryStrip({ entries, sorties, recurrents, active, onSelect, currency }: Props) {
  const segments: { key: StripFilter; label: string; value: number; color: string }[] = [
    { key: 'credit', label: 'Revenus',    value: entries,    color: '#16a34a' },
    { key: 'debit',  label: 'Sorties',    value: sorties,    color: '#ef4444' },
    { key: 'fixed',  label: 'Récurrents', value: recurrents, color: '#f97316' },
  ]

  return (
    <div className="grid grid-cols-3 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
      {segments.map((seg, idx) => {
        const isActive = active === seg.key
        const isDimmed = active !== 'all' && !isActive
        return (
          <button
            key={seg.key}
            onClick={() => onSelect(isActive ? 'all' : seg.key)}
            className={`relative flex flex-col items-center justify-center py-3 transition-opacity
              ${idx < segments.length - 1 ? 'border-r border-gray-100 dark:border-gray-700' : ''}
              ${isDimmed ? 'opacity-40' : 'opacity-100'}`}
            style={{ borderBottom: isActive ? `2px solid ${seg.color}` : '2px solid transparent' }}>
            <span className="text-[11px] text-gray-400 dark:text-gray-500 mb-0.5">{seg.label}</span>
            <span className="text-[16px] font-bold" style={{ color: seg.color }}>
              {formatAmount(seg.value, currency)}
            </span>
          </button>
        )
      })}
    </div>
  )
}
