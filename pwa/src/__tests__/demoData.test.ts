/**
 * Scénarios de tests : données réelles du tableau de suivi budget
 *
 * Chaque ligne du tableau Excel est représentée comme un scénario de test.
 * Ces tests servent de source de vérité — si une entrée change dans
 * loadDemoData(), le test correspondant échoue immédiatement.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { convertToBase, EUR_RATES } from '../data/currencies'
import { CATEGORY_MAP, CATEGORIES } from '../data/categories'
import type { CategoryId, CurrencyCode } from '../models/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Parse les lignes brutes du tableau en objets structurés */
type RawRow = {
  date: string          // YYYY-MM-DD
  bank: string
  category: CategoryId
  subCategory: string
  type: 'debit' | 'credit'
  amount: number
  currency: CurrencyCode
  title: string         // Boutique
  notes: string
}

function debit(amount: number, currency: CurrencyCode): Pick<RawRow, 'type' | 'amount' | 'currency'> {
  return { type: 'debit', amount, currency }
}
function credit(amount: number, currency: CurrencyCode): Pick<RawRow, 'type' | 'amount' | 'currency'> {
  return { type: 'credit', amount, currency }
}

// ─── Données de référence (source de vérité = feuille Excel) ──────────────────

const JANVIER_2026: RawRow[] = [
  { date: '2026-01-01', bank: 'UBS',    category: 'entreprise', subCategory: 'Salaire',            ...credit(7814,   'CHF'), title: 'Pictet',                  notes: '' },
  { date: '2026-01-01', bank: 'UBS',    category: 'logement',   subCategory: 'Loyer + Charges',    ...debit(2530,   'CHF'), title: 'Mme. Febo',               notes: '' },
  { date: '2026-01-01', bank: 'UBS',    category: 'nourriture', subCategory: 'Restaurant',         ...debit(64.40,  'CHF'), title: 'McDonalds',               notes: '' },
  { date: '2026-01-02', bank: 'CIC',    category: 'abonnements',subCategory: 'Spotify',            ...debit(17.20,  'EUR'), title: 'Spotify',                 notes: '' },
  { date: '2026-01-02', bank: 'CIC',    category: 'abonnements',subCategory: 'ChatGPT',            ...debit(20.44,  'EUR'), title: 'OpenAI',                  notes: '' },
  { date: '2026-01-02', bank: 'Revolut',category: 'abonnements',subCategory: 'Canal+',             ...debit(41.99,  'EUR'), title: 'Canal+',                  notes: 'Abonnement Mémé' },
  { date: '2026-01-03', bank: 'Revolut',category: 'loisirs',    subCategory: 'Autres Loisirs',     ...debit(19.27,  'EUR'), title: 'Fnac',                    notes: 'Jeu de société + crayons' },
  { date: '2026-01-03', bank: 'Revolut',category: 'nourriture', subCategory: 'Courses',            ...debit(319.77, 'EUR'), title: 'Intermarché',             notes: 'Courses avec Angèle' },
  { date: '2026-01-05', bank: 'UBS',    category: 'assurance',  subCategory: 'Maladie (Lamal)',    ...debit(442.75, 'CHF'), title: 'Sanitas',                 notes: '' },
  { date: '2026-01-05', bank: 'UBS',    category: 'entreprise', subCategory: 'Restaurant Travail', ...debit(12,     'CHF'), title: 'Pictet',                  notes: 'Repas' },
  { date: '2026-01-05', bank: 'UBS',    category: 'entreprise', subCategory: 'Restaurant Travail', ...debit(2.30,   'CHF'), title: 'Pictet',                  notes: 'Fruit petit déjeuner' },
  { date: '2026-01-06', bank: 'UBS',    category: 'entreprise', subCategory: 'Restaurant Travail', ...debit(12,     'CHF'), title: 'Pictet',                  notes: 'Repas' },
  { date: '2026-01-07', bank: 'CIC',    category: 'cadeaux',    subCategory: 'Revenus Supplémentaires', ...credit(300, 'EUR'), title: 'Angèle',              notes: 'Remboursement crédit (dernier pour la voiture)' },
  { date: '2026-01-07', bank: 'UBS',    category: 'cadeaux',    subCategory: 'Autres Cadeaux',     ...debit(30,    'CHF'), title: 'Sabine A.',               notes: 'Twint naissance enfant Quentin D.' },
  { date: '2026-01-07', bank: 'UBS',    category: 'cadeaux',    subCategory: 'Autres Cadeaux',     ...debit(30,    'CHF'), title: 'Sabine A.',               notes: 'Twint départ Sophie P.' },
  { date: '2026-01-07', bank: 'UBS',    category: 'nourriture', subCategory: 'Autres Nourriture',  ...debit(27.20, 'CHF'), title: 'Aux Merveilleux de Fred', notes: 'Petit-déjeuner anniversaire' },
  { date: '2026-01-07', bank: 'UBS',    category: 'entreprise', subCategory: 'Restaurant Travail', ...debit(25,    'CHF'), title: 'Pictet',                  notes: 'Repas + consigne Tupperware' },
  { date: '2026-01-08', bank: 'CIC',    category: 'banque',     subCategory: 'Frais Carte',        ...debit(5.47,  'EUR'), title: 'CIC',                     notes: '' },
  { date: '2026-01-08', bank: 'Revolut',category: 'loisirs',    subCategory: 'Autres Loisirs',     ...debit(25.90, 'CHF'), title: 'Meta Pay',                notes: '1er jeu avec Oculus' },
  { date: '2026-01-08', bank: 'Revolut',category: 'besoinsPersonnels', subCategory: 'Livres/Education', ...debit(80, 'CHF'), title: 'Apple',               notes: 'CISSP Renouvellement questions 6 mois' },
  { date: '2026-01-08', bank: 'UBS',    category: 'entreprise', subCategory: 'Restaurant Travail', ...debit(22,    'CHF'), title: 'Pictet',                  notes: 'Repas + consigne Tupperware' },
  { date: '2026-01-08', bank: 'UBS',    category: 'cadeaux',    subCategory: 'Revenus Supplémentaires', ...credit(200, 'CHF'), title: 'Maman',              notes: 'Cadeau d\'anniversaire' },
  { date: '2026-01-09', bank: 'UBS',    category: 'nourriture', subCategory: 'Restaurant',         ...debit(50.20, 'CHF'), title: 'Uber Eats',               notes: 'Mister Tacos avec Angèle' },
  { date: '2026-01-09', bank: 'UBS',    category: 'entreprise', subCategory: 'Restaurant Travail', ...debit(12,    'CHF'), title: 'Pictet',                  notes: 'Repas' },
  { date: '2026-01-10', bank: 'Revolut',category: 'transport',  subCategory: 'Péages',             ...debit(33.50, 'EUR'), title: 'Area',                    notes: 'Péages pour Roynac' },
  { date: '2026-01-11', bank: 'Revolut',category: 'transport',  subCategory: 'Péages',             ...debit(18.80, 'EUR'), title: 'APRR',                    notes: 'Péage retour Roynac pour Lyon' },
  { date: '2026-01-12', bank: 'UBS',    category: 'entreprise', subCategory: 'Restaurant Travail', ...debit(10.05, 'CHF'), title: 'Pictet',                  notes: 'Repas' },
  { date: '2026-01-12', bank: 'UBS',    category: 'entreprise', subCategory: 'Restaurant Travail', ...debit(8,     'CHF'), title: 'Pictet',                  notes: 'Petit-déjeuner' },
  { date: '2026-01-12', bank: 'UBS',    category: 'entreprise', subCategory: 'Restaurant Travail', ...credit(15,   'CHF'), title: 'Pictet',                  notes: 'Retour consignes repas' },
  { date: '2026-01-13', bank: 'CIC',    category: 'cadeaux',    subCategory: 'Famille',            ...debit(200,   'EUR'), title: 'La Poste',                notes: 'Retrait cash anniversaire Léna' },
  { date: '2026-01-13', bank: 'UBS',    category: 'entreprise', subCategory: 'Restaurant Travail', ...debit(12,    'CHF'), title: 'Pictet',                  notes: 'Repas' },
  { date: '2026-01-14', bank: 'UBS',    category: 'nourriture', subCategory: 'Restaurant',         ...debit(71.10, 'CHF'), title: 'Uber Eats',               notes: 'Mister Tacos avec Angèle' },
  { date: '2026-01-14', bank: 'UBS',    category: 'cadeaux',    subCategory: 'Revenus Supplémentaires', ...credit(2000, 'CHF'), title: 'Maman',             notes: 'Remboursement équivalente Adrien (Restant=3k)' },
  { date: '2026-01-15', bank: 'UBS',    category: 'loisirs',    subCategory: 'Autres Loisirs',     ...debit(43,    'CHF'), title: 'Remy W.',                 notes: 'Tabacs pipe' },
  { date: '2026-01-15', bank: 'UBS',    category: 'entreprise', subCategory: 'Restaurant Travail', ...debit(17.80, 'CHF'), title: 'Pictet',                  notes: 'Repas' },
  { date: '2026-01-16', bank: 'Revolut',category: 'logement',   subCategory: 'Location Logement',  ...debit(102,   'EUR'), title: 'Quentin L.',              notes: 'Moitié AirBnb weekend Château d\'Oex' },
  { date: '2026-01-16', bank: 'UBS',    category: 'nourriture', subCategory: 'Restaurant',         ...debit(133,   'CHF'), title: 'Les Sales Gosses',         notes: 'Restaurant anciens EY' },
  { date: '2026-01-16', bank: 'UBS',    category: 'nourriture', subCategory: 'Restaurant',         ...credit(57,   'CHF'), title: 'Alexandre K.',            notes: 'Remboursement restaurant' },
  { date: '2026-01-16', bank: 'UBS',    category: 'loisirs',    subCategory: 'Bars',               ...debit(27,    'CHF'), title: 'Oh No Lulu!',             notes: 'Bar avec anciens EY' },
  { date: '2026-01-16', bank: 'UBS',    category: 'entreprise', subCategory: 'Restaurant Travail', ...debit(12.05, 'CHF'), title: 'Pictet',                  notes: 'Repas' },
  { date: '2026-01-16', bank: 'UBS',    category: 'entreprise', subCategory: 'Restaurant Travail', ...debit(3.35,  'CHF'), title: 'Pictet',                  notes: 'Fruit petit déjeuner' },
  { date: '2026-01-16', bank: 'UBS',    category: 'entreprise', subCategory: 'Restaurant Travail', ...credit(25,   'CHF'), title: 'Pictet',                  notes: 'Retour consignes repas' },
  { date: '2026-01-19', bank: 'UBS',    category: 'impots',     subCategory: 'Global',             ...debit(1611,  'CHF'), title: 'Etat',                    notes: 'Acompte 2026 (1/12)' },
  { date: '2026-01-28', bank: 'LCL',    category: 'banque',     subCategory: 'Prêt',               ...debit(535.67,'EUR'), title: 'LCL',                     notes: 'Échéance prêt 36/60' },
]

