/**
 * Tests du jeu de démonstration (src/data/demoData.ts) : transactions réelles
 * 01.01 → 12.07.2026, générées depuis le tableau de suivi Excel avec trois
 * adaptations : « Abonnement » fusionné dans « Abonnements », salaires classés
 * en revenus/Salaire, remboursements conservés dans la catégorie de la dépense
 * d'origine (note explicitant le rattachement).
 *
 * Les attendus chiffrés ont été recalculés indépendamment depuis le fichier
 * source — si une ligne de DEMO_EXPENSE_ROWS change, le test correspondant
 * échoue immédiatement.
 */

import { describe, it, expect } from 'vitest'
import { convertToBase, EUR_RATES } from '../data/currencies'
import { CATEGORY_MAP, CATEGORIES } from '../data/categories'
import { DEMO_EXPENSE_ROWS, DEMO_RECURRING } from '../data/demoData'
import { useStore } from '../store/useStore'

// Accès nommé aux colonnes du tuple
const col = {
  date: 0, bank: 1, category: 2, subCategory: 3, type: 4,
  amount: 5, currency: 6, isFixed: 7, title: 8, person: 9, notes: 10,
} as const
const get = (r: (typeof DEMO_EXPENSE_ROWS)[number], k: keyof typeof col) => r[col[k]]

const rows = DEMO_EXPENSE_ROWS
const credits = rows.filter(r => get(r, 'type') === 'credit')
const debits  = rows.filter(r => get(r, 'type') === 'debit')

// ─── Devises & conversion ─────────────────────────────────────────────────────

describe('Conversion de devises', () => {
  it('1 EUR = 0.96 CHF (taux de référence)', () => {
    expect(EUR_RATES['CHF']).toBe(0.96)
    expect(EUR_RATES['EUR']).toBe(1)
  })

  it('convertToBase CHF→CHF retourne le même montant', () => {
    expect(convertToBase(2530, 'CHF', 'CHF')).toBe(2530)
  })

  it('convertToBase EUR→CHF : 535.67 EUR ≈ 514.24 CHF', () => {
    expect(convertToBase(535.67, 'EUR', 'CHF')).toBeCloseTo(514.24, 1)
  })
})

// ─── Catégories intégrées ─────────────────────────────────────────────────────

describe('Catégories', () => {
  it('19 catégories au total', () => {
    expect(CATEGORIES).toHaveLength(19)
  })

  it('banque a les sous-catégories Prêt, Frais Carte et Frais Bancaires', () => {
    expect(CATEGORY_MAP['banque'].subCategories).toEqual(['Prêt', 'Frais Carte', 'Frais Bancaires'])
  })

  it('revenus a Salaire ; entreprise a Repas Travail et Pressing', () => {
    expect(CATEGORY_MAP['revenus'].subCategories).toContain('Salaire')
    expect(CATEGORY_MAP['entreprise'].subCategories).toContain('Repas Travail')
    expect(CATEGORY_MAP['entreprise'].subCategories).toContain('Pressing')
  })

  it('les catégories incompressibles sont : banque, impots, assurance, logement', () => {
    const fixed = CATEGORIES.filter(c => c.isFixed).map(c => c.id)
    expect(fixed).toEqual(expect.arrayContaining(['banque', 'impots', 'assurance', 'logement']))
    expect(fixed).not.toContain('nourriture')
  })
})

// ─── Intégrité globale du jeu de démo ────────────────────────────────────────

describe('Jeu de démo — intégrité', () => {
  it('687 transactions (01.01 → 12.07.2026)', () => {
    expect(rows).toHaveLength(687)
    expect(rows.every(r => get(r, 'date') >= '2026-01-01' && get(r, 'date') <= '2026-07-12')).toBe(true)
  })

  it('40 crédits, 647 débits', () => {
    expect(credits).toHaveLength(40)
    expect(debits).toHaveLength(647)
  })

  it('toutes les catégories existent dans CATEGORY_MAP (aucun « Abonnement » orphelin)', () => {
    const used = new Set(rows.map(r => get(r, 'category')))
    for (const cat of used) {
      expect(CATEGORY_MAP[cat as string], `Catégorie manquante : ${cat}`).toBeDefined()
    }
  })

  it('aucune sous-catégorie vide, uniquement banques UBS/Revolut/CIC, devises CHF/EUR', () => {
    expect(rows.every(r => (get(r, 'subCategory') as string).length > 0)).toBe(true)
    expect(new Set(rows.map(r => get(r, 'bank')))).toEqual(new Set(['UBS', 'Revolut', 'CIC']))
    expect(new Set(rows.map(r => get(r, 'currency')))).toEqual(new Set(['CHF', 'EUR']))
  })

  it('impôts et assurances toujours incompressibles ; montants tous positifs', () => {
    expect(rows.filter(r => get(r, 'category') === 'impots').every(r => get(r, 'isFixed') === true)).toBe(true)
    expect(rows.filter(r => get(r, 'category') === 'assurance').every(r => get(r, 'isFixed') === true)).toBe(true)
    expect(rows.every(r => (get(r, 'amount') as number) > 0)).toBe(true)
  })
})

// ─── Adaptation (b) : salaires en revenus ────────────────────────────────────

