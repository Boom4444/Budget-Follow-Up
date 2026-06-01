import { v4 as uuid } from 'uuid'
import type { CurrencyCode } from '../models/types'

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
}

export interface BankImportResult {
  bank: BankFormat
  bankName: string
  transactions: ImportedTransaction[]
}

// ── Keyword → category classifier ────────────────────────────────────────────

const KEYWORD_RULES: Array<{ keywords: string[]; category: string; subCategory: string }> = [
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
]

const EXCHANGE_PATTERNS = [
  /^exchanged? (to|from) [a-z]{3}/i,
  /^currency exchange/i,
  /^fx (conversion|fee)/i,
  /^change de devises/i,
  /^bureau de change/i,
]

function isCurrencyExchange(desc: string, revolut_type?: string): boolean {
  if (revolut_type?.toLowerCase() === 'exchange') return true
  return EXCHANGE_PATTERNS.some(p => p.test(desc.trim()))
}

function classify(description: string): { category: string; subCategory: string; needsReview: boolean } {
  const lower = description.toLowerCase()
  for (const rule of KEYWORD_RULES) {
    if (rule.keywords.some(k => lower.includes(k))) {
      return { category: rule.category, subCategory: rule.subCategory, needsReview: false }
    }
  }
  return { category: 'autre', subCategory: 'Divers', needsReview: true }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseDate(raw: string): string {
  raw = raw.trim().replace(/^["']|["']$/g, '')
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10)
  const dmy = raw.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4})/)
  if (dmy) {
    const d = dmy[1].padStart(2, '0')
    const m = dmy[2].padStart(2, '0')
    let y = parseInt(dmy[3])
    if (y < 100) y += 2000
    return `${y}-${m}-${d}`
  }
  return new Date().toISOString().slice(0, 10)
}

function parseAmount(raw: string): number {
  return parseFloat(
    raw
      .replace(/−/g, '-')  // Unicode minus → ASCII minus (Revolut)
      .replace(/['"]/g, '')
      .replace(',', '.')
      .replace(/\s/g, '')
  ) || 0
}

function detectSep(line: string): string {
  if (line.includes(';')) return ';'
  if (line.includes('\t')) return '\t'
  return ','
}

function detectFormat(header: string): BankFormat {
  const h = header.toLowerCase()
  if (h.includes('completed date') || h.includes('started date')) return 'revolut'
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

function parseRevolutCSV(lines: string[]): ImportedTransaction[] {
  const sep = detectSep(lines[0])
  const header = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/['"]/g, ''))
  const col = (name: string) => header.indexOf(name)

  const dateIdx    = col('completed date') !== -1 ? col('completed date') : col('started date')
  const descIdx    = col('description')
  const amountIdx  = col('amount')
  const currencyIdx= col('currency')
  const stateIdx   = col('state')
  const typeIdx = col('type')

  const out: ImportedTransaction[] = []
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue
    const cols = splitLine(line, sep)
    if (cols.length < 5) continue
    if (stateIdx >= 0 && (cols[stateIdx] ?? '').toLowerCase() !== 'completed') continue
    const txType = typeIdx >= 0 ? (cols[typeIdx] ?? '').toLowerCase() : ''; if (txType === 'exchange') continue

    const amount = parseAmount(cols[amountIdx] ?? '')
    if (amount === 0) continue

    const currency = ((cols[currencyIdx] ?? 'EUR').trim().toUpperCase()) as CurrencyCode
    const description = cols[descIdx] ?? ''
    if (isCurrencyExchange(description, cols[typeIdx] ?? '')) continue
    const { category, subCategory, needsReview } = classify(description)

    out.push({
      id: uuid(),
      date: parseDate(cols[dateIdx] ?? ''),
      title: description,
      amount: Math.abs(amount),
      currency,
      type: amount < 0 ? 'debit' : 'credit',
      bank: 'Revolut',
      suggestedCategory: category,
      suggestedSubCategory: subCategory,
      needsReview,
    })
  }
  return out
}

function parseCICCSV(lines: string[]): ImportedTransaction[] {
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
    const { category, subCategory, needsReview } = classify(description)

    out.push({
      id: uuid(),
      date: parseDate(cols[dateIdx >= 0 ? dateIdx : 0] ?? ''),
      title: description,
      amount: Math.abs(amount),
      currency: 'EUR',
      type: amount < 0 ? 'debit' : 'credit',
      bank: 'CIC',
      suggestedCategory: category,
      suggestedSubCategory: subCategory,
      needsReview,
    })
  }
  return out
}

function parseCaisseEpargneCSV(lines: string[]): ImportedTransaction[] {
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
    const { category, subCategory, needsReview } = classify(description)

    out.push({
      id: uuid(),
      date: parseDate(cols[dateIdx >= 0 ? dateIdx : 0] ?? ''),
      title: description,
      amount: Math.abs(amount),
      currency: 'EUR',
      type: amount < 0 ? 'debit' : 'credit',
      bank: "Caisse d'Épargne",
      suggestedCategory: category,
      suggestedSubCategory: subCategory,
      needsReview,
    })
  }
  return out
}

function parseUBSLines(lines: string[]): ImportedTransaction[] {
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
    const { category, subCategory, needsReview } = classify(description)

    out.push({
      id: uuid(),
      date: parseDate(cols[dateIdx >= 0 ? dateIdx : 0] ?? ''),
      title: description,
      amount: debit > 0 ? debit : credit,
      currency: 'CHF',
      type: debit > 0 ? 'debit' : 'credit',
      bank: 'UBS',
      suggestedCategory: category,
      suggestedSubCategory: subCategory,
      needsReview,
    })
  }
  return out
}