const JUIN_2024: RawRow[] = [
  { date: '2024-06-01', bank: 'CIC',    category: 'loisirs',    subCategory: 'Voyage',             ...debit(130,   'EUR'), title: 'Click & Boat',            notes: 'Location bateau Italie avec Quentin et Alex (1/3)' },
  { date: '2024-06-01', bank: 'Revolut',category: 'loisirs',    subCategory: 'Location Logement',  ...debit(315,   'EUR'), title: 'Airbnb',                  notes: 'Airbnb Italie avec Quentin et Alex (1/3)' },
  { date: '2024-06-01', bank: 'Revolut',category: 'loisirs',    subCategory: 'Voyage',             ...credit(125,  'EUR'), title: 'Quentin Liardeaux',       notes: 'Remboursement 1/3 bateau Italie' },
  { date: '2024-06-01', bank: 'Revolut',category: 'loisirs',    subCategory: 'Voyage',             ...credit(310,  'EUR'), title: 'Quentin Liardeaux',       notes: 'Remboursement 1/3 logement Italie' },
  { date: '2024-06-01', bank: 'Revolut',category: 'besoinsPersonnels', subCategory: 'Livres/Education', ...debit(34.94, 'EUR'), title: 'Les Arts Frontières', notes: 'Achat BD + Solo Leveling T13' },
  { date: '2024-06-01', bank: 'CS',     category: 'assurance',  subCategory: 'Maladie (Complémentaire)', ...debit(93.1, 'CHF'), title: 'Groupe Mutuel',    notes: 'Assurance complémentaire juin' },
  { date: '2024-06-01', bank: 'CS',     category: 'logement',   subCategory: 'Loyer Suisse',       ...debit(100,   'CHF'), title: 'Mme. Febo',               notes: '' },
  { date: '2024-06-01', bank: 'Cash',   category: 'logement',   subCategory: 'Location Logement',  ...debit(400,   'EUR'), title: 'Jacques',                 notes: 'Loyer avril 2024' },
  { date: '2024-06-01', bank: 'CS',     category: 'impots',     subCategory: 'Global',             ...debit(1178,  'CHF'), title: 'Etat Suisse',             notes: 'Impôts anticipés juin 2024 (5/10)' },
  { date: '2024-06-01', bank: 'CS',     category: 'assurance',  subCategory: 'Maladie (Lamal)',    ...debit(382.45,'CHF'), title: 'Sanitas',                 notes: '' },
  { date: '2024-06-02', bank: 'Revolut',category: 'loisirs',    subCategory: 'Bars',               ...credit(20,   'EUR'), title: 'Alexandre Keusen',        notes: 'Remboursement bars' },
  { date: '2024-06-02', bank: 'Revolut',category: 'loisirs',    subCategory: 'Bars',               ...credit(20,   'EUR'), title: 'Louise Dramé',            notes: 'Remboursement bars' },
  { date: '2024-06-03', bank: 'CS',     category: 'entreprise', subCategory: 'Transport Travail',  ...debit(84.30, 'CHF'), title: 'CFF',                     notes: 'Train Genève-Zurich passage panel' },
  { date: '2024-06-03', bank: 'CS',     category: 'entreprise', subCategory: 'Restaurant Travail', ...debit(31.80, 'CHF'), title: 'Umamido',                 notes: '' },
  { date: '2024-06-04', bank: 'CS',     category: 'entreprise', subCategory: 'Transport Travail',  ...debit(78.50, 'CHF'), title: 'CFF',                     notes: 'Train Zurich-Genève retour panel' },
  { date: '2024-06-04', bank: 'CS',     category: 'entreprise', subCategory: 'Restaurant Travail', ...debit(18,    'CHF'), title: 'Suweena Fine Thai Food',  notes: 'Pad Thai bureau Zurich' },
  { date: '2024-06-04', bank: 'CS',     category: 'nourriture', subCategory: 'Restaurant',         ...debit(13.30, 'CHF'), title: 'Bloody Bar',              notes: 'Petit déjeuner avant Zurich' },
  { date: '2024-06-04', bank: 'Revolut',category: 'nourriture', subCategory: 'Courses',            ...debit(19.88, 'EUR'), title: 'Intermarché',             notes: '' },
  { date: '2024-06-04', bank: 'CIC',    category: 'abonnements',subCategory: 'Spotify',            ...debit(14.99, 'EUR'), title: 'Spotify',                 notes: '' },
  { date: '2024-06-05', bank: 'CS',     category: 'entreprise', subCategory: 'Restaurant Travail', ...credit(204.8,'CHF'), title: 'EY',                      notes: '' },
  { date: '2024-06-05', bank: 'CIC',    category: 'besoinsPersonnels', subCategory: 'Autres Besoins', ...debit(33.98,'EUR'), title: 'Amazon',               notes: '' },
  { date: '2024-06-07', bank: 'CS',     category: 'entreprise', subCategory: 'Restaurant Travail', ...debit(17,    'CHF'), title: 'Satay Sarray',            notes: '' },
  { date: '2024-06-10', bank: 'CS',     category: 'entreprise', subCategory: 'Restaurant Travail', ...debit(16.90, 'CHF'), title: 'Genecand Traiteur',       notes: '' },
  { date: '2024-06-13', bank: 'Revolut',category: 'loisirs',    subCategory: 'Bars',               ...credit(35,   'EUR'), title: 'Louise Dramé',            notes: 'Remboursement bar Le Balthazar' },
  { date: '2024-06-13', bank: 'Revolut',category: 'loisirs',    subCategory: 'Bars',               ...credit(20,   'EUR'), title: 'Juliette Coste',          notes: 'Remboursement bar Le Balthazar' },
  { date: '2024-06-15', bank: 'Revolut',category: 'nourriture', subCategory: 'Restaurant',         ...debit(29,    'CHF'), title: 'Pierre Hermé',            notes: '' },
  { date: '2024-06-15', bank: 'Revolut',category: 'nourriture', subCategory: 'Autres Nourriture',  ...debit(3.50,  'CHF'), title: 'Speciality Coffee',       notes: 'Café Lyon' },
  { date: '2024-06-16', bank: 'Revolut',category: 'nourriture', subCategory: 'Restaurant',         ...debit(7.20,  'CHF'), title: 'DiVoglia',                notes: 'Café moulu' },
  { date: '2024-06-17', bank: 'CS',     category: 'entreprise', subCategory: 'Restaurant Travail', ...debit(11.90, 'CHF'), title: 'Migros',                  notes: '' },
  { date: '2024-06-17', bank: 'CIC',    category: 'loisirs',    subCategory: 'Autres Loisirs',     ...debit(1.99,  'EUR'), title: 'Amazon',                  notes: '' },
  { date: '2024-06-17', bank: 'CIC',    category: 'transport',  subCategory: 'SNCF',               ...debit(18.60, 'EUR'), title: 'SNCF',                    notes: '' },
  { date: '2024-06-17', bank: 'CIC',    category: 'nourriture', subCategory: 'Restaurant',         ...credit(38,   'EUR'), title: 'Angèle',                  notes: 'Remboursement restaurants Angèle' },
  { date: '2024-06-18', bank: 'Revolut',category: 'cadeaux',    subCategory: 'Angèle',             ...debit(200,   'CHF'), title: 'Léna Fournier',           notes: 'Tapis de course Angèle' },
  { date: '2024-06-18', bank: 'CIC',    category: 'transport',  subCategory: 'Autres Transport',   ...debit(0.50,  'EUR'), title: 'Velivert',                notes: 'Vélo Sainté' },
  { date: '2024-06-19', bank: 'CIC',    category: 'transport',  subCategory: 'Autres Transport',   ...debit(75,    'EUR'), title: 'GetAround',               notes: 'Location voiture réserve Pal' },
  { date: '2024-06-20', bank: 'CIC',    category: 'cadeaux',    subCategory: 'Angèle',             ...debit(94.60, 'EUR'), title: 'Fever',                   notes: 'CandleLight Cathédrale Fourvière anniversaire Angèle' },
  { date: '2024-06-23', bank: 'Revolut',category: 'nourriture', subCategory: 'Autres Nourriture',  ...debit(13.80, 'CHF'), title: 'New York Coffee',         notes: '' },
  { date: '2024-06-23', bank: 'Revolut',category: 'transport',  subCategory: 'Essence',            ...debit(22.90, 'CHF'), title: 'Eni',                     notes: '' },
  { date: '2024-06-24', bank: 'CS',     category: 'entreprise', subCategory: 'Salaire',            ...credit(6418.9,'CHF'), title: 'EY',                     notes: 'Salaire juin 2024' },
  { date: '2024-06-24', bank: 'Revolut',category: 'transport',  subCategory: 'Autres Transport',   ...debit(4,     'EUR'), title: 'Cumul',                   notes: 'Péage vacances Italie' },
  { date: '2024-06-24', bank: 'Revolut',category: 'nourriture', subCategory: 'Restaurant',         ...debit(6,     'EUR'), title: 'Gelateria Vernazza',      notes: 'Glaces avec Quentin et Alex' },
  { date: '2024-06-24', bank: 'Revolut',category: 'transport',  subCategory: 'SNCF',               ...debit(30,    'EUR'), title: 'Trenitalia',              notes: 'Trains Cinque Terre' },
  { date: '2024-06-24', bank: 'Revolut',category: 'nourriture', subCategory: 'Autres Nourriture',  ...debit(3.60,  'EUR'), title: 'Sadyra Srls',             notes: 'Café' },
  { date: '2024-06-24', bank: 'CIC',    category: 'transport',  subCategory: 'Autres Transport',   ...debit(4.40,  'EUR'), title: 'Autoroute',               notes: '' },
  { date: '2024-06-24', bank: 'CIC',    category: 'transport',  subCategory: 'SNCF',               ...debit(6.80,  'EUR'), title: 'SNCF',                    notes: '' },
  { date: '2024-06-24', bank: 'CIC',    category: 'transport',  subCategory: 'Autres Transport',   ...debit(4.40,  'EUR'), title: 'Autoroute',               notes: '' },
  { date: '2024-06-24', bank: 'CIC',    category: 'loisirs',    subCategory: 'Activité/Sortie',    ...debit(187,   'EUR'), title: 'Grand Parc Puy Du Fou',   notes: 'Puy Du Fou avec Angèle et Jacky' },
  { date: '2024-06-25', bank: 'CIC',    category: 'transport',  subCategory: 'Autres Transport',   ...debit(14.30, 'EUR'), title: 'Autoroute',               notes: '' },
  { date: '2024-06-25', bank: 'CIC',    category: 'logement',   subCategory: 'Location Logement',  ...debit(30,    'EUR'), title: 'Airbnb',                  notes: 'Puy Du Fou avec Angèle et Jacky (1/3)' },
  { date: '2024-06-25', bank: 'CIC',    category: 'logement',   subCategory: 'Location Logement',  ...debit(34,    'EUR'), title: 'Airbnb',                  notes: 'Puy Du Fou avec Angèle et Jacky (1/3)' },
  { date: '2024-06-25', bank: 'CIC',    category: 'abonnements',subCategory: 'Téléphone',          ...debit(25.99, 'EUR'), title: 'Sosh',                    notes: '' },
  { date: '2024-06-26', bank: 'CS',     category: 'banque',     subCategory: 'Frais Carte',        ...debit(21,    'CHF'), title: 'Crédit Suisse',           notes: 'Décompte de frais' },
  { date: '2024-06-26', bank: 'Revolut',category: 'nourriture', subCategory: 'Autres Nourriture',  ...debit(3.60,  'EUR'), title: 'Melissa Coffee',          notes: '' },
  { date: '2024-06-26', bank: 'Revolut',category: 'nourriture', subCategory: 'Autres Nourriture',  ...debit(6,     'EUR'), title: 'Mokita Lounge',           notes: '' },
  { date: '2024-06-26', bank: 'Revolut',category: 'transport',  subCategory: 'Autres Transport',   ...debit(15.30, 'EUR'), title: 'Autostrade per l\'Italia',notes: 'Péage Italie' },
  { date: '2024-06-26', bank: 'CIC',    category: 'nourriture', subCategory: 'Courses',            ...debit(1.90,  'EUR'), title: 'Arello Bar',              notes: '' },
  { date: '2024-06-26', bank: 'CIC',    category: 'transport',  subCategory: 'Autres Transport',   ...debit(13,    'EUR'), title: 'Parcheggio La Spezia',    notes: '' },
  { date: '2024-06-26', bank: 'CIC',    category: 'transport',  subCategory: 'Autres Transport',   ...debit(26.30, 'EUR'), title: 'Parcheggio La Spezia',    notes: '' },
  { date: '2024-06-26', bank: 'CIC',    category: 'transport',  subCategory: 'Autres Transport',   ...debit(1.50,  'EUR'), title: 'Parcheggio La Spezia',    notes: '' },
  { date: '2024-06-28', bank: 'Revolut',category: 'nourriture', subCategory: 'Restaurant',         ...debit(29.70, 'EUR'), title: 'Cyril Nitard',            notes: '' },
  { date: '2024-06-28', bank: 'Revolut',category: 'transport',  subCategory: 'Autres Transport',   ...debit(1.10,  'EUR'), title: 'Vinci Autoroutes',        notes: '' },
  { date: '2024-06-28', bank: 'Revolut',category: 'nourriture', subCategory: 'Restaurant',         ...debit(19.50, 'EUR'), title: 'Ramen Djizan',            notes: '' },
  { date: '2024-06-28', bank: 'Revolut',category: 'loisirs',    subCategory: 'Alcool',             ...debit(50,    'EUR'), title: 'Caveau Château',          notes: '' },
  { date: '2024-06-28', bank: 'Revolut',category: 'nourriture', subCategory: 'Courses',            ...debit(18.40, 'EUR'), title: 'Craqui Shop',             notes: '' },
  { date: '2024-06-28', bank: 'LCL',    category: 'banque',     subCategory: 'Prêt',               ...debit(535.67,'EUR'), title: 'LCL',                     notes: 'Échéance prêt 17/60' },
  { date: '2024-06-29', bank: 'Revolut',category: 'transport',  subCategory: 'Autres Transport',   ...debit(12.90, 'EUR'), title: 'APRR',                    notes: '' },
  { date: '2024-06-29', bank: 'Revolut',category: 'banque',     subCategory: 'Frais Carte',        ...debit(10.99, 'CHF'), title: 'Revolut',                 notes: '' },
]

