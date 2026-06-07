import { useState } from 'react'

interface Step {
  text: string
  note?: string
}

interface Section {
  id: string
  icon: string
  title: string
  summary: string
  steps?: Step[]
  tips?: string[]
  alwaysOpen?: boolean
}

const SECTIONS: Section[] = [
  {
    id: 'quickstart',
    icon: '🚀',
    title: 'Démarrage rapide',
    summary: 'Commencez en 3 minutes.',
    alwaysOpen: true,
    steps: [
      { text: 'Ouvrez Réglages → configurez les noms du foyer et la devise de référence.' },
      { text: 'Onglet Dépenses → bouton + (en haut à droite) pour saisir votre première dépense.' },
      { text: 'Remplissez titre, montant, catégorie et personne. Validez.' },
      { text: 'Consultez le Tableau de bord pour voir votre solde et graphiques.', note: 'Les données sont sauvegardées automatiquement sur votre appareil.' },
      { text: 'Explorez l\'onglet Outils (📐) pour simuler votre épargne ou analyser votre cashflow.' },
    ],
  },
  {
    id: 'dashboard',
    icon: '📊',
    title: 'Tableau de bord',
    summary: 'Vue d\'ensemble financière du foyer.',
    steps: [
      { text: 'Naviguez par année (flèches) et filtrez par mois via les chips.' },
      { text: 'Filtrez par personne : Foyer (tout), votre prénom, celui du partenaire, ou Commun.' },
      { text: 'Le solde = revenus − dépenses. En vert si positif, rouge si négatif.' },
      { text: 'Les montants par personne incluent leur quote-part des dépenses communes.', note: 'Ex : loyer 2 000 € à 70/30 → 1 400 € pour person1, 600 € pour person2.' },
      { text: 'Appuyez sur une tranche du graphique circulaire pour isoler la catégorie.' },
    ],
    tips: [
      'Le graphique en barres montre chaque mois : charges fixes (rouge), variables (bleu), revenus (vert)',
      'Cliquez sur "Dépenses par catégorie" pour filtrer toutes les dépenses sur une catégorie précise',
    ],
  },
  {
    id: 'expenses',
    icon: '💸',
    title: 'Saisie des dépenses',
    summary: 'Enregistrez chaque transaction manuellement.',
    steps: [
      { text: 'Appuyez sur le bouton + en haut à droite du header pour ouvrir le formulaire.' },
      { text: 'Type Débit = dépense (rouge) · Crédit = revenu ou remboursement (vert).' },
      { text: 'Choisissez la catégorie : fixes (loyer, assurance…) ou courantes (courses, loisirs…).' },
      { text: 'Pour "Commun" : un curseur de répartition apparaît (ex. 70 % / 30 %).', note: 'Par défaut 50/50. La dépense totale reste visible dans le foyer.' },
      { text: '🔒 Charge fixe = dépense incompressible (loyer, impôts). Les autres sont variables.' },
      { text: 'Glissez une ligne vers la gauche pour la supprimer.' },
    ],
    tips: [
      'Les modèles récurrents apparaissent en suggestions quand vous tapez — sélectionnez-en un pour pré-remplir',
      'Vous pouvez saisir dans n\'importe quelle devise : la conversion en devise de référence est automatique',
    ],
  },
  {
    id: 'import',
    icon: '📥',
    title: 'Import de relevés bancaires',
    summary: 'Importez CSV, XLSX, TXT ou depuis Google Drive.',
    steps: [
      { text: 'Dans l\'onglet Dépenses, appuyez sur "Relevé" en haut à droite.' },
      { text: 'Choisissez un fichier : CSV, TSV, TXT ou XLSX depuis votre appareil ou Google Drive.', note: 'Sur iPhone, "Parcourir" dans le sélecteur de fichiers donne accès à vos fichiers Google Drive.' },
      { text: 'Les formats Revolut, CIC, Caisse d\'Épargne et UBS sont reconnus automatiquement.' },
      { text: 'Choisissez à qui appartiennent ces transactions (personne 1 ou 2) via les chips en haut de la feuille de révision.' },
      { text: 'L\'app classe les transactions connues. Les inconnues arrivent en file de révision ⚠.' },
      { text: 'Ajustez les catégories puis appuyez sur "Importer X transactions".', note: 'Les transactions non classifiées s\'importent en catégorie "Autre".' },
    ],
    tips: [
      'Exportez depuis votre app bancaire en CSV puis importez ici',
      'Les marchands connus (Spotify, Netflix, SNCF…) sont classés automatiquement',
      'Importez plusieurs relevés de mois différents — les doublons sont à votre charge de vérification',
    ],
  },
  {
    id: 'split',
    icon: '⚖️',
    title: 'Répartition des dépenses communes',
    summary: 'Répartissez les charges partagées au prorata.',
    steps: [
      { text: 'Dans le formulaire d\'ajout, choisissez "Commun" dans le champ Personne.' },
      { text: 'Un curseur de répartition apparaît : glissez pour ajuster le % de chaque conjoint.' },
      { text: 'Exemple : loyer à 70/30 → person1 porte 70 %, person2 porte 30 % dans les totaux.' },
      { text: 'La dépense totale reste visible dans le foyer ; seule la répartition change par personne.', note: 'Par défaut la répartition est 50/50 si vous ne touchez pas au curseur.' },
    ],
    tips: [
      'Les cartes par personne dans le tableau de bord affichent "dont X commun" pour la transparence',
      'Utile pour loyer, courses, vacances, abonnements familiaux…',
    ],
  },
  {
    id: 'budget',
    icon: '🎯',
    title: 'Budget prévisionnel',
    summary: 'Planifiez et suivez vos objectifs mensuels.',
    steps: [
      { text: 'Accédez à l\'onglet Budget, choisissez le mois et la personne.' },
      { text: 'Saisissez un revenu estimé en haut pour calculer le reste disponible.' },
      { text: 'Appuyez sur une catégorie pour saisir le montant prévu.' },
      { text: 'La barre de progression compare budget prévu vs dépenses réelles.' },
      { text: 'Déviation rouge = dépassement · orange = proche · vert = dans les clous.' },
      { text: 'Bouton "Copier" pour dupliquer le budget d\'un mois précédent.', note: 'Gain de temps si vos charges ne changent pas d\'un mois à l\'autre.' },
    ],
    tips: [
      'Configurez un budget une fois et copiez-le chaque mois',
      'Les charges fixes (🔒) se distinguent des variables pour mieux cibler les économies',
    ],
  },
  {
    id: 'recurring',
    icon: '🔄',
    title: 'Charges récurrentes',
    summary: 'Modèles pour vos dépenses régulières.',
    steps: [
      { text: 'Créez un modèle dans l\'onglet Récurrentes : loyer, abonnements, assurances…' },
      { text: 'Lors de la saisie d\'une dépense, vos modèles apparaissent en suggestions.' },
      { text: 'Sélectionnez un modèle pour pré-remplir automatiquement tous les champs.' },
      { text: 'La fréquence (mensuel, hebdo…) est indicative — les modèles ne se saisissent pas seuls.', note: 'Vous gardez le contrôle sur chaque saisie.' },
    ],
  },
  {
    id: 'outils',
    icon: '📐',
    title: 'Outils financiers',
    summary: 'Simulateur d\'épargne et calculateur de patrimoine.',
    steps: [
      { text: 'Accédez à l\'onglet Outils (📐) pour trouver deux calculateurs avancés.' },
      {
        text: 'Simulateur d\'intérêts composés : entrez capital initial, épargne mensuelle, horizon et taux annuel.',
        note: 'L\'axe Y utilise k€ et M€ pour rester lisible même sur de longs horizons.',
      },
      { text: 'Ajoutez jusqu\'à 4 scénarios pour les comparer sur le même graphique : appuyez sur + à côté des chips.' },
      { text: 'Le tableau de comparaison affiche capital final, versements, intérêts et l\'écart vs scénario 1 en vert/rouge.' },
      {
        text: 'Calculateur de patrimoine : renseignez revenus, investissements puis dépenses en 3 étapes.',
        note: 'Sur l\'étape Dépenses, le bouton "📊 Importer mes dépenses réelles" pré-remplit les catégories depuis la moyenne de vos 3 derniers mois.',
      },
      { text: 'Le résultat affiche votre taux d\'épargne, cashflow disponible et un diagramme de flux (Sankey) de votre budget.' },
    ],
    tips: [
      'Changez le nom d\'un scénario en le tapant directement dans le champ de titre',
      'Le simulateur fonctionne aussi pour modéliser un remboursement de crédit (taux négatif)',
      'Le calculateur de patrimoine vous donne votre "taux d\'épargne possible" si vous optimisez le disponible',
    ],
  },
  {
    id: 'ai',
    icon: '🤖',
    title: 'Assistant IA',
    summary: 'Posez des questions en langage naturel.',
    steps: [
      { text: 'Obtenez une clé API Claude sur console.anthropic.com (gratuit pour commencer).' },
      { text: 'Entrez la clé dans Réglages → Assistant IA.' },
      { text: 'Accédez à l\'onglet 🤖 IA et posez vos questions.' },
      {
        text: 'Exemples : "Quelles sont mes plus grosses dépenses ce mois ?", "Compare jan vs fév", "Donne-moi des conseils pour économiser".',
        note: 'L\'assistant voit un résumé de vos 12 derniers mois — pas de données brutes envoyées.',
      },
    ],
    tips: [
      'Posez des questions précises pour des réponses plus utiles',
      'Chaque conversation repart de zéro — appuyez sur "Nouvelle discussion" pour effacer',
    ],
  },
  {
    id: 'backup',
    icon: '☁️',
    title: 'Sauvegarde & Export',
    summary: 'Exportez en JSON, CSV, Excel ou PDF · Sauvegardez sur Google Drive.',
    steps: [
      {
        text: 'Réglages → "Exporter…" ouvre un choix de format : JSON (sauvegarde complète), CSV (tableur), Excel (.xlsx) ou PDF (impression).',
        note: 'Le JSON est le seul format restaurable. Les autres sont pour l\'analyse externe.',
      },
      { text: 'Importez un JSON pour restaurer vos données, avec l\'option fusionner ou remplacer.' },
      { text: 'Les sauvegardes automatiques (5 dernières) sont accessibles dans Réglages et téléchargeables à tout moment.' },
      {
        text: 'Google Drive : configurez un OAuth Client ID dans Réglages, connectez-vous, puis choisissez le dossier de destination via "Dossier de sauvegarde".',
        note: 'Le dossier sélectionné est mémorisé. Reconnectez-vous et le bon dossier est utilisé automatiquement.',
      },
      { text: 'Le bouton "↑ Sauvegarder sur Drive" envoie un fichier JSON horodaté dans le dossier sélectionné.' },
      { text: 'Restaurez n\'importe quelle sauvegarde Drive en appuyant sur "↓ Restaurer" dans la liste.' },
    ],
    tips: [
      'Exportez un JSON avant chaque mise à jour importante ou réinitialisation',
      'Le CSV/Excel s\'ouvre dans Excel ou Google Sheets pour des analyses et graphiques avancés',
      'Le PDF génère une page imprimable de toutes vos transactions',
    ],
  },
  {
    id: 'updates',
    icon: '🔄',
    title: 'Mises à jour',
    summary: 'Vérifiez et installez les nouvelles versions.',
    steps: [
      { text: 'Réglages → À propos → appuyez sur "Vérifier les mises à jour".' },
      { text: 'Si une nouvelle version est disponible, son numéro s\'affiche et un bouton "Installer" apparaît.' },
      { text: 'Si vous êtes à jour, "✓ Vous avez la dernière version" s\'affiche en vert.' },
      {
        text: 'Un bandeau bleu apparaît automatiquement en haut de l\'écran quand une mise à jour est prête.',
        note: 'L\'app vérifie aussi à chaque retour au premier plan — aucune action manuelle requise.',
      },
    ],
    tips: [
      'La version installée est toujours visible dans Réglages → À propos',
      'L\'installation recharge l\'app — vos données locales sont préservées',
    ],
  },
  {
    id: 'tips',
    icon: '💡',
    title: 'Astuces',
    summary: '',
    alwaysOpen: true,
    tips: [
      'Ajoutez l\'app à l\'écran d\'accueil (iOS : Partager → Sur l\'écran d\'accueil) pour un accès hors-ligne instantané',
      'Scrollez avec le doigt en cours de saisie : le clavier se ferme automatiquement',
      'Utilisez les modèles récurrents pour saisir loyer ou abonnements en 1 tap',
      'Le calculateur de patrimoine → "Importer mes dépenses réelles" prend la moyenne de vos 3 derniers mois',
      'Le simulateur : ajoutez 3 scénarios (pessimiste / réaliste / optimiste) pour visualiser l\'écart en M€',
      'Glissez une dépense vers la gauche pour la supprimer instantanément',
      'Copiez votre budget d\'un mois à l\'autre pour aller vite',
      'L\'IA peut identifier des tendances que les graphiques ne montrent pas clairement',
    ],
  },
]

