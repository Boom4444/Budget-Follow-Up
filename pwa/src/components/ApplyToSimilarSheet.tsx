interface Props {
  /** Display name of the merchant (the transaction title). */
  merchant: string
  /** How many other same-merchant transactions would be re-categorized. */
  count: number
  /** Target category, for the confirmation label. */
  emoji: string
  categoryLabel: string
  onApplyAll: () => void
  onJustThis: () => void
}

/** Bottom sheet asking whether a category change should also apply to the other
 *  transactions of the same merchant. Lets the user re-categorize e.g. every
 *  "Restaurant Pictet" at once, while keeping a per-payment choice for merchants
 *  like Apple Pay that span several categories. */
export default function ApplyToSimilarSheet({
  merchant, count, emoji, categoryLabel, onApplyAll, onJustThis,
}: Props) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40"
         onClick={onJustThis}>
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-t-3xl p-5"
           onClick={e => e.stopPropagation()}
           style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' }}>
        <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-4" />
        <p className="text-[17px] font-semibold dark:text-white mb-1">Appliquer à d'autres&nbsp;?</p>
        <p className="text-[14px] text-gray-500 dark:text-gray-400 mb-4">
          {count} autre{count > 1 ? 's' : ''} transaction{count > 1 ? 's' : ''} «&nbsp;{merchant}&nbsp;»
          {count > 1 ? ' ont' : ' a'} une catégorie différente. Leur appliquer aussi {emoji} {categoryLabel}&nbsp;?
        </p>
        <button onClick={onApplyAll}
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold text-[15px] mb-2">
          Oui, appliquer aux {count} autres
        </button>
        <button onClick={onJustThis}
          className="w-full py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-semibold text-[15px]">
          Seulement celle-ci
        </button>
      </div>
    </div>
  )
}
