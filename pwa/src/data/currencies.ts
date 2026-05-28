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

// 1 EUR = X foreign currency (approximate)
export const EUR_RATES: Record<CurrencyCode, number> = {
  EUR: 1, USD: 1.08, GBP: 0.86, CHF: 0.96,
  MAD: 10.85, DZD: 145.2, TND: 3.35,
  JPY: 162.5, CAD: 1.47, AUD: 1.65, SGD: 1.45, AED: 3.97,
}

export function convertToBase(amount: number, from: CurrencyCode, base: CurrencyCode): number {
  if (from === base) return amount
  const fromRate = EUR_RATES[from]
  const baseRate = EUR_RATES[base]
  return (amount / fromRate) * baseRate
}