describe('Salaires classés en revenus/Salaire', () => {
  const salaires = rows.filter(r => get(r, 'category') === 'revenus' && get(r, 'subCategory') === 'Salaire')

  it('6 salaires Pictet (janv → juin), tous crédits CHF', () => {
    expect(salaires).toHaveLength(6)
    expect(salaires.every(r => get(r, 'type') === 'credit' && get(r, 'currency') === 'CHF' && get(r, 'title') === 'Pictet')).toBe(true)
  })

  it('total des salaires : 62 827.52 CHF (recalculé du fichier source)', () => {
    const total = salaires.reduce((s, r) => s + (get(r, 'amount') as number), 0)
    expect(total).toBeCloseTo(62827.52, 2)
  })

  it("plus aucun salaire dans la catégorie entreprise", () => {
    expect(rows.filter(r => get(r, 'category') === 'entreprise' && /salaire/i.test(get(r, 'subCategory') as string))).toHaveLength(0)
  })

  it('dons/prêts remboursés par Maman classés en revenus (2000 + 200 CHF)', () => {
    const maman = rows.filter(r => get(r, 'title') === 'Maman' && get(r, 'type') === 'credit')
    expect(maman).toHaveLength(2)
    const byAmount = Object.fromEntries(maman.map(r => [get(r, 'amount'), get(r, 'subCategory')]))
    expect(byAmount[2000]).toBe('Remboursement global')
    expect(byAmount[200]).toBe('Don / Cadeau')
    expect(maman.every(r => get(r, 'category') === 'revenus')).toBe(true)
  })
})

// ─── Adaptation (c) : remboursements dans la catégorie d'origine ─────────────

describe('Remboursements rattachés à la dépense d\'origine', () => {
  it('12 remboursements restés en nourriture (restos partagés), 10 en entreprise', () => {
    expect(credits.filter(r => get(r, 'category') === 'nourriture')).toHaveLength(12)
    expect(credits.filter(r => get(r, 'category') === 'entreprise')).toHaveLength(10)
  })

  it('chaque crédit hors revenus porte une note de rattachement (« Remboursement… »)', () => {
    const nonRevenus = credits.filter(r => get(r, 'category') !== 'revenus')
    expect(nonRevenus.length).toBeGreaterThan(0)
    for (const r of nonRevenus) {
      expect(get(r, 'notes'), `note manquante: ${get(r, 'title')}`).toMatch(/rembours|retour|twint/i)
    }
  })

  it('exemple : remboursement Alexandre Keusen 44 CHF en nourriture/Restaurant', () => {
    const r = credits.find(r => get(r, 'title') === 'Alexandre Keusen' && get(r, 'amount') === 44)
    expect(r).toBeDefined()
    expect(get(r!, 'category')).toBe('nourriture')
    expect(get(r!, 'subCategory')).toBe('Restaurant')
  })
})

// ─── Lignes de référence (recalculées indépendamment du fichier source) ───────

describe('Lignes de référence', () => {
  it('7 loyers Comptoir Immobilier à 2530 CHF, incompressibles', () => {
    const loyers = rows.filter(r => get(r, 'title') === 'Comptoir Immobilier')
    expect(loyers).toHaveLength(7)
    expect(loyers.every(r => get(r, 'amount') === 2530 && get(r, 'isFixed') === true && get(r, 'category') === 'logement')).toBe(true)
  })

  it('7 acomptes d\'impôts Etat à 1611 CHF', () => {
    const impots = rows.filter(r => get(r, 'title') === 'Etat')
    expect(impots).toHaveLength(7)
    expect(impots.every(r => get(r, 'amount') === 1611 && get(r, 'category') === 'impots')).toBe(true)
  })

  it('7 primes Sanitas (Lamal) et 183 repas travail Pictet en débit', () => {
    expect(rows.filter(r => get(r, 'title') === 'Sanitas')).toHaveLength(7)
    expect(rows.filter(r => get(r, 'subCategory') === 'Repas Travail' && get(r, 'type') === 'debit')).toHaveLength(183)
  })

  it('90 transactions en janvier, 43 en juillet (mois partiel)', () => {
    expect(rows.filter(r => (get(r, 'date') as string).startsWith('2026-01'))).toHaveLength(90)
    expect(rows.filter(r => (get(r, 'date') as string).startsWith('2026-07'))).toHaveLength(43)
  })

  it('11 factures Salt classées abonnements/Téléphone', () => {
    const salt = rows.filter(r => get(r, 'title') === 'Salt')
    expect(salt).toHaveLength(11)
    expect(salt.every(r => get(r, 'category') === 'abonnements' && get(r, 'subCategory') === 'Téléphone')).toBe(true)
  })
})

// ─── Récurrentes de démo ──────────────────────────────────────────────────────

describe('Récurrentes de démo', () => {
  it('contient les charges mensuelles clés (loyer, impôts, Lamal, prêt)', () => {
    const titles = DEMO_RECURRING.map(r => r.title)
    expect(titles).toEqual(expect.arrayContaining(['Comptoir Immobilier', 'Etat', 'Sanitas', 'LCL']))
  })

  it('toutes les récurrentes pointent vers des catégories valides', () => {
    for (const r of DEMO_RECURRING) {
      expect(CATEGORY_MAP[r.category], `Catégorie manquante : ${r.category}`).toBeDefined()
    }
  })
})

// ─── Chargement dans le store ─────────────────────────────────────────────────

describe('loadDemoData()', () => {
  it('charge 687 dépenses avec amountInBase converti et updatedAt stampé', () => {
    useStore.getState().loadDemoData()
    const { expenses, recurring } = useStore.getState()
    expect(expenses).toHaveLength(687)
    expect(recurring.length).toBeGreaterThanOrEqual(4)
    expect(expenses.every(e => e.amountInBase > 0)).toBe(true)
    expect(expenses.every(e => typeof e.updatedAt === 'number')).toBe(true)
    // conversion EUR → base CHF appliquée
    const eur = expenses.find(e => e.currency === 'EUR')!
    expect(eur.amountInBase).toBeCloseTo(convertToBase(eur.amount, 'EUR', 'CHF'), 5)
  })
})
