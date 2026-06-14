// @vitest-environment jsdom
/**
 * Tests UI/UX : on monte les vrais écrans (Tableau de bord, Budget) avec le
 * jeu de données 2 personnes (public/demo-foyer.json) et on vérifie que les
 * montants AFFICHÉS correspondent aux montants calculés à la main —
 * répartition personne / foyer comprise.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, fireEvent, cleanup, type RenderResult } from '@testing-library/react'
import DashboardScreen from '../screens/DashboardScreen'
import BudgetScreen from '../screens/BudgetScreen'
import { useStore } from '../store/useStore'
import { parseJSONBackup } from '../utils/backup'
import demoRaw from '../../public/demo-foyer.json'
import type { Expense, MonthlyBudget, RecurringExpense, AppSettings } from '../models/types'

// jsdom n'implémente ni ResizeObserver (recharts) ni matchMedia
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  })
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: false, media: q, addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false,
  }))

  const backup = parseJSONBackup(JSON.stringify(demoRaw))!
  useStore.setState(s => ({
    expenses: backup.expenses as Expense[],
    recurring: backup.recurring as RecurringExpense[],
    budgets: backup.budgets as MonthlyBudget[],
    settings: { ...s.settings, ...(backup.settings as AppSettings) },
  }))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

/** Texte de la page avec espaces normalisées (Intl insère des espaces fines) */
function txt(r: RenderResult): string {
  return r.container.textContent!.replace(/[\s  ]+/g, ' ')
}

/** Texte (normalisé) de la carte contenant `label` */
function card(r: RenderResult, label: string | RegExp): string {
  const el = r.getByText(label)
  return el.closest('.card')!.textContent!.replace(/[\s  ]+/g, ' ')
}

describe('Tableau de bord — vue Foyer, juin 2026', () => {
  function renderJuin(): RenderResult {
    const r = render(<DashboardScreen />)
    fireEvent.click(r.getByText('Jun'))
    return r
  }

  it('affiche dépenses 3 300, revenus 10 000, solde +6 700', () => {
    const r = renderJuin()
    const page = txt(r)
    expect(page).toContain('3 300,00 Fr')   // total dépenses
    expect(page).toContain('10 000,00 Fr')  // total revenus
    expect(page).toContain('+6 700 Fr')     // solde
  })

  it('cartes par personne : Alex 1 890 (dont 1 640 commun), Sam 1 410 (dont 1 160 commun)', () => {
    const r = renderJuin()
    const alex = card(r, /👤 Alex/)
    expect(alex).toContain('1 890,00 Fr')
    expect(alex).toContain('dont 1 640,00 Fr commun')
    const sam = card(r, /👤 Sam/)
    expect(sam).toContain('1 410,00 Fr')
    expect(sam).toContain('dont 1 160,00 Fr commun')
  })

  it('suivi du budget : 3 300 dépensés sur 4 000 (83 %), rien hors budget', () => {
    const r = renderJuin()
    const budget = card(r, /Suivi du budget/)
    expect(budget).toContain('3 300,00 Fr')
    expect(budget).toContain('sur 4 000,00 Fr · 83%')
    expect(budget).not.toContain('hors catégories budgétisées')
  })
})

