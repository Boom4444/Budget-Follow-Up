import { v4 as uuid } from 'uuid'
import type { CurrencyCode, ImportRule } from '../models/types'

export type BankFormat = 'revolut' | 'cic' | 'caisse_epargne' | 'ubs' | 'generic'

export interface ImportedTransaction {
  id: string
  date: string
  title: string
  amount: number
  currency: CurrencyCode
  type: 'debit' | 'credit'
  bank: string
  suggestedCategory: string
  suggestedSubCategory: string
  needsReview: boolean
  notes: string
}

export interface BankImportResult {
  bank: BankFormat
  bankName: string
  transactions: ImportedTransaction[]
}

// ── Keyword → category classifier ────────────────────────────────────────────

const KEYWORD_RULES: Array<{ keywords: string[]; category: string; subCategory: string; debitOnly?: boolean }> = [
  // Abonnements
  { keywords: ['spotify'], category: 'abonnements', subCategory: 'Spotify' },
  { keywords: ['netflix'], category: 'abonnements', subCategory: 'Streaming' },
  { keywords: ['amazon prime', 'prime video'], category: 'abonnements', subCategory: 'Streaming' },
  { keywords: ['disney+', 'disneyplus', 'disney plus'], category: 'abonnements', subCategory: 'Streaming' },
  { keywords: ['deezer', 'tidal', 'apple music'], category: 'abonnements', subCategory: 'Streaming' },
  { keywords: ['openai', 'chatgpt'], category: 'abonnements', subCategory: 'ChatGPT' },
  { keywords: ['canal+', 'canalplus', 'canal plus'], category: 'abonnements', subCategory: 'Canal+' },
  { keywords: ['sosh', 'sfr ', 'bouygues telecom', 'free mobile', 'lebara', 'lycamobile', 'prlv sepa sosh', 'prlv sepa sfr'], category: 'abonnements', subCategory: 'Téléphone' },
  { keywords: ['orange telecom', 'prlv sepa orange'], category: 'abonnements', subCategory: 'Téléphone' },
  { keywords: ['icloud', 'apple.com/bill', 'apple services'], category: 'abonnements', subCategory: 'Autres Abonnements' },
  { keywords: ['youtube premium', 'google one', 'google storage'], category: 'abonnements', subCategory: 'Autres Abonnements' },
  { keywords: ['adobe', 'microsoft 365', 'office 365'], category: 'abonnements', subCategory: 'Autres Abonnements' },
  { keywords: ['prlv sepa free', 'free sas'], category: 'abonnements', subCategory: 'Internet' },

  // Nourriture – Courses
  { keywords: ['intermarché', 'intermarche'], category: 'nourriture', subCategory: 'Courses' },
  { keywords: ['lidl', 'aldi ', 'netto '], category: 'nourriture', subCategory: 'Courses' },
  { keywords: ['carrefour', 'monoprix', 'franprix', 'casino '], category: 'nourriture', subCategory: 'Courses' },
  { keywords: ['auchan', 'e.leclerc', 'leclerc '], category: 'nourriture', subCategory: 'Courses' },
  { keywords: ['super u ', 'systeme u', 'système u'], category: 'nourriture', subCategory: 'Courses' },
  { keywords: ['picard ', 'bio c bon', 'naturalia', 'biocoop'], category: 'nourriture', subCategory: 'Courses' },
  { keywords: ['migros', 'coop supermarche', 'denner', 'volg '], category: 'nourriture', subCategory: 'Courses' },
  { keywords: ['amazon fresh', 'too good to go', 'frichti'], category: 'nourriture', subCategory: 'Courses' },
  { keywords: ['épicerie', 'epicerie'], category: 'nourriture', subCategory: 'Courses' },

  // Nourriture – Restaurant / Livraison
  { keywords: ['mcdonald', 'mcdo', 'kfc ', 'burger king', 'quick resto', 'subway ', 'five guys', 'chipotle', 'popeyes'], category: 'nourriture', subCategory: 'Restaurant' },
  { keywords: ["domino's", 'pizza hut', 'pizza '], category: 'nourriture', subCategory: 'Livraison' },
  { keywords: ['uber eat', 'ubereats', 'deliveroo', 'just eat', 'doordash'], category: 'nourriture', subCategory: 'Livraison' },
  { keywords: ['starbucks', 'costa coffee', 'starbuck'], category: 'nourriture', subCategory: 'Café / Boulangerie' },
  { keywords: ['boulangerie', 'patisserie', 'pâtisserie', 'boulang'], category: 'nourriture', subCategory: 'Café / Boulangerie' },

  // Transport
  { keywords: ['sncf', 'oui.sncf', 'ouigo', 'tgv ', 'eurostar', 'thalys', 'intercités'], category: 'transport', subCategory: 'SNCF / Train' },
  { keywords: ['cff.ch', 'sbb.ch', ' cff ', ' sbb '], category: 'transport', subCategory: 'SNCF / Train' },
  { keywords: ['ratp', 'navigo ', 'transilien'], category: 'transport', subCategory: 'Métro / Bus' },
  { keywords: ['uber ', 'bolt taxi', 'kapten', 'g7 taxi', 'taxi '], category: 'transport', subCategory: 'VTC / Taxi' },
  { keywords: ['shell ', 'total ener', 'bp ', 'esso ', 'eni ', 'q8 ', 'leclerc essence', 'carburant', 'station service'], category: 'transport', subCategory: 'Essence' },
  { keywords: ['aprr', 'area ', 'sanef', 'cofiroute', 'vinci autoroute', 'péage', 'peage', 'autostrade', 'telepeage'], category: 'transport', subCategory: 'Péages' },
  { keywords: ['getaround', 'ouicar', 'blablacar'], category: 'transport', subCategory: 'Autres Transport' },
  { keywords: ['velib', 'vélib', 'lime ', 'tier ', 'bird ', 'dott '], category: 'transport', subCategory: 'Autres Transport' },

  // Logement
  { keywords: ['airbnb', 'booking.com', 'hotels.com', 'accorhotels', 'ibis ', 'novotel', 'marriott', 'hilton', 'hyatt'], category: 'logement', subCategory: 'Location Logement' },
  { keywords: ['edf ', 'engie ', 'vattenfall', 'veolia', 'eau de paris', 'gaz'], category: 'logement', subCategory: 'Eau / Électricité / Gaz' },

  // Loisirs
  { keywords: ['ryanair', 'easyjet', 'air france', 'lufthansa', 'transavia', 'vueling', 'british airways', 'iberia', 'tap air'], category: 'loisirs', subCategory: 'Voyage' },
  { keywords: ['ugc ', 'pathé', 'pathe ', 'mk2 ', 'cgr ', 'cinéma ', 'cinema '], category: 'loisirs', subCategory: 'Cinéma' },
  { keywords: ['disneyland', 'puy du fou', 'futuroscope', 'parc asterix'], category: 'loisirs', subCategory: 'Activité / Sortie' },
  { keywords: ['nicolas ', 'cave à vins', 'vinatis', 'alcool ', 'spirits ', 'whisky', 'whiskey'], category: 'loisirs', subCategory: 'Alcool' },
  { keywords: ['steam ', 'playstation', 'xbox game', 'nintendo', 'epic games', 'meta quest'], category: 'loisirs', subCategory: 'Jeux / Jeux vidéo' },
  { keywords: ['fnac ', 'cultura ', 'gibert joseph', 'amazon.fr'], category: 'loisirs', subCategory: 'Autres Loisirs' },

  // Assurance
  { keywords: ['axa ', 'maaf ', 'matmut', 'mma ', 'allianz', 'generali', 'groupama', 'macif', 'maif '], category: 'assurance', subCategory: 'Autres Assurance' },
  { keywords: ['sanitas', 'groupe mutuel', 'css assurance', 'helsana', 'swica ', 'concordia', 'visana', 'assura '], category: 'assurance', subCategory: 'Maladie (Lamal)' },
  { keywords: ['mutuelle', 'complémentaire santé'], category: 'assurance', subCategory: 'Maladie (Complémentaire)' },

  // Banque
  { keywords: ['frais carte', 'cotisation carte', 'frais de tenue', 'interets debiteurs'], category: 'banque', subCategory: 'Frais Carte' },
  { keywords: ['remboursement pret', 'remboursement prêt', 'echeance pret', 'échéance prêt', 'mensualite credit', 'mensualité crédit'], category: 'banque', subCategory: 'Prêt' },

  // Impôts
  { keywords: ['dgfip', 'tresor public', 'trésor public', 'impots.gouv', 'taxe habitation', 'taxe fonciere', 'taxe foncière'], category: 'impots', subCategory: 'Global' },

  // Santé
  { keywords: ['pharmacie', 'pharmacien', 'pharma '], category: 'sante', subCategory: 'Pharmacie' },
  { keywords: ['medecin', 'médecin', 'docteur', 'cabinet médical', 'cabinet medical', 'hopital', 'hôpital', 'clinique'], category: 'sante', subCategory: 'Médecin' },
  { keywords: ['dentiste', 'cabinet dentaire', 'orthodontiste'], category: 'sante', subCategory: 'Dentiste' },
  { keywords: ['opticien', 'afflelou', 'krys ', 'atol ', 'les opticiens', 'optique '], category: 'sante', subCategory: 'Opticien' },
  { keywords: ['kinésithérapeute', 'kinesitherapeute', 'kiné', 'ostéopathe', 'osteopathe'], category: 'sante', subCategory: 'Kiné / Ostéo' },

  // Habillement
  { keywords: ['zara ', 'h&m ', 'uniqlo', 'primark', 'mango ', 'bershka', 'pull&bear', 'la redoute', 'zalando', 'asos ', 'jules ', 'kiabi', 'celio', 'promod', 'pimkie', 'jennyfer', 'camaieu', 'bonobo'], category: 'habillement', subCategory: 'Vêtements' },
  { keywords: ['nike ', 'adidas ', 'puma ', 'new balance', 'skechers', 'timberland', 'chaussures', 'andre '], category: 'habillement', subCategory: 'Chaussures' },

  // Maison
  { keywords: ['ikea', 'castorama', 'leroy merlin', 'mr bricolage', 'brico depot', 'bricomarché', 'bricomarche'], category: 'maison', subCategory: 'Bricolage' },
  { keywords: ['maisons du monde', 'conforama', 'but ', 'fly ', 'alinea ', 'habitat '], category: 'maison', subCategory: 'Meubles' },
  { keywords: ['darty', 'boulanger ', 'electro depot', 'samsung ', 'apple store'], category: 'maison', subCategory: 'Électroménager' },

  // Beauté
  { keywords: ['coiffeur', 'coiffure', 'barbier', 'barber ', 'salon de coiffure'], category: 'beaute', subCategory: 'Coiffeur' },
  { keywords: ['sephora', 'marionnaud', 'nocibé', 'nocibe', 'yves rocher', "l'occitane", 'loccitane', 'nuxe ', 'kiko '], category: 'beaute', subCategory: 'Cosmétiques' },
  { keywords: ['manucure', 'pedicure', 'pédicure', 'épilation', 'epilation', 'waxing', 'spa ', 'massage', 'bien-être'], category: 'beaute', subCategory: 'Soins / Spa' },

  // Sport
  { keywords: ['basic fit', 'basicfit', 'keep cool', 'neoness', 'fitness park', 'orange bleue', 'moving '], category: 'sport', subCategory: 'Inscription / Abonnement' },
  { keywords: ['decathlon', 'sport 2000', 'go sport', 'intersport'], category: 'sport', subCategory: 'Équipement' },

  // Entreprise / Pro — Pictet is the user's employer: meals on site are work
  // expenses. `debitOnly` because the monthly salary is *also* paid by "Pictet"
  // and must not be mistagged as a work meal (it stays "À classer" → revenus).
  { keywords: ['pictet'], category: 'entreprise', subCategory: 'Repas Travail', debitOnly: true },
]

