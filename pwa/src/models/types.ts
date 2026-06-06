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
  | 'sante'
  | 'habillement'
  | 'maison'
  | 'beaute'
  | 'sport'
  | 'autre'

export interface CustomCategoryDef {
  id: string
  label: string
  emoji: string
  isFixed: boolean
}

export interface Expense {
  id: string
  title: string
  amount: number
  currency: CurrencyCode
  amountInBase: number
  date: string           // 'YYYY-MM-DD'
  category: string       // CategoryId or custom category id
  subCategory: string
  type: 'debit' | 'credit'
  isFixed: boolean
  bank: string
  person: HouseholdMember
  notes: string
  splitRatio?: { person1: number; person2: number }  // percentages summing to 100, only for person='shared'
}

export interface RecurringExpense {
  id: string
  title: string
  amount: number
  currency: CurrencyCode
  category: string       // CategoryId or custom category id
  subCategory: string
  isFixed: boolean
  bank: string
  person: HouseholdMember
  frequency: RecurrenceFrequency
}

export type AppTheme = 'light' | 'dark' | 'system'

export interface BudgetItem {
  categoryId: string     // CategoryId or custom category id
  amount: number
}

export interface MonthlyBudget {
  year: number
  month: number
  person: HouseholdMember
  estimatedIncome?: number
  items: BudgetItem[]
}

export interface AppSettings {
  person1Name: string
  person2Name: string
  baseCurrency: CurrencyCode
  banks: string[]
  theme: AppTheme
  googleDriveClientId: string
  driveBackupFolder?: { id: string; name: string }
  customCategories: CustomCategoryDef[]
  claudeApiKey: string
}
