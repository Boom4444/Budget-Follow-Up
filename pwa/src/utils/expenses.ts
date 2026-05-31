import type { Expense } from '../models/types'

/** Returns the pro-rated amountInBase that belongs to `person` for a given expense. */
export function getPersonShare(expense: Expense, person: 'person1' | 'person2'): number {
  if (expense.type !== 'debit') return 0
  if (expense.person === person) return expense.amountInBase
  if (expense.person !== 'shared') return 0
  const ratio = expense.splitRatio ?? { person1: 50, person2: 50 }
  return expense.amountInBase * (ratio[person] / 100)
}
