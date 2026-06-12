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
  // ── Revenus (income) ────────────────────────────────────────────────────────
  {
    id: 'revenus',
    label: 'Revenus',
    emoji: '💰',
    color: '#15803d',
    bgColor: '#dcfce7',
    isFixed: false,
    subCategories: ['Salaire', 'Prime / Bonus', 'Don / Cadeau', 'Remboursement global', 'Autre'],
  },
  // ── Charges courantes ──────────────────────────────────────────────────────
  {
    id: 'nourriture',
    label: 'Courses',
    emoji: '🛒',
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
    subCategories: ['Repas Travail', 'Transport Travail', 'Matériel Pro', 'Autres Pro'],
  },
  {
    id: 'autre',
    label: 'Autre',
    emoji: '📦',
    color: '#6b7280',
    bgColor: '#f9fafb',
    isFixed: false,
    subCategories: ['Divers', 'Frais bancaires', 'Prêt'],
  },
  {
    id: 'a_classer',
    label: 'À classer',
    emoji: '🏷️',
    color: '#b45309',
    bgColor: '#fef3c7',
    isFixed: false,
    subCategories: ['Non classé'],
  },
]

export const CATEGORY_MAP = Object.fromEntries(
  CATEGORIES.map(c => [c.id, c])
) as Record<string, CategoryMeta>

export const FIXED_CATEGORIES   = CATEGORIES.filter(c => c.isFixed)
// Expense categories only — excludes the income 'revenus' category and system 'a_classer'
export const VARIABLE_CATEGORIES = CATEGORIES.filter(c => !c.isFixed && c.id !== 'revenus' && c.id !== 'a_classer')
export const REVENUS_CATEGORY    = CATEGORIES.find(c => c.id === 'revenus')!

export function getCategoryMeta(
  id: string,
  customCategories: CustomCategoryDef[] = [],
): CategoryMeta | undefined {
  const override = customCategories.find(c => c.id === id)
  const builtin = CATEGORY_MAP[id]

  if (builtin && override) {
    // User renamed/re-emojied a built-in category — keep sub-categories and colors
    return { ...builtin, label: override.label, emoji: override.emoji }
  }
  if (builtin) return builtin
  if (override) {
    return {
      id: override.id,
      label: override.label,
      emoji: override.emoji,
      color: '#6b7280',
      bgColor: '#f3f4f6',
      isFixed: override.isFixed,
      subCategories: [],
    }
  }
  return undefined
}

/**
 * Returns all active (non-deleted) categories sorted alphabetically,
 * applying custom label/emoji overrides for built-ins.
 * The 'a_classer' system category always appears last.
 */
export function getActiveCategories(
  customCategories: CustomCategoryDef[] = [],
  deletedBuiltinCategoryIds: string[] = [],
): { id: string; label: string; emoji: string; isFixed: boolean }[] {
  const deletedSet = new Set(deletedBuiltinCategoryIds)
  // Expense categories: exclude 'revenus' and 'a_classer' from the sorted body
  const builtinRows = CATEGORIES
    .filter(c => c.id !== 'a_classer' && c.id !== 'revenus' && !deletedSet.has(c.id))
    .map(c => {
      const ov = customCategories.find(o => o.id === c.id)
      return { id: c.id, label: ov?.label ?? c.label, emoji: ov?.emoji ?? c.emoji, isFixed: c.isFixed }
    })
  const newCustom = customCategories
    .filter(c => !CATEGORY_MAP[c.id])
    .map(c => ({ id: c.id, label: c.label, emoji: c.emoji, isFixed: c.isFixed }))
  const sorted = [...builtinRows, ...newCustom]
    .sort((a, b) => a.label.localeCompare(b.label, 'fr'))
  // 'Revenus' always first, 'À classer' always last
  const revOv = customCategories.find(o => o.id === 'revenus')
  sorted.unshift({ id: 'revenus', label: revOv?.label ?? 'Revenus', emoji: revOv?.emoji ?? '💰', isFixed: false })
  sorted.push({ id: 'a_classer', label: 'À classer', emoji: '🏷️', isFixed: false })
  return sorted
}