function parseGenericLines(lines: string[], bankName: string): ImportedTransaction[] {
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
    const { category, subCategory, needsReview } = classify(description)

    out.push({
      id: uuid(),
      date: parseDate(cols[dateIdx >= 0 ? dateIdx : 0] ?? ''),
      title: description,
      amount: Math.abs(amount),
      currency: 'EUR',
      type: amount < 0 ? 'debit' : 'credit',
      bank: bankName,
      suggestedCategory: category,
      suggestedSubCategory: subCategory,
      needsReview,
    })
  }
  return out
}

// ── Public API ────────────────────────────────────────────────────────────────

export function importFromCSV(text: string, fileName: string): BankImportResult {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return { bank: 'generic', bankName: 'Import', transactions: [] }

  const format = detectFormat(lines[0])
  switch (format) {
    case 'revolut':       return { bank: format, bankName: 'Revolut',             transactions: parseRevolutCSV(lines) }
    case 'cic':           return { bank: format, bankName: 'CIC',                 transactions: parseCICCSV(lines) }
    case 'caisse_epargne':return { bank: format, bankName: "Caisse d'Épargne",    transactions: parseCaisseEpargneCSV(lines) }
    case 'ubs':           return { bank: format, bankName: 'UBS',                 transactions: parseUBSLines(lines) }
    default: {
      const name = fileName.replace(/\.(csv|tsv|txt)$/i, '')
      return { bank: format, bankName: name, transactions: parseGenericLines(lines, name) }
    }
  }
}

export async function importFromXLSX(buffer: ArrayBuffer, fileName: string): Promise<BankImportResult> {
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
    case 'revolut':       return { bank: format, bankName: 'Revolut',             transactions: parseRevolutCSV(lines) }
    case 'ubs':           return { bank: format, bankName: 'UBS',                 transactions: parseUBSLines(lines) }
    case 'caisse_epargne':return { bank: format, bankName: "Caisse d'Épargne",    transactions: parseCaisseEpargneCSV(lines) }
    default:              return { bank: format, bankName,                         transactions: parseGenericLines(lines, bankName) }
  }
}
