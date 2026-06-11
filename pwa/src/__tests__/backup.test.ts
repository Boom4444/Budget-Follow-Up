import { describe, it, expect, beforeEach } from 'vitest'
import { autoSave, getAutoBackupSlots, parseJSONBackup, BACKUP_VERSION } from '../utils/backup'
import type { AppSettings, Expense, MonthlyBudget, RecurringExpense } from '../models/types'

// Minimal localStorage stub for the Node test environment
const storage = new Map<string, string>()
beforeEach(() => {
  storage.clear()
  globalThis.localStorage = {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => void storage.set(k, v),
    removeItem: (k: string) => void storage.delete(k),
    clear: () => storage.clear(),
    key: (i: number) => [...storage.keys()][i] ?? null,
    get length() { return storage.size },
  } as Storage
})

const settings: AppSettings = {
  person1Name: 'Moi',
  person2Name: 'Partenaire',
  baseCurrency: 'CHF',
  banks: ['UBS'],
  theme: 'system',
  googleDriveClientId: '',
  customCategories: [],
}

const expense: Expense = {
  id: 'e1', date: '2026-06-01', bank: 'UBS', category: 'nourriture',
  subCategory: 'Courses', type: 'debit', amount: 42, currency: 'CHF',
  amountInBase: 42, isFixed: false, title: 'Migros', person: 'person1', notes: '',
}

const recurring: RecurringExpense[] = [
  { id: 'r1', title: 'Loyer', category: 'logement', subCategory: 'Loyer', amount: 2000, currency: 'CHF', isFixed: true, bank: 'UBS', person: 'person1', frequency: 'monthly' },
]

const budgets: MonthlyBudget[] = [
  { year: 2026, month: 6, person: 'person1', estimatedIncome: 7800, items: [{ categoryId: 'nourriture', amount: 600 }] },
]

describe('autoSave (local backup slots)', () => {
  it('stores expenses, recurring, settings AND budgets', () => {
    autoSave([expense], recurring, settings, budgets)
    const slots = getAutoBackupSlots()
    expect(slots).toHaveLength(1)
    expect(slots[0].data.version).toBe(BACKUP_VERSION)
    expect(slots[0].data.expenses).toHaveLength(1)
    expect(slots[0].data.recurring).toHaveLength(1)
    expect(slots[0].data.budgets).toHaveLength(1)
    expect(slots[0].data.budgets![0].estimatedIncome).toBe(7800)
    expect(slots[0].data.settings.baseCurrency).toBe('CHF')
  })

  it('keeps at most 5 slots, newest first', () => {
    for (let i = 0; i < 7; i++) {
      autoSave([{ ...expense, amount: i }], [], settings, [])
    }
    const slots = getAutoBackupSlots()
    expect(slots).toHaveLength(5)
    expect(slots[0].data.expenses[0].amount).toBe(6)
    expect(slots[4].data.expenses[0].amount).toBe(2)
  })

  it('round-trips through parseJSONBackup (restore path)', () => {
    autoSave([expense], recurring, settings, budgets)
    const slot = getAutoBackupSlots()[0]
    const restored = parseJSONBackup(JSON.stringify(slot.data))
    expect(restored).not.toBeNull()
    expect(restored!.expenses[0].title).toBe('Migros')
    expect(restored!.budgets![0].items[0].amount).toBe(600)
    expect(restored!.settings.person1Name).toBe('Moi')
  })
})