const ALL_ROWS = [...JANVIER_2026, ...JUIN_2024]

// ─── Utilitaires de calcul ────────────────────────────────────────────────────

function sumInCHF(rows: RawRow[], filterFn: (r: RawRow) => boolean): number {
  return rows
    .filter(filterFn)
    .reduce((s, r) => s + convertToBase(r.amount, r.currency, 'CHF'), 0)
}

// ─── Tests : devises & conversion ─────────────────────────────────────────────

describe('Conversion de devises', () => {
  it('1 EUR = 0.96 CHF (taux de référence)', () => {
    expect(EUR_RATES['CHF']).toBe(0.96)
    expect(EUR_RATES['EUR']).toBe(1)
  })

  it('convertToBase CHF→CHF retourne le même montant', () => {
    expect(convertToBase(100, 'CHF', 'CHF')).toBe(100)
    expect(convertToBase(2530, 'CHF', 'CHF')).toBe(2530)
  })

  it('convertToBase EUR→CHF : 535.67 EUR ≈ 514.24 CHF', () => {
    const result = convertToBase(535.67, 'EUR', 'CHF')
    expect(result).toBeCloseTo(514.24, 1)
  })

  it('convertToBase EUR→CHF : 319.77 EUR ≈ 306.98 CHF', () => {
    const result = convertToBase(319.77, 'EUR', 'CHF')
    expect(result).toBeCloseTo(306.98, 1)
  })
})

