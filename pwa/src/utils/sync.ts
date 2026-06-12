import type { Expense, RecurringExpense, MonthlyBudget, CustomCategoryDef } from '../models/types'

/**
 * Household sync — pure merge engine.
 *
 * Both phones connect to the same Google account and share one Drive file.
 * Each device does pull → merge → apply locally → push. The merge is
 * deterministic and commutative so devices converge regardless of order:
 *  - items are identified by id (expenses, recurring) or year-month-person
 *    key (budgets); the copy with the newest `updatedAt` wins
 *  - deletions are propagated through tombstones (id → deletedAt); an item
 *    edited AFTER its deletion timestamp survives (no surprise resurrection
 *    of fresh edits, no resurrection of deleted items either)
 *  - settings are NOT synced (device-specific), except custom categories
 *    which are unioned so shared expenses always display correctly
 */

export interface Tombstones {
  expenses: Record<string, number>
  recurring: Record<string, number>
  budgets: Record<string, number>
}

export interface SyncData {
  syncVersion: number
  updatedAt: string
  expenses: Expense[]
  recurring: RecurringExpense[]
  budgets: MonthlyBudget[]
  tombstones: Tombstones
  customCategories: CustomCategoryDef[]
  deletedBuiltinCategories: string[]
}

export const SYNC_FILE_NAME = 'budget-foyer-sync.json'

/** Tombstones older than this are pruned at merge time (the deletion has
 *  long been propagated; keeping them forever would grow the file). */
const TOMBSTONE_TTL_MS = 180 * 24 * 3600_000

export function emptyTombstones(): Tombstones {
  return { expenses: {}, recurring: {}, budgets: {} }
}

export function budgetKey(b: Pick<MonthlyBudget, 'year' | 'month' | 'person'>): string {
  return `${b.year}-${b.month}-${b.person}`
}

// ── Generic last-write-wins merge with tombstones ─────────────────────────────

