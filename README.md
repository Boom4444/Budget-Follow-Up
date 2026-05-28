# BudgetApp — Application de Budget Personnel iOS

Application native iOS pour le suivi de budget d'un foyer de 2 personnes, avec gestion multi-devises, charges incompressibles et tableaux de bord interactifs.

## Stack technique

| Couche | Technologie |
|---|---|
| UI | SwiftUI 5 |
| Persistance | SwiftData (iOS 17+) |
| Graphiques | Swift Charts |
| Architecture | MVVM |
| Langage | Swift 5.9 |

**Cible minimale : iOS 17.0**

---

## Structure du projet

```
BudgetApp/
├── App/
│   ├── BudgetApp.swift          # Point d'entrée @main
│   └── ContentView.swift        # TabView principale
│
├── Models/                      # Entités SwiftData
│   ├── Expense.swift            # Dépense (@Model)
│   ├── ExpenseCategory.swift    # 25 catégories (enum)
│   ├── RecurringExpense.swift   # Modèle récurrent (@Model)
│   ├── CurrencyCode.swift       # 12 devises (enum)
│   ├── HouseholdMember.swift    # Personne 1 / 2 / Commun
│   └── AppSettings.swift        # Réglages foyer (@Model)
│
├── ViewModels/
│   ├── DashboardViewModel.swift    # Calculs dashboard
│   ├── ExpenseListViewModel.swift  # Filtres & tri liste
│   └── AddExpenseViewModel.swift   # Formulaire + suggestions
│
├── Views/
│   ├── Dashboard/
│   │   ├── DashboardView.swift
│   │   ├── YearSummaryView.swift
│   │   ├── MonthlyTrendView.swift
│   │   └── CategoryBreakdownView.swift
│   ├── Expenses/
│   │   ├── ExpenseListView.swift
│   │   ├── ExpenseRowView.swift
│   │   └── AddExpenseView.swift
│   ├── Recurring/
│   │   ├── RecurringExpenseListView.swift
│   │   └── AddRecurringExpenseView.swift
│   ├── Settings/
│   │   └── SettingsView.swift
│   └── Components/
│       ├── AmountView.swift
│       ├── CategoryBadgeView.swift
│       └── CategoryPickerView.swift
│
├── Services/
│   └── CurrencyService.swift
│
├── Extensions/
│   ├── Date+Extensions.swift
│   └── Double+Extensions.swift
│
└── PreviewContent/
    └── PreviewData.swift        # 6 mois de données exemple
```

---

## Ouverture dans Xcode

### Option A — Projet inclus

```bash
open BudgetApp.xcodeproj
```

Sélectionner une cible iPhone et appuyer sur ▶.

### Option B — Nouveau projet Xcode

1. **File → New → Project** → `App` (iOS)
2. Nom : `BudgetApp`, Interface : `SwiftUI`, Language : `Swift`
3. Minimum Deployment : **iOS 17.0**
4. Supprimer `ContentView.swift` généré automatiquement
5. Glisser le dossier `BudgetApp/` dans le navigateur Xcode
6. S'assurer que tous les fichiers sont inclus dans la target

---

## Fonctionnalités V1

### Tableau de bord
- Sélecteur année ◀▶ + chips mois
- Cartes résumé : total, incompressible vs variable, par personne
- Graphique barres mensuel (incompressible / variable)
- Camembert des 8 premières catégories (tap pour focus)
- Filtre par membre du foyer

### Saisie de dépense
- Montant + sélecteur devise (12 devises, conversion automatique)
- 25 catégories avec icônes SF Symbols
- Badge **Incompressible** ← automatique selon catégorie, modifiable
- Personne (Moi / Partenaire / Commun) + Banque + Date + Notes
- **Suggestions** : modèles récurrents + titres récents filtrés en live
- Enregistrement direct en modèle récurrent

### Liste des dépenses
- Groupées par mois, total par groupe
- Recherche plein texte + filtres (personne, type, catégorie)
- Tri : date, montant, catégorie
- Swipe-to-delete

### Dépenses récurrentes
- Modèles avec fréquence (hebdo → annuel)
- Charge mensuelle estimée calculée automatiquement

### Réglages
- Prénoms des 2 membres, devise de référence, banques

---

## Devises supportées

EUR · USD · GBP · CHF · MAD · DZD · TND · JPY · CAD · AUD · SGD · AED

Les taux sont intégrés localement (approximatifs). Une future version pourra
les récupérer via une API (Frankfurter, Open Exchange Rates).
