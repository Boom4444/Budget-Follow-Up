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
} from '../utils/bankImport'

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
    expect(fees.every(f => f.suggestedCategory === 'autre')).toBe(true)
    expect(fees.every(f => f.suggestedSubCategory === 'Frais bancaires')).toBe(true)
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

// ── PDF: real statements (skipped in CI when private fixtures are absent) ──────
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