const EXCHANGE_PATTERNS = [
  /^exchanged? (to|from) [a-z]{3}/i,
  /^currency exchange/i,
  /^fx (conversion|fee)/i,
  /^change de devises/i,
  /^change en [a-z]{3}/i,   // Revolut FR: "Change en EUR", "Change en GBP"
  /^bureau de change/i,
]

function isCurrencyExchange(desc: string, txnType?: string): boolean {
  const t = txnType?.toLowerCase() ?? ''
  if (t === 'exchange' || t === 'changes' || t === 'change') return true
  return EXCHANGE_PATTERNS.some(p => p.test(desc.trim()))
}

/**
 * Normalize a transaction description into a stable merchant key: lowercased,
 * accents/punctuation/digits stripped, common bank prefixes removed. Used both
 * to derive a learned rule's keyword and to match it against future imports, so
 * "CB PICTET 12/05" and "Pictet" reduce to the same comparable form.
 */
export function deriveImportKeyword(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // strip accents
    .replace(/[0-9]+/g, ' ')                            // drop dates/refs/amounts
    .replace(/[^a-z ]+/g, ' ')                          // drop punctuation/symbols
    .replace(/\b(cb|carte|paiement|vir|virement|prlv|sepa|achat)\b/g, ' ')  // bank noise
    .replace(/\s+/g, ' ')
    .trim()
}

