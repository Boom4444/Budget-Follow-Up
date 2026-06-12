export const TRASH_RETENTION_DAYS = 30
export const TRASH_RETENTION_MS = TRASH_RETENTION_DAYS * 24 * 3600_000

/** Drop trashed items whose 30-day retention has elapsed. */
export function purgeExpired<T extends { deletedAt: number }>(items: T[], now = Date.now()): T[] {
  return items.filter(t => now - t.deletedAt < TRASH_RETENTION_MS)
}

/** Whole days left before automatic permanent deletion (0 = today). */
export function daysLeft(deletedAt: number, now = Date.now()): number {
  return Math.max(0, Math.ceil((deletedAt + TRASH_RETENTION_MS - now) / (24 * 3600_000)))
}