describe('Tableau de bord — filtre par personne, juin 2026', () => {
  function renderFiltre(person: string): RenderResult {
    const r = render(<DashboardScreen />)
    fireEvent.click(r.getByText('Jun'))
    fireEvent.click(r.getByRole('button', { name: person }))
    return r
  }

  it("vue Alex : dépenses 1 890 (sa part du commun incluse), budget 1 890 sur 2 430", () => {
    const r = renderFiltre('Alex')
    expect(txt(r)).toContain('1 890,00 Fr')
    const budget = card(r, /Suivi du budget/)
    expect(budget).toContain('1 890,00 Fr')
    expect(budget).toContain('sur 2 430,00 Fr')
    expect(budget).toContain('prorata des revenus')
  })

  it('vue Sam : dépenses 1 410, budget 1 410 sur 1 570', () => {
    const r = renderFiltre('Sam')
    const budget = card(r, /Suivi du budget/)
    expect(budget).toContain('1 410,00 Fr')
    expect(budget).toContain('sur 1 570,00 Fr')
  })

  it('vue Commun : dépenses 2 800, budget 2 800 sur 2 800', () => {
    const r = renderFiltre('Commun')
    const budget = card(r, /Suivi du budget/)
    expect(budget).toContain('2 800,00 Fr')
    expect(budget).toContain('sur 2 800,00 Fr')
  })

  it('COHÉRENCE AFFICHAGE : Alex (1 890) + Sam (1 410) = Foyer (3 300)', () => {
    // Les trois vues affichent des montants dont la somme doit boucler
    expect(1890 + 1410).toBe(3300)
    const alex = renderFiltre('Alex')
    expect(txt(alex)).toContain('1 890,00 Fr')
    cleanup()
    const sam = renderFiltre('Sam')
    expect(txt(sam)).toContain('1 410,00 Fr')
  })
})

describe('Écran Budget — juin 2026 (mois courant)', () => {
  it('onglet Alex : prévu 2 430, réel 1 890, mention des 60 % du foyer', () => {
    const r = render(<BudgetScreen />)
    const page = txt(r)
    expect(page).toContain('Juin 2026')
    expect(page).toContain('2 430,00 Fr')   // dépenses prévues (750 + 60 % de 2 800)
    expect(page).toContain('1 890,00 Fr')   // dépenses réelles
    expect(page).toContain('Inclut 60% du budget foyer (prorata des revenus)')
    expect(page).toContain('6 000,00 Fr')   // revenus prévus Alex
  })

  it('onglet Sam : prévu 1 570, réel 1 410', () => {
    const r = render(<BudgetScreen />)
    fireEvent.click(r.getByRole('button', { name: 'Sam' }))
    const page = txt(r)
    expect(page).toContain('1 570,00 Fr')
    expect(page).toContain('1 410,00 Fr')
    expect(page).toContain('Inclut 40% du budget foyer')
  })

  it('onglet Foyer : prévu 2 800, réel 2 800 (pas de double comptage)', () => {
    const r = render(<BudgetScreen />)
    fireEvent.click(r.getByRole('button', { name: 'Foyer' }))
    const page = txt(r)
    expect(page).toContain('2 800,00 Fr')
    expect(page).not.toContain('Inclut')
  })

  it('suivi Alex : le loyer affiche 1 200 / 1 200 (part au prorata)', () => {
    const r = render(<BudgetScreen />)
    fireEvent.click(r.getByRole('button', { name: 'Suivi' }))
    const row = r.getAllByText('Logement')
      .map(el => el.closest('button'))
      .find(btn => btn?.textContent?.includes('1 200,00'))
    expect(row, 'ligne Logement du suivi').toBeTruthy()
    const rowText = row!.textContent!.replace(/[\s  ]+/g, ' ')
    expect(rowText).toContain('1 200,00 Fr / 1 200,00 Fr')
  })

  it('catégories de Réglages (ajout, renommage, suppression) reflétées dans Planifier', () => {
    useStore.setState(s => ({
      settings: {
        ...s.settings,
        customCategories: [
          ...(s.settings.customCategories ?? []),
          { id: 'custom_animaux', label: 'Animaux', emoji: '🐾', isFixed: false },
          { id: 'loisirs', label: 'Sorties', emoji: '🎊', isFixed: false },
        ],
        deletedBuiltinCategories: [...(s.settings.deletedBuiltinCategories ?? []), 'sport'],
      },
    }))
    const r = render(<BudgetScreen />)
    const page = txt(r)
    expect(page).toContain('Animaux')             // nouvelle catégorie personnalisée
    expect(page).toContain('Sorties')             // libellé personnalisé pour "loisirs"
    expect(page).not.toContain('Loisirs')         // ancien libellé masqué
    expect(page).not.toContain('Sport & Fitness') // catégorie supprimée absente
  })
})
