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
  return CSV_CAT_MAP[key] ?? 'a_classer'
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
  // Never write the (deprecated) API key field into exported files
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { claudeApiKey: _k, ...cleanSettings } = settings
  const data: BackupData = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    settings: cleanSettings,
    expenses,
    recurring,
    budgets,
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  downloadBlob(blob, `budget-backup-${isoDate()}.json`)
}

export function exportCSV(expenses: Expense[], budgets: MonthlyBudget[] = []): void {
  const expenseRows = expenses
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

  const MONTHS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']
  const budgetHeader = ['Année', 'Mois', 'Personne', 'Catégorie', 'Montant budgété', 'Revenu prévu'].join('\t')
  const budgetRows = budgets
    .slice()
    .sort((a, b) => a.year !== b.year ? a.year - b.year : a.month !== b.month ? a.month - b.month : a.person.localeCompare(b.person))
    .flatMap(b => {
      const monthLabel = `${MONTHS[b.month - 1]} ${b.year}`
      const personLabel = b.person === 'person1' ? 'Personne 1' : b.person === 'person2' ? 'Personne 2' : 'Commun'
      const itemRows = b.items.map(it => [
        b.year, monthLabel, personLabel,
        CATEGORY_MAP[it.categoryId]?.label ?? it.categoryId,
        it.amount, '',
      ].join('\t'))
      if (b.estimatedIncome != null) {
        itemRows.push([b.year, monthLabel, personLabel, 'REVENU', '', b.estimatedIncome].join('\t'))
      }
      return itemRows
    })

  const lines = [
    '=== DÉPENSES ===',
    CSV_HEADER,
    ...expenseRows,
    '',
    '=== BUDGETS MENSUELS ===',
    budgetHeader,
    ...budgetRows,
  ]
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/tab-separated-values;charset=utf-8' })
  downloadBlob(blob, `budget-export-${isoDate()}.tsv`)
}

export function exportXLSX(expenses: Expense[], budgets: MonthlyBudget[] = []): void {
  const MONTHS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']

  const expenseRows = expenses
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

  const budgetRows = budgets
    .slice()
    .sort((a, b) => a.year !== b.year ? a.year - b.year : a.month !== b.month ? a.month - b.month : a.person.localeCompare(b.person))
    .flatMap(b => {
      const monthLabel = `${MONTHS[b.month - 1]} ${b.year}`
      const personLabel = b.person === 'person1' ? 'Personne 1' : b.person === 'person2' ? 'Personne 2' : 'Commun'
      const rows = b.items.map(it => ({
        Année: b.year,
        Mois: monthLabel,
        Personne: personLabel,
        Catégorie: CATEGORY_MAP[it.categoryId]?.label ?? it.categoryId,
        'Montant budgété': it.amount,
        'Revenu prévu': '',
      }))
      if (b.estimatedIncome != null) {
        rows.push({ Année: b.year, Mois: monthLabel, Personne: personLabel, Catégorie: 'REVENU', 'Montant budgété': '', 'Revenu prévu': b.estimatedIncome } as any)
      }
      return rows
    })

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expenseRows), 'Dépenses')
  if (budgetRows.length > 0) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(budgetRows), 'Budgets')
  }
  XLSX.writeFile(wb, `budget-export-${isoDate()}.xlsx`)
}

