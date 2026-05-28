import type { CurrencyCode } from '../models/types'
import { CURRENCY_MAP } from '../data/currencies'

export function formatAmount(amount: number, currency: CurrencyCode): string {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount) + ' ' + CURRENCY_MAP[currency].symbol
}

export function formatAmountCompact(amount: number, currency: CurrencyCode): string {
  if (amount >= 1000) {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(amount / 1000) + 'k ' + CURRENCY_MAP[currency].symbol
  }
  return formatAmount(amount, currency)
}

export function formatPercent(value: number, total: number): string {
  if (total === 0) return '0 %'
  return new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 1,
  }).format((value / total) * 100) + ' %'
}
