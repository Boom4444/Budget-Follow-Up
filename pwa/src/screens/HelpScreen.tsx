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
      { text: 'Revenez sur Dépenses → appuyez sur + pour saisir votre première dépense.' },
      { text: 'Remplissez titre, montant, catégorie et personne. Ajoutez si besoin.' },
      { text: 'Consultez le Tableau de bord pour voir votre solde et vos graphiques.', note: 'Les données sont sauvegardées automatiquement sur votre appareil.' },
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
      { text: 'Appuyez sur une catégorie dans le graphique circulaire pour l\'isoler.' },
    ],
    tips: [
      'Le graphique en barres montre chaque mois : charges fixes (rouge), variables (bleu), revenus (vert)',
      'Cliquez sur "Dépenses par catégorie" pour filtrer sur une catégorie précise',
    ],
  },
  {
    id: 'expenses',
    icon: '💸',
    title: 'Saisie des dépenses',
    summary: 'Enregistrez chaque transaction.',
    steps: [
      { text: 'Appuyez sur + (en haut à droite) pour ouvrir le formulaire.' },
      { text: 'Type Débit = dépense (rouge) · Crédit = revenu ou remboursement (vert).' },
      { text: 'Choisissez la catégorie via le sélecteur : fixes (loyer, assurance…) ou courantes (courses, loisirs…).' },
      { text: 'Pour "Commun" : un curseur apparaît pour définir la répartition ex. 70% / 30%.', note: 'Le montant total reste à 100% dans le foyer, mais chaque personne porte sa part.' },
      { text: '🔒 Charge fixe = dépense incompressible (loyer, impôts). Les autres sont variables.' },
      { text: 'Glissez une ligne vers la gauche pour la supprimer.' },
    ],
    tips: [
      'Les modèles récurrents apparaissent en suggestions dès que vous tapez — sélectionnez-en un pour pré-remplir',
      'Vous pouvez saisir dans n\'importe quelle devise : la conversion en devise de référence est automatique',
      '📥 Importez un relevé bancaire Revolut, CIC, CdE ou UBS via le bouton import',
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
      { text: 'Exemple : loyer à 70/30 → person1 porte 70%, person2 porte 30% dans les totaux.' },
      { text: 'La dépense totale reste visible dans le foyer ; seule la répartition change par personne.', note: 'Par défaut la répartition est 50/50 si vous ne touchez pas au curseur.' },
    ],
    tips: [
      'Les cartes par personne dans le tableau de bord montrent "dont X commun" pour la transparence',
      'Utile pour loyer, courses, vacances, abonnements familiaux…',
    ],
  },
  {
    id: 'budget',
    icon: '🎯',
    title: 'Budget prévisionnel',
    summary: 'Planifiez et suivez vos objectifs.',
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
    id: 'import',
    icon: '📥',
    title: 'Import de relevés bancaires',
    summary: 'Importez CSV ou XLSX de vos banques.',
    steps: [
      { text: 'Dans l\'onglet Dépenses, appuyez sur 📥 en haut à droite.' },
      { text: 'Sélectionnez un fichier CSV, TSV ou XLSX depuis votre appareil.' },
      { text: 'Les formats Revolut, CIC, Caisse d\'Épargne et UBS sont reconnus automatiquement.' },
      { text: 'L\'app classe les transactions connues. Les inconnues arrivent dans une file de révision.' },
      { text: 'Vérifiez et ajustez les catégories, puis importez les sélectionnées.', note: 'Vous pouvez importer plusieurs relevés de mois différents sans doublons intentionnels.' },
    ],
    tips: [
      'Exportez depuis votre app bancaire en CSV, puis importez ici',
      'Les marchands reconnus (Spotify, Netflix, SNCF…) sont classés automatiquement',
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
      { text: 'Exemples : "Quelles sont mes plus grosses dépenses ce mois ?", "Compare jan vs fév", "Donne-moi des conseils pour économiser".', note: 'L\'assistant voit un résumé de vos 12 derniers mois — pas de données brutes envoyées.' },
    ],
    tips: [
      'Posez des questions précises pour des réponses plus utiles',
      'Chaque conversation repart de zéro — appuyez sur "Nouvelle discussion" pour effacer',
    ],
  },
  {
    id: 'backup',
    icon: '☁️',
    title: 'Sauvegarde',
    summary: 'Protégez et exportez vos données.',
    steps: [
      { text: 'Réglages → Sauvegarde : exportez en JSON (sauvegarde complète) ou TSV (tableur).' },
      { text: 'Importez un JSON pour restaurer, avec option fusionner ou remplacer.' },
      { text: 'Les sauvegardes automatiques (5 dernières) se téléchargent depuis les Réglages.' },
      { text: 'Google Drive : configurez un OAuth Client ID pour des sauvegardes cloud.', note: 'Les données sont stockées sur votre appareil — l\'export JSON est votre bouée de secours.' },
    ],
    tips: [
      'Exportez un JSON avant chaque mise à jour ou réinitialisation',
      'Le TSV s\'ouvre dans Excel ou Google Sheets pour des analyses avancées',
    ],
  },
  {
    id: 'tips',
    icon: '💡',
    title: 'Astuces',
    summary: '',
    alwaysOpen: true,
    tips: [
      'Ajoutez l\'app à l\'écran d\'accueil (iOS : Partager → Ajouter) pour un accès instantané hors-ligne',
      'Utilisez les modèles récurrents pour saisir le loyer ou les abonnements en 1 tap',
      'La devise de référence sert à tous les totaux — choisissez-la une fois pour toutes',
      'Le glisser-gauche sur une dépense la supprime immédiatement',
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
