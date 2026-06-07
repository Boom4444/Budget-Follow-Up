import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuid } from 'uuid'
import type { Expense, RecurringExpense, AppSettings, CurrencyCode, HouseholdMember, MonthlyBudget, BudgetItem } from '../models/types'
import { convertToBase } from '../data/currencies'
import { autoSave } from '../utils/backup'

export interface AutoBackupStatus {
  at: string
  status: 'ok' | 'error'
}

interface AppState {
  expenses: Expense[]
  recurring: RecurringExpense[]
  settings: AppSettings

  addExpense: (e: Omit<Expense, 'id' | 'amountInBase'>) => void
  addBatchExpenses: (items: Omit<Expense, 'id' | 'amountInBase'>[]) => void
  updateExpense: (id: string, patch: Partial<Expense>) => void
  deleteExpense: (id: string) => void

  addRecurring: (r: Omit<RecurringExpense, 'id'>) => void
  updateRecurring: (id: string, patch: Partial<RecurringExpense>) => void
  deleteRecurring: (id: string) => void

  updateSettings: (patch: Partial<AppSettings>) => void
  recategorizeExpenses: (fromCategoryId: string, toCategoryId: string) => void
  loadDemoData: () => void
  importData: (expenses: Expense[], recurring: RecurringExpense[], budgets: MonthlyBudget[], merge?: boolean) => void
  clearData: () => void

  budgets: MonthlyBudget[]
  setBudgetItem: (year: number, month: number, person: HouseholdMember, categoryId: string, amount: number) => void
  setBudgetItems: (year: number, month: number, person: HouseholdMember, items: BudgetItem[]) => void
  copyBudget: (fromYear: number, fromMonth: number, fromPerson: HouseholdMember, toYear: number, toMonth: number, toPerson: HouseholdMember) => void
  setIncome: (year: number, month: number, person: HouseholdMember, amount: number) => void

  // Transient (not persisted)
  driveToken: string | null
  setDriveToken: (token: string | null) => void
  lastAutoBackup: AutoBackupStatus | null
  setLastAutoBackup: (b: AutoBackupStatus | null) => void
  claudeApiKey: string
  setClaudeApiKey: (key: string) => void
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      expenses: [],
      recurring: [],
      budgets: [],
      settings: {
        person1Name: 'Moi',
        person2Name: 'Partenaire',
        baseCurrency: 'CHF',
        banks: ['LCL', 'UBS', 'CIC', 'Revolut', 'CS', 'Cash'],
        theme: 'system',
        googleDriveClientId: '',
        customCategories: [],
        claudeApiKey: '',
      },

      addExpense(e) {
        const base = get().settings.baseCurrency
        const amountInBase = convertToBase(e.amount, e.currency, base)
        set(s => ({ expenses: [...s.expenses, { ...e, id: uuid(), amountInBase }] }))
        const { expenses, recurring, settings } = get()
        autoSave(expenses, recurring, settings)
      },

      addBatchExpenses(items) {
        const base = get().settings.baseCurrency
        const newExpenses = items.map(e => ({
          ...e,
          id: uuid(),
          amountInBase: convertToBase(e.amount, e.currency, base),
        }))
        set(s => ({ expenses: [...s.expenses, ...newExpenses] }))
        const { expenses, recurring, settings } = get()
        autoSave(expenses, recurring, settings)
      },

      updateExpense(id, patch) {
        set(s => ({
          expenses: s.expenses.map(e => {
            if (e.id !== id) return e
            const merged = { ...e, ...patch }
            const base = s.settings.baseCurrency
            merged.amountInBase = convertToBase(merged.amount, merged.currency, base)
            return merged
          }),
        }))
      },

      deleteExpense(id) {
        set(s => ({ expenses: s.expenses.filter(e => e.id !== id) }))
        const { expenses, recurring, settings } = get()
        autoSave(expenses, recurring, settings)
      },

      addRecurring(r) {
        set(s => ({ recurring: [...s.recurring, { ...r, id: uuid() }] }))
      },

