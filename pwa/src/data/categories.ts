import type { CustomCategoryDef } from '../models/types'

export interface CategoryMeta {
  id: string
  label: string
  emoji: string
  color: string
  bgColor: string
  isFixed: boolean
  subCategories: string[]
}

export const CATEGORIES: CategoryMeta[] = [
  // ── Charges fixes ──────────────────────────────────────────────────────────
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
    subCategories: ['Maladie (Lamal)', 'Maladie (Complémentaire)', 'Habitation', 'Auto', 'Autres Assurance'],
  },
  {
    id: 'logement',
    label: 'Logement',
    emoji: '🏠',
    color: '#0f766e',
    bgColor: '#ccfbf1',
    isFixed: true,
    subCategories: ['Loyer + Charges', 'Loyer Suisse', 'Location Logement', 'Eau / Électricité / Gaz'],
  },
  // ── Charges courantes ──────────────────────────────────────────────────────
  {
    id: 'nourriture',
    label: 'Alimentation',
    emoji: '🍽️',
    color: '#16a34a',
    bgColor: '#dcfce7',
    isFixed: false,
    subCategories: ['Courses', 'Restaurant', 'Livraison', 'Café / Boulangerie', 'Autres Nourriture'],
  },
  {
    id: 'transport',
    label: 'Transport',
    emoji: '🚗',
    color: '#ea580c',
    bgColor: '#ffedd5',
    isFixed: false,
    subCategories: ['Péages', 'Essence', 'SNCF / Train', 'Métro / Bus', 'VTC / Taxi', 'Autres Transport'],
  },
  {
    id: 'abonnements',
    label: 'Abonnements',
    emoji: '🔄',
    color: '#7c3aed',
    bgColor: '#ede9fe',
    isFixed: false,
    subCategories: ['Téléphone', 'Streaming', 'Spotify', 'ChatGPT', 'Canal+', 'Internet', 'Presse', 'Autres Abonnements'],
  },
  {
    id: 'sante',
    label: 'Santé',
    emoji: '🏥',
    color: '#e11d48',
    bgColor: '#ffe4e6',
    isFixed: false,
    subCategories: ['Médecin', 'Pharmacie', 'Dentiste', 'Opticien', 'Kiné / Ostéo', 'Autres Santé'],
  },
  {
    id: 'loisirs',
    label: 'Loisirs',
    emoji: '🎉',
    color: '#db2777',
    bgColor: '#fce7f3',
    isFixed: false,
    subCategories: ['Voyage', 'Bars', 'Alcool', 'Activité / Sortie', 'Cinéma', 'Jeux / Jeux vidéo', 'Autres Loisirs'],
  },
  {
    id: 'sport',
    label: 'Sport & Fitness',
    emoji: '🏋️',
    color: '#d97706',
    bgColor: '#fef3c7',
    isFixed: false,
    subCategories: ['Inscription / Abonnement', 'Équipement', 'Coaching', 'Compétition', 'Autres Sport'],
  },
  {
    id: 'habillement',
    label: 'Habillement',
    emoji: '👗',
    color: '#8b5cf6',
    bgColor: '#f5f3ff',
    isFixed: false,
    subCategories: ['Vêtements', 'Chaussures', 'Accessoires', 'Lingerie', 'Autres Habillement'],
  },
  {
    id: 'beaute',
    label: 'Beauté & Hygiène',
    emoji: '💄',
    color: '#c026d3',
    bgColor: '#fdf4ff',
    isFixed: false,
    subCategories: ['Coiffeur', 'Cosmétiques', 'Hygiène', 'Soins / Spa', 'Autres Beauté'],
  },
  {
    id: 'maison',
    label: 'Maison & Équipement',
    emoji: '🏡',
    color: '#0891b2',
    bgColor: '#e0f2fe',
    isFixed: false,
    subCategories: ['Meubles', 'Électroménager', 'Déco', 'Bricolage', 'Jardinage', 'Autres Maison'],
  },
  {
    id: 'besoinsPersonnels',
    label: 'Besoins Personnels',
    emoji: '👤',
    color: '#0369a1',
    bgColor: '#e0f2fe',
    isFixed: false,
    subCategories: ['Livres / Éducation', 'High-Tech', 'Divers', 'Autres Besoins'],
  },
  {
    id: 'cadeaux',
    label: 'Cadeaux & Famille',
    emoji: '🎁',
    color: '#dc2626',
    bgColor: '#fee2e2',
    isFixed: false,
    subCategories: ['Famille', 'Couple', 'Amis', 'Revenus Supplémentaires', 'Autres Cadeaux'],
  },
  {
    id: 'entreprise',
    label: 'Entreprise / Pro',
    emoji: '💼',
    color: '#374151',
    bgColor: '#f3f4f6',
    isFixed: false,
    subCategories: ['Salaire', 'Repas Travail', 'Transport Travail', 'Matériel Pro', 'Autres Pro'],
  },
  {
    id: 'autre',
    label: 'Autre',
    emoji: '📦',
    color: '#6b7280',
    bgColor: '#f9fafb',
    isFixed: false,
    subCategories: ['Divers'],
  },
]

export const CATEGORY_MAP = Object.fromEntries(
  CATEGORIES.map(c => [c.id, c])
) as Record<string, CategoryMeta>

export const FIXED_CATEGORIES = CATEGORIES.filter(c => c.isFixed)
export const VARIABLE_CATEGORIES = CATEGORIES.filter(c => !c.isFixed)

export function getCategoryMeta(
  id: string,
  customCategories: CustomCategoryDef[] = [],
): CategoryMeta | undefined {
  if (CATEGORY_MAP[id]) return CATEGORY_MAP[id]
  const custom = customCategories.find(c => c.id === id)
  if (!custom) return undefined
  return {
    id: custom.id,
    label: custom.label,
    emoji: custom.emoji,
    color: '#6b7280',
    bgColor: '#f3f4f6',
    isFixed: custom.isFixed,
    subCategories: [],
  }
}