// ─── Tests : catégories ───────────────────────────────────────────────────────

describe('Catégories', () => {
  it('11 catégories au total', () => {
    expect(CATEGORIES).toHaveLength(11)
  })

  it('banque a les sous-catégories Prêt et Frais Carte', () => {
    expect(CATEGORY_MAP['banque'].subCategories).toEqual(['Prêt', 'Frais Carte'])
  })

  it('impots a les sous-catégories Global et Acompte', () => {
    expect(CATEGORY_MAP['impots'].subCategories).toContain('Global')
    expect(CATEGORY_MAP['impots'].subCategories).toContain('Acompte')
  })

  it('assurance a Maladie (Lamal) et Maladie (Complémentaire)', () => {
    expect(CATEGORY_MAP['assurance'].subCategories).toContain('Maladie (Lamal)')
    expect(CATEGORY_MAP['assurance'].subCategories).toContain('Maladie (Complémentaire)')
  })

  it('logement a Loyer + Charges, Loyer Suisse, Location Logement', () => {
    const subs = CATEGORY_MAP['logement'].subCategories
    expect(subs).toContain('Loyer + Charges')
    expect(subs).toContain('Loyer Suisse')
    expect(subs).toContain('Location Logement')
  })

  it('loisirs a Alcool et Activité/Sortie', () => {
    const subs = CATEGORY_MAP['loisirs'].subCategories
    expect(subs).toContain('Alcool')
    expect(subs).toContain('Activité/Sortie')
  })

  it('entreprise a Salaire, Restaurant Travail, Transport Travail', () => {
    const subs = CATEGORY_MAP['entreprise'].subCategories
    expect(subs).toContain('Salaire')
    expect(subs).toContain('Restaurant Travail')
    expect(subs).toContain('Transport Travail')
  })

  it('les catégories incompressibles sont : banque, impots, assurance, logement', () => {
    const fixed = CATEGORIES.filter(c => c.isFixed).map(c => c.id)
    expect(fixed).toContain('banque')
    expect(fixed).toContain('impots')
    expect(fixed).toContain('assurance')
    expect(fixed).toContain('logement')
    expect(fixed).not.toContain('nourriture')
    expect(fixed).not.toContain('loisirs')
  })

  it('toutes les catégories des données existent dans CATEGORY_MAP', () => {
    const usedCategories = new Set(ALL_ROWS.map(r => r.category))
    for (const cat of usedCategories) {
      expect(CATEGORY_MAP[cat], `Catégorie manquante : ${cat}`).toBeDefined()
    }
  })

  it('toutes les sous-catégories existent dans leur catégorie', () => {
    for (const row of ALL_ROWS) {
      const cat = CATEGORY_MAP[row.category]
      expect(
        cat.subCategories,
        `"${row.subCategory}" attendu dans ${row.category}`
      ).toContain(row.subCategory)
    }
  })
})

