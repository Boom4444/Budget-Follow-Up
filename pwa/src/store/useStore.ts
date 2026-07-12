import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuid } from 'uuid'
import type { Expense, RecurringExpense, AppSettings, CurrencyCode, HouseholdMember, MonthlyBudget, BudgetItem, ImportRule } from '../models/types'
import { convertToBase } from '../data/currencies'
import { autoSave } from '../utils/backup'
import { budgetKey, emptyTombstones, type Tombstones } from '../utils/sync'
import { purgeExpired } from '../utils/trash'
import { DEMO_EXPENSE_ROWS, DEMO_RECURRING } from '../data/demoData'

export type TrashedExpense = Expense & { deletedAt: number }
export type TrashedRecurring = RecurringExpense & { deletedAt: number }

export interface AutoBackupStatus {
  at: string
  status: 'ok' | 'error'
  /** 'auth' = Drive reconnection needed; 'other' = network/server failure */
  reason?: 'auth' | 'other'
}

interface AppState {
  expenses: Expense[]
  recurring: RecurringExpense[]
  settings: AppSettings

  addExpense: (e: Omit<Expense, 'id' | 'amountInBase'>) => void
  addBatchExpenses: (items: Omit<Expense, 'id' | 'amountInBase'>[]) => void
  updateExpense: (id: string, patch: Partial<Expense>) => void
  /** Apply the same category/sub-category/fixed flag to several expenses at once
   *  (used to re-categorize every transaction of the same merchant). */
  setCategoryForExpenses: (ids: string[], patch: Pick<Expense, 'category' | 'subCategory' | 'isFixed'>) => void
  deleteExpense: (id: string) => void

  addRecurring: (r: Omit<RecurringExpense, 'id'>) => void
  updateRecurring: (id: string, patch: Partial<RecurringExpense>) => void
  deleteRecurring: (id: string) => void

  updateSettings: (patch: Partial<AppSettings>) => void
  /** Remember a merchant → category mapping taught during bank-import review,
   *  upserting by (keyword, type) so the latest classification wins. */
  addImportRule: (rule: ImportRule) => void
  recategorizeExpenses: (fromCategoryId: string, toCategoryId: string) => void
  loadDemoData: () => void
  importData: (expenses: Expense[], recurring: RecurringExpense[], budgets: MonthlyBudget[], merge?: boolean) => void
  clearData: () => void

  budgets: MonthlyBudget[]
  setBudgetItem: (year: number, month: number, person: HouseholdMember, categoryId: string, amount: number) => void
  setBudgetItems: (year: number, month: number, person: HouseholdMember, items: BudgetItem[]) => void
  copyBudget: (fromYear: number, fromMonth: number, fromPerson: HouseholdMember, toYear: number, toMonth: number, toPerson: HouseholdMember) => void
  setIncome: (year: number, month: number, person: HouseholdMember, amount: number) => void

  // Drive session — persisted so auto-backup survives app relaunches
  // (Google access tokens last ~1h; expiry is checked before each use)
  driveToken: string | null
  driveTokenExpiresAt: number | null
  // Persisted "connection intent": true once the user connects Drive, false
  // only on an explicit disconnect. Survives token expiry (which merely clears
  // driveToken) so the connection can be silently re-granted on the next launch.
  driveConnected: boolean
  setDriveToken: (token: string | null, expiresInSeconds?: number) => void
  disconnectDrive: () => void
  lastAutoBackup: AutoBackupStatus | null
  setLastAutoBackup: (b: AutoBackupStatus | null) => void

  // Trash — deleted items kept 30 days on this device before final purge
  trashedExpenses: TrashedExpense[]
  trashedRecurring: TrashedRecurring[]
  restoreExpense: (id: string) => void
  restoreRecurring: (id: string) => void
  deleteTrashedExpense: (id: string) => void
  deleteTrashedRecurring: (id: string) => void
  emptyTrash: () => void
  purgeExpiredTrash: () => void

