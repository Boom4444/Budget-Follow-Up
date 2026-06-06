import { v4 as uuid } from 'uuid'
import * as XLSX from 'xlsx'
import { convertToBase } from '../data/currencies'
import { CATEGORY_MAP } from '../data/categories'
import type { Expense, RecurringExpense, AppSettings, CategoryId, CurrencyCode, HouseholdMember, MonthlyBudget } from '../models/types'

export const BACKUP_VERSION = 3

export interface BackupData {
  version: number
  exportedAt: string
  settings: AppSettings
  expenses: Expense[]
  recurring: RecurringExpense[]
  budgets?: MonthlyBudget[]
}

// ── CSV column mapping ────────────────────────────────────────────────────────

// Maps French spreadsheet category names → CategoryId
const CSV_CAT_MAP: Record<string, CategoryId> = {
  'banque':                   'banque',
  'impôts & administratif':   'impots',
  'impôts':                   'impots',
  'impots':                   'impots',
  'cadeaux':                  'cadeaux',
  'abonnements':              'abonnements',
  'abonnement':               'abonnements',
  'logement':                 'logement',
  'transport':                'transport',
  'loisirs':                  'loisirs',
  'besoins personnels':       'besoinsPersonnels',
  'nourriture':               'nourriture',
  'alimentation':             'nourriture',
  'entreprise':               'entreprise',
  'assurance':                'assurance',
  'santé':                    'sante',
  'sante':                    'sante',
  'habillement':              'habillement',
  'maison':                   'maison',
  'beauté':                   'beaute',
  'beaute':                   'beaute',
  'sport':                    'sport',
  'autre':                    'autre',
  'autres':                   'autre',
}

const CSV_HEADER =
  'Date\tCompte\tCatégorie\tSous Catégorie\tDébit (CHF)\tCrédit (CHF)\tDebit (€)\tCrédit (€)\tBoutique\tCommentaire'

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseFrenchDate(raw: string, defaultYear: number): string {
  raw = raw.trim()
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  // DD/MM/YYYY or DD/MM/YY
  const full = raw.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/)
  if (full) {
    const d = full[1].padStart(2, '0')
    const m = full[2].padStart(2, '0')
    let y = full[3] ? parseInt(full[3]) : defaultYear
    if (y < 100) y += 2000
    return `${y}-${m}-${d}`
  }
  return `${defaultYear}-01-01`
}

function num(s: string): number {
  return parseFloat(s.replace(',', '.').replace(/\s/g, '')) || 0
}

function resolveCategory(raw: string): CategoryId {
  const key = raw.trim().toLowerCase()
  return CSV_CAT_MAP[key] ?? 'nourriture'
}

function resolveSubCategory(catId: CategoryId, raw: string): string {
  const cat = CATEGORY_MAP[catId]
  const trimmed = raw.trim()
  if (!trimmed) return cat?.subCategories[0] ?? ''
  return cat?.subCategories.includes(trimmed) ? trimmed : trimmed
}

// ── Export ────────────────────────────────────────────────────────────────────

export function exportJSON(
  expenses: Expense[],
  recurring: RecurringExpense[],
  settings: AppSettings,
  budgets: MonthlyBudget[] = [],
): void {
  const data: BackupData = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    settings,
    expenses,
    recurring,
    budgets,
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  downloadBlob(blob, `budget-backup-${isoDate()}.json`)
}

export function exportCSV(expenses: Expense[]): void {
  const rows = expenses
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(e => {
      const [y, m, d] = e.date.split('-')
      const dateFr = `${d}/${m}/${y}`
      const debitCHF  = (e.type === 'debit'  && e.currency === 'CHF') ? e.amount : ''
      const creditCHF = (e.type === 'credit' && e.currency === 'CHF') ? e.amount : ''
      const debitEUR  = (e.type === 'debit'  && e.currency === 'EUR') ? e.amount : ''
      const creditEUR = (e.type === 'credit' && e.currency === 'EUR') ? e.amount : ''
      const catLabel  = CATEGORY_MAP[e.category]?.label ?? e.category
      return [dateFr, e.bank, catLabel, e.subCategory,
              debitCHF, creditCHF, debitEUR, creditEUR,
              e.title, e.notes].join('\t')
    })
  const csv = [CSV_HEADER, ...rows].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/tab-separated-values;charset=utf-8' })
  downloadBlob(blob, `budget-export-${isoDate()}.tsv`)
}

export function exportXLSX(expenses: Expense[]): void {
  const rows = expenses
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(e => ({
      Date: e.date,
      Boutique: e.title,
      Banque: e.bank,
      Catégorie: CATEGORY_MAP[e.category as CategoryId]?.label ?? e.category,
      'Sous-catégorie': e.subCategory,
      Type: e.type === 'debit' ? 'Débit' : 'Crédit',
      Montant: e.type === 'debit' ? -e.amount : e.amount,
      Devise: e.currency,
      Personne: e.person,
      Notes: e.notes,
    }))
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Dépenses')
  XLSX.writeFile(wb, `budget-export-${isoDate()}.xlsx`)
}

