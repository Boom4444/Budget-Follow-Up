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
  | 'revenus'
  | 'a_classer'
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
  /** 'income' = split recomputed each month from both persons' estimated incomes
   *  (takes precedence over splitRatio). Absent = use splitRatio, else 50/50. */
  splitMode?: 'income'
  exchangeRate?: number  // 1 unit of `currency` = exchangeRate units of baseCurrency, at transaction date
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
  /** Who uses this device — new and imported expenses default to this person.
   *  Device-specific: deliberately NOT restored from backups. */
  currentUser?: 'person1' | 'person2'
  /** Default split for shared (foyer) expenses and foyer budget tracking:
   *  'equal' = 50/50, 'income' = prorated on each person's monthly income. */
  sharedSplitMode?: 'equal' | 'income'
  baseCurrency: CurrencyCode
  banks: string[]
  theme: AppTheme
  googleDriveClientId: string
  driveBackupFolder?: { id: string; name: string }
  autoBackupToDrive?: boolean
  autoBackupFileId?: string   // Drive file ID for the single auto-backup file (update-in-place)
  customCategories: CustomCategoryDef[]
  deletedBuiltinCategories?: string[]   // built-in category IDs the user has removed
  /** Keep the Claude API key encrypted on this device (AES-GCM / IndexedDB).
   *  When false the key only lives in memory for the current session. */
  storeApiKeyLocally?: boolean
  /** @deprecated moved to secure storage (IndexedDB) — kept for one-time migration only */
  claudeApiKey?: string
}
