import type { CategoryId } from '../models/types'

export interface CategoryMeta {
  id: CategoryId
  label: string
  emoji: string
  color: string
  bgColor: string
  isFixed: boolean
  subCategories: string[]
}

export const CATEGORIES: CategoryMeta[] = [
  {
    id: 'banque',
    label: 'Banque',
    emoji: '🏦',
    color: '#1d4ed8',
    bgColor: '#dbeafe',
    isFixed: true,
    subCategories: ['Prêt', 'Frais Carte'],
  },
  {
    id: 'impots',
    label: 'Impôts & Administratif',
    emoji: '🏛️',
    color: '#92400e',
    bgColor: '#fef3c7',
    isFixed: true,
    subCategories: ['Global', 'Acompte'],
  },
  {
    id: 'assurance',
    label: 'Assurance',
    emoji: '🛡️',
    color: '#4f46e5',
    bgColor: '#e0e7ff',
    isFixed: true,
    subCategories: ['Maladie (Lamal)', 'Maladie (Complémentaire)'],
  },
  {
    id: 'logement',
    label: 'Logement',
    emoji: '🏠',
    color: '#0f766e',
    bgColor: '#ccfbf1',
    isFixed: true,
    subCategories: ['Loyer + Charges', 'Loyer Suisse', 'Location Logement'],
  },
  {
    id: 'abonnements',
    label: 'Abonnements',
    emoji: '🔄',
    color: '#7c3aed',
    bgColor: '#ede9fe',
    isFixed: false,
    subCategories: ['Spotify', 'ChatGPT', 'Canal+', 'Téléphone', 'Autres'],
  },
  {
    id: 'transport',
    label: 'Transport',
    emoji: '🚗',
    color: '#ea580c',
    bgColor: '#ffedd5',
    isFixed: false,
    subCategories: ['Péages', 'Essence', 'SNCF', 'Autres Transport'],
  },
  {
    id: 'nourriture',
    label: 'Nourriture',
    emoji: '🍽️',
    color: '#16a34a',
    bgColor: '#dcfce7',
    isFixed: false,
    subCategories: ['Courses', 'Restaurant', 'Autres Nourriture'],
  },
  {
    id: 'loisirs',
    label: 'Loisirs',
    emoji: '🎉',
    color: '#db2777',
    bgColor: '#fce7f3',
    isFixed: false,
    subCategories: ['Voyage', 'Bars', 'Alcool', 'Activité/Sortie', 'Autres Loisirs', 'Location Logement'],
  },
  {
    id: 'besoinsPersonnels',
    label: 'Besoins Personnels',
    emoji: '👤',
    color: '#0891b2',
    bgColor: '#cffafe',
    isFixed: false,
    subCategories: ['Livres/Education', 'Autres Besoins'],
  },
  {
    id: 'cadeaux',
    label: 'Cadeaux',
    emoji: '🎁',
    color: '#dc2626',
    bgColor: '#fee2e2',
    isFixed: false,
    subCategories: ['Famille', 'Angèle', 'Revenus Supplémentaires', 'Autres Cadeaux'],
  },
  {
    id: 'entreprise',
    label: 'Entreprise',
    emoji: '💼',
    color: '#374151',
    bgColor: '#f3f4f6',
    isFixed: false,
    subCategories: ['Salaire', 'Restaurant Travail', 'Transport Travail'],
  },
]

export const CATEGORY_MAP = Object.fromEntries(
  CATEGORIES.map(c => [c.id, c])
) as Record<CategoryId, CategoryMeta>

export const FIXED_CATEGORIES = CATEGORIES.filter(c => c.isFixed)
export const VARIABLE_CATEGORIES = CATEGORIES.filter(c => !c.isFixed)
