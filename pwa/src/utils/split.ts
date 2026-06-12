import type { Expense, MonthlyBudget, AppSettings } from '../models/types'

export interface SplitRatio {
  person1: number
  person2: number
}

const FIFTY_FIFTY: SplitRatio = { person1: 50, person2: 50 }

/**
 * Income-proportional split for a given month, from each person's estimated
 * income in the monthly budgets. If the month has no income, walks back up to
 * 12 months to the most recent month where an income is set (so the ratio
 * carries over until incomes are updated). Falls back to 50/50 when no income
 * was ever entered.
 */
export function incomeRatioForMonth(
  budgets: MonthlyBudget[],
  year: number,
  month: number,
): SplitRatio {
  let y = year
  let m = month
  for (let i = 0; i < 12; i++) {
    const inc1 = budgets.find(b => b.year === y && b.month === m && b.person === 'person1')?.estimatedIncome ?? 0
    const inc2 = budgets.find(b => b.year === y && b.month === m && b.person === 'person2')?.estimatedIncome ?? 0
    const total = inc1 + inc2
    if (total > 0) {
      const p1 = Math.round((inc1 / total) * 100)
      return { person1: p1, person2: 100 - p1 }
    }
    if (m === 1) { y--; m = 12 } else { m-- }
  }
  return FIFTY_FIFTY
}

/** The household's default ratio for a month, per the sharedSplitMode setting. */
export function householdRatioForMonth(
  budgets: MonthlyBudget[],
  settings: Pick<AppSettings, 'sharedSplitMode'>,
  year: number,
  month: number,
): SplitRatio {
  return settings.sharedSplitMode === 'income'
    ? incomeRatioForMonth(budgets, year, month)
    : FIFTY_FIFTY
}

/**
 * Effective split ratio of a shared expense:
 * 1. splitMode 'income' → prorated on that month's incomes
 * 2. explicit splitRatio → as stored
 * 3. otherwise → household default (sharedSplitMode setting)
 */
export function splitRatioOf(
  e: Pick<Expense, 'date' | 'person' | 'splitRatio' | 'splitMode'>,
  budgets: MonthlyBudget[],
  settings: Pick<AppSettings, 'sharedSplitMode'>,
): SplitRatio {
  if (e.splitMode === 'income') {
    return incomeRatioForMonth(budgets, parseInt(e.date.slice(0, 4)), parseInt(e.date.slice(5, 7)))
  }
  if (e.splitRatio) return e.splitRatio
  return householdRatioForMonth(budgets, settings, parseInt(e.date.slice(0, 4)), parseInt(e.date.slice(5, 7)))
}

/**
 * Fraction (0..1) of an expense borne by `person`: the full amount for their
 * own expenses, their split share for shared ones, 0 otherwise.
 */
export function personShareFraction(
  e: Pick<Expense, 'date' | 'person' | 'splitRatio' | 'splitMode'>,
  person: 'person1' | 'person2',
  budgets: MonthlyBudget[],
  settings: Pick<AppSettings, 'sharedSplitMode'>,
): number {
  if (e.person === person) return 1
  if (e.person !== 'shared') return 0
  return splitRatioOf(e, budgets, settings)[person] / 100
}
