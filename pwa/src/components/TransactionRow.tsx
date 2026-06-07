import CategoryAvatar from './CategoryAvatar'
import { CURRENCY_MAP } from '../data/currencies'
import { formatAmount } from '../utils/formatters'
import type { Expense, CurrencyCode } from '../models/types'

interface Props {
  expense: Expense
  cat: { emoji: string; bgColor: string; color: string; label: string } | null
  baseCurrency: CurrencyCode
  person1Name: string
  person2Name: string
  swipeOpen?: boolean
  onSwipeToggle?: () => void
  onDelete?: () => void
  onEdit?: () => void
  isLast?: boolean
}

function personLabel(p: string, person1Name: string, person2Name: string): string {
  if (p === 'person1') return person1Name
  if (p === 'person2') return person2Name
  return 'Commun'
}

export default function TransactionRow({
  expense,
  cat,
  baseCurrency,
  person1Name,
  person2Name,
  swipeOpen = false,
  onSwipeToggle,
  onDelete,
  onEdit,
  isLast = false,
}: Props) {
  const isCredit = expense.type === 'credit'
  const avatarEmoji   = isCredit ? '💚' : (cat?.emoji ?? '📦')
  const avatarBgColor = isCredit ? '#d1fae5' : (cat?.bgColor ?? '#f3f4f6')
  const sym = CURRENCY_MAP[expense.currency]?.symbol ?? expense.currency
  const bankBadge = expense.bank ? expense.bank.charAt(0).toUpperCase() : undefined

  function handleRowClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (swipeOpen) {
      onSwipeToggle?.()
    } else {
      onEdit?.()
    }
  }

  return (
    <div className={`relative overflow-hidden${!isLast ? ' border-b border-gray-100 dark:border-gray-700/60' : ''}`}>
      {/* Delete panel */}
      <div className="absolute inset-y-0 right-0 flex items-center justify-center w-20 bg-red-500">
        <button
          onClick={() => onDelete?.()}
          className="text-white text-[12px] font-semibold w-full h-full flex items-center justify-center">
          🗑 Suppr.
        </button>
      </div>

      {/* Swipeable row */}
      <div
        className={`relative bg-white dark:bg-gray-800 flex items-center gap-3 px-4 py-3 transition-transform
          ${swipeOpen ? '-translate-x-20' : 'translate-x-0'}`}
        onClick={handleRowClick}>
        {/* Avatar with bank badge */}
        <CategoryAvatar emoji={avatarEmoji} bgColor={avatarBgColor} size="md" badgeText={bankBadge} />

        {/* Center */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-[15px] font-medium truncate dark:text-white">{expense.title}</p>
            {expense.isFixed && <span className="text-[11px]">🔒</span>}
          </div>
          <div className="flex items-center gap-1 mt-0.5 min-w-0 flex-wrap">
            <span className="text-[12px] font-medium" style={{ color: isCredit ? '#16a34a' : (cat?.color ?? '#6b7280') }}>
              {cat?.label ?? expense.category}
            </span>
            <span className="text-[12px] text-gray-300 dark:text-gray-600">·</span>
            <span className="text-[12px] text-gray-400 dark:text-gray-500">
              {personLabel(expense.person, person1Name, person2Name)}
            </span>
            {expense.bank && (
              <>
                <span className="text-[12px] text-gray-300 dark:text-gray-600">·</span>
                <span className="text-[12px] text-gray-400 dark:text-gray-500 truncate">{expense.bank}</span>
              </>
            )}
          </div>
          {expense.notes && (
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 truncate italic">{expense.notes}</p>
          )}
        </div>

        {/* Right amount */}
        <div className="text-right flex-shrink-0">
          <p className={`text-[15px] font-semibold ${isCredit ? 'text-green-600' : 'text-red-500 dark:text-red-400'}`}>
            {isCredit ? '+' : '-'}{formatAmount(expense.amount, expense.currency as CurrencyCode)}
          </p>
          {expense.currency !== baseCurrency && (
            <p className="text-[11px] text-gray-400 dark:text-gray-500">
              {formatAmount(expense.amountInBase, baseCurrency)}
            </p>
          )}
        </div>

        {/* Swipe chevron — › when open (closes), ‹ when closed (opens) */}
        <button
          className="ml-1 text-gray-200 dark:text-gray-600 text-lg flex-shrink-0 z-10"
          onClick={e => { e.stopPropagation(); onSwipeToggle?.() }}>
          {swipeOpen ? '›' : '‹'}
        </button>
      </div>
    </div>
  )
}
