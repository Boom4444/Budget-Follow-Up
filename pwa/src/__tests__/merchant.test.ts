import { describe, it, expect } from 'vitest'
import { merchantKey, findSimilarExpenses } from '../utils/merchant'
import type { Expense } from '../models/types'

function exp(partial: Partial<Expense> & { id: string; title: string }): Expense {
  return {
    amount: 10, currency: 'CHF', amountInBase: 10, date: '2026-01-01',
    category: 'a_classer', subCategory: 'Non classé', type: 'debit',
    isFixed: false, bank: 'UBS', person: 'person1', notes: '',
    ...partial,
  }
}

describe('merchantKey', () => {
  it('normalise et retire dates/refs pour regrouper un même commerçant', () => {
    expect(merchantKey('Restaurant Pictet 05.01')).toBe(merchantKey('Restaurant Pictet 12.01'))
    expect(merchantKey('Restaurant Pictet')).toBe('restaurant pictet')
  })

  it('retourne une chaîne vide pour un libellé sans mot exploitable', () => {
    expect(merchantKey('1234')).toBe('')
  })
})

describe('findSimilarExpenses', () => {
  const list: Expense[] = [
    exp({ id: 'a', title: 'Restaurant Pictet 05.01', category: 'a_classer' }),
    exp({ id: 'b', title: 'Restaurant Pictet 12.01', category: 'a_classer' }),
    exp({ id: 'c', title: 'Restaurant Pictet 20.01', category: 'entreprise' }),
    exp({ id: 'd', title: 'Apple Pay 01.01', category: 'a_classer' }),
    exp({ id: 'e', title: 'Restaurant Pictet', type: 'credit', category: 'a_classer' }),
  ]

  it('retrouve les autres transactions du même commerçant ayant une catégorie différente', () => {
    const found = findSimilarExpenses(list, 'a', 'Restaurant Pictet 05.01', 'debit', 'entreprise')
    // b (a_classer) et c (entreprise) ? c a déjà la cible → exclu ; b inclus ; e est un crédit → exclu
    expect(found.map(e => e.id).sort()).toEqual(['b'])
  })

  it('inclut la transaction déjà classée dans une autre catégorie que la cible', () => {
    const found = findSimilarExpenses(list, 'a', 'Restaurant Pictet 05.01', 'debit', 'nourriture')
    expect(found.map(e => e.id).sort()).toEqual(['b', 'c'])
  })

  it('exclut la source, l’autre direction et un commerçant différent', () => {
    const found = findSimilarExpenses(list, 'a', 'Restaurant Pictet 05.01', 'debit', 'nourriture')
    expect(found.map(e => e.id)).not.toContain('a')  // source
    expect(found.map(e => e.id)).not.toContain('d')  // Apple Pay
    expect(found.map(e => e.id)).not.toContain('e')  // crédit
  })

  it('ne regroupe rien si le libellé ne donne pas de clé exploitable', () => {
    expect(findSimilarExpenses(list, 'x', '1234', 'debit', 'nourriture')).toEqual([])
  })
})
