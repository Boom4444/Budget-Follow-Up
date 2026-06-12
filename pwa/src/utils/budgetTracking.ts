import { householdRatioForMonth, personShareFraction } from './split'
import type { Expense, MonthlyBudget, AppSettings } from '../models/types'

export type BudgetScope = 'all' | 'person1' | 'person2' | 'shared'

export interface BudgetTrackingRow {
  id: string
  budgeted: number
  actual: number
}

export interface BudgetTracking {
  rows: BudgetTrackingRow[]
  totalBudgeted: number
  totalActual: number
  /** Spend in categories that have no budget set (excluding 'a_classer') */
  offBudget: number
}

/**
 * Budget vs actual for a month (or a whole year when month is null), scoped
 * to the household or one person. Used by the dashboard card and by the
 * coherence test suite. Amounts are in the base currency.
 *
 * In personal scopes the foyer budget items are split between the two
 * persons using the household ratio of each month (50/50 or income
 * proration), and shared expenses are split per their own ratio — so
 * person1 + person2 always equals the household view.
 */
export function computeBudgetTracking(
  expenses: Expense[],
  budgets: MonthlyBudget[],
  settings: Pick<AppSettings, 'sharedSplitMode'>,
  year: number,
  month: number | null,
  scope: BudgetScope,
): BudgetTracking | null {
  const months = month !== null ? [month] : Array.from({ length: 12 }, (_, i) => i + 1)

  const budgeted: Record<string, number> = {}
  for (const m of months) {
    const ratio = householdRatioForMonth(budgets, settings, year, m)
    for (const b of budgets.filter(b => b.year === year && b.month === m)) {
      for (const it of b.items) {
        let amt = 0
        if (scope === 'all') amt = it.amount
        else if (scope === 'shared') amt = b.person === 'shared' ? it.amount : 0
        else if (b.person === scope) amt = it.amount
        else if (b.person === 'shared') amt = it.amount * ratio[scope] / 100
        if (amt > 0) budgeted[it.categoryId] = (budgeted[it.categoryId] ?? 0) + amt
      }
    }
  }
  if (Object.keys(budgeted).length === 0) return null

  const actual: Record<string, number> = {}
  for (const e of expenses) {
    if (e.type !== 'debit') continue
    if (parseInt(e.date.slice(0, 4)) !== year) continue
    if (month !== null && parseInt(e.date.slice(5, 7)) !== month) continue
    let w = 1
    if (scope === 'shared') w = e.person === 'shared' ? 1 : 0
    else if (scope !== 'all') w = personShareFraction(e, scope, budgets, settings)
    const amt = e.amountInBase * w
    if (amt > 0) actual[e.category] = (actual[e.category] ?? 0) + amt
  }

  const rows = Object.keys(budgeted)
    .map(id => ({ id, budgeted: budgeted[id], actual: actual[id] ?? 0 }))
    .sort((a, b) => b.budgeted - a.budgeted)
  const totalBudgeted = rows.reduce((s, r) => s + r.budgeted, 0)
  const totalActual   = rows.reduce((s, r) => s + r.actual, 0)
  const offBudget = Object.entries(actual)
    .filter(([id]) => !budgeted[id] && id !== 'a_classer')
    .reduce((s, [, v]) => s + v, 0)
  return { rows, totalBudgeted, totalActual, offBudget }
}