      updateRecurring(id, patch) {
        set(s => ({
          recurring: s.recurring.map(r => r.id === id ? { ...r, ...patch } : r),
        }))
      },

      deleteRecurring(id) {
        set(s => ({ recurring: s.recurring.filter(r => r.id !== id) }))
      },

      updateSettings(patch) {
        set(s => ({ settings: { ...s.settings, ...patch } }))
      },

      recategorizeExpenses(fromCategoryId, toCategoryId) {
        set(s => ({
          expenses: s.expenses.map(e =>
            e.category === fromCategoryId
              ? { ...e, category: toCategoryId, subCategory: 'Non classé' }
              : e
          ),
        }))
        const { expenses, recurring, settings } = get()
        autoSave(expenses, recurring, settings)
      },

      loadDemoData() {
        const base: CurrencyCode = get().settings.baseCurrency

        type RawEntry = readonly [
          string,             // date YYYY-MM-DD
          string,             // bank
          string,             // category
          string,             // subCategory
          'debit' | 'credit', // type
          number,             // amount
          CurrencyCode,       // currency
          boolean,            // isFixed
          string,             // title (boutique)
          HouseholdMember,    // person
          string,             // notes
        ]

        const rows: RawEntry[] = [
          // ── Janvier 2026 ─────────────────────────────────────────────────────
          ['2026-01-01', 'UBS', 'entreprise', 'Salaire',           'credit', 7814,   'CHF', false, 'Pictet',                   'person1', ''],
          ['2026-01-01', 'UBS', 'logement',   'Loyer + Charges',   'debit',  2530,   'CHF', true,  'Mme. Febo',                'person1', ''],
          ['2026-01-01', 'UBS', 'nourriture', 'Restaurant',        'debit',   64.40, 'CHF', false, 'McDonalds',                'person1', ''],
          ['2026-01-02', 'CIC', 'abonnements','Spotify',           'debit',   17.20, 'EUR', false, 'Spotify',                  'person1', ''],
          ['2026-01-02', 'CIC', 'abonnements','ChatGPT',           'debit',   20.44, 'EUR', false, 'OpenAI',                   'person1', ''],
          ['2026-01-02', 'Revolut','abonnements','Canal+',          'debit',   41.99, 'EUR', false, 'Canal+',                   'person1', 'Abonnement Mémé'],
          ['2026-01-03', 'Revolut','loisirs',  'Autres Loisirs',   'debit',   19.27, 'EUR', false, 'Fnac',                     'person1', 'Jeu de société + crayons'],
          ['2026-01-03', 'Revolut','nourriture','Courses',          'debit',  319.77, 'EUR', false, 'Intermarché',              'shared',  'Courses avec Angèle'],
          ['2026-01-05', 'UBS', 'assurance',  'Maladie (Lamal)',   'debit',  442.75, 'CHF', true,  'Sanitas',                  'person1', ''],
          ['2026-01-05', 'UBS', 'entreprise', 'Repas Travail',     'debit',   12,    'CHF', false, 'Pictet',                   'person1', 'Repas'],
          ['2026-01-05', 'UBS', 'entreprise', 'Repas Travail',     'debit',    2.30, 'CHF', false, 'Pictet',                   'person1', 'Fruit petit déjeuner'],
          ['2026-01-06', 'UBS', 'entreprise', 'Repas Travail',     'debit',   12,    'CHF', false, 'Pictet',                   'person1', 'Repas'],
          ['2026-01-07', 'CIC', 'cadeaux',    'Revenus Supplémentaires','credit',300,'EUR', false, 'Angèle',                   'person1', 'Remboursement crédit (dernier pour la voiture)'],
          ['2026-01-07', 'UBS', 'cadeaux',    'Autres Cadeaux',   'debit',   30,    'CHF', false, 'Sabine A.',                'person1', 'Twint naissance enfant Quentin D.'],
          ['2026-01-07', 'UBS', 'cadeaux',    'Autres Cadeaux',   'debit',   30,    'CHF', false, 'Sabine A.',                'person1', 'Twint départ Sophie P.'],
          ['2026-01-07', 'UBS', 'nourriture', 'Café / Boulangerie','debit',   27.20, 'CHF', false, 'Aux Merveilleux de Fred',  'person1', 'Petit-déjeuner anniversaire'],
          ['2026-01-07', 'UBS', 'entreprise', 'Repas Travail',     'debit',   25,    'CHF', false, 'Pictet',                   'person1', 'Repas + consigne Tupperware'],
          ['2026-01-08', 'CIC', 'banque',     'Frais Carte',      'debit',    5.47, 'EUR', false, 'CIC',                      'person1', ''],
          ['2026-01-08', 'Revolut','loisirs',  'Jeux / Jeux vidéo','debit',   25.90, 'CHF', false, 'Meta Pay',                 'person1', '1er jeu avec Oculus'],
          ['2026-01-08', 'Revolut','besoinsPersonnels','Livres / Éducation','debit',80,'CHF', false, 'Apple',                   'person1', 'CISSP Renouvellement questions 6 mois'],
          ['2026-01-08', 'UBS', 'entreprise', 'Repas Travail',     'debit',   22,    'CHF', false, 'Pictet',                   'person1', 'Repas + consigne Tupperware'],
          ['2026-01-08', 'UBS', 'cadeaux',    'Revenus Supplémentaires','credit',200,'CHF', false, 'Maman',                   'person1', 'Cadeau d\'anniversaire'],
          ['2026-01-09', 'UBS', 'nourriture', 'Restaurant',       'debit',   50.20, 'CHF', false, 'Uber Eats',                'person1', 'Mister Tacos avec Angèle'],
          ['2026-01-09', 'UBS', 'entreprise', 'Repas Travail',     'debit',   12,    'CHF', false, 'Pictet',                   'person1', 'Repas'],
          ['2026-01-10', 'Revolut','transport','Péages',           'debit',   33.50, 'EUR', false, 'Area',                     'person1', 'Péages pour Roynac'],
          ['2026-01-11', 'Revolut','transport','Péages',           'debit',   18.80, 'EUR', false, 'APRR',                     'person1', 'Péage retour Roynac pour Lyon'],
          ['2026-01-12', 'UBS', 'entreprise', 'Repas Travail',     'debit',   10.05, 'CHF', false, 'Pictet',                   'person1', 'Repas'],
          ['2026-01-12', 'UBS', 'entreprise', 'Repas Travail',     'debit',    8,    'CHF', false, 'Pictet',                   'person1', 'Petit-déjeuner'],
          ['2026-01-12', 'UBS', 'entreprise', 'Repas Travail',     'credit',  15,    'CHF', false, 'Pictet',                   'person1', 'Retour consignes repas'],
          ['2026-01-13', 'CIC', 'cadeaux',    'Famille',          'debit',  200,    'EUR', false, 'La Poste',                 'person1', 'Retrait cash anniversaire Léna'],
          ['2026-01-13', 'UBS', 'entreprise', 'Repas Travail',     'debit',   12,    'CHF', false, 'Pictet',                   'person1', 'Repas'],
          ['2026-01-14', 'UBS', 'nourriture', 'Restaurant',       'debit',   71.10, 'CHF', false, 'Uber Eats',                'person1', 'Mister Tacos avec Angèle'],
          ['2026-01-14', 'UBS', 'cadeaux',    'Revenus Supplémentaires','credit',2000,'CHF', false,'Maman',                   'person1', 'Remboursement équivalente Adrien (Restant=3k)'],
          ['2026-01-15', 'UBS', 'loisirs',    'Activité / Sortie','debit',   43,    'CHF', false, 'Remy W.',                  'person1', 'Tabacs pipe'],
          ['2026-01-15', 'UBS', 'entreprise', 'Repas Travail',     'debit',   17.80, 'CHF', false, 'Pictet',                   'person1', 'Repas'],
          ['2026-01-16', 'Revolut','logement', 'Location Logement','debit',  102,    'EUR', false, 'Quentin L.',               'person1', 'Moitié AirBnb weekend Château d\'Oex'],
          ['2026-01-16', 'UBS', 'nourriture', 'Restaurant',       'debit',  133,    'CHF', false, 'Les Sales Gosses',          'person1', 'Restaurant anciens EY (comprend part d\'Alex)'],
          ['2026-01-16', 'UBS', 'nourriture', 'Restaurant',       'credit',  57,    'CHF', false, 'Alexandre K.',             'person1', 'Remboursement restaurant'],
          ['2026-01-16', 'UBS', 'loisirs',    'Bars',             'debit',   27,    'CHF', false, 'Oh No Lulu!',              'person1', 'Bar avec anciens EY'],
          ['2026-01-16', 'UBS', 'entreprise', 'Repas Travail',     'debit',   12.05, 'CHF', false, 'Pictet',                   'person1', 'Repas'],
          ['2026-01-16', 'UBS', 'entreprise', 'Repas Travail',     'debit',    3.35, 'CHF', false, 'Pictet',                   'person1', 'Fruit petit déjeuner'],
          ['2026-01-16', 'UBS', 'entreprise', 'Repas Travail',     'credit',  25,    'CHF', false, 'Pictet',                   'person1', 'Retour consignes repas'],
          ['2026-01-19', 'UBS', 'impots',     'Global',           'debit', 1611,    'CHF', true,  'Etat',                     'person1', 'Acompte 2026 (1/12)'],
          ['2026-01-28', 'LCL', 'banque',     'Prêt',             'debit',  535.67, 'EUR', true,  'LCL',                      'person1', 'Échéance prêt 36/60'],

          // ── Juin 2024 ────────────────────────────────────────────────────────
          ['2024-06-01', 'CIC', 'loisirs',    'Voyage',           'debit',  130,    'EUR', false, 'Click & Boat',             'person1', 'Location bateau Italie avec Quentin et Alex (1/3)'],
          ['2024-06-01', 'Revolut','loisirs',  'Location Logement','debit',  315,    'EUR', false, 'Airbnb',                   'person1', 'Airbnb Italie avec Quentin et Alex (1/3)'],
          ['2024-06-01', 'Revolut','loisirs',  'Voyage',           'credit', 125,    'EUR', false, 'Quentin Liardeaux',        'person1', 'Remboursement 1/3 bateau Italie'],
          ['2024-06-01', 'Revolut','loisirs',  'Voyage',           'credit', 310,    'EUR', false, 'Quentin Liardeaux',        'person1', 'Remboursement 1/3 logement Italie'],
          ['2024-06-01', 'Revolut','besoinsPersonnels','Livres / Éducation','debit',34.94,'EUR',false,'Les Arts Frontières',    'person1', 'Achat BD + Tome 13 Solo Leveling'],
          ['2024-06-01', 'CS',    'assurance', 'Maladie (Complémentaire)','debit',93.1,'CHF',true, 'Groupe Mutuel',           'person1', 'Assurance complémentaire juin'],
          ['2024-06-01', 'CS',    'logement',  'Loyer Suisse',     'debit',  100,    'CHF', true,  'Mme. Febo',                'person1', ''],
          ['2024-06-01', 'Cash',  'logement',  'Location Logement','debit',  400,    'EUR', false, 'Jacques',                  'person1', 'Loyer avril 2024'],
          ['2024-06-01', 'CS',    'impots',    'Global',           'debit', 1178,    'CHF', true,  'Etat Suisse',              'person1', 'Impôts anticipés juin 2024 (5/10)'],
          ['2024-06-01', 'CS',    'assurance', 'Maladie (Lamal)',  'debit',  382.45, 'CHF', true,  'Sanitas',                  'person1', ''],
          ['2024-06-02', 'Revolut','loisirs',  'Bars',             'credit',  20,    'EUR', false, 'Alexandre Keusen',         'person1', 'Remboursement bars'],
          ['2024-06-02', 'Revolut','loisirs',  'Bars',             'credit',  20,    'EUR', false, 'Louise Dramé',             'person1', 'Remboursement bars'],
          ['2024-06-03', 'CS',    'entreprise','Transport Travail','debit',   84.30, 'CHF', false, 'CFF',                      'person1', 'Train Genève-Zurich passage panel'],
          ['2024-06-03', 'CS',    'entreprise','Repas Travail',    'debit',   31.80, 'CHF', false, 'Umamido',                  'person1', ''],
          ['2024-06-04', 'CS',    'entreprise','Transport Travail','debit',   78.50, 'CHF', false, 'CFF',                      'person1', 'Train Zurich-Genève retour panel'],
          ['2024-06-04', 'CS',    'entreprise','Repas Travail',    'debit',   18,    'CHF', false, 'Suweena Fine Thai Food',   'person1', 'Pad Thai bureau Zurich'],
          ['2024-06-04', 'CS',    'nourriture','Restaurant',       'debit',   13.30, 'CHF', false, 'Bloody Bar',               'person1', 'Petit déjeuner avant Zurich'],
          ['2024-06-04', 'Revolut','nourriture','Courses',          'debit',   19.88, 'EUR', false, 'Intermarché',              'person1', ''],
          ['2024-06-05', 'CS',    'entreprise','Repas Travail',    'credit', 204.80, 'CHF', false, 'EY',                       'person1', ''],
          ['2024-06-04', 'CIC',   'abonnements','Spotify',          'debit',   14.99, 'EUR', false, 'Spotify',                 'person1', ''],
          ['2024-06-05', 'CIC',   'besoinsPersonnels','Divers',     'debit',   33.98, 'EUR', false, 'Amazon',                   'person1', ''],
          ['2024-06-07', 'CS',    'entreprise','Repas Travail',    'debit',   17,    'CHF', false, 'Satay Sarray',             'person1', ''],
          ['2024-06-10', 'CS',    'entreprise','Repas Travail',    'debit',   16.90, 'CHF', false, 'Genecand Traiteur',        'person1', ''],
          ['2024-06-13', 'Revolut','loisirs',  'Bars',             'credit',  35,    'EUR', false, 'Louise Dramé',             'person1', 'Remboursement bar Le Balthazar'],
          ['2024-06-13', 'Revolut','loisirs',  'Bars',             'credit',  20,    'EUR', false, 'Juliette Coste',           'person1', 'Remboursement bar Le Balthazar'],
          ['2024-06-15', 'Revolut','nourriture','Restaurant',       'debit',   29,    'CHF', false, 'Pierre Hermé',             'person1', ''],
          ['2024-06-15', 'Revolut','nourriture','Café / Boulangerie','debit',   3.50, 'CHF', false, 'Speciality Coffee',        'person1', 'Café Lyon'],
          ['2024-06-16', 'Revolut','nourriture','Restaurant',       'debit',    7.20, 'CHF', false, 'DiVoglia',                 'person1', 'Café moulu'],
          ['2024-06-17', 'CS',    'entreprise','Repas Travail',    'debit',   11.90, 'CHF', false, 'Migros',                   'person1', ''],
          ['2024-06-17', 'CIC',   'loisirs',   'Activité / Sortie','debit',    1.99, 'EUR', false, 'Amazon',                   'person1', ''],
          ['2024-06-17', 'CIC',   'transport', 'SNCF / Train',     'debit',   18.60, 'EUR', false, 'SNCF',                     'person1', ''],
          ['2024-06-17', 'CIC',   'nourriture','Restaurant',        'credit',  38,    'EUR', false, 'Angèle',                   'person1', 'Remboursement restaurants Angèle'],
          ['2024-06-18', 'Revolut','cadeaux',  'Couple',           'debit',  200,    'CHF', false, 'Léna Fournier',            'person1', 'Tapis de course Angèle'],
          ['2024-06-18', 'CIC',   'transport', 'Autres Transport',  'debit',    0.50, 'EUR', false, 'Velivert',                 'person1', 'Vélo Sainté'],
          ['2024-06-19', 'CIC',   'transport', 'Autres Transport',  'debit',   75,    'EUR', false, 'GetAround',                'person1', 'Location voiture réserve Pal'],
          ['2024-06-20', 'CIC',   'cadeaux',   'Couple',           'debit',   94.60, 'EUR', false, 'Fever',                    'person1', 'CandleLight Cathédrale Fourvière anniversaire Angèle'],
          ['2024-06-23', 'Revolut','nourriture','Café / Boulangerie','debit',  13.80, 'CHF', false, 'New York Coffee',          'person1', ''],
          ['2024-06-23', 'Revolut','transport', 'Essence',          'debit',   22.90, 'CHF', false, 'Eni',                      'person1', ''],
          ['2024-06-24', 'CS',    'entreprise','Salaire',           'credit', 6418.90,'CHF', false, 'EY',                      'person1', 'Salaire juin 2024'],
          ['2024-06-24', 'Revolut','transport', 'Péages',           'debit',    4,    'EUR', false, 'Cumul',                    'person1', 'Péage vacances Italie'],
          ['2024-06-24', 'Revolut','nourriture','Restaurant',        'debit',    6,    'EUR', false, 'Gelateria Vernazza',       'person1', 'Glaces avec Quentin et Alex'],
          ['2024-06-24', 'Revolut','transport', 'SNCF / Train',     'debit',   30,    'EUR', false, 'Trenitalia',               'person1', 'Trains Cinque Terre'],
          ['2024-06-24', 'Revolut','nourriture','Café / Boulangerie','debit',   3.60, 'EUR', false, 'Sadyra Srls',              'person1', 'Café'],
          ['2024-06-24', 'CIC',   'transport', 'Péages',            'debit',    4.40, 'EUR', false, 'Autoroute',                'person1', ''],
          ['2024-06-24', 'CIC',   'transport', 'SNCF / Train',      'debit',    6.80, 'EUR', false, 'SNCF',                     'person1', ''],
          ['2024-06-24', 'CIC',   'transport', 'Péages',            'debit',    4.40, 'EUR', false, 'Autoroute',                'person1', ''],
          ['2024-06-24', 'CIC',   'loisirs',   'Activité / Sortie', 'debit',  187,   'EUR', false, 'Grand Parc Puy Du Fou',    'person1', 'Puy Du Fou avec Angèle et Jacky'],
          ['2024-06-25', 'CIC',   'transport', 'Péages',            'debit',   14.30, 'EUR', false, 'Autoroute',                'person1', ''],
          ['2024-06-25', 'CIC',   'logement',  'Location Logement','debit',   30,    'EUR', false, 'Airbnb',                   'person1', 'Puy Du Fou avec Angèle et Jacky (1/3)'],
          ['2024-06-25', 'CIC',   'logement',  'Location Logement','debit',   34,    'EUR', false, 'Airbnb',                   'person1', 'Puy Du Fou avec Angèle et Jacky (1/3)'],
          ['2024-06-25', 'CIC',   'abonnements','Téléphone',        'debit',   25.99, 'EUR', false, 'Sosh',                     'person1', ''],
          ['2024-06-26', 'CS',    'banque',     'Frais Carte',      'debit',   21,    'CHF', false, 'Crédit Suisse',            'person1', 'Décompte de frais'],
          ['2024-06-26', 'Revolut','nourriture','Café / Boulangerie','debit',   3.60, 'EUR', false, 'Melissa Coffee',           'person1', ''],
          ['2024-06-26', 'Revolut','nourriture','Café / Boulangerie','debit',   6,    'EUR', false, 'Mokita Lounge',            'person1', ''],
          ['2024-06-26', 'Revolut','transport', 'Péages',           'debit',   15.30, 'EUR', false, "Autostrade per l'Italia",  'person1', 'Péage Italie'],
          ['2024-06-26', 'CIC',   'nourriture','Courses',           'debit',    1.90, 'EUR', false, 'Arello Bar',               'person1', ''],
          ['2024-06-26', 'CIC',   'transport', 'Autres Transport',  'debit',   13,    'EUR', false, 'Parcheggio La Spezia',     'person1', ''],
          ['2024-06-26', 'CIC',   'transport', 'Autres Transport',  'debit',   26.30, 'EUR', false, 'Parcheggio La Spezia',     'person1', ''],
          ['2024-06-26', 'CIC',   'transport', 'Autres Transport',  'debit',    1.50, 'EUR', false, 'Parcheggio La Spezia',     'person1', ''],
          ['2024-06-28', 'Revolut','nourriture','Restaurant',        'debit',   29.70, 'EUR', false, 'Cyril Nitard',             'person1', ''],
          ['2024-06-28', 'Revolut','transport', 'Péages',           'debit',    1.10, 'EUR', false, 'Vinci Autoroutes',         'person1', ''],
          ['2024-06-28', 'Revolut','nourriture','Restaurant',        'debit',   19.50, 'EUR', false, 'Ramen Djizan',             'person1', ''],
          ['2024-06-28', 'Revolut','loisirs',   'Alcool',           'debit',   50,    'EUR', false, 'Caveau Château',           'person1', ''],
          ['2024-06-28', 'Revolut','nourriture','Courses',           'debit',   18.40, 'EUR', false, 'Craqui Shop',              'person1', ''],
          ['2024-06-28', 'LCL',   'banque',     'Prêt',             'debit',  535.67, 'EUR', true,  'LCL',                      'person1', 'Échéance prêt 17/60'],
          ['2024-06-29', 'Revolut','transport', 'Péages',           'debit',   12.90, 'EUR', false, 'APRR',                     'person1', ''],
          ['2024-06-29', 'Revolut','banque',    'Frais Carte',      'debit',   10.99, 'CHF', false, 'Revolut',                  'person1', ''],
        ]

        const expenses: Expense[] = rows.map(
          ([date, bank, category, subCategory, type, amount, currency, isFixed, title, person, notes]) => ({
            id: uuid(),
            date, bank, category, subCategory, type, amount,
            currency: currency as CurrencyCode,
            isFixed, title, person, notes,
            amountInBase: convertToBase(amount, currency as CurrencyCode, base),
          })
        )

        const recurring: RecurringExpense[] = [
          { id: uuid(), title: 'LCL',      category: 'banque',     subCategory: 'Prêt',                    amount: 535.67, currency: 'EUR', isFixed: true,  bank: 'LCL',    person: 'person1', frequency: 'monthly' },
          { id: uuid(), title: 'Mme. Febo',category: 'logement',   subCategory: 'Loyer + Charges',         amount: 2530,   currency: 'CHF', isFixed: true,  bank: 'UBS',    person: 'person1', frequency: 'monthly' },
          { id: uuid(), title: 'Sanitas',  category: 'assurance',  subCategory: 'Maladie (Lamal)',          amount: 442.75, currency: 'CHF', isFixed: true,  bank: 'UBS',    person: 'person1', frequency: 'monthly' },
          { id: uuid(), title: 'Etat',     category: 'impots',     subCategory: 'Global',                  amount: 1611,   currency: 'CHF', isFixed: true,  bank: 'UBS',    person: 'person1', frequency: 'monthly' },
          { id: uuid(), title: 'Spotify',  category: 'abonnements',subCategory: 'Spotify',                 amount: 17.20,  currency: 'EUR', isFixed: false, bank: 'CIC',    person: 'person1', frequency: 'monthly' },
          { id: uuid(), title: 'OpenAI',   category: 'abonnements',subCategory: 'ChatGPT',                 amount: 20.44,  currency: 'EUR', isFixed: false, bank: 'CIC',    person: 'person1', frequency: 'monthly' },
          { id: uuid(), title: 'Canal+',   category: 'abonnements',subCategory: 'Canal+',                  amount: 41.99,  currency: 'EUR', isFixed: false, bank: 'Revolut',person: 'person1', frequency: 'monthly' },
          { id: uuid(), title: 'Sosh',     category: 'abonnements',subCategory: 'Téléphone',               amount: 25.99,  currency: 'EUR', isFixed: false, bank: 'CIC',    person: 'person1', frequency: 'monthly' },
        ]

        set({ expenses, recurring })
        const s = get()
        autoSave(s.expenses, s.recurring, s.settings)
      },

