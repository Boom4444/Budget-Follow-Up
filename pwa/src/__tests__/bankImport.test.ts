import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import {
  importFromCSV,
  importFromJSON,
  parsePDFTransactions,
  extractPdfText,
  deriveImportKeyword,
  looksLikeRevolutCsv,
} from '../utils/bankImport'
import type { ImportRule } from '../models/types'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixture = (name: string) => join(__dirname, 'fixtures', name)

// Extract PDF text in Node using the legacy pdfjs build (works headless).
async function extractFromPdfFile(path: string): Promise<string> {
  const require = createRequire(import.meta.url)
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  pdfjs.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')
  const data = new Uint8Array(readFileSync(path))
  const pdf = await pdfjs.getDocument({ data }).promise
  const { text } = await extractPdfText(pdf)
  return text
}

// ── CSV: French Revolut export (synthetic fixture, always present) ─────────────
describe('importFromCSV — Revolut FR', () => {
  const text = readFileSync(fixture('revolut_fr_sample.csv'), 'utf-8')
  const result = importFromCSV(text, 'MaiJuin_2026.csv')
  const txns = result.transactions

  it('detects Revolut', () => {
    expect(result.bank).toBe('revolut')
    expect(result.bankName).toBe('Revolut')
  })

  it('skips currency-exchange ("Change en …") rows', () => {
    expect(txns.some(t => /change en/i.test(t.title))).toBe(false)
  })

  it('skips the RENVOYÉ (returned) row, keeps the settled one', () => {
    const ivs = txns.filter(t => t.title === 'IVS France')
    expect(ivs).toHaveLength(1)
    expect(ivs[0].amount).toBeCloseTo(2.40, 2)
  })

  it('captures Premium subscription fees as their own debit', () => {
    const fees = txns.filter(t => /frais/i.test(t.title))
    expect(fees.length).toBe(2)
    expect(fees.every(f => f.type === 'debit')).toBe(true)
    expect(fees.every(f => Math.abs(f.amount - 10.99) < 0.01)).toBe(true)
    expect(fees.every(f => f.suggestedCategory === 'banque')).toBe(true)
    expect(fees.every(f => f.suggestedSubCategory === 'Frais Carte')).toBe(true)
  })

  it('preserves both CHF and EUR currencies', () => {
    const currencies = new Set(txns.map(t => t.currency))
    expect(currencies.has('CHF')).toBe(true)
    expect(currencies.has('EUR')).toBe(true)
  })

  it('marks debits/credits by sign', () => {
    const credit = txns.find(t => t.amount === 2500)
    expect(credit?.type).toBe('credit')
    const sbb = txns.find(t => t.title === 'SBB CFF FFS')
    expect(sbb?.type).toBe('debit')
  })

  it('dates transactions by "Date de fin" (completed), not "Date de début" (started)', () => {
    // SBB CFF FFS: Date de début = 2026-04-02, Date de fin = 2026-04-03
    const sbb = txns.find(t => t.title === 'SBB CFF FFS')
    expect(sbb?.date).toBe('2026-04-03')
    // Canal+: Date de début = 2026-04-02, Date de fin = 2026-04-06
    const canal = txns.find(t => t.title === 'Canal+')
    expect(canal?.date).toBe('2026-04-06')
  })

  it('auto-classifies known merchants', () => {
    expect(txns.find(t => /canal/i.test(t.title))?.suggestedCategory).toBe('abonnements')
    expect(txns.find(t => t.title === 'Lidl')?.suggestedCategory).toBe('nourriture')
  })

  it('every transaction has a valid ISO date, positive amount, id and type', () => {
    for (const t of txns) {
      expect(t.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(t.amount).toBeGreaterThan(0)
      expect(t.id).toBeTruthy()
      expect(['debit', 'credit']).toContain(t.type)
    }
  })
})

// ── Revolut content detection (filename has a misleading numeric suffix) ──────
describe('looksLikeRevolutCsv', () => {
  it('recognises the French Revolut header', () => {
    const fr = 'Type,Produit,Date de début,Date de fin,Description,Montant,Frais,Devise,État,Solde'
    expect(looksLikeRevolutCsv(fr)).toBe(true)
  })

  it('recognises the English Revolut header', () => {
    const en = 'Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance'
    expect(looksLikeRevolutCsv(en)).toBe(true)
  })

  it('matches on just the first line of a multi-line export', () => {
    const text = readFileSync(fixture('revolut_fr_sample.csv'), 'utf-8')
    expect(looksLikeRevolutCsv(text)).toBe(true)
  })

  it('rejects non-Revolut text and binary/PDF gibberish', () => {
    expect(looksLikeRevolutCsv('Date,Libellé,Débit,Crédit')).toBe(false)        // CIC-ish
    expect(looksLikeRevolutCsv('%PDF-1.4\n%âãÏÓ\n1 0 obj')).toBe(false)          // PDF header
    expect(looksLikeRevolutCsv('')).toBe(false)
  })
})

// ── JSON import ─────────────────────────────────────────────────────────────
describe('importFromJSON', () => {
  it('parses a bare array with EN field names', () => {
    const json = JSON.stringify([
      { date: '2026-01-05', description: 'Spotify', amount: -9.99, currency: 'EUR' },
      { date: '2026-01-10', description: 'Salaire', amount: 2500, currency: 'EUR' },
    ])
    const { transactions } = importFromJSON(json, 'x.json')
    expect(transactions).toHaveLength(2)
    expect(transactions[0].type).toBe('debit')
    expect(transactions[0].suggestedCategory).toBe('abonnements')
    expect(transactions[1].type).toBe('credit')
  })

  it('parses an object wrapping the array under "transactions" with FR fields', () => {
    const json = JSON.stringify({
      transactions: [
        { date: '2026-02-01', libellé: 'Carrefour', montant: '-45,60', devise: 'EUR' },
      ],
    })
    const { transactions } = importFromJSON(json, 'export.json')
    expect(transactions).toHaveLength(1)
    expect(transactions[0].amount).toBeCloseTo(45.6, 2)
    expect(transactions[0].suggestedCategory).toBe('nourriture')
  })

  it('honours an explicit type field over the amount sign', () => {
    const json = JSON.stringify([{ date: '2026-03-01', title: 'Remboursement', amount: 50, type: 'debit' }])
    const { transactions } = importFromJSON(json, 'x.json')
    expect(transactions[0].type).toBe('debit')
  })

  it('returns empty for malformed JSON without throwing', () => {
    expect(importFromJSON('{not json', 'x.json').transactions).toHaveLength(0)
  })
})

// ── Pictet (employer) built-in rule — debit-only ─────────────────────────────
describe('Pictet built-in classification', () => {
  const json = (desc: string, amount: number, type: 'debit' | 'credit') =>
    importFromJSON(JSON.stringify([{ date: '2026-01-05', description: desc, amount, type }]), 'x.json')
      .transactions[0]

  it('classifies "Restaurant Pictet" debits as Entreprise / Repas Travail', () => {
    const t = json('Restaurant Pictet', -12, 'debit')
    expect(t.suggestedCategory).toBe('entreprise')
    expect(t.suggestedSubCategory).toBe('Repas Travail')
    expect(t.needsReview).toBe(false)
  })

  it('classifies a bare "Pictet" debit the same way', () => {
    const t = json('Pictet', -8, 'debit')
    expect(t.suggestedCategory).toBe('entreprise')
    expect(t.needsReview).toBe(false)
  })

  it('does NOT tag a "Pictet" credit (salary) as a work meal', () => {
    const t = json('Pictet', 7814, 'credit')
    expect(t.suggestedCategory).not.toBe('entreprise')
    expect(t.suggestedCategory).toBe('a_classer')
    expect(t.needsReview).toBe(true)
  })
})

// ── User-taught import rules ──────────────────────────────────────────────────
describe('user-taught import rules', () => {
  const rule = (keyword: string, category: string, subCategory: string, type: 'debit' | 'credit'): ImportRule =>
    ({ keyword, category, subCategory, type })
  const classifyVia = (desc: string, type: 'debit' | 'credit', rules: ImportRule[]) =>
    importFromJSON(JSON.stringify([{ date: '2026-01-05', description: desc, amount: type === 'debit' ? -10 : 10, type }]), 'x.json', rules)
      .transactions[0]

  it('applies a learned rule to a matching merchant (and clears needsReview)', () => {
    const t = classifyVia('Le Bouchon Lyonnais', 'debit', [rule('le bouchon lyonnais', 'nourriture', 'Restaurant', 'debit')])
    expect(t.suggestedCategory).toBe('nourriture')
    expect(t.suggestedSubCategory).toBe('Restaurant')
    expect(t.needsReview).toBe(false)
  })

  it('matches as a substring across noisy descriptions', () => {
    const t = classifyVia('CB LE BOUCHON LYONNAIS 12/05 LYON', 'debit', [rule('le bouchon lyonnais', 'nourriture', 'Restaurant', 'debit')])
    expect(t.suggestedCategory).toBe('nourriture')
  })

  it('is type-scoped: a debit rule does not touch a credit', () => {
    const t = classifyVia('Le Bouchon Lyonnais', 'credit', [rule('le bouchon lyonnais', 'nourriture', 'Restaurant', 'debit')])
    expect(t.suggestedCategory).toBe('a_classer')
    expect(t.needsReview).toBe(true)
  })

  it('wins over a conflicting built-in rule', () => {
    const t = classifyVia('Spotify', 'debit', [rule('spotify', 'loisirs', 'Jeux / Jeux vidéo', 'debit')])
    expect(t.suggestedCategory).toBe('loisirs')
  })
})

// ── deriveImportKeyword ───────────────────────────────────────────────────────
describe('deriveImportKeyword', () => {
  it('strips bank noise, digits, punctuation and accents', () => {
    expect(deriveImportKeyword('CB PICTET 12/05 GENÈVE')).toBe('pictet geneve')
  })
  it('lowercases and collapses whitespace', () => {
    expect(deriveImportKeyword('  Le   Bouchon  ')).toBe('le bouchon')
  })
})

// ── PDF: real statements (skipped in CI when private fixtures are absent) ──────
// ── UBS full statement with a running-balance column (synthetic, no fixture) ──
// Reproduces the bug where the balance (Solde) column was read as the amount,
// leaking the real amount into the title (e.g. "Restaurant Pictet -17" / +10'839).
describe('parsePDFTransactions — UBS with Solde (balance) column', () => {
  const text = [
    'UBS Switzerland AG',
    'Mouvements de compte',
    'Date de trans. Date de compt. Description Débit Crédit Solde Date de valeur',
    "30.01.2026   Restaurant Pictet   -17.00   10'839.52   31.01.2026",
    "30.01.2026   Restaurant Pictet   -2.30   10'841.82   31.01.2026",
    "29.01.2026   Migros M Cornavin Gare   -45.50   10'887.32   30.01.2026",
    "28.01.2026   Salaire Pictet   5'000.00   15'887.32   28.01.2026",
  ].join('\n')
  const { transactions } = parsePDFTransactions(text, 'UBS')

  it('reads the transaction amount, never the running balance', () => {
    expect(transactions).toHaveLength(4)
    expect(transactions.every(t => t.amount < 6000)).toBe(true)   // no 10'8xx balance leak
    expect(transactions.map(t => t.amount)).toEqual([17, 2.3, 45.5, 5000])
  })

  it('keeps the description clean (amount not leaked into the title)', () => {
    expect(transactions[0].title).toBe('Restaurant Pictet')
    expect(transactions.every(t => !/\d[.,]\d{2}/.test(t.title))).toBe(true)
  })

  it('signs debit/credit correctly and stays in CHF', () => {
    expect(transactions[0].type).toBe('debit')
    expect(transactions[3].type).toBe('credit')   // Salaire (positive)
    expect(transactions.every(t => t.currency === 'CHF')).toBe(true)
  })
})

const CIC1 = fixture('CIC_01.pdf')
const CIC2 = fixture('CIC_02.pdf')
const UBS = fixture('UBS.pdf')
const hasPdfFixtures = existsSync(CIC1) && existsSync(UBS)
const pdfDescribe = hasPdfFixtures ? describe : describe.skip

pdfDescribe('importFromPDF (parse pipeline) — real statements', () => {
  it('extracts and parses CIC_01 with categories', async () => {
    const text = await extractFromPdfFile(CIC1)
    expect(text.length).toBeGreaterThan(100)
    const { transactions } = parsePDFTransactions(text, 'CIC')
    expect(transactions.length).toBeGreaterThan(5)
    expect(transactions.find(t => /^vir /i.test(t.title))?.type).toBe('credit')
    expect(transactions.some(t => t.suggestedCategory === 'abonnements')).toBe(true)
    for (const t of transactions) {
      expect(t.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(t.amount).toBeGreaterThan(0)
      expect(t.currency).toBe('EUR')
    }
  })

  it('extracts and parses CIC_02 (originally extension-less)', async () => {
    if (!existsSync(CIC2)) return
    const { transactions } = parsePDFTransactions(await extractFromPdfFile(CIC2), 'CIC')
    expect(transactions.length).toBeGreaterThan(0)
  })

  it('extracts and parses UBS in CHF', async () => {
    const { transactions } = parsePDFTransactions(await extractFromPdfFile(UBS), 'UBS')
    expect(transactions.length).toBeGreaterThan(20)
    expect(transactions.every(t => t.currency === 'CHF')).toBe(true)
    for (const t of transactions) {
      expect(t.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(t.amount).toBeGreaterThan(0)
    }
  })
})
