export type CurrencyCode = 'EUR' | 'USD' | 'GBP' | 'CHF' | 'MAD' | 'DZD' | 'TND' | 'JPY' | 'CAD' | 'AUD' | 'SGD' | 'AED'

export type HouseholdMember = 'person1' | 'person2' | 'shared'

export type RecurrenceFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'

export type CategoryId =
  | 'banque'
  | 'impots'
  | 'cadeaux'
  | 'abonnements'
  | 'logement'
  | 'transport'
  | 'loisirs'
  | 'besoinsPersonnels'
  | 'nourriture'
  | 'entreprise'
  | 'assurance'

export interface Expense {
  id: string
  title: string          // boutique / description
  amount: number
  currency: CurrencyCode
  amountInBase: number
  date: string           // 'YYYY-MM-DD'
  category: CategoryId
  subCategory: string
  type: 'debit' | 'credit'
  isFixed: boolean
  bank: string
  person: HouseholdMember
  notes: string
}

export interface RecurringExpense {
  id: string
  title: string
  amount: number
  currency: CurrencyCode
  category: CategoryId
  subCategory: string
  isFixed: boolean
  bank: string
  person: HouseholdMember
  frequency: RecurrenceFrequency
}

export interface AppSettings {
  person1Name: string
  person2Name: string
  baseCurrency: CurrencyCode
  banks: string[]
}