export function exportPDF(expenses: Expense[], baseCurrency: string): void {
  const sorted = expenses.slice().sort((a, b) => b.date.localeCompare(a.date))
  const rows = sorted.map(e => {
    const sign = e.type === 'credit' ? '+' : '-'
    const catLabel = CATEGORY_MAP[e.category as CategoryId]?.label ?? e.category
    return `<tr>
      <td>${e.date}</td>
      <td>${e.title}</td>
      <td>${catLabel}</td>
      <td>${e.subCategory}</td>
      <td style="text-align:right;color:${e.type === 'credit' ? 'green' : 'inherit'}">${sign}${e.amount.toFixed(2)} ${e.currency}</td>
      <td>${e.bank}</td>
    </tr>`
  }).join('')
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Budget Export ${isoDate()}</title>
    <style>
      body{font-family:system-ui,sans-serif;font-size:12px;color:#111}
      h1{font-size:16px;margin-bottom:4px}
      p{color:#666;margin-bottom:16px}
      table{width:100%;border-collapse:collapse}
      th{background:#f3f4f6;font-weight:600;text-align:left;padding:6px 8px;border-bottom:2px solid #e5e7eb}
      td{padding:5px 8px;border-bottom:1px solid #f3f4f6}
      tr:last-child td{border-bottom:none}
    </style>
  </head><body>
    <h1>Budget — Export ${isoDate()}</h1>
    <p>${expenses.length} transactions · devise base : ${baseCurrency}</p>
    <table>
      <thead><tr><th>Date</th><th>Boutique</th><th>Catégorie</th><th>Sous-cat.</th><th>Montant</th><th>Banque</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </body></html>`
  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(html)
  w.document.close()
  w.focus()
  w.print()
}

// ── Import ────────────────────────────────────────────────────────────────────

export function parseJSONBackup(text: string): BackupData | null {
  try {
    const obj = JSON.parse(text)
    if (!obj.expenses || !Array.isArray(obj.expenses)) return null
    return obj as BackupData
  } catch {
    return null
  }
}

export function parseCSV(
  text: string,
  baseCurrency: CurrencyCode,
  defaultYear = new Date().getFullYear(),
): Expense[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  const start = lines[0].toLowerCase().includes('date') ? 1 : 0
  const expenses: Expense[] = []

  for (const line of lines.slice(start)) {
    const cols = line.split('\t')
    if (cols.length < 5) continue

    const [rawDate, compte, rawCat, rawSub, debitCHF, creditCHF, debitEUR, creditEUR, boutique, commentaire] = cols

    const dCHF = num(debitCHF  ?? '')
    const cCHF = num(creditCHF ?? '')
    const dEUR = num(debitEUR  ?? '')
    const cEUR = num(creditEUR ?? '')

    let amount = 0
    let currency: CurrencyCode = 'CHF'
    let type: 'debit' | 'credit' = 'debit'

    if (dCHF > 0)      { amount = dCHF; currency = 'CHF'; type = 'debit' }
    else if (cCHF > 0) { amount = cCHF; currency = 'CHF'; type = 'credit' }
    else if (dEUR > 0) { amount = dEUR; currency = 'EUR'; type = 'debit' }
    else if (cEUR > 0) { amount = cEUR; currency = 'EUR'; type = 'credit' }
    else continue

    const category = resolveCategory(rawCat ?? '')
    const subCategory = resolveSubCategory(category, rawSub ?? '')
    const cat = CATEGORY_MAP[category]

    expenses.push({
      id: uuid(),
      date: parseFrenchDate(rawDate ?? '', defaultYear),
      bank: (compte ?? '').trim(),
      category,
      subCategory,
      type,
      amount,
      currency,
      amountInBase: convertToBase(amount, currency, baseCurrency),
      isFixed: cat?.isFixed ?? false,
      title: (boutique ?? '').trim() || rawSub?.trim() || rawCat?.trim(),
      person: 'person1' as HouseholdMember,
      notes: (commentaire ?? '').trim(),
    })
  }
  return expenses
}

// ── Auto-backup (localStorage) ────────────────────────────────────────────────

const AUTO_BACKUP_KEY = 'budget-auto-backup'
const AUTO_BACKUP_MAX_SLOTS = 5

export interface AutoBackupSlot {
  savedAt: string
  data: BackupData
}

export function autoSave(
  expenses: Expense[],
  recurring: RecurringExpense[],
  settings: AppSettings,
): void {
  try {
    const existing: AutoBackupSlot[] = getAutoBackupSlots()
    const slot: AutoBackupSlot = {
      savedAt: new Date().toISOString(),
      data: { version: BACKUP_VERSION, exportedAt: new Date().toISOString(), settings, expenses, recurring },
    }
    const updated = [slot, ...existing].slice(0, AUTO_BACKUP_MAX_SLOTS)
    localStorage.setItem(AUTO_BACKUP_KEY, JSON.stringify(updated))
  } catch {
    // storage full or unavailable — ignore silently
  }
}

export function getAutoBackupSlots(): AutoBackupSlot[] {
  try {
    const raw = localStorage.getItem(AUTO_BACKUP_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function downloadAutoBackup(slot: AutoBackupSlot): void {
  const blob = new Blob([JSON.stringify(slot.data, null, 2)], { type: 'application/json' })
  const ts = slot.savedAt.slice(0, 16).replace('T', '_').replace(':', 'h')
  downloadBlob(blob, `budget-backup-${ts}.json`)
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function isoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'à l\'instant'
  if (mins < 60) return `il y a ${mins} min`
  const h = Math.floor(mins / 60)
  if (h < 24)    return `il y a ${h}h`
  const d = Math.floor(h / 24)
  return `il y a ${d}j`
}