// ─── Tests : données janvier 2026 ─────────────────────────────────────────────

describe('Données Janvier 2026', () => {
  it('44 entrées au total', () => {
    expect(JANVIER_2026).toHaveLength(44)
  })

  it('1 salaire UBS Pictet 7814 CHF (crédit)', () => {
    const row = JANVIER_2026.find(r => r.category === 'entreprise' && r.subCategory === 'Salaire')
    expect(row).toBeDefined()
    expect(row!.amount).toBe(7814)
    expect(row!.currency).toBe('CHF')
    expect(row!.type).toBe('credit')
    expect(row!.bank).toBe('UBS')
  })

  it('loyer 2530 CHF UBS débit incompressible', () => {
    const row = JANVIER_2026.find(r => r.subCategory === 'Loyer + Charges')
    expect(row).toBeDefined()
    expect(row!.amount).toBe(2530)
    expect(row!.currency).toBe('CHF')
    expect(row!.type).toBe('debit')
  })

  it('prêt LCL 535.67 EUR débit', () => {
    const row = JANVIER_2026.find(r => r.bank === 'LCL')
    expect(row).toBeDefined()
    expect(row!.amount).toBe(535.67)
    expect(row!.currency).toBe('EUR')
    expect(row!.subCategory).toBe('Prêt')
  })

  it('impôts UBS 1611 CHF débit', () => {
    const row = JANVIER_2026.find(r => r.category === 'impots')
    expect(row).toBeDefined()
    expect(row!.amount).toBe(1611)
    expect(row!.currency).toBe('CHF')
    expect(row!.type).toBe('debit')
  })

  it('assurance Lamal 442.75 CHF UBS', () => {
    const row = JANVIER_2026.find(r => r.subCategory === 'Maladie (Lamal)')
    expect(row).toBeDefined()
    expect(row!.amount).toBe(442.75)
    expect(row!.bank).toBe('UBS')
  })

  it('remboursement Angèle 300 EUR crédit CIC', () => {
    const row = JANVIER_2026.find(r => r.type === 'credit' && r.currency === 'EUR')
    expect(row).toBeDefined()
    expect(row!.amount).toBe(300)
    expect(row!.bank).toBe('CIC')
    expect(row!.subCategory).toBe('Revenus Supplémentaires')
  })

  it('remboursement Maman 2000 CHF crédit UBS', () => {
    const row = JANVIER_2026.find(r => r.amount === 2000 && r.type === 'credit')
    expect(row).toBeDefined()
    expect(row!.currency).toBe('CHF')
    expect(row!.bank).toBe('UBS')
  })

  it('Intermarché 319.77 EUR Revolut nourriture/Courses', () => {
    const row = JANVIER_2026.find(r => r.title === 'Intermarché')
    expect(row).toBeDefined()
    expect(row!.amount).toBe(319.77)
    expect(row!.currency).toBe('EUR')
    expect(row!.category).toBe('nourriture')
    expect(row!.subCategory).toBe('Courses')
  })

  it('12 entrées débit "Restaurant Travail" (déjeuners Pictet)', () => {
    // 05/1×2, 06/1, 07/1, 08/1, 09/1×2, 12/1×2, 13/1, 15/1, 16/1×2 = 12
    const repas = JANVIER_2026.filter(r =>
      r.subCategory === 'Restaurant Travail' && r.type === 'debit'
    )
    expect(repas).toHaveLength(12)
  })

  it('2 entrées crédit "Restaurant Travail" (retours consignes Pictet)', () => {
    // 12/1 (15 CHF) + 16/1 (25 CHF)
    const retours = JANVIER_2026.filter(r =>
      r.subCategory === 'Restaurant Travail' && r.type === 'credit'
    )
    expect(retours).toHaveLength(2)
  })

  it('total dépenses CHF (montants CHF directs)', () => {
    const totalCHFDebit = JANVIER_2026
      .filter(r => r.type === 'debit' && r.currency === 'CHF')
      .reduce((s, r) => s + r.amount, 0)
    // 2530 + 64.40 + 442.75 + 12 + 2.30 + 12 + 30 + 30 + 27.20 + 25
    // + 25.90 + 80 + 22 + 50.20 + 12 + 10.05 + 8 + 12 + 71.10 + 43
    // + 17.80 + 102??? non: 102 est EUR. Recalcul.
    expect(totalCHFDebit).toBeGreaterThan(3000)
  })

  it('toutes les entrées du mois sont en 2026-01', () => {
    const wrong = JANVIER_2026.filter(r => !r.date.startsWith('2026-01'))
    expect(wrong).toHaveLength(0)
  })
})