      importData(newExpenses, newRecurring, newBudgets, merge = false) {
        set(s => ({
          expenses:  merge ? [...s.expenses,  ...newExpenses]  : newExpenses,
          recurring: merge ? [...s.recurring, ...newRecurring] : newRecurring,
          budgets:   merge ? [...s.budgets,   ...newBudgets]   : newBudgets,
        }))
        const { expenses, recurring, settings } = get()
        autoSave(expenses, recurring, settings)
      },

      clearData() {
        set({ expenses: [], recurring: [] })
      },

      setBudgetItem(year, month, person, categoryId, amount) {
        set(s => {
          const match = (b: MonthlyBudget) => b.year === year && b.month === month && b.person === person
          const existing = s.budgets.find(match)
          if (existing) {
            const items = existing.items.filter(i => i.categoryId !== categoryId)
            if (amount > 0) items.push({ categoryId, amount })
            return { budgets: s.budgets.map(b => match(b) ? { ...b, items } : b) }
          }
          if (amount <= 0) return {}
          return { budgets: [...s.budgets, { year, month, person, items: [{ categoryId, amount }] }] }
        })
      },

      setBudgetItems(year, month, person, items) {
        set(s => {
          const filtered = s.budgets.filter(b => !(b.year === year && b.month === month && b.person === person))
          return { budgets: items.length > 0 ? [...filtered, { year, month, person, items }] : filtered }
        })
      },

