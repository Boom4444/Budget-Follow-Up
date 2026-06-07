import type { CurrencyCode } from '../models/types'

export interface CurrencyMeta {
  code: CurrencyCode
  name: string
  symbol: string
  flag: string
}

export const CURRENCIES: CurrencyMeta[] = [
  { code: 'EUR', name: 'Euro',               symbol: '€',   flag: '🇪🇺' },
  { code: 'USD', name: 'Dollar américain',   symbol: '$',   flag: '🇺🇸' },
  { code: 'GBP', name: 'Livre sterling',     symbol: '£',   flag: '🇬🇧' },
  { code: 'CHF', name: 'Franc suisse',       symbol: 'Fr',  flag: '🇨🇭' },
  { code: 'MAD', name: 'Dirham marocain',    symbol: 'MAD', flag: '🇲🇦' },
  { code: 'DZD', name: 'Dinar algérien',     symbol: 'DZD', flag: '🇩🇿' },
  { code: 'TND', name: 'Dinar tunisien',     symbol: 'DT',  flag: '🇹🇳' },
  { code: 'JPY', name: 'Yen japonais',       symbol: '¥',   flag: '🇯🇵' },
  { code: 'CAD', name: 'Dollar canadien',    symbol: 'CA$', flag: '🇨🇦' },
  { code: 'AUD', name: 'Dollar australien',  symbol: 'A$',  flag: '🇦🇺' },
  { code: 'SGD', name: 'Dollar Singapour',   symbol: 'S$',  flag: '🇸🇬' },
  { code: 'AED', name: 'Dirham EAU',         symbol: 'AED', flag: '🇦🇪' },
]

export const CURRENCY_MAP = Object.fromEntries(
  CURRENCIES.map(c => [c.code, c])
) as Record<CurrencyCode, CurrencyMeta>

// Fallback rates: 1 EUR = X (used when live rates unavailable for that currency)
const FALLBACK_RATES: Record<CurrencyCode, number> = {
  EUR: 1, USD: 1.08, GBP: 0.86, CHF: 0.96,
  MAD: 10.85, DZD: 145.2, TND: 3.35,
  JPY: 162.5, CAD: 1.47, AUD: 1.65, SGD: 1.45, AED: 3.97,
}

export const EUR_RATES = FALLBACK_RATES

// Live rates: 1 EUR = X, refreshed monthly via Frankfurter API
let liveRates: Record<CurrencyCode, number> = { ...FALLBACK_RATES }

const CACHE_KEY = 'budget-live-rates'
// Currencies supported by Frankfurter (excludes MAD, DZD, TND, AED — kept from fallback)
const FRANKFURTER_SUPPORTED: CurrencyCode[] = ['USD', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD', 'SGD']

export function getLiveRates(): Record<CurrencyCode, number> {
  return { ...liveRates }
}

export async function refreshExchangeRates(): Promise<void> {
  const today = new Date()
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`

  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null')
    if (cached?.month === currentMonth && cached.rates) {
      liveRates = { ...FALLBACK_RATES, ...cached.rates }
      return
    }
  } catch { /* ignore stale cache */ }

  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=EUR')
    if (!res.ok) return
    const data: { rates: Record<string, number> } = await res.json()

    const rates: Partial<Record<CurrencyCode, number>> = {}
    for (const code of FRANKFURTER_SUPPORTED) {
      if (data.rates[code] != null) rates[code] = data.rates[code]
    }

    liveRates = { ...FALLBACK_RATES, ...rates }
    localStorage.setItem(CACHE_KEY, JSON.stringify({ month: currentMonth, rates }))
  } catch { /* keep fallback rates on network failure */ }
}

export function convertToBase(amount: number, from: CurrencyCode, base: CurrencyCode): number {
  if (from === base) return amount
  const fromRate = liveRates[from]
  const baseRate = liveRates[base]
  return (amount / fromRate) * baseRate
}

// ── Historical rate cache (EUR-based, per weekday) ───────────────────────────
// { 'YYYY-MM-DD': { 'CHF': 0.96, 'EUR': 1, 'USD': 1.08, ... } }
const HIST_CACHE_KEY = 'budget-hist-rates'
let histRateCache: Record<string, Record<string, number>> = {}

try {
  histRateCache = JSON.parse(localStorage.getItem(HIST_CACHE_KEY) ?? '{}')
} catch { /* ignore */ }

function persistHistCache(): void {
  try { localStorage.setItem(HIST_CACHE_KEY, JSON.stringify(histRateCache)) } catch { /* storage full */ }
}

// Fetch EUR-based rates for an entire date range in one API call and cache them.
// fromDate / toDate: 'YYYY-MM-DD'
export async function prefetchHistoricalRates(fromDate: string, toDate: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10)
  const to = toDate > today ? today : toDate
  if (fromDate > to) return
  try {
    const res = await fetch(`https://api.frankfurter.app/${fromDate}..${to}?from=EUR`)
    if (!res.ok) return
    const data: { rates: Record<string, Record<string, number>> } = await res.json()
    for (const [date, rates] of Object.entries(data.rates)) {
      histRateCache[date] = { EUR: 1, ...rates }
    }
    persistHistCache()
  } catch { /* keep fallback */ }
}

// Fetch and cache the rate for a single date.
export async function prefetchRateForDate(date: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10)
  if (date > today) return
  try {
    const res = await fetch(`https://api.frankfurter.app/${date}?from=EUR`)
    if (!res.ok) return
    const data: { date: string; rates: Record<string, number> } = await res.json()
    // Frankfurter returns the nearest weekday date (e.g., Friday for a Saturday)
    const effectiveDate = data.date ?? date
    const entry = { EUR: 1, ...data.rates }
    histRateCache[effectiveDate] = entry
    if (effectiveDate !== date) histRateCache[date] = entry  // alias original date
    persistHistCache()
  } catch { /* keep fallback */ }
}

// Find the nearest cached rates for a date (walks back up to 7 days for weekends/holidays).
function nearestCachedRates(date: string): Record<string, number> | null {
  for (let i = 0; i < 7; i++) {
    const d = new Date(date)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    if (histRateCache[key]) return histRateCache[key]
  }
  return null
}

// Returns: 1 unit of `from` = X units of `base`, at the given historical date.
// Falls back to current live rates if no historical data is cached for that date.
export function getHistoricalConversionRate(date: string, from: CurrencyCode, base: CurrencyCode): number {
  if (from === base) return 1
  const rates = nearestCachedRates(date)
  if (rates) {
    const fromRate = rates[from] ?? liveRates[from]
    const baseRate = rates[base] ?? liveRates[base]
    return baseRate / fromRate
  }
  // Fallback: current live cross-rate
  return liveRates[base] / liveRates[from]
}