function mergeCollection<T extends { updatedAt?: number }>(
  local: T[],
  remote: T[],
  keyOf: (item: T) => string,
  localTombs: Record<string, number>,
  remoteTombs: Record<string, number>,
): { items: T[]; tombstones: Record<string, number> } {
  // Union of tombstones, newest deletion timestamp wins
  const tombstones: Record<string, number> = {}
  for (const [k, ts] of [...Object.entries(localTombs ?? {}), ...Object.entries(remoteTombs ?? {})]) {
    if (typeof ts === 'number' && ts > (tombstones[k] ?? 0)) tombstones[k] = ts
  }

  // Union of items: newest updatedAt wins; deterministic tie-break on the
  // serialized content so both devices converge instead of ping-ponging
  const byKey = new Map<string, T>()
  for (const item of [...local, ...remote]) {
    const k = keyOf(item)
    const existing = byKey.get(k)
    if (!existing) { byKey.set(k, item); continue }
    const a = existing.updatedAt ?? 0
    const b = item.updatedAt ?? 0
    if (b > a) byKey.set(k, item)
    else if (b === a && JSON.stringify(item) > JSON.stringify(existing)) byKey.set(k, item)
  }

  // Apply deletions: a tombstone removes the item unless the item was
  // edited strictly after the deletion (then the edit wins and the
  // tombstone is dropped)
  const items: T[] = []
  for (const [k, item] of byKey) {
    const deletedAt = tombstones[k]
    if (deletedAt != null) {
      if ((item.updatedAt ?? 0) > deletedAt) delete tombstones[k]
      else continue
    }
    items.push(item)
  }

  // Prune ancient tombstones
  const cutoff = Date.now() - TOMBSTONE_TTL_MS
  for (const [k, ts] of Object.entries(tombstones)) {
    if (ts < cutoff) delete tombstones[k]
  }

  return { items, tombstones }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function mergeSyncData(local: SyncData, remote: SyncData): SyncData {
  const lt = local.tombstones ?? emptyTombstones()
  const rt = remote.tombstones ?? emptyTombstones()

  const expenses  = mergeCollection(local.expenses ?? [], remote.expenses ?? [], e => e.id, lt.expenses, rt.expenses)
  const recurring = mergeCollection(local.recurring ?? [], remote.recurring ?? [], r => r.id, lt.recurring, rt.recurring)
  const budgets   = mergeCollection(local.budgets ?? [], remote.budgets ?? [], budgetKey, lt.budgets, rt.budgets)

  // Custom categories: union by id (no timestamps — local wins on conflict,
  // ties broken deterministically via content like items above)
  const catById = new Map<string, CustomCategoryDef>()
  for (const c of [...(remote.customCategories ?? []), ...(local.customCategories ?? [])]) {
    const existing = catById.get(c.id)
    if (!existing || JSON.stringify(c) > JSON.stringify(existing)) catById.set(c.id, c)
  }
  const deletedBuiltins = [...new Set([
    ...(local.deletedBuiltinCategories ?? []),
    ...(remote.deletedBuiltinCategories ?? []),
  ])].sort()

  return {
    syncVersion: 1,
    updatedAt: new Date().toISOString(),
    expenses: expenses.items,
    recurring: recurring.items,
    budgets: budgets.items,
    tombstones: {
      expenses: expenses.tombstones,
      recurring: recurring.tombstones,
      budgets: budgets.tombstones,
    },
    customCategories: [...catById.values()],
    deletedBuiltinCategories: deletedBuiltins,
  }
}

/** Canonical serialization of the synced content (ignores updatedAt header
 *  and ordering) — used to detect whether anything actually changed. */
export function canonicalize(d: SyncData): string {
  const sortRec = (r: Record<string, number>) =>
    Object.fromEntries(Object.entries(r ?? {}).sort(([a], [b]) => a.localeCompare(b)))
  return JSON.stringify({
    expenses: [...(d.expenses ?? [])].sort((a, b) => a.id.localeCompare(b.id)),
    recurring: [...(d.recurring ?? [])].sort((a, b) => a.id.localeCompare(b.id)),
    budgets: [...(d.budgets ?? [])].sort((a, b) => budgetKey(a).localeCompare(budgetKey(b))),
    tombstones: {
      expenses: sortRec(d.tombstones?.expenses),
      recurring: sortRec(d.tombstones?.recurring),
      budgets: sortRec(d.tombstones?.budgets),
    },
    customCategories: [...(d.customCategories ?? [])].sort((a, b) => a.id.localeCompare(b.id)),
    deletedBuiltinCategories: [...(d.deletedBuiltinCategories ?? [])].sort(),
  })
}

/** Parse and validate a sync file. Returns null when the content is not a
 *  plausible sync payload (corrupt file ⇒ caller overwrites with local). */
export function parseSyncData(text: string): SyncData | null {
  try {
    const obj = JSON.parse(text)
    if (!obj || typeof obj !== 'object') return null
    if (!Array.isArray(obj.expenses)) return null
    return {
      syncVersion: typeof obj.syncVersion === 'number' ? obj.syncVersion : 1,
      updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : '',
      expenses: obj.expenses.filter((e: any) => e && typeof e === 'object' && typeof e.id === 'string'),
      recurring: Array.isArray(obj.recurring) ? obj.recurring.filter((r: any) => r && typeof r.id === 'string') : [],
      budgets: Array.isArray(obj.budgets) ? obj.budgets.filter((b: any) => b && typeof b === 'object' && b.year != null) : [],
      tombstones: {
        expenses: typeof obj.tombstones?.expenses === 'object' && obj.tombstones.expenses ? obj.tombstones.expenses : {},
        recurring: typeof obj.tombstones?.recurring === 'object' && obj.tombstones.recurring ? obj.tombstones.recurring : {},
        budgets: typeof obj.tombstones?.budgets === 'object' && obj.tombstones.budgets ? obj.tombstones.budgets : {},
      },
      customCategories: Array.isArray(obj.customCategories) ? obj.customCategories : [],
      deletedBuiltinCategories: Array.isArray(obj.deletedBuiltinCategories) ? obj.deletedBuiltinCategories : [],
    }
  } catch {
    return null
  }
}