// Escape user-controlled strings before interpolating them into the print
// document — imported files (CSV/PDF/JSON) could otherwise inject HTML/JS.
function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function exportPDF(expenses: Expense[], baseCurrency: string, budgets: MonthlyBudget[] = []): void {
  const MONTHS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']
  const sorted = expenses.slice().sort((a, b) => b.date.localeCompare(a.date))
  const expenseRows = sorted.map(e => {
    const sign = e.type === 'credit' ? '+' : '-'
    const catLabel = CATEGORY_MAP[e.category as CategoryId]?.label ?? e.category
    return `<tr>
      <td>${esc(e.date)}</td>
      <td>${esc(e.title)}</td>
      <td>${esc(catLabel)}</td>
      <td>${esc(e.subCategory)}</td>
      <td style="text-align:right;color:${e.type === 'credit' ? 'green' : 'inherit'}">${sign}${Number(e.amount).toFixed(2)} ${esc(e.currency)}</td>
      <td>${esc(e.bank)}</td>
    </tr>`
  }).join('')

  const budgetSection = budgets.length > 0 ? (() => {
    const sortedB = budgets.slice().sort((a, b) =>
      a.year !== b.year ? a.year - b.year : a.month !== b.month ? a.month - b.month : a.person.localeCompare(b.person)
    )
    const bRows = sortedB.flatMap(b => {
      const monthLabel = `${MONTHS[b.month - 1]} ${b.year}`
      const personLabel = b.person === 'person1' ? 'P.1' : b.person === 'person2' ? 'P.2' : 'Commun'
      const rows = b.items.map(it =>
        `<tr><td>${esc(monthLabel)}</td><td>${esc(personLabel)}</td><td>${esc(CATEGORY_MAP[it.categoryId]?.label ?? it.categoryId)}</td><td style="text-align:right">${Number(it.amount).toFixed(2)} ${esc(baseCurrency)}</td></tr>`
      )
      if (b.estimatedIncome != null) {
        rows.push(`<tr style="color:#16a34a"><td>${esc(monthLabel)}</td><td>${esc(personLabel)}</td><td>Revenu prévu</td><td style="text-align:right">+${Number(b.estimatedIncome).toFixed(2)} ${esc(baseCurrency)}</td></tr>`)
      }
      return rows
    }).join('')
    return `<h2 style="margin-top:24px;font-size:14px">Budgets mensuels (${budgets.length} mois)</h2>
      <table>
        <thead><tr><th>Mois</th><th>Personne</th><th>Catégorie</th><th>Montant</th></tr></thead>
        <tbody>${bRows}</tbody>
      </table>`
  })() : ''

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Budget Export ${isoDate()}</title>
    <style>
      body{font-family:system-ui,sans-serif;font-size:12px;color:#111}
      h1{font-size:16px;margin-bottom:4px}h2{font-size:14px}
      p{color:#666;margin-bottom:16px}
      table{width:100%;border-collapse:collapse;margin-bottom:8px}
      th{background:#f3f4f6;font-weight:600;text-align:left;padding:6px 8px;border-bottom:2px solid #e5e7eb}
      td{padding:5px 8px;border-bottom:1px solid #f3f4f6}
    </style>
  </head><body>
    <h1>Budget — Export ${isoDate()}</h1>
    <p>${expenses.length} transactions · devise base : ${esc(baseCurrency)}</p>
    <table>
      <thead><tr><th>Date</th><th>Boutique</th><th>Catégorie</th><th>Sous-cat.</th><th>Montant</th><th>Banque</th></tr></thead>
      <tbody>${expenseRows}</tbody>
    </table>
    ${budgetSection}
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
    if (!obj || typeof obj !== 'object' || !Array.isArray(obj.expenses)) return null
    // Drop malformed entries instead of corrupting the store: every expense
    // must at least have a date string and a finite positive amount.
    obj.expenses = obj.expenses.filter((e: any) =>
      e && typeof e === 'object' &&
      typeof e.date === 'string' &&
      Number.isFinite(Number(e.amount))
    )
    if (obj.recurring != null && !Array.isArray(obj.recurring)) obj.recurring = []
    if (obj.budgets != null && !Array.isArray(obj.budgets)) obj.budgets = []
    if (obj.settings != null && typeof obj.settings !== 'object') obj.settings = undefined
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
  budgets: MonthlyBudget[] = [],
): void {
  try {
    const existing: AutoBackupSlot[] = getAutoBackupSlots()
    const slot: AutoBackupSlot = {
      savedAt: new Date().toISOString(),
      data: { version: BACKUP_VERSION, exportedAt: new Date().toISOString(), settings, expenses, recurring, budgets },
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