      copyBudget(fromYear, fromMonth, fromPerson, toYear, toMonth, toPerson) {
        const src = get().budgets.find(b => b.year === fromYear && b.month === fromMonth && b.person === fromPerson)
        if (!src) return
        set(s => {
          const filtered = s.budgets.filter(b => !(b.year === toYear && b.month === toMonth && b.person === toPerson))
          return { budgets: [...filtered, { year: toYear, month: toMonth, person: toPerson, estimatedIncome: src.estimatedIncome, items: [...src.items] }] }
        })
      },

      setIncome(year, month, person, amount) {
        set(s => {
          const match = (b: MonthlyBudget) => b.year === year && b.month === month && b.person === person
          const existing = s.budgets.find(match)
          if (existing) {
            return { budgets: s.budgets.map(b => match(b) ? { ...b, estimatedIncome: amount } : b) }
          }
          return { budgets: [...s.budgets, { year, month, person, estimatedIncome: amount, items: [] }] }
        })
      },

      driveToken: null,
      setDriveToken: (token) => set({ driveToken: token }),
      lastAutoBackup: null,
      setLastAutoBackup: (b) => set({ lastAutoBackup: b }),
      claudeApiKey: '',
      setClaudeApiKey: (key) => set({ claudeApiKey: key }),
    }),
    {
      name: 'budget-app-store',
      version: 5,
      partialize: (state) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { claudeApiKey: _dep, ...cleanSettings } = state.settings as AppSettings & { claudeApiKey?: string }
        return {
          expenses: state.expenses,
          recurring: state.recurring,
          budgets: state.budgets,
          settings: cleanSettings,
        }
      },
      migrate(persistedState, version) {
        const s = persistedState as any
        let state = { ...s }
        if (version < 3) {
          state = {
            ...state,
            budgets: (state.budgets ?? []).map((b: any) =>
              b.person ? b : { ...b, person: 'person1' as HouseholdMember }
            ),
          }
        }
        if (version < 4) {
          state = {
            ...state,
            settings: {
              ...state.settings,
              customCategories: state.settings?.customCategories ?? [],
            },
          }
        }
        if (version < 5) {
          state = {
            ...state,
            settings: {
              ...state.settings,
              claudeApiKey: state.settings?.claudeApiKey ?? '',
            },
          }
        }
        return state
      },
    }
  )
)

// Selectors
export const selectExpensesByYearMonth = (
  expenses: Expense[], year: number, month: number | null
) =>
  expenses.filter(e => {
    const ey = parseInt(e.date.slice(0, 4))
    const em = parseInt(e.date.slice(5, 7))
    return ey === year && (month === null || em === month)
  })
