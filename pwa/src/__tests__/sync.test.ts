import { describe, it, expect } from 'vitest'
import { mergeSyncData, parseSyncData, canonicalize, emptyTombstones, budgetKey, type SyncData } from '../utils/sync'
import type { Expense } from '../models/types'

function expense(id: string, overrides: Partial<Expense> = {}): Expense {
  return {
    id, title: `Dépense ${id}`, amount: 10, currency: 'CHF', amountInBase: 10,
    date: '2026-06-01', category: 'nourriture', subCategory: 'Courses',
    type: 'debit', isFixed: false, bank: 'UBS', person: 'person1', notes: '',
    ...overrides,
  }
}

function syncData(overrides: Partial<SyncData> = {}): SyncData {
  return {
    syncVersion: 1,
    updatedAt: new Date().toISOString(),
    expenses: [],
    recurring: [],
    budgets: [],
    tombstones: emptyTombstones(),
    customCategories: [],
    deletedBuiltinCategories: [],
    ...overrides,
  }
}

describe('mergeSyncData', () => {
  it('unions expenses from both devices without duplicates', () => {
    const local = syncData({ expenses: [expense('a'), expense('b')] })
    const remote = syncData({ expenses: [expense('b'), expense('c')] })
    const merged = mergeSyncData(local, remote)
    expect(merged.expenses.map(e => e.id).sort()).toEqual(['a', 'b', 'c'])
  })

  it('keeps the most recently edited version of a conflicting expense', () => {
    const local = syncData({ expenses: [expense('a', { amount: 10, updatedAt: 100 })] })
    const remote = syncData({ expenses: [expense('a', { amount: 99, updatedAt: 200 })] })
    expect(mergeSyncData(local, remote).expenses[0].amount).toBe(99)
    expect(mergeSyncData(remote, local).expenses[0].amount).toBe(99)
  })

  it('propagates deletions through tombstones', () => {
    const now = Date.now()
    const local = syncData({
      expenses: [],
      tombstones: { ...emptyTombstones(), expenses: { a: now } },
    })
    const remote = syncData({ expenses: [expense('a', { updatedAt: now - 1000 })] })
    const merged = mergeSyncData(local, remote)
    expect(merged.expenses).toHaveLength(0)
    expect(merged.tombstones.expenses['a']).toBe(now)
  })

  it('an edit made after the deletion wins (no lost fresh edits)', () => {
    const local = syncData({ tombstones: { ...emptyTombstones(), expenses: { a: 100 } } })
    const remote = syncData({ expenses: [expense('a', { updatedAt: 300 })] })
    const merged = mergeSyncData(local, remote)
    expect(merged.expenses.map(e => e.id)).toEqual(['a'])
    expect(merged.tombstones.expenses['a']).toBeUndefined()
  })

  it('deleted items do not resurrect on the device that still has them', () => {
    // Device A deleted 'a'; device B still has it untouched (older updatedAt)
    const deviceA = syncData({ tombstones: { ...emptyTombstones(), expenses: { a: 500 } } })
    const deviceB = syncData({ expenses: [expense('a', { updatedAt: 100 })] })
    expect(mergeSyncData(deviceB, deviceA).expenses).toHaveLength(0)
  })

  it('merges budgets by year-month-person, newest wins', () => {
    const b1 = { year: 2026, month: 6, person: 'person1' as const, estimatedIncome: 5000, items: [], updatedAt: 100 }
    const b2 = { ...b1, estimatedIncome: 6000, updatedAt: 200 }
    const other = { year: 2026, month: 6, person: 'shared' as const, items: [{ categoryId: 'logement', amount: 2000 }], updatedAt: 50 }
    const merged = mergeSyncData(syncData({ budgets: [b1, other] }), syncData({ budgets: [b2] }))
    expect(merged.budgets).toHaveLength(2)
    expect(merged.budgets.find(b => budgetKey(b) === '2026-6-person1')?.estimatedIncome).toBe(6000)
  })

  it('is convergent: both devices reach the same canonical state', () => {
    const a = syncData({
      expenses: [expense('x', { amount: 1 }), expense('y', { amount: 2, updatedAt: 10 })],
      tombstones: { ...emptyTombstones(), expenses: { z: 50 } },
    })
    const b = syncData({
      expenses: [expense('y', { amount: 3, updatedAt: 20 }), expense('z', { updatedAt: 5 })],
      customCategories: [{ id: 'custom_1', label: 'Vacances', emoji: '🏖️', isFixed: false }],
    })
    expect(canonicalize(mergeSyncData(a, b))).toBe(canonicalize(mergeSyncData(b, a)))
  })

  it('unions custom categories and deleted builtins', () => {
    const a = syncData({ customCategories: [{ id: 'c1', label: 'A', emoji: '🅰️', isFixed: false }], deletedBuiltinCategories: ['sport'] })
    const b = syncData({ customCategories: [{ id: 'c2', label: 'B', emoji: '🅱️', isFixed: false }], deletedBuiltinCategories: ['beaute'] })
    const merged = mergeSyncData(a, b)
    expect(merged.customCategories.map(c => c.id).sort()).toEqual(['c1', 'c2'])
    expect(merged.deletedBuiltinCategories).toEqual(['beaute', 'sport'])
  })
})

describe('parseSyncData', () => {
  it('accepts a valid payload and normalizes missing fields', () => {
    const parsed = parseSyncData(JSON.stringify({ expenses: [expense('a')] }))
    expect(parsed).not.toBeNull()
    expect(parsed!.expenses).toHaveLength(1)
    expect(parsed!.tombstones).toEqual(emptyTombstones())
    expect(parsed!.recurring).toEqual([])
  })

  it('rejects corrupt content (so it cannot wipe local data)', () => {
    expect(parseSyncData('not json')).toBeNull()
    expect(parseSyncData('"string"')).toBeNull()
    expect(parseSyncData('{}')).toBeNull()
  })

  it('drops malformed expense entries', () => {
    const parsed = parseSyncData(JSON.stringify({ expenses: [expense('a'), null, 42, { noId: true }] }))
    expect(parsed!.expenses).toHaveLength(1)
  })
})