function classify(
  description: string,
  userRules: ImportRule[] = [],
  type: 'debit' | 'credit' = 'debit',
): { category: string; subCategory: string; needsReview: boolean } {
  const lower = description.toLowerCase()

  // 1. User-taught rules win over the built-ins. Longest keyword first so a more
  //    specific merchant beats a shorter, broader one. Type-scoped.
  if (userRules.length) {
    const descKey = deriveImportKeyword(description)
    const matches = userRules
      .filter(r => r.type === type && r.keyword && descKey.includes(r.keyword))
      .sort((a, b) => b.keyword.length - a.keyword.length)
    if (matches.length) {
      return { category: matches[0].category, subCategory: matches[0].subCategory, needsReview: false }
    }
  }

  // 2. Built-in keyword rules.
  for (const rule of KEYWORD_RULES) {
    if (rule.debitOnly && type === 'credit') continue
    if (rule.keywords.some(k => lower.includes(k))) {
      return { category: rule.category, subCategory: rule.subCategory, needsReview: false }
    }
  }

  return { category: 'a_classer', subCategory: 'Non classé', needsReview: true }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseDate(raw: string, yearHint?: number): string {
  raw = raw.trim().replace(/^["']|["']$/g, '')
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10)
  // Year is optional — CIC bank statements use DD/MM without year
  const dmy = raw.match(/^(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-](\d{2,4}))?/)
  if (dmy) {
    const d = dmy[1].padStart(2, '0')
    const m = dmy[2].padStart(2, '0')
    let y: number
    if (dmy[3]) {
      y = parseInt(dmy[3])
      if (y < 100) y += 2000
    } else {
      y = yearHint ?? new Date().getFullYear()
    }
    return `${y}-${m}-${d}`
  }
  return new Date().toISOString().slice(0, 10)
}

function parseAmount(raw: string): number {
  let s = raw
    .replace(/−/g, '-')   // Unicode minus → ASCII minus (Revolut)
    .replace(/['"]/g, '') // apostrophes (Swiss 1'234) and stray quotes
    .replace(/\s/g, '')   // spaces
    .trim()
  // European format: comma is decimal separator, dots are thousands separators.
  // Detect by comma appearing before the last 1-3 digits at end of string.
  if (/,\d+$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.')
  }
  return parseFloat(s) || 0
}

function detectSep(line: string): string {
  if (line.includes(';')) return ';'
  if (line.includes('\t')) return '\t'
  return ','
}

function detectFormat(header: string): BankFormat {
  const h = header.toLowerCase()
  // Revolut: English ("Completed Date"/"Started Date") or French
  // ("Date de début"/"Date de fin" + "Devise" + "État")
  if (h.includes('completed date') || h.includes('started date')) return 'revolut'
  if ((h.includes('date de début') || h.includes('date de debut') || h.includes('date de fin')) &&
      h.includes('devise') && (h.includes('état') || h.includes('etat'))) return 'revolut'
  if (h.includes('buchungsdatum') || h.includes('belastung') || h.includes('gutschrift')) return 'ubs'
  if (h.includes('date valeur')) return 'caisse_epargne'
  if (h.includes('numéro de compte') || h.includes('numero de compte')) return 'cic'
  return 'generic'
}

function splitLine(line: string, sep: string): string[] {
  // Handle quoted fields properly
  if (!line.includes('"')) return line.split(sep).map(c => c.trim())
  const cols: string[] = []
  let inQuote = false
  let buf = ''
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') { inQuote = !inQuote; continue }
    if (!inQuote && ch === sep) { cols.push(buf.trim()); buf = ''; continue }
    buf += ch
  }
  cols.push(buf.trim())
  return cols
}

// ── Per-bank parsers ──────────────────────────────────────────────────────────

// Handles both the English and French Revolut CSV exports.
// EN: Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance
// FR: Type,Produit,Date de début,Date de fin,Description,Montant,Frais,Devise,État,Solde
function parseRevolutCSV(lines: string[], userRules: ImportRule[] = []): ImportedTransaction[] {
  const sep = detectSep(lines[0])
  const header = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/['"]/g, ''))
  // Find a column whose name contains any of the given substrings
  const find = (...names: string[]) => header.findIndex(h => names.some(n => h.includes(n)))

  const completedIdx = find('completed date', 'date de fin')
  const startedIdx   = find('started date', 'date de début', 'date de debut')
  const dateIdx      = completedIdx !== -1 ? completedIdx : startedIdx
  const descIdx      = find('description')
  const amountIdx    = find('amount', 'montant')
  const feeIdx       = find('fee', 'frais')
  const currencyIdx  = find('currency', 'devise')
  const stateIdx     = find('state', 'état', 'etat')
  const typeIdx      = find('type')

  // Only these states are real, settled transactions
  const DONE = new Set(['completed', 'terminé', 'termine'])

  const out: ImportedTransaction[] = []
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue
    const cols = splitLine(line, sep)
    if (cols.length < 5) continue

    const state = (stateIdx >= 0 ? cols[stateIdx] ?? '' : '').toLowerCase().trim()
    if (stateIdx >= 0 && !DONE.has(state)) continue

    const txType = typeIdx >= 0 ? (cols[typeIdx] ?? '') : ''
    const currency = ((cols[currencyIdx] ?? 'EUR').trim().toUpperCase() || 'EUR') as CurrencyCode
    const description = cols[descIdx] ?? ''
    const date = parseDate(cols[dateIdx] ?? '')

    // Skip internal currency-exchange legs (they double-count real spending)
    if (isCurrencyExchange(description, txType)) continue

    const amount = parseAmount(cols[amountIdx] ?? '')
    const fee    = feeIdx >= 0 ? parseAmount(cols[feeIdx] ?? '') : 0

    if (amount !== 0) {
      const type = amount < 0 ? 'debit' : 'credit'
      const { category, subCategory, needsReview } = classify(description, userRules, type)
      out.push({
        id: uuid(),
        date,
        title: description,
        amount: Math.abs(amount),
        currency,
        type,
        bank: 'Revolut',
        suggestedCategory: category,
        suggestedSubCategory: subCategory,
        needsReview,
        notes: '',
      })
    }

    // A non-zero fee is a real charge — capture it as its own debit so it
    // isn't silently lost (e.g. "Frais d'abonnement Premium" = 10.99).
    if (fee > 0) {
      out.push({
        id: uuid(),
        date,
        title: `Frais — ${description || 'Revolut'}`,
        amount: Math.abs(fee),
        currency,
        type: 'debit',
        bank: 'Revolut',
        suggestedCategory: 'banque',
        suggestedSubCategory: 'Frais Carte',
        needsReview: false,
        notes: '',
      })
    }
  }
  return out
}

function parseCICCSV(lines: string[], userRules: ImportRule[] = []): ImportedTransaction[] {
  const sep = detectSep(lines[0])
  const header = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/['"]/g, ''))

  const dateIdx   = header.findIndex(h => h === 'date')
  const amountIdx = header.findIndex(h => h.includes('montant'))
  const labelIdx  = header.findIndex(h => h.includes('libellé') || h.includes('libelle') || h.includes('description'))

  const out: ImportedTransaction[] = []
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue
    const cols = splitLine(line, sep)
    if (cols.length < 3) continue

    const amount = parseAmount(cols[amountIdx >= 0 ? amountIdx : 1] ?? '')
    if (amount === 0) continue

    const description = cols[labelIdx >= 0 ? labelIdx : 3] ?? ''
    if (isCurrencyExchange(description)) continue
    const type = amount < 0 ? 'debit' : 'credit'
    const { category, subCategory, needsReview } = classify(description, userRules, type)

    out.push({
      id: uuid(),
      date: parseDate(cols[dateIdx >= 0 ? dateIdx : 0] ?? ''),
      title: description,
      amount: Math.abs(amount),
      currency: 'EUR',
      type,
      bank: 'CIC',
      suggestedCategory: category,
      suggestedSubCategory: subCategory,
      needsReview,
      notes: '',
    })
  }
  return out
}

function parseCaisseEpargneCSV(lines: string[], userRules: ImportRule[] = []): ImportedTransaction[] {
  const sep = detectSep(lines[0])
  const header = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/['"]/g, ''))

  const dateIdx   = header.findIndex(h => h === 'date' || h.startsWith('date '))
  const amountIdx = header.findIndex(h => h.includes('montant'))
  const labelIdx  = header.findIndex(h => h.includes('libellé') || h.includes('libelle'))

  const out: ImportedTransaction[] = []
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue
    const cols = splitLine(line, sep)
    if (cols.length < 3) continue

    const amount = parseAmount(cols[amountIdx >= 0 ? amountIdx : 2] ?? '')
    if (amount === 0) continue

    const description = cols[labelIdx >= 0 ? labelIdx : 3] ?? ''
    if (isCurrencyExchange(description)) continue
    const type = amount < 0 ? 'debit' : 'credit'
    const { category, subCategory, needsReview } = classify(description, userRules, type)

    out.push({
      id: uuid(),
      date: parseDate(cols[dateIdx >= 0 ? dateIdx : 0] ?? ''),
      title: description,
      amount: Math.abs(amount),
      currency: 'EUR',
      type,
      bank: "Caisse d'Épargne",
      suggestedCategory: category,
      suggestedSubCategory: subCategory,
      needsReview,
      notes: '',
    })
  }
  return out
}

function parseUBSLines(lines: string[], userRules: ImportRule[] = []): ImportedTransaction[] {
  const sep = detectSep(lines[0])
  const header = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/['"]/g, ''))

  const dateIdx   = header.findIndex(h => h.includes('buchungs') || h === 'date' || h === 'datum')
  const descIdx   = header.findIndex(h => h.includes('buchungstext') || h.includes('description') || h.includes('text'))
  const debitIdx  = header.findIndex(h => h.includes('belastung') || h === 'debit' || h.includes('ausgabe'))
  const creditIdx = header.findIndex(h => h.includes('gutschrift') || h === 'credit' || h.includes('einnahme'))

  const out: ImportedTransaction[] = []
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue
    const cols = splitLine(line, sep)
    if (cols.length < 3) continue

    const debit  = debitIdx  >= 0 ? parseAmount(cols[debitIdx]  ?? '') : 0
    const credit = creditIdx >= 0 ? parseAmount(cols[creditIdx] ?? '') : 0
    if (debit === 0 && credit === 0) continue

    const description = cols[descIdx >= 0 ? descIdx : 2] ?? ''
    if (isCurrencyExchange(description)) continue
    const type = debit > 0 ? 'debit' : 'credit'
    const { category, subCategory, needsReview } = classify(description, userRules, type)

    out.push({
      id: uuid(),
      date: parseDate(cols[dateIdx >= 0 ? dateIdx : 0] ?? ''),
      title: description,
      amount: debit > 0 ? debit : credit,
      currency: 'CHF',
      type,
      bank: 'UBS',
      suggestedCategory: category,
      suggestedSubCategory: subCategory,
      needsReview,
      notes: '',
    })
  }
  return out
}

function parseGenericLines(lines: string[], bankName: string, userRules: ImportRule[] = []): ImportedTransaction[] {
  const sep = detectSep(lines[0])
  const header = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/['"]/g, ''))

  const dateIdx   = header.findIndex(h => h === 'date' || h.includes('date'))
  const amountIdx = header.findIndex(h => ['amount', 'montant', 'betrag', 'somme'].some(k => h.includes(k)))
  const labelIdx  = header.findIndex(h => ['description', 'libellé', 'libelle', 'text', 'label', 'memo', 'narration', 'reference'].some(k => h.includes(k)))

  if (amountIdx < 0) return []

  const out: ImportedTransaction[] = []
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue
    const cols = splitLine(line, sep)
    if (cols.length < 2) continue

    const amount = parseAmount(cols[amountIdx] ?? '')
    if (amount === 0) continue

    const description = labelIdx >= 0 ? (cols[labelIdx] ?? '') : (cols[1] ?? '')
    if (isCurrencyExchange(description)) continue
    const type = amount < 0 ? 'debit' : 'credit'
    const { category, subCategory, needsReview } = classify(description, userRules, type)

    out.push({
      id: uuid(),
      date: parseDate(cols[dateIdx >= 0 ? dateIdx : 0] ?? ''),
      title: description,
      amount: Math.abs(amount),
      currency: 'EUR',
      type,
      bank: bankName,
      suggestedCategory: category,
      suggestedSubCategory: subCategory,
      needsReview,
      notes: '',
    })
  }
  return out
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * True when `text` is the start of a Revolut CSV/Excel export (FR or EN
 * header). Lets the import screen route Revolut files whose filename carries a
 * misleading numeric suffix (e.g. "Revolut_04.2026", read as a ".2026"
 * extension) to the CSV parser instead of the PDF parser. Content-based on
 * purpose, so it never affects the real UBS/CIC PDF statements.
 */
export function looksLikeRevolutCsv(text: string): boolean {
  const firstLine = (text.split(/\r?\n/, 1)[0] ?? '').toLowerCase()
  const hasCompletedDate = firstLine.includes('date de fin') || firstLine.includes('completed date')
  const hasAmount = firstLine.includes('montant') || firstLine.includes('amount')
  const hasCurrency = firstLine.includes('devise') || firstLine.includes('currency')
  return hasCompletedDate && hasAmount && hasCurrency
}

export function importFromCSV(text: string, fileName: string, userRules: ImportRule[] = []): BankImportResult {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return { bank: 'generic', bankName: 'Import', transactions: [] }

  const format = detectFormat(lines[0])
  switch (format) {
    case 'revolut':       return { bank: format, bankName: 'Revolut',             transactions: parseRevolutCSV(lines, userRules) }
    case 'cic':           return { bank: format, bankName: 'CIC',                 transactions: parseCICCSV(lines, userRules) }
    case 'caisse_epargne':return { bank: format, bankName: "Caisse d'Épargne",    transactions: parseCaisseEpargneCSV(lines, userRules) }
    case 'ubs':           return { bank: format, bankName: 'UBS',                 transactions: parseUBSLines(lines, userRules) }
    default: {
      const name = fileName.replace(/\.(csv|tsv|txt)$/i, '')
      return { bank: format, bankName: name, transactions: parseGenericLines(lines, name, userRules) }
    }
  }
}

// ── JSON import ────────────────────────────────────────────────────────────
// Accepts either a bare array of transaction-like objects, or an object that
// wraps the array under a common key (transactions / expenses / data / items).
// Field names are matched flexibly (EN/FR), so it ingests both the app's own
// export and generic third-party JSON dumps.
export function importFromJSON(text: string, fileName: string, userRules: ImportRule[] = []): BankImportResult {
  let parsed: any
  try {
    parsed = JSON.parse(text)
  } catch {
    return { bank: 'generic', bankName: 'Import', transactions: [] }
  }

  // Locate the array of records
  let arr: any[] | null = null
  if (Array.isArray(parsed)) arr = parsed
  else if (parsed && typeof parsed === 'object') {
    for (const key of ['transactions', 'expenses', 'data', 'items', 'operations', 'records']) {
      if (Array.isArray(parsed[key])) { arr = parsed[key]; break }
    }
  }
  if (!arr) return { bank: 'generic', bankName: 'Import', transactions: [] }

  const name = fileName.replace(/\.json$/i, '') || 'Import'

  const pick = (obj: any, keys: string[]): any => {
    for (const k of Object.keys(obj)) {
      const lk = k.toLowerCase()
      if (keys.some(want => lk === want || lk.includes(want))) return obj[k]
    }
    return undefined
  }

  const out: ImportedTransaction[] = []
  for (const rec of arr) {
    if (!rec || typeof rec !== 'object') continue

    const rawDate = pick(rec, ['date', 'datum'])
    const rawAmount = pick(rec, ['amount', 'montant', 'betrag', 'somme', 'value'])
    const rawTitle = pick(rec, ['title', 'description', 'libellé', 'libelle', 'label', 'text', 'memo', 'name'])
    const rawCurrency = pick(rec, ['currency', 'devise'])
    const rawType = pick(rec, ['type'])

    const amountNum = typeof rawAmount === 'number' ? rawAmount : parseAmount(String(rawAmount ?? ''))
    if (!amountNum) continue

    const description = String(rawTitle ?? name)
    if (isCurrencyExchange(description, typeof rawType === 'string' ? rawType : undefined)) continue

    const currency = (String(rawCurrency ?? 'EUR').trim().toUpperCase() || 'EUR') as CurrencyCode

    // Type: explicit debit/credit string wins, otherwise sign of the amount
    let txType: 'debit' | 'credit'
    const t = String(rawType ?? '').toLowerCase()
    if (t === 'debit' || t === 'credit') txType = t
    else txType = amountNum < 0 ? 'debit' : 'credit'

    const { category, subCategory, needsReview } = classify(description, userRules, txType)

    out.push({
      id: uuid(),
      date: parseDate(String(rawDate ?? '')),
      title: description,
      amount: Math.abs(amountNum),
      currency,
      type: txType,
      bank: name,
      suggestedCategory: category,
      suggestedSubCategory: subCategory,
      needsReview,
      notes: '',
    })
  }

  return { bank: 'generic', bankName: name, transactions: out }
}

/**
 * Extract visual text rows from a pdf.js document. Items on the same visual
 * line (snapped to an 8-unit y-grid) are joined left-to-right; rows are ordered
 * top-to-bottom. Every step is defensive so a single malformed page/item can
 * never throw and abort the whole import.
 *
 * Also returns a short per-page `diagnostics` string (page count, item/row
 * counts, or the error for failed pages) so a "no text extracted" failure can
 * be reported back with enough detail to debug without browser devtools.
 */
export async function extractPdfText(pdf: any): Promise<{ text: string; diagnostics: string }> {
  type Item = { str: string; x: number; y: number }
  const pageTexts: string[] = []
  const pageInfo: string[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    let content: any
    try {
      const page = await pdf.getPage(i)
      content = await page.getTextContent()
    } catch (e) {
      const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
      const frame = e instanceof Error && e.stack
        ? e.stack.split('\n')[1]?.match(/[\w.-]+\.m?js:\d+:\d+/)?.[0]
        : undefined
      pageInfo.push(`p${i}:err(${msg}${frame ? ` @${frame}` : ''})`)
      console.warn('[pdf] page', i, 'failed', e)
      continue
    }

    const rawItems: any[] = content && Array.isArray(content.items) ? content.items : []
    const items: Item[] = []
    for (const it of rawItems) {
      if (!it || typeof it.str !== 'string' || !Array.isArray(it.transform)) continue
      items.push({
        str: it.str,
        x: Math.round(Number(it.transform[4]) || 0),
        y: Math.round(Number(it.transform[5]) || 0),
      })
    }

    const byY = new Map<number, Item[]>()
    for (const it of items) {
      const yKey = Math.round(it.y / 8) * 8
      const row = byY.get(yKey)
      if (row) row.push(it)
      else byY.set(yKey, [it])
    }

    const rows = Array.from(byY.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([, row]) => row.sort((a, b) => a.x - b.x).map(it => it.str).join(' ').trim())
      .filter(Boolean)
    pageTexts.push(rows.join('\n'))
    pageInfo.push(`p${i}:items=${rawItems.length},valid=${items.length},rows=${rows.length}`)
  }

  return { text: pageTexts.join('\n'), diagnostics: `v${__APP_VERSION__} pages=${pdf.numPages} ${pageInfo.join(' ')}` }
}

/**
 * Lazily set up pdf.js exactly once. We deliberately do NOT spin up a real
 * Worker: importing the worker module directly into the main thread sets
 * `globalThis.pdfjsWorker.WorkerMessageHandler`, which makes pdf.js use its
 * "fake worker" (a same-realm `LoopbackPort`) instead of postMessage-ing
 * across a real Worker. This is the same code path our Node test suite uses
 * (where these PDFs parse fine) and avoids a structured-clone-related crash
 * inside `getTextContent()` seen on iOS Safari with a real classic Worker.
 * The import is dynamic so this module stays free of Vite-only syntax at the
 * top level (keeps it importable by Node/vitest for unit-testing the parsers).
 */
let pdfjsLibPromise: Promise<any> | null = null
async function getPdfjs(): Promise<any> {
  if (pdfjsLibPromise) return pdfjsLibPromise
  pdfjsLibPromise = (async () => {
    const pdfjsLib = await import('pdfjs-dist')
    try {
      await import('pdfjs-dist/build/pdf.worker.min.mjs')
    } catch (e) {
      console.warn('[pdf] worker module preload failed', e)
    }
    return pdfjsLib
  })()
  return pdfjsLibPromise
}

export async function importFromPDF(buffer: ArrayBuffer, fileName: string, userRules: ImportRule[] = []): Promise<BankImportResult> {
  const pdfjsLib = await getPdfjs()
  console.log('[pdf] start | buffer:', buffer.byteLength, 'bytes')

  const standardFontDataUrl = import.meta.env.BASE_URL + 'standard_fonts/'
  let pdf: any
  try {
    pdf = await pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      standardFontDataUrl,
      // Don't fail the whole parse over font/eval issues
      isEvalSupported: false,
      useSystemFonts: true,
    }).promise
  } catch (e) {
    console.error('[pdf] getDocument failed', e)
    throw new Error('PDF_PARSE_FAILED')
  }
  console.log('[pdf] pages:', pdf.numPages)

  const { text: fullText, diagnostics } = await extractPdfText(pdf)
  console.log('[pdf] total text chars:', fullText.length, '| sample:', fullText.slice(0, 300).replace(/\n/g, ' ↵ '), '| diag:', diagnostics)

  // If pdf.js returned no text at all, the PDF is image-only/scanned (or the
  // worker failed) — surface a clear, distinct error (with diagnostics) instead
  // of a generic "0 transactions" message.
  if (fullText.replace(/\s/g, '').length === 0) {
    throw new Error(`PDF_NO_TEXT|${diagnostics}`)
  }

  const bankName = fileName.replace(/\.pdf$/i, '')

  // Try to detect bank from text content. Identify the ISSUER from letterhead
  // markers, not transaction payee names — a UBS statement may list
  // "Revolut Bank UAB" as a counterparty, which must NOT flip detection to
  // Revolut (that would mislabel the bank and use EUR instead of CHF).
  const lower = fullText.toLowerCase()
  if (lower.includes('ubs switzerland') || lower.includes('www.ubs.com')) return parsePDFTransactions(fullText, 'UBS', userRules)
  if (lower.includes('revolut')) return parsePDFTransactions(fullText, 'Revolut', userRules)
  if (lower.includes('cic') || lower.includes('crédit industriel')) return parsePDFTransactions(fullText, 'CIC', userRules)
  if (lower.includes('caisse d\'épargne') || lower.includes('caisse d epargne')) return parsePDFTransactions(fullText, "Caisse d'Épargne", userRules)
  if (lower.includes('ubs')) return parsePDFTransactions(fullText, 'UBS', userRules)
  if (lower.includes('lcl') || lower.includes('le crédit lyonnais')) return parsePDFTransactions(fullText, 'LCL', userRules)
  if (lower.includes('bnp') || lower.includes('banque nationale de paris')) return parsePDFTransactions(fullText, 'BNP', userRules)
  if (lower.includes('société générale') || lower.includes('societe generale')) return parsePDFTransactions(fullText, 'Société Générale', userRules)

  return parsePDFTransactions(fullText, bankName, userRules)
}

