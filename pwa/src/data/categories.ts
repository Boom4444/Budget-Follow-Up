import type { CategoryId } from '../models/types'

export interface CategoryMeta {
  id: CategoryId
  label: string
  emoji: string
  color: string
  bgColor: string
  isFixed: boolean
}

export const CATEGORIES: CategoryMeta[] = [
  // --- Incompressibles ---
  { id: 'rent',          label: 'Loyer / Prêt immo',        emoji: '🏠', color: '#2563eb', bgColor: '#dbeafe', isFixed: true },
  { id: 'homeInsurance', label: 'Assurance habitation',      emoji: '🛡️', color: '#4f46e5', bgColor: '#e0e7ff', isFixed: true },
  { id: 'healthInsurance',label: 'Mutuelle / Santé',         emoji: '❤️', color: '#db2777', bgColor: '#fce7f3', isFixed: true },
  { id: 'electricity',   label: 'Électricité / Gaz',         emoji: '⚡', color: '#d97706', bgColor: '#fef3c7', isFixed: true },
  { id: 'water',         label: 'Eau',                       emoji: '💧', color: '#0891b2', bgColor: '#cffafe', isFixed: true },
  { id: 'internet',      label: 'Internet / Box',            emoji: '📶', color: '#7c3aed', bgColor: '#ede9fe', isFixed: true },
  { id: 'mobile',        label: 'Téléphone mobile',          emoji: '📱', color: '#0d9488', bgColor: '#ccfbf1', isFixed: true },
  { id: 'carInsurance',  label: 'Assurance voiture',         emoji: '🚗', color: '#ea580c', bgColor: '#ffedd5', isFixed: true },
  { id: 'loanRepayment', label: 'Remboursement crédit',      emoji: '💳', color: '#dc2626', bgColor: '#fee2e2', isFixed: true },
  { id: 'taxes',         label: 'Impôts / Taxes',            emoji: '🏛️', color: '#92400e', bgColor: '#fef3c7', isFixed: true },
  // --- Variables ---
  { id: 'groceries',     label: 'Alimentation / Courses',    emoji: '🛒', color: '#16a34a', bgColor: '#dcfce7', isFixed: false },
  { id: 'transport',     label: 'Transport / Carburant',     emoji: '⛽', color: '#ea580c', bgColor: '#ffedd5', isFixed: false },
  { id: 'health',        label: 'Santé / Pharmacie',         emoji: '💊', color: '#dc2626', bgColor: '#fee2e2', isFixed: false },
  { id: 'clothing',      label: 'Vêtements',                 emoji: '👗', color: '#db2777', bgColor: '#fce7f3', isFixed: false },
  { id: 'leisure',       label: 'Loisirs / Sorties',         emoji: '🎉', color: '#7c3aed', bgColor: '#ede9fe', isFixed: false },
  { id: 'restaurants',   label: 'Restaurants / Cafés',       emoji: '🍽️', color: '#ea580c', bgColor: '#ffedd5', isFixed: false },
  { id: 'travel',        label: 'Vacances / Voyages',        emoji: '✈️', color: '#2563eb', bgColor: '#dbeafe', isFixed: false },
  { id: 'culture',       label: 'Culture / Divertissement',  emoji: '🎬', color: '#92400e', bgColor: '#fef3c7', isFixed: false },
  { id: 'sport',         label: 'Sport / Fitness',           emoji: '🏃', color: '#16a34a', bgColor: '#dcfce7', isFixed: false },
  { id: 'gifts',         label: 'Cadeaux',                   emoji: '🎁', color: '#dc2626', bgColor: '#fee2e2', isFixed: false },
  { id: 'children',      label: 'Enfants / Éducation',       emoji: '🎒', color: '#d97706', bgColor: '#fef3c7', isFixed: false },
  { id: 'savings',       label: 'Épargne',                   emoji: '🐷', color: '#16a34a', bgColor: '#dcfce7', isFixed: false },
  { id: 'homeImprovement',label: 'Maison / Entretien',       emoji: '🔧', color: '#6b7280', bgColor: '#f3f4f6', isFixed: false },
  { id: 'subscriptions', label: 'Abonnements',               emoji: '🔄', color: '#7c3aed', bgColor: '#ede9fe', isFixed: false },
  { id: 'other',         label: 'Autre',                     emoji: '📦', color: '#6b7280', bgColor: '#f3f4f6', isFixed: false },
]

export const CATEGORY_MAP = Object.fromEntries(
  CATEGORIES.map(c => [c.id, c])
) as Record<CategoryId, CategoryMeta>

export const FIXED_CATEGORIES = CATEGORIES.filter(c => c.isFixed)
export const VARIABLE_CATEGORIES = CATEGORIES.filter(c => !c.isFixed)
