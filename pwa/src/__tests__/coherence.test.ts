/**
 * Batterie de cohérence sur le jeu de données de test à 2 personnes
 * (public/demo-foyer.json — importable dans l'app).
 *
 * Vérifie que les montants saisis et les montants affichés concordent,
 * en particulier la répartition personne / foyer :
 *  - part d'Alex + part de Sam = total foyer (dépenses ET budgets)
 *  - prorata des revenus correct et variable selon le mois
 *  - le suivi de budget du tableau de bord (computeBudgetTracking,
 *    le code de production) donne les valeurs calculées à la main
 */
import { describe, it, expect } from 'vitest'
import demoRaw from '../../public/demo-foyer.json'
import { parseJSONBackup } from '../utils/backup'
import { incomeRatioForMonth, splitRatioOf, personShareFraction } from '../utils/split'
import { computeBudgetTracking } from '../utils/budgetTracking'
import { getCategoryMeta } from '../data/categories'
import type { Expense, MonthlyBudget, AppSettings } from '../models/types'

const backup = parseJSONBackup(JSON.stringify(demoRaw))!
const expenses = backup.expenses as Expense[]
const budgets = backup.budgets as MonthlyBudget[]
const settings = backup.settings as AppSettings   // sharedSplitMode: 'income'

const ofMonth = (m: number) => expenses.filter(e => e.date.startsWith(`2026-${String(m).padStart(2, '0')}`))
const debits  = (list: Expense[]) => list.filter(e => e.type === 'debit')
const credits = (list: Expense[]) => list.filter(e => e.type === 'credit' && e.category === 'revenus')
const sum = (list: Expense[], f: (e: Expense) => number = e => e.amountInBase) =>
  list.reduce((s, e) => s + f(e), 0)
const personTotal = (list: Expense[], p: 'person1' | 'person2') =>
  sum(debits(list), e => e.amountInBase * personShareFraction(e, p, budgets, settings))

describe('demo-foyer.json — validité du fichier', () => {
  it('se parse comme une sauvegarde restaurable', () => {
    expect(backup).not.toBeNull()
    expect(expenses).toHaveLength(16)
    expect(backup.recurring).toHaveLength(2)
    expect(budgets).toHaveLength(6)
  })

  it('toutes les catégories et sous-catégories existent', () => {
    for (const e of expenses) {
      const meta = getCategoryMeta(e.category)
      expect(meta, `catégorie inconnue : ${e.category}`).toBeDefined()
      expect(meta!.subCategories, `sous-catégorie de ${e.title}`).toContain(e.subCategory)
    }
  })

  it('chaque répartition explicite somme à 100 %', () => {
    for (const e of expenses.filter(e => e.splitRatio)) {
      expect(e.splitRatio!.person1 + e.splitRatio!.person2).toBe(100)
    }
  })

  it('montants en base = montants saisis (tout est en CHF)', () => {
    for (const e of expenses) {
      expect(e.currency).toBe('CHF')
      expect(e.amountInBase).toBe(e.amount)
    }
  })
})

describe('prorata des revenus (change chaque mois)', () => {
  it('juin 2026 : 6000/4000 → 60/40', () => {
    expect(incomeRatioForMonth(budgets, 2026, 6)).toEqual({ person1: 60, person2: 40 })
  })

  it('mai 2026 : 5000/5000 → 50/50', () => {
    expect(incomeRatioForMonth(budgets, 2026, 5)).toEqual({ person1: 50, person2: 50 })
  })

  it('le loyer (splitMode income) se répartit 1200/800 en juin et 1000/1000 en mai', () => {
    const juin = expenses.find(e => e.id === 'demo-e01')!
    const mai  = expenses.find(e => e.id === 'demo-e12')!
    expect(splitRatioOf(juin, budgets, settings)).toEqual({ person1: 60, person2: 40 })
    expect(splitRatioOf(mai, budgets, settings)).toEqual({ person1: 50, person2: 50 })
    expect(juin.amountInBase * personShareFraction(juin, 'person1', budgets, settings)).toBe(1200)
    expect(juin.amountInBase * personShareFraction(juin, 'person2', budgets, settings)).toBe(800)
    expect(mai.amountInBase * personShareFraction(mai, 'person1', budgets, settings)).toBe(1000)
  })
})

