import { deriveImportKeyword } from './bankImport'
import type { Expense } from '../models/types'

/** Normalized merchant key for a transaction title (strips dates/refs/accents/
 *  bank noise). Two transactions of the same shop share the same key, so
 *  "Restaurant Pictet 05.01" and "Restaurant Pictet 12.01" match. */
export function merchantKey(title: string): string {
  return deriveImportKeyword(title)
}

/** Other expenses (excluding `sourceId`) from the same merchant and of the same
 *  direction whose category differs from `targetCategory` — the candidates a
 *  user may want to re-categorize in bulk after re-classifying one of them.
 *  Returns [] when the title yields no usable merchant key (too generic). */
export function findSimilarExpenses(
  expenses: Expense[],
  sourceId: string,
  title: string,
  type: 'debit' | 'credit',
  targetCategory: string,
): Expense[] {
  const key = merchantKey(title)
  if (!key) return []
  return expenses.filter(e =>
    e.id !== sourceId &&
    e.type === type &&
    e.category !== targetCategory &&
    merchantKey(e.title) === key
  )
}