export default function HelpScreen() {
  const [openId, setOpenId] = useState<string | null>('quickstart')

  return (
    <div className="flex flex-col h-full bg-[#f2f2f7] dark:bg-[#1c1c1e]">
      <header className="pt-safe flex-shrink-0 bg-[#f2f2f7] dark:bg-[#1c1c1e] border-b border-gray-200 dark:border-gray-700 px-4 py-4">
        <h1 className="text-[22px] font-bold leading-tight text-gray-900 dark:text-white">
          Aide &amp; Guide
        </h1>
        <p className="text-[13px] text-gray-400 dark:text-gray-500 mt-0.5">Appuyez sur une section pour la développer</p>
      </header>

      <div className="flex-1 scroll-ios pb-safe overflow-y-auto px-4 pt-3 pb-6">
        <div className="space-y-3">
          {SECTIONS.map(section => {
            const isAlwaysOpen = section.alwaysOpen === true
            const isOpen = isAlwaysOpen || openId === section.id

            return (
              <div key={section.id} className="card overflow-hidden">
                <button
                  type="button"
                  disabled={isAlwaysOpen}
                  onClick={() => !isAlwaysOpen && setOpenId(prev => prev === section.id ? null : section.id)}
                  className={[
                    'w-full flex items-center gap-3 px-4 py-3.5 text-left',
                    !isAlwaysOpen ? 'active:bg-gray-50 dark:active:bg-gray-700' : 'cursor-default',
                  ].join(' ')}
                  aria-expanded={isOpen}
                >
                  <span className="text-2xl leading-none flex-shrink-0">{section.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-gray-900 dark:text-white">{section.title}</p>
                    {!isOpen && section.summary && (
                      <p className="text-[12px] text-gray-400 dark:text-gray-500 truncate">{section.summary}</p>
                    )}
                  </div>
                  {!isAlwaysOpen && (
                    <span className={`ml-2 flex-shrink-0 text-gray-300 dark:text-gray-600 text-[11px] transition-transform duration-200 inline-block ${isOpen ? 'rotate-180' : ''}`}>
                      ▼
                    </span>
                  )}
                </button>

                {isOpen && (
                  <div className="border-t border-gray-100 dark:border-gray-700 px-4 pb-4 pt-3">
                    {section.steps && (
                      <ol className="space-y-3 mb-3">
                        {section.steps.map((step, i) => (
                          <li key={i} className="flex gap-3">
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-[11px] font-bold flex items-center justify-center mt-0.5">
                              {i + 1}
                            </span>
                            <div className="flex-1">
                              <p className="text-[13.5px] text-gray-700 dark:text-gray-200 leading-snug">{step.text}</p>
                              {step.note && (
                                <p className="text-[11.5px] text-gray-400 dark:text-gray-500 mt-0.5 italic">{step.note}</p>
                              )}
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}

                    {section.tips && (
                      <div className={section.steps ? 'border-t border-gray-100 dark:border-gray-700 pt-3' : ''}>
                        {section.steps && (
                          <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Astuces</p>
                        )}
                        <ul className="space-y-2">
                          {section.tips.map((tip, i) => (
                            <li key={i} className="flex gap-2 items-start">
                              <span className="text-yellow-400 text-[13px] mt-0.5 flex-shrink-0">✦</span>
                              <span className="text-[13px] text-gray-600 dark:text-gray-300 leading-snug">{tip}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
