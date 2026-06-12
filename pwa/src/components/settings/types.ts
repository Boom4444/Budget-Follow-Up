import type { Expense, RecurringExpense, MonthlyBudget, AppSettings } from '../../models/types'

/** Parsed backup waiting for the user to choose Remplacer / Fusionner.
 *  Fed by both the file import and the Drive restore. */
export interface PendingImport {
  expenses: Expense[]
  recurring: RecurringExpense[]
  budgets: MonthlyBudget[]
  /** Preferences from a JSON/Drive backup — restored together with the data */
  settings?: Partial<AppSettings>
  label: string
}
