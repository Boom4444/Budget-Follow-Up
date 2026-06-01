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