  // Household sync (shared Drive file between the two phones)
  tombstones: Tombstones
  lastSync: AutoBackupStatus | null
  setLastSync: (s: AutoBackupStatus | null) => void
  applySync: (data: {
    expenses: Expense[]
    recurring: RecurringExpense[]
    budgets: MonthlyBudget[]
    tombstones: Tombstones
    customCategories: AppSettings['customCategories']
    deletedBuiltinCategories: string[]
  }) => void

  // Transient (not persisted)
  claudeApiKey: string
  setClaudeApiKey: (key: string) => void
}

/** Returns the stored Drive token only if it has >60s of validity left. */
export function getValidDriveToken(s: Pick<AppState, 'driveToken' | 'driveTokenExpiresAt'>): string | null {
  if (!s.driveToken) return null
  if (s.driveTokenExpiresAt != null && Date.now() > s.driveTokenExpiresAt - 60_000) return null
  return s.driveToken
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      expenses: [],
      recurring: [],
      budgets: [],
      settings: {
        person1Name: 'Moi',
        person2Name: 'Partenaire',
        currentUser: 'person1',
        sharedSplitMode: 'equal',
        baseCurrency: 'CHF',
        banks: ['LCL', 'UBS', 'CIC', 'Revolut', 'CS', 'Cash'],
        theme: 'system',
        googleDriveClientId: '',
        customCategories: [],
        importRules: [],
        claudeApiKey: '',
      },

      addExpense(e) {
        const base = get().settings.baseCurrency
        const amountInBase = e.exchangeRate != null
          ? e.amount * e.exchangeRate
          : convertToBase(e.amount, e.currency, base)
        set(s => ({ expenses: [...s.expenses, { ...e, id: uuid(), amountInBase, updatedAt: Date.now() }] }))
      },

      addBatchExpenses(items) {
        const base = get().settings.baseCurrency
        const now = Date.now()
        const newExpenses = items.map(e => ({
          ...e,
          id: uuid(),
          amountInBase: e.exchangeRate != null
            ? e.amount * e.exchangeRate
            : convertToBase(e.amount, e.currency, base),
          updatedAt: now,
        }))
        set(s => ({ expenses: [...s.expenses, ...newExpenses] }))
      },

      updateExpense(id, patch) {
        set(s => ({
          expenses: s.expenses.map(e => {
            if (e.id !== id) return e
            const merged = { ...e, ...patch, updatedAt: Date.now() }
            const base = s.settings.baseCurrency
            // Use stored historical rate if available; fall back to live cross-rate
            merged.amountInBase = merged.exchangeRate != null
              ? merged.amount * merged.exchangeRate
              : convertToBase(merged.amount, merged.currency, base)
            return merged
          }),
        }))
      },

      setCategoryForExpenses(ids, patch) {
        if (ids.length === 0) return
        const idSet = new Set(ids)
        const now = Date.now()
        set(s => ({
          expenses: s.expenses.map(e =>
            idSet.has(e.id) ? { ...e, ...patch, updatedAt: now } : e
          ),
        }))
      },

      deleteExpense(id) {
        set(s => {
          const item = s.expenses.find(e => e.id === id)
          return {
            expenses: s.expenses.filter(e => e.id !== id),
            trashedExpenses: item
              ? [{ ...item, deletedAt: Date.now() }, ...purgeExpired(s.trashedExpenses)]
              : s.trashedExpenses,
            tombstones: { ...s.tombstones, expenses: { ...s.tombstones.expenses, [id]: Date.now() } },
          }
        })
      },

      addRecurring(r) {
        set(s => ({ recurring: [...s.recurring, { ...r, id: uuid(), updatedAt: Date.now() }] }))
      },

      updateRecurring(id, patch) {
        set(s => ({
          recurring: s.recurring.map(r => r.id === id ? { ...r, ...patch, updatedAt: Date.now() } : r),
        }))
      },

      deleteRecurring(id) {
        set(s => {
          const item = s.recurring.find(r => r.id === id)
          return {
            recurring: s.recurring.filter(r => r.id !== id),
            trashedRecurring: item
              ? [{ ...item, deletedAt: Date.now() }, ...purgeExpired(s.trashedRecurring)]
              : s.trashedRecurring,
            tombstones: { ...s.tombstones, recurring: { ...s.tombstones.recurring, [id]: Date.now() } },
          }
        })
      },

      updateSettings(patch) {
        set(s => ({ settings: { ...s.settings, ...patch } }))
      },

      addImportRule(rule) {
        if (!rule.keyword || rule.keyword.length < 3) return
        set(s => {
          const existing = s.settings.importRules ?? []
          // Upsert by keyword+type — re-classifying the same merchant updates it
          const kept = existing.filter(r => !(r.keyword === rule.keyword && r.type === rule.type))
          return { settings: { ...s.settings, importRules: [...kept, rule] } }
        })
      },

      recategorizeExpenses(fromCategoryId, toCategoryId) {
        const now = Date.now()
        set(s => ({
          expenses: s.expenses.map(e =>
            e.category === fromCategoryId
              ? { ...e, category: toCategoryId, subCategory: 'Non classé', updatedAt: now }
              : e
          ),
        }))
      },

      loadDemoData() {
        const base: CurrencyCode = get().settings.baseCurrency
        const now = Date.now()

        // Jeu de démonstration complet (janv → juil 2026), défini dans
        // src/data/demoData.ts — salaires en revenus/Salaire, remboursements
        // rattachés à la catégorie de la dépense d'origine.
        const expenses: Expense[] = DEMO_EXPENSE_ROWS.map(
          ([date, bank, category, subCategory, type, amount, currency, isFixed, title, person, notes]) => ({
            id: uuid(),
            date, bank, category, subCategory, type, amount,
            currency: currency as CurrencyCode,
            isFixed, title, person, notes,
            amountInBase: convertToBase(amount, currency as CurrencyCode, base),
            updatedAt: now,
          })
        )

        const recurring: RecurringExpense[] = DEMO_RECURRING.map(r => ({
          ...r, id: uuid(), person: 'person1' as HouseholdMember, updatedAt: now,
        }))

        set({ expenses, recurring })
      },

      importData(newExpenses, newRecurring, newBudgets, merge = false) {
        set(s => {
          if (!merge) {
            return { expenses: newExpenses, recurring: newRecurring, budgets: newBudgets }
          }
          // Merge by id/key so re-importing a backup never duplicates entries
          const expById = new Map(s.expenses.map(e => [e.id, e]))
          for (const e of newExpenses) {
            const ex = expById.get(e.id)
            if (!ex || (e.updatedAt ?? 0) >= (ex.updatedAt ?? 0)) expById.set(e.id, e)
          }
          const recById = new Map(s.recurring.map(r => [r.id, r]))
          for (const r of newRecurring) {
            const ex = recById.get(r.id)
            if (!ex || (r.updatedAt ?? 0) >= (ex.updatedAt ?? 0)) recById.set(r.id, r)
          }
          const budByKey = new Map(s.budgets.map(b => [budgetKey(b), b]))
          for (const b of newBudgets) {
            const k = budgetKey(b)
            const ex = budByKey.get(k)
            if (!ex || (b.updatedAt ?? 0) >= (ex.updatedAt ?? 0)) budByKey.set(k, b)
          }
          return {
            expenses: [...expById.values()],
            recurring: [...recById.values()],
            budgets: [...budByKey.values()],
          }
        })
      },

      clearData() {
        set({ expenses: [], recurring: [], trashedExpenses: [], trashedRecurring: [] })
      },

      setBudgetItem(year, month, person, categoryId, amount) {
        set(s => {
          const match = (b: MonthlyBudget) => b.year === year && b.month === month && b.person === person
          const existing = s.budgets.find(match)
          if (existing) {
            const items = existing.items.filter(i => i.categoryId !== categoryId)
            if (amount > 0) items.push({ categoryId, amount })
            return { budgets: s.budgets.map(b => match(b) ? { ...b, items, updatedAt: Date.now() } : b) }
          }
          if (amount <= 0) return {}
          return { budgets: [...s.budgets, { year, month, person, items: [{ categoryId, amount }], updatedAt: Date.now() }] }
        })
      },

      setBudgetItems(year, month, person, items) {
        set(s => {
          const filtered = s.budgets.filter(b => !(b.year === year && b.month === month && b.person === person))
          if (items.length > 0) {
            return { budgets: [...filtered, { year, month, person, items, updatedAt: Date.now() }] }
          }
          // Budget removed — leave a tombstone so the deletion syncs
          const key = budgetKey({ year, month, person })
          return {
            budgets: filtered,
            tombstones: { ...s.tombstones, budgets: { ...s.tombstones.budgets, [key]: Date.now() } },
          }
        })
      },

      copyBudget(fromYear, fromMonth, fromPerson, toYear, toMonth, toPerson) {
        const src = get().budgets.find(b => b.year === fromYear && b.month === fromMonth && b.person === fromPerson)
        if (!src) return
        set(s => {
          const filtered = s.budgets.filter(b => !(b.year === toYear && b.month === toMonth && b.person === toPerson))
          return { budgets: [...filtered, { year: toYear, month: toMonth, person: toPerson, estimatedIncome: src.estimatedIncome, items: [...src.items], updatedAt: Date.now() }] }
        })
      },

      setIncome(year, month, person, amount) {
        set(s => {
          const match = (b: MonthlyBudget) => b.year === year && b.month === month && b.person === person
          const existing = s.budgets.find(match)
          if (existing) {
            return { budgets: s.budgets.map(b => match(b) ? { ...b, estimatedIncome: amount, updatedAt: Date.now() } : b) }
          }
          return { budgets: [...s.budgets, { year, month, person, estimatedIncome: amount, items: [], updatedAt: Date.now() }] }
        })
      },

      driveToken: null,
      driveTokenExpiresAt: null,
      driveConnected: false,
      setDriveToken: (token, expiresInSeconds) => set({
        driveToken: token,
        driveTokenExpiresAt: token && expiresInSeconds ? Date.now() + expiresInSeconds * 1000 : null,
        // Obtaining a token (interactive connect OR silent re-grant) marks the
        // connection live. Clearing a token (expiry / 401) leaves the intent
        // untouched, so it can be silently re-granted on the next launch.
        ...(token ? { driveConnected: true } : null),
      }),
      disconnectDrive: () => set({ driveToken: null, driveTokenExpiresAt: null, driveConnected: false }),
      lastAutoBackup: null,
      setLastAutoBackup: (b) => set({ lastAutoBackup: b }),

      trashedExpenses: [],
      trashedRecurring: [],

      restoreExpense(id) {
        set(s => {
          const t = s.trashedExpenses.find(e => e.id === id)
          if (!t) return {}
          const { deletedAt: _d, ...item } = t
          // Stamp the restore so the household sync resurrects the item
          // (an edit newer than the deletion tombstone wins the merge)
          const expTombs = { ...s.tombstones.expenses }
          delete expTombs[id]
          return {
            trashedExpenses: s.trashedExpenses.filter(e => e.id !== id),
            expenses: [...s.expenses, { ...item, updatedAt: Date.now() }],
            tombstones: { ...s.tombstones, expenses: expTombs },
          }
        })
      },

      restoreRecurring(id) {
        set(s => {
          const t = s.trashedRecurring.find(r => r.id === id)
          if (!t) return {}
          const { deletedAt: _d, ...item } = t
          const recTombs = { ...s.tombstones.recurring }
          delete recTombs[id]
          return {
            trashedRecurring: s.trashedRecurring.filter(r => r.id !== id),
            recurring: [...s.recurring, { ...item, updatedAt: Date.now() }],
            tombstones: { ...s.tombstones, recurring: recTombs },
          }
        })
      },

      deleteTrashedExpense(id) {
        set(s => ({ trashedExpenses: s.trashedExpenses.filter(e => e.id !== id) }))
      },

      deleteTrashedRecurring(id) {
        set(s => ({ trashedRecurring: s.trashedRecurring.filter(r => r.id !== id) }))
      },

      emptyTrash() {
        set({ trashedExpenses: [], trashedRecurring: [] })
      },

      purgeExpiredTrash() {
        set(s => ({
          trashedExpenses: purgeExpired(s.trashedExpenses),
          trashedRecurring: purgeExpired(s.trashedRecurring),
        }))
      },

      tombstones: emptyTombstones(),
      lastSync: null,
      setLastSync: (st) => set({ lastSync: st }),
      applySync(data) {
        set(s => ({
          expenses: data.expenses,
          recurring: data.recurring,
          budgets: data.budgets,
          tombstones: data.tombstones,
          settings: {
            ...s.settings,
            customCategories: data.customCategories,
            deletedBuiltinCategories: data.deletedBuiltinCategories,
          },
        }))
      },

      claudeApiKey: '',
      setClaudeApiKey: (key) => set({ claudeApiKey: key }),
    }),
    {
      name: 'budget-app-store',
      version: 8,
      partialize: (state) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { claudeApiKey: _dep, ...cleanSettings } = state.settings as AppSettings & { claudeApiKey?: string }
        return {
          expenses: state.expenses,
          recurring: state.recurring,
          budgets: state.budgets,
          settings: cleanSettings,
          driveToken: state.driveToken,
          driveTokenExpiresAt: state.driveTokenExpiresAt,
          driveConnected: state.driveConnected,
          lastAutoBackup: state.lastAutoBackup,
          tombstones: state.tombstones,
          lastSync: state.lastSync,
          trashedExpenses: state.trashedExpenses,
          trashedRecurring: state.trashedRecurring,
        }
      },
      migrate(persistedState, version) {
        const s = persistedState as any
        let state = { ...s }
        if (version < 3) {
          state = {
            ...state,
            budgets: (state.budgets ?? []).map((b: any) =>
              b.person ? b : { ...b, person: 'person1' as HouseholdMember }
            ),
          }
        }
        if (version < 4) {
          state = {
            ...state,
            settings: {
              ...state.settings,
              customCategories: state.settings?.customCategories ?? [],
            },
          }
        }
        if (version < 5) {
          state = {
            ...state,
            settings: {
              ...state.settings,
              claudeApiKey: state.settings?.claudeApiKey ?? '',
            },
          }
        }
        if (version < 6) {
          state = {
            ...state,
            settings: {
              ...state.settings,
              currentUser: state.settings?.currentUser ?? 'person1',
              sharedSplitMode: state.settings?.sharedSplitMode ?? 'equal',
            },
          }
        }
        if (version < 7) {
          // v6 (app 1.11.0) briefly removed the 'banque' category and folded
          // its entries into 'autre' — restore them for devices that ran it.
          const wasBanque = (x: any) =>
            x.category === 'autre' && ['Frais Carte', 'Frais bancaires', 'Prêt'].includes(x.subCategory)
          const fixSub = (s: string) => s === 'Frais bancaires' ? 'Frais Carte' : s
          state = {
            ...state,
            expenses: (state.expenses ?? []).map((e: any) =>
              wasBanque(e) ? { ...e, category: 'banque', subCategory: fixSub(e.subCategory) } : e
            ),
            recurring: (state.recurring ?? []).map((r: any) =>
              wasBanque(r) ? { ...r, category: 'banque', subCategory: fixSub(r.subCategory) } : r
            ),
          }
        }
        if (version < 8) {
          // New explicit connection-intent flag: infer it from a previously
          // persisted token so already-connected devices stay connected.
          state = { ...state, driveConnected: !!state.driveToken }
        }
        return state
      },
    }
  )
)

// ── Local auto-backup ─────────────────────────────────────────────────────────
// One debounced subscription covers EVERY data change (expenses, recurring,
// budgets, settings) instead of per-action calls, so nothing is ever missed.
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null
useStore.subscribe((state, prev) => {
  if (
    state.expenses === prev.expenses &&
    state.recurring === prev.recurring &&
    state.budgets === prev.budgets &&
    state.settings === prev.settings
  ) return
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
  autoSaveTimer = setTimeout(() => {
    const s = useStore.getState()
    autoSave(s.expenses, s.recurring, s.settings, s.budgets)
  }, 2_000)
})

// Selectors
export const selectExpensesByYearMonth = (
  expenses: Expense[], year: number, month: number | null
) =>
  expenses.filter(e => {
    const ey = parseInt(e.date.slice(0, 4))
    const em = parseInt(e.date.slice(5, 7))
    return ey === year && (month === null || em === month)
  })