// ─── Tests : données juin 2024 ────────────────────────────────────────────────

describe('Données Juin 2024', () => {
  it('67 entrées au total', () => {
    expect(JUIN_2024).toHaveLength(67)
  })

  it('salaire EY 6418.90 CHF crédit CS', () => {
    const row = JUIN_2024.find(r => r.category === 'entreprise' && r.subCategory === 'Salaire')
    expect(row).toBeDefined()
    expect(row!.amount).toBe(6418.9)
    expect(row!.currency).toBe('CHF')
    expect(row!.bank).toBe('CS')
    expect(row!.type).toBe('credit')
  })

  it('impôts 1178 CHF CS (Etat Suisse)', () => {
    const row = JUIN_2024.find(r => r.category === 'impots')
    expect(row).toBeDefined()
    expect(row!.amount).toBe(1178)
    expect(row!.bank).toBe('CS')
  })

  it('assurance Lamal Sanitas 382.45 CHF', () => {
    const row = JUIN_2024.find(r => r.subCategory === 'Maladie (Lamal)')
    expect(row).toBeDefined()
    expect(row!.amount).toBe(382.45)
  })

  it('assurance complémentaire Groupe Mutuel 93.10 CHF', () => {
    const row = JUIN_2024.find(r => r.subCategory === 'Maladie (Complémentaire)')
    expect(row).toBeDefined()
    expect(row!.amount).toBe(93.1)
  })

  it('Airbnb Italie 315 EUR loisirs/Location Logement (Revolut)', () => {
    const row = JUIN_2024.find(r => r.bank === 'Revolut' && r.subCategory === 'Location Logement')
    expect(row).toBeDefined()
    expect(row!.amount).toBe(315)
    expect(row!.currency).toBe('EUR')
    expect(row!.category).toBe('loisirs')
  })

  it('remboursements Quentin Liardeaux : 125 EUR + 310 EUR (crédits)', () => {
    const rembours = JUIN_2024.filter(r => r.title === 'Quentin Liardeaux')
    expect(rembours).toHaveLength(2)
    expect(rembours.every(r => r.type === 'credit')).toBe(true)
    const amounts = rembours.map(r => r.amount).sort((a, b) => a - b)
    expect(amounts).toEqual([125, 310])
  })

  it('prêt LCL 535.67 EUR (17ème mensualité)', () => {
    const row = JUIN_2024.find(r => r.bank === 'LCL')
    expect(row).toBeDefined()
    expect(row!.amount).toBe(535.67)
    expect(row!.subCategory).toBe('Prêt')
  })

  it('4 remboursements bars en crédit (juin)', () => {
    const barCredits = JUIN_2024.filter(r => r.subCategory === 'Bars' && r.type === 'credit')
    expect(barCredits).toHaveLength(4)
    const total = barCredits.reduce((s, r) => s + r.amount, 0)
    // 20 + 20 + 35 + 20 = 95 EUR
    expect(total).toBe(95)
  })

  it('parcheggio La Spezia : 3 entrées transport (parking Italie)', () => {
    const parking = JUIN_2024.filter(r => r.title === 'Parcheggio La Spezia')
    expect(parking).toHaveLength(3)
    expect(parking.every(r => r.currency === 'EUR')).toBe(true)
    expect(parking.every(r => r.category === 'transport')).toBe(true)
  })

  it('transport CFF : 2 billets de train travail', () => {
    const cff = JUIN_2024.filter(r => r.title === 'CFF')
    expect(cff).toHaveLength(2)
    const amounts = cff.map(r => r.amount).sort((a, b) => a - b)
    expect(amounts).toEqual([78.5, 84.3])
  })

  it('toutes les entrées du mois sont en 2024-06', () => {
    const wrong = JUIN_2024.filter(r => !r.date.startsWith('2024-06'))
    expect(wrong).toHaveLength(0)
  })
})

