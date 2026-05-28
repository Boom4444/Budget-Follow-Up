import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuid } from 'uuid'
import type { Expense, RecurringExpense, AppSettings, CurrencyCode, CategoryId, HouseholdMember, RecurrenceFrequency } from '../models/types'
import { convertToBase } from '../data/currencies'
import { today } from '../utils/dates'

interface AppState {
  expenses: Expense[]
  recurring: RecurringExpense[]
  settings: AppSettings

  addExpense: (e: Omit<Expense, 'id' | 'amountInBase'>) => void
  updateExpense: (id: string, patch: Partial<Expense>) => void
  deleteExpense: (id: string) => void

  addRecurring: (r: Omit<RecurringExpense, 'id'>) => void
  updateRecurring: (id: string, patch: Partial<RecurringExpense>) => void
  deleteRecurring: (id: string) => void

  updateSettings: (patch: Partial<AppSettings>) => void
  loadDemoData: () => void
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      expenses: [],
      recurring: [],
      settings: {
        person1Name: 'Moi',
        person2Name: 'Partenaire',
        baseCurrency: 'EUR',
        banks: ['BNP Paribas', 'Crédit Agricole', 'Revolut'],
      },

      addExpense(e) {
        const base = get().settings.baseCurrency
        const amountInBase = convertToBase(e.amount, e.currency, base)
        set(s => ({ expenses: [...s.expenses, { ...e, id: uuid(), amountInBase }] }))
      },

      updateExpense(id, patch) {
        set(s => ({
          expenses: s.expenses.map(e => {
            if (e.id !== id) return e
            const merged = { ...e, ...patch }
            const base = s.settings.baseCurrency
            merged.amountInBase = convertToBase(merged.amount, merged.currency, base)
            return merged
          }),
        }))
      },

      deleteExpense(id) {
        set(s => ({ expenses: s.expenses.filter(e => e.id !== id) }))
      },

      addRecurring(r) {
        set(s => ({ recurring: [...s.recurring, { ...r, id: uuid() }] }))
      },

      updateRecurring(id, patch) {
        set(s => ({
          recurring: s.recurring.map(r => r.id === id ? { ...r, ...patch } : r),
        }))
      },

      deleteRecurring(id) {
        set(s => ({ recurring: s.recurring.filter(r => r.id !== id) }))
      },

      updateSettings(patch) {
        set(s => ({ settings: { ...s.settings, ...patch } }))
      },

      loadDemoData() {
        const base: CurrencyCode = 'EUR'
        const now = new Date()
        const expenses: Expense[] = []
        const recurring: RecurringExpense[] = [
          { id: uuid(), title: 'Loyer',           amount: 1200,  currency: 'EUR', category: 'rent',          isFixed: true,  bank: 'BNP Paribas',     person: 'shared',  frequency: 'monthly' },
          { id: uuid(), title: 'EDF',              amount: 85,    currency: 'EUR', category: 'electricity',   isFixed: true,  bank: 'BNP Paribas',     person: 'shared',  frequency: 'monthly' },
          { id: uuid(), title: 'Mobile Moi',       amount: 19.99, currency: 'EUR', category: 'mobile',        isFixed: true,  bank: 'Crédit Agricole', person: 'person1', frequency: 'monthly' },
          { id: uuid(), title: 'Mobile Partenaire',amount: 19.99, currency: 'EUR', category: 'mobile',        isFixed: true,  bank: 'Crédit Agricole', person: 'person2', frequency: 'monthly' },
          { id: uuid(), title: 'Netflix',          amount: 17.99, currency: 'EUR', category: 'subscriptions', isFixed: false, bank: 'Revolut',         person: 'shared',  frequency: 'monthly' },
          { id: uuid(), title: 'Mutuelle',         amount: 95,    currency: 'EUR', category: 'healthInsurance',isFixed: true, bank: 'BNP Paribas',     person: 'shared',  frequency: 'monthly' },
          { id: uuid(), title: 'Spotify',          amount: 9.99,  currency: 'EUR', category: 'subscriptions', isFixed: false, bank: 'Revolut',         person: 'person1', frequency: 'monthly' },
        ]
        type Row = [string, number, CurrencyCode, CategoryId, boolean, string, HouseholdMember]
        const monthTemplate: Row[] = [
          ['Loyer',              1200,   'EUR', 'rent',          true,  'BNP Paribas',     'shared'],
          ['EDF',                85,     'EUR', 'electricity',   true,  'BNP Paribas',     'shared'],
          ['Mutuelle',           95,     'EUR', 'healthInsurance',true, 'BNP Paribas',     'shared'],
          ['Mobile Moi',         19.99,  'EUR', 'mobile',        true,  'Crédit Agricole', 'person1'],
          ['Mobile Partenaire',  19.99,  'EUR', 'mobile',        true,  'Crédit Agricole', 'person2'],
          ['Netflix',            17.99,  'EUR', 'subscriptions', false, 'Revolut',         'shared'],
          ['Courses Lidl',       72,     'EUR', 'groceries',     false, 'Crédit Agricole', 'person1'],
          ['Courses Carrefour',  105,    'EUR', 'groceries',     false, 'Crédit Agricole', 'shared'],
          ['Carburant Total',    65,     'EUR', 'transport',     false, 'BNP Paribas',     'person2'],
          ['Pharmacie',          28,     'EUR', 'health',        false, 'Crédit Agricole', 'person1'],
          ['Restaurant',         48,     'EUR', 'restaurants',   false, 'Revolut',         'shared'],
        ]
        for (let mo = 0; mo < 6; mo++) {
          const d = new Date(now.getFullYear(), now.getMonth() - mo, 1)
          const y = d.getFullYear()
          const m = String(d.getMonth() + 1).padStart(2, '0')
          monthTemplate.forEach(([title, amount, currency, category, isFixed, bank, person], i) => {
            const day = String(Math.min(i + 1, 28)).padStart(2, '0')
            expenses.push({
              id: uuid(), title, amount: amount as number, currency,
              amountInBase: convertToBase(amount as number, currency, base),
              date: `${y}-${m}-${day}`, category, isFixed, bank, person, notes: '',
            })
          })
          if (mo === 1) {
            expenses.push({
              id: uuid(), title: 'Airbnb Barcelone', amount: 180, currency: 'EUR',
              amountInBase: 180, date: `${y}-${m}-15`, category: 'travel', isFixed: false,
              bank: 'Revolut', person: 'shared', notes: 'Week-end',
            })
          }
          if (mo === 0) {
            expenses.push({
              id: uuid(), title: 'Zara vêtements', amount: 89, currency: 'EUR',
              amountInBase: 89, date: `${y}-${m}-18`, category: 'clothing', isFixed: false,
              bank: 'Crédit Agricole', person: 'person1', notes: '',
            })
          }
        }
        set({ expenses, recurring })
      },
    }),
    {
      name: 'budget-app-store',
      version: 1,
    }
  )
)

// Selectors
export const selectExpensesByYearMonth = (
  expenses: Expense[], year: number, month: number | null
) =>
  expenses.filter(e => {
    const ey = parseInt(e.date.slice(0, 4))
    const em = parseInt(e.date.slice(5, 7))
    return ey === year && (month === null || em === month)
  })
