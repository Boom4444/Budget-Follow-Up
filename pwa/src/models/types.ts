export type CurrencyCode = 'EUR' | 'USD' | 'GBP' | 'CHF' | 'MAD' | 'DZD' | 'TND' | 'JPY' | 'CAD' | 'AUD' | 'SGD' | 'AED'

export type HouseholdMember = 'person1' | 'person2' | 'shared'

export type RecurrenceFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'

export type CategoryId =
  | 'rent' | 'homeInsurance' | 'healthInsurance' | 'electricity' | 'water'
  | 'internet' | 'mobile' | 'carInsurance' | 'loanRepayment' | 'taxes'
  | 'groceries' | 'transport' | 'health' | 'clothing' | 'leisure'
  | 'restaurants' | 'travel' | 'culture' | 'sport' | 'gifts'
  | 'children' | 'savings' | 'homeImprovement' | 'subscriptions' | 'other'

export interface Expense {
  id: string
  title: string
  amount: number
  currency: CurrencyCode
  amountInBase: number
  date: string // 'YYYY-MM-DD'
  category: CategoryId
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