describe('cohérence dépenses : personne vs foyer', () => {
  it('juin : foyer 3300, Alex 1890, Sam 1410, revenus 10000, solde +6700', () => {
    const juin = ofMonth(6)
    expect(sum(debits(juin))).toBe(3300)
    expect(personTotal(juin, 'person1')).toBeCloseTo(1890, 6)
    expect(personTotal(juin, 'person2')).toBeCloseTo(1410, 6)
    expect(sum(credits(juin))).toBe(10000)
    expect(sum(credits(juin)) - sum(debits(juin))).toBe(6700)
  })

  it('mai : foyer 2500, Alex 1300, Sam 1200', () => {
    const mai = ofMonth(5)
    expect(sum(debits(mai))).toBe(2500)
    expect(personTotal(mai, 'person1')).toBeCloseTo(1300, 6)
    expect(personTotal(mai, 'person2')).toBeCloseTo(1200, 6)
  })

  it('INVARIANT : part Alex + part Sam = total foyer, pour chaque dépense et chaque mois', () => {
    for (const e of debits(expenses)) {
      const p1 = e.amountInBase * personShareFraction(e, 'person1', budgets, settings)
      const p2 = e.amountInBase * personShareFraction(e, 'person2', budgets, settings)
      expect(p1 + p2, `répartition de ${e.title} (${e.date})`).toBeCloseTo(e.amountInBase, 6)
    }
    for (const m of [5, 6]) {
      const mois = ofMonth(m)
      expect(personTotal(mois, 'person1') + personTotal(mois, 'person2'))
        .toBeCloseTo(sum(debits(mois)), 6)
    }
  })
})

describe('suivi du budget (code du tableau de bord)', () => {
  it('juin, vue Foyer : budget 4000, dépensé 3300, rien hors budget', () => {
    const t = computeBudgetTracking(expenses, budgets, settings, 2026, 6, 'all')!
    expect(t.totalBudgeted).toBe(4000)
    expect(t.totalActual).toBe(3300)
    expect(t.offBudget).toBe(0)
  })

  it('juin, vue Alex : budget 2430 (750 perso + 60 % de 2800 foyer), dépensé 1890', () => {
    const t = computeBudgetTracking(expenses, budgets, settings, 2026, 6, 'person1')!
    expect(t.totalBudgeted).toBeCloseTo(2430, 6)
    expect(t.totalActual).toBeCloseTo(1890, 6)
    const byId = Object.fromEntries(t.rows.map(r => [r.id, r]))
    expect(byId['logement'].budgeted).toBeCloseTo(1200, 6)   // 60 % de 2000
    expect(byId['logement'].actual).toBeCloseTo(1200, 6)
    expect(byId['nourriture'].budgeted).toBeCloseTo(760, 6)  // 400 + 60 % de 600
    expect(byId['nourriture'].actual).toBeCloseTo(420, 6)    // 120 perso + 300 de commun
    expect(byId['maison'].actual).toBeCloseTo(140, 6)        // 70 % de 200
  })

  it('juin, vue Sam : budget 1570, dépensé 1410', () => {
    const t = computeBudgetTracking(expenses, budgets, settings, 2026, 6, 'person2')!
    expect(t.totalBudgeted).toBeCloseTo(1570, 6)
    expect(t.totalActual).toBeCloseTo(1410, 6)
  })

  it('juin, vue Commun : budget 2800, dépensé 2800', () => {
    const t = computeBudgetTracking(expenses, budgets, settings, 2026, 6, 'shared')!
    expect(t.totalBudgeted).toBe(2800)
    expect(t.totalActual).toBe(2800)
  })

  it('INVARIANT : budget Alex + budget Sam = budget foyer (et idem pour le réel)', () => {
    for (const m of [5, 6] as const) {
      const all = computeBudgetTracking(expenses, budgets, settings, 2026, m, 'all')!
      const p1  = computeBudgetTracking(expenses, budgets, settings, 2026, m, 'person1')!
      const p2  = computeBudgetTracking(expenses, budgets, settings, 2026, m, 'person2')!
      expect(p1.totalBudgeted + p2.totalBudgeted).toBeCloseTo(all.totalBudgeted, 6)
      expect(p1.totalActual + p2.totalActual).toBeCloseTo(all.totalActual, 6)
    }
  })

  it('vue Année 2026 : budgets et réels cumulés (mai + juin)', () => {
    const t = computeBudgetTracking(expenses, budgets, settings, 2026, null, 'all')!
    expect(t.totalBudgeted).toBe(3450 + 4000)
    expect(t.totalActual).toBe(2500 + 3300)
  })

  it('mai : budget 3450, dépensé 2500, rien hors budget', () => {
    const t = computeBudgetTracking(expenses, budgets, settings, 2026, 5, 'all')!
    expect(t.totalBudgeted).toBe(3450)
    expect(t.totalActual).toBe(2500)
    expect(t.offBudget).toBe(0)
  })
})