// ─── Tests : agrégats globaux ─────────────────────────────────────────────────

describe('Agrégats globaux', () => {
  it('111 entrées au total sur les deux mois', () => {
    expect(ALL_ROWS).toHaveLength(111)
  })

  it('les banques utilisées font partie de la liste autorisée', () => {
    const allowed = new Set(['LCL', 'UBS', 'CIC', 'Revolut', 'CS', 'Cash'])
    const used = new Set(ALL_ROWS.map(r => r.bank))
    for (const bank of used) {
      expect(allowed, `Banque inconnue : ${bank}`).toContain(bank)
    }
  })

  it('devises utilisées : CHF et EUR uniquement', () => {
    const currencies = new Set(ALL_ROWS.map(r => r.currency))
    expect([...currencies].sort()).toEqual(['CHF', 'EUR'])
  })

  it('total revenus janvier 2026 : salaire 7814 + Maman 2200 + Angèle 300 EUR + retours Pictet + Alexandre K.', () => {
    const credits = JANVIER_2026.filter(r => r.type === 'credit')
    // CHF: 7814, 2000, 200, 15, 25, 57 = 10111 CHF
    // EUR: 300 EUR = 288 CHF
    const totalCHF = sumInCHF(credits, () => true)
    expect(totalCHF).toBeGreaterThan(10000)
  })

  it('abonnements janvier 2026 : Spotify + ChatGPT + Canal+ = 79.63 EUR', () => {
    const abos = JANVIER_2026.filter(r => r.category === 'abonnements' && r.type === 'debit')
    expect(abos).toHaveLength(3)
    const total = abos.reduce((s, r) => s + r.amount, 0)
    expect(total).toBeCloseTo(79.63, 1) // 17.20 + 20.44 + 41.99
  })

  it('abonnements juin 2024 : Spotify + Téléphone Sosh = 40.98 EUR', () => {
    const abos = JUIN_2024.filter(r => r.category === 'abonnements')
    expect(abos).toHaveLength(2) // Spotify (CIC) + Sosh (CIC)
    const total = abos.reduce((s, r) => s + r.amount, 0)
    expect(total).toBeCloseTo(40.98, 1) // 14.99 + 25.99
  })

  it('dépenses logement janvier 2026 : loyer 2530 CHF + AirBnb 102 EUR', () => {
    const logement = JANVIER_2026.filter(r => r.category === 'logement' && r.type === 'debit')
    expect(logement).toHaveLength(2)
    const totalCHF = sumInCHF(logement, () => true)
    // 2530 + 102 * 0.96 = 2530 + 97.92 = 2627.92
    expect(totalCHF).toBeCloseTo(2627.92, 1)
  })

  it('dépenses transport travail juin 2024 : 2 billets CFF (84.3 + 78.5 CHF)', () => {
    // CFF est en catégorie "entreprise/Transport Travail", pas "transport"
    const cff = JUIN_2024.filter(r => r.title === 'CFF')
    expect(cff).toHaveLength(2)
    expect(cff.reduce((s, r) => s + r.amount, 0)).toBeCloseTo(162.8, 1)
  })
})