// A line is a candidate transaction if it starts with (optional tiny prefix then) a date.
// The optional \S{0,2}\s* handles footnote markers like "2 " or "X " before the date.
const DATE_RE = /^\s*\S{0,2}\s*(\d{1,2}[\/.\-]\d{1,2}(?:[\/.\-]\d{2,4})?|\d{4}-\d{2}-\d{2})/

// Amount anywhere in a string: requires exactly 2 decimal digits (reduces false positives).
// Supports: 1'234.56 (Swiss), 1 234,56 (French), 1.234,56 (German), 45.60, -2.30, etc.
// Optional trailing currency code (CHF, EUR …) before end-of-string.
const AMOUNT_RE = /([+-]?\s*\d{1,3}(?:['\s,.]\d{3})*[,.]\d{2})\s*(?:CHF|EUR|USD|GBP|€)?$/i

// Trailing value date found in UBS statements: "Description   -amount   DD.MM.YYYY"
// We strip this so AMOUNT_RE can find the real amount just before it.
const TRAILING_DATE_RE = /\s+\d{2}[\/.\-]\d{2}[\/.\-]\d{4}\s*$/

// Money token (Swiss apostrophe thousands, dot/comma decimals), matched
// globally. UBS full statements list "amount  running-balance" on one line, so
// we need every token to tell the transaction amount (first) from the balance.
const UBS_MONEY_RE = /([+-]?\d{1,3}(?:['’]\d{3})*[.,]\d{2})/g

// Matches any date-like token — used without anchor to locate dates inside a line.
const DATE_TOKEN_RE = /\d{1,2}[\/.\-]\d{1,2}(?:[\/.\-]\d{2,4})?|\d{4}-\d{2}-\d{2}/

export function parsePDFTransactions(text: string, bankName: string, userRules: ImportRule[] = []): BankImportResult {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const transactions: ImportedTransaction[] = []

  const yearMatch = text.match(/\b(20\d{2})\b/)
  const documentYear = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear()
  const dateLines = lines.filter(l => DATE_RE.test(l) && DATE_TOKEN_RE.test(l))
  console.log('[pdf] bank:', bankName, '| lines:', lines.length, '| date-lines:', dateLines.length, '| year:', documentYear)

  // UBS → CHF, all others default to EUR
  const currency: CurrencyCode = bankName === 'UBS' ? 'CHF' : 'EUR'

  // CIC statements list amounts as unsigned positive values — direction comes from description keywords
  const isCICFormat = bankName === 'CIC'

  // CIC puts the merchant name on the line *below* the amount line
  // (e.g. "SPOTIFY FRANCE   CARTE 3935"). We merge that into the description so
  // auto-categorisation works as well as it does for Excel/CSV imports.
  let lastTxn: ImportedTransaction | null = null
  let lastTxnMerged = false

  for (const line of lines) {
    const isDateLine = DATE_RE.test(line) && DATE_TOKEN_RE.test(line)

    if (!isDateLine) {
      // Continuation line — for CIC, fold the merchant detail (which sits on the
      // line directly below the amount) into the previous txn. We only ever look
      // at the single immediate continuation line to avoid swallowing footer text.
      if (isCICFormat && lastTxn && !lastTxnMerged) {
        lastTxnMerged = true   // consume our one-shot look, success or not
        const cont = line
          .replace(/\bCARTE\s+\d+\b/i, '')                                            // "CARTE 3935"
          .replace(/\s+\d{1,3}(?:[',\s]\d{3})*[,.]\d+\s*(?:CHF|EUR|USD|GBP|€)?\s*$/i, '') // stray amounts
          .trim()
        // Only merge merchant-like text (has letters), skip pure refs / totals / IBAN lines
        if (cont && /[a-zA-Zà-ÿ]/.test(cont) && !/^(IBAN|QXBAN|R[ée]f\b|SOLDE|TOTAL|N°)/i.test(cont)) {
          const combined = `${lastTxn.title} ${cont}`.trim()
          lastTxn.title = combined
          const c = classify(combined, userRules, lastTxn.type)
          lastTxn.suggestedCategory = c.category
          lastTxn.suggestedSubCategory = c.subCategory
          lastTxn.needsReview = c.needsReview
        }
      }
      continue
    }

    const dateMatch = line.match(DATE_TOKEN_RE)
    if (!dateMatch) continue
    const date = parseDate(dateMatch[0], documentYear)

    // UBS lines end with a second "value date" — strip it before looking for the amount
    const lineForAmount = TRAILING_DATE_RE.test(line)
      ? line.replace(TRAILING_DATE_RE, '')
      : line

    let amount: number
    let description: string

    if (bankName === 'UBS') {
      // UBS lines: "transDate  description  amount  [running balance]". The FIRST
      // money token after the date is the transaction amount; any LATER token is
      // the running balance (Solde) and must be ignored — otherwise the balance
      // is read as the amount and the real amount leaks into the description.
      const afterDate = lineForAmount.slice(dateMatch.index! + dateMatch[0].length)
      const tokens = [...afterDate.matchAll(UBS_MONEY_RE)]
      if (tokens.length === 0) continue
      amount = parseAmount(tokens[0][1])
      if (amount === 0) continue
      description = afterDate.slice(0, tokens[0].index).trim() || bankName
    } else {
      const amountMatch = lineForAmount.match(AMOUNT_RE)
      if (!amountMatch) continue
      amount = parseAmount(amountMatch[1])
      if (amount === 0) continue

      // Description: text after the first date, before the amount, minus leading value date
      const afterDate = lineForAmount.slice(dateMatch.index! + dateMatch[0].length)
      description = afterDate
        .replace(AMOUNT_RE, '')
        // strip leading value date (CIC: "op_date  val_date  Description  amount")
        .replace(/^\s*\d{1,2}[\/.\-]\d{1,2}(?:[\/.\-]\d{2,4})?\s*/, '')
        // strip residual "foreign_amount CURRENCY" on cross-currency CIC lines (e.g. "475,04   CHF")
        .replace(/\s+\d{1,3}(?:[',\s]\d{3})*[,.]\d+\s*(?:CHF|EUR|USD|GBP|€)\s*$/i, '')
        .trim() || bankName
    }

    if (isCurrencyExchange(description)) {
      lastTxn = null
      continue
    }

    // CIC: unsigned amounts — infer debit/credit from description prefix
    // UBS: amounts are already signed (negative = debit)
    let txType: 'debit' | 'credit'
    if (isCICFormat) {
      const dl = description.toLowerCase()
      txType = (dl.startsWith('vir ') || dl.startsWith('virement') || dl.startsWith('remboursement'))
        ? 'credit'
        : 'debit'
    } else {
      txType = amount < 0 ? 'debit' : 'credit'
    }

    const { category, subCategory, needsReview } = classify(description, userRules, txType)

    const txn: ImportedTransaction = {
      id: uuid(),
      date,
      title: description,
      amount: Math.abs(amount),
      currency,
      type: txType,
      bank: bankName,
      suggestedCategory: category,
      suggestedSubCategory: subCategory,
      needsReview,
      notes: '',
    }
    transactions.push(txn)
    lastTxn = txn
    lastTxnMerged = false
  }

  return { bank: 'generic', bankName, transactions }
}

export async function importFromXLSX(buffer: ArrayBuffer, fileName: string, userRules: ImportRule[] = []): Promise<BankImportResult> {
  const XLSX = await import('xlsx')
  const wb = XLSX.read(buffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false, defval: '' })

  if (rows.length < 2) return { bank: 'generic', bankName: 'Import', transactions: [] }

  // Convert rows to tab-separated lines for detection + reuse existing parsers
  const lines = rows.map(row => row.join('\t'))
  const format = detectFormat(lines[0])
  const bankName = fileName.replace(/\.xlsx?$/i, '')

  switch (format) {
    case 'revolut':       return { bank: format, bankName: 'Revolut',             transactions: parseRevolutCSV(lines, userRules) }
    case 'ubs':           return { bank: format, bankName: 'UBS',                 transactions: parseUBSLines(lines, userRules) }
    case 'caisse_epargne':return { bank: format, bankName: "Caisse d'Épargne",    transactions: parseCaisseEpargneCSV(lines, userRules) }
    default:              return { bank: format, bankName,                         transactions: parseGenericLines(lines, bankName, userRules) }
  }
}
