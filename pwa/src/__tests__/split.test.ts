import { describe, it, expect } from 'vitest'
import { incomeRatioForMonth, householdRatioForMonth, splitRatioOf, personShareFraction } from '../utils/split'
import type { MonthlyBudget } from '../models/types'

const budgets: MonthlyBudget[] = [
  { year: 2026, month: 6, person: 'person1', estimatedIncome: 6000, items: [] },
  { year: 2026, month: 6, person: 'person2', estimatedIncome: 4000, items: [] },
  // Month 7: incomes change → ratio changes
  { year: 2026, month: 7, person: 'person1', estimatedIncome: 5000, items: [] },
  { year: 2026, month: 7, person: 'person2', estimatedIncome: 5000, items: [] },
]

describe('incomeRatioForMonth', () => {
  it('prorates on the month incomes (60/40)', () => {
    expect(incomeRatioForMonth(budgets, 2026, 6)).toEqual({ person1: 60, person2: 40 })
  })

  it('changes month by month (50/50 in July)', () => {
    expect(incomeRatioForMonth(budgets, 2026, 7)).toEqual({ person1: 50, person2: 50 })
  })

  it('walks back to the most recent month with incomes', () => {
    // August has no budget → uses July incomes
    expect(incomeRatioForMonth(budgets, 2026, 8)).toEqual({ person1: 50, person2: 50 })
    // March 2027 is more than 12 months after July 2026? No — 8 months, still found
    expect(incomeRatioForMonth(budgets, 2027, 3)).toEqual({ person1: 50, person2: 50 })
  })

  it('falls back to 50/50 when no income was ever set', () => {
    expect(incomeRatioForMonth([], 2026, 6)).toEqual({ person1: 50, person2: 50 })
  })

  it('gives 100% to the only person with a known income', () => {
    const solo: MonthlyBudget[] = [{ year: 2026, month: 6, person: 'person1', estimatedIncome: 5000, items: [] }]
    expect(incomeRatioForMonth(solo, 2026, 6)).toEqual({ person1: 100, person2: 0 })
  })
})

describe('householdRatioForMonth', () => {
  it("returns 50/50 in 'equal' mode regardless of incomes", () => {
    expect(householdRatioForMonth(budgets, { sharedSplitMode: 'equal' }, 2026, 6)).toEqual({ person1: 50, person2: 50 })
    expect(householdRatioForMonth(budgets, {}, 2026, 6)).toEqual({ person1: 50, person2: 50 })
  })

  it("prorates in 'income' mode", () => {
    expect(householdRatioForMonth(budgets, { sharedSplitMode: 'income' }, 2026, 6)).toEqual({ person1: 60, person2: 40 })
  })
})

describe('splitRatioOf', () => {
  const base = { date: '2026-06-15', person: 'shared' as const }

  it("splitMode 'income' takes precedence and uses the expense month", () => {
    expect(splitRatioOf({ ...base, splitMode: 'income', splitRatio: { person1: 90, person2: 10 } }, budgets, {}))
      .toEqual({ person1: 60, person2: 40 })
    expect(splitRatioOf({ ...base, date: '2026-07-02', splitMode: 'income' }, budgets, {}))
      .toEqual({ person1: 50, person2: 50 })
  })

  it('explicit splitRatio wins over the household default', () => {
    expect(splitRatioOf({ ...base, splitRatio: { person1: 70, person2: 30 } }, budgets, { sharedSplitMode: 'income' }))
      .toEqual({ person1: 70, person2: 30 })
  })

  it('falls back to the household default mode', () => {
    expect(splitRatioOf(base, budgets, { sharedSplitMode: 'income' })).toEqual({ person1: 60, person2: 40 })
    expect(splitRatioOf(base, budgets, {})).toEqual({ person1: 50, person2: 50 })
  })
})

describe('personShareFraction', () => {
  it('own expense → 1, other person → 0', () => {
    const e = { date: '2026-06-15', person: 'person1' as const }
    expect(personShareFraction(e, 'person1', budgets, {})).toBe(1)
    expect(personShareFraction(e, 'person2', budgets, {})).toBe(0)
  })

  it('shared expense → split fraction', () => {
    const e = { date: '2026-06-15', person: 'shared' as const, splitMode: 'income' as const }
    expect(personShareFraction(e, 'person1', budgets, {})).toBeCloseTo(0.6)
    expect(personShareFraction(e, 'person2', budgets, {})).toBeCloseTo(0.4)
  })
})
