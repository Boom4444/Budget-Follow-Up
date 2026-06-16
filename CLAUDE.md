# Budget Foyer — PWA de suivi de budget à deux (iOS Safari first)

React 18 + TypeScript + Vite + Tailwind + Zustand. Tout vit dans `pwa/`.
Déployée sur GitHub Pages par `.github/workflows/deploy-pwa.yml` à chaque push
sur `main` (≈1 min). Pas de backend : données en localStorage, sauvegarde et
synchronisation via Google Drive (API REST + GIS), conversion de devises via
api.frankfurter.app, IA via api.anthropic.com.

## Commandes (depuis `pwa/`)

```
npm run build    # tsc + vite build — DOIT être propre avant commit
npm run test     # vitest (118 tests) — DOIT passer avant commit
```

## Workflow de livraison (à respecter à chaque changement)

1. Bumper `version` dans `pwa/package.json` (affiché dans Réglages → À propos ;
   `public/version.json` est régénéré au build).
2. `npm run build` puis `npm run test` propres.
3. Commit descriptif, push sur `main`, vérifier le run "Deploy PWA to GitHub
   Pages" (API GitHub authentifiée — l'API anonyme est vite rate-limitée).
4. Répondre à l'utilisateur en français (consignes de test : vider le cache,
   vérifier la version dans À propos).

## Carte des modules — OÙ ÉDITER QUOI

| Sujet | Fichier |
|---|---|
| Types du domaine (Expense, MonthlyBudget, AppSettings…) | `src/models/types.ts` |
| Store Zustand : actions, persistance (clé `budget-app-store`, version 8), migrations, corbeille, tombstones, données démo | `src/store/useStore.ts` |
| Catégories intégrées + sous-catégories + tri | `src/data/categories.ts` |
| Devises, taux, conversion historique | `src/data/currencies.ts` |
| Répartition personne/foyer (50/50, prorata des revenus, part d'une personne) | `src/utils/split.ts` |
| Budget vs réel (carte du dashboard ET tests) | `src/utils/budgetTracking.ts` |
| Import relevés bancaires (CSV/PDF/XLSX Revolut, CIC, UBS…), règles mots-clés → catégorie | `src/utils/bankImport.ts` |
| Export/restauration JSON-CSV-XLSX-PDF, sauvegarde locale 5 emplacements, `parseJSONBackup` | `src/utils/backup.ts` |
| Client API Google Drive (token GIS, fichiers, dossiers) — sans état, ne touche pas au store | `src/utils/googleDrive.ts` |
| Obtention de token Drive avec cache/refresh silencieux | `src/utils/driveSession.ts` |
| Moteur de fusion de la synchro foyer (pur, testé) : LWW par id, tombstones | `src/utils/sync.ts` |
| Corbeille : rétention 30 j, purge | `src/utils/trash.ts` + `src/components/TrashSheet.tsx` |
| Clé API Claude chiffrée (AES-GCM/IndexedDB) | `src/utils/secureStorage.ts` |
| Polyfills iOS < 18.4 (chargés en premier dans main.tsx — NE PAS retirer) | `src/utils/polyfills.ts` |
| Hook sauvegarde auto Drive (fichier par appareil) | `src/hooks/useAutoBackupToDrive.ts` |
| Hook synchro foyer (fichier partagé `budget-foyer-sync.json`) | `src/hooks/useDriveSync.ts` |
| Écrans : Tableau de bord / Dépenses+import / Budget / Récurrentes / Réglages | `src/screens/*.tsx` |
| Saisie/édition d'une dépense (personne, répartition) | `src/components/AddExpenseModal.tsx` |
| CSP + version + PWA manifest | `vite.config.ts` (CSP injectée au build seulement) |

## Invariants à ne pas casser (couverts par les tests)

- **Conservation des parts** : part person1 + part person2 = montant foyer,
  pour chaque dépense partagée, chaque mois, et pour les budgets
  (`coherence.test.ts`). Toute nouvelle agrégation par personne doit passer
  par `personShareFraction`/`computeBudgetTracking`.
- **Synchro** : la fusion est commutative/convergente (LWW + tombstones).
  Toute action du store qui modifie expenses/recurring/budgets doit stamper
  `updatedAt: Date.now()` ; toute suppression doit poser un tombstone.
- **Jamais** la clé API Claude dans un export/backup/fichier Drive.
- **Settings non synchronisés** entre téléphones (sauf customCategories +
  deletedBuiltinCategories) ; `currentUser` jamais restauré d'un backup.
- Un fichier distant corrompu ne doit jamais écraser les données locales
  (`parseSyncData`/`parseJSONBackup` retournent null → on ignore).
- `budget-app-store` version 8 : nouvelle clé persistée = l'ajouter au
  `partialize` ; champ obligatoire nouveau = migration + bump de version.

## Données de test & tests

- `public/demo-foyer.json` : jeu 2 personnes à montants ronds (juin 2026 :
  foyer 3300, Alex 1890, Sam 1410 ; prorata 60/40 ; mai : 50/50). Les valeurs
  attendues des tests `coherence.test.ts` et `ui.test.tsx` en découlent — si
  on modifie ce fichier, recalculer les attendus À LA MAIN.
- `ui.test.tsx` monte les vrais écrans (jsdom) ; stub ResizeObserver requis.
- Fixtures PDF/CSV réels de banques : jamais commités (privés, gitignorés).

## Pièges connus

- iOS Safari < 18.4 : pas d'itération async sur ReadableStream → polyfills.
  `build.target: 'es2022'` obligatoire (downlevel esbuild casse pdf.js).
- pdf.js tourne en mode fake-worker (import direct du worker, pas de Worker).
- GitHub Pages ne sert pas d'en-têtes : CSP en meta tag, scripts inline
  interdits en prod (theme-init.js est un fichier externe pour ça).
- `xlsx` 0.18.5 : 2 CVE connues sans correctif sur npm (CDN SheetJS bloqué) —
  risque accepté, exposition limitée aux fichiers choisis par l'utilisateur.
- Rollback : la branche `backup/v1.11.1-stable` fige l'état d'avant la
  synchro foyer.
