import { useState } from 'react'

interface Section {
  id: string
  icon: string
  title: string
  body: string
  alwaysOpen?: boolean
  bulletList?: string[]
}

const SECTIONS: Section[] = [
  {
    id: 'dashboard',
    icon: '📊',
    title: 'Tableau de bord',
    body: "Visualisez votre solde mensuel, la répartition dépenses/revenus, et l’évolution annuelle en graphique. Filtrez par mois ou par personne du foyer.",
  },
  {
    id: 'expenses',
    icon: '💸',
    title: 'Dépenses',
    body: "Appuyez sur + pour ajouter une dépense. Glissez ‹ vers la gauche pour supprimer. Le Débit = dépense, le Crédit = revenu ou remboursement (affiché en vert 💚). Le 🔒 indique une charge fixe incompressible.",
  },
  {
    id: 'budget',
    icon: '🎯',
    title: 'Budget',
    body: "Définissez un budget prévisionnel par catégorie pour chaque mois, avant ou après. Comparez ensuite les dépenses réelles au budget. Copiez le budget d’un mois précédent pour aller vite. Les déviations en rouge = dépassement.",
  },
  {
    id: 'recurring',
    icon: '🔄',
    title: 'Récurrentes',
    body: "Créez des modèles pour vos charges mensuelles (loyer, abonnements…). Lors de la saisie, appuyez sur un modèle pour pré-remplir le formulaire automatiquement.",
  },
  {
    id: 'backup',
    icon: '☁️',
    title: 'Sauvegarde',
    body: "Exportez en JSON (sauvegarde complète) ou en TSV (compatible tableur). Importez depuis un fichier avec option fusionner/remplacer. Connectez Google Drive pour des sauvegardes cloud : Réglages → Google Drive.",
  },
  {
    id: 'settings',
    icon: '⚙️',
    title: 'Réglages',
    body: "Changez la devise de base, gérez vos banques, activez le mode sombre ou suivez le système. L’application fonctionne hors-ligne et se comporte comme une app native une fois ajoutée à l’écran d’accueil.",
  },
  {
    id: 'tips',
    icon: '💡',
    title: 'Conseils',
    alwaysOpen: true,
    body: '',
    bulletList: [
      "Utilisez les modèles récurrents pour accélérer la saisie",
      "Ajoutez l’app à l’écran d’accueil pour un accès instantané hors ligne",
      "Exportez un JSON chaque mois pour votre historique",
      "Le solde = revenus − dépenses du mois sélectionné",
      "Les graphiques dans Budget vous montrent où vous déviez",
    ],
  },
]

export default function HelpScreen() {
  const [openId, setOpenId] = useState<string | null>(null)

  function toggle(id: string) {
    setOpenId(prev => (prev === id ? null : id))
  }

  return (
    <div className="flex flex-col h-full bg-[#f2f2f7] dark:bg-[#1c1c1e]">
      {/* Fixed header */}
      <header className="pt-safe flex-shrink-0 bg-[#f2f2f7] dark:bg-[#1c1c1e] border-b border-gray-200 dark:border-gray-700 px-4 py-4">
        <h1 className="text-[22px] font-bold leading-tight text-gray-900 dark:text-white">
          Aide &amp; Guide
        </h1>
      </header>

      {/* Scrollable body */}
      <div className="flex-1 scroll-ios pb-safe px-4 pt-2">
        <p className="section-header pl-0">Comment utiliser l&apos;application</p>

        <div className="card overflow-hidden">
          {SECTIONS.map((section, index) => {
            const isAlwaysOpen = section.alwaysOpen === true
            const isOpen = isAlwaysOpen || openId === section.id

            return (
              <div key={section.id}>
                {/* Divider between items (not before first) */}
                {index > 0 && (
                  <div className="h-px bg-gray-100 dark:bg-gray-700 mx-4" />
                )}

                {/* Section header row */}
                <button
                  type="button"
                  disabled={isAlwaysOpen}
                  onClick={() => !isAlwaysOpen && toggle(section.id)}
                  className={[
                    'w-full flex items-center justify-between px-4 py-3 text-left',
                    'transition-colors duration-150',
                    !isAlwaysOpen
                      ? 'active:bg-gray-50 dark:active:bg-gray-700 cursor-pointer'
                      : 'cursor-default',
                  ].join(' ')}
                  aria-expanded={isOpen}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <span className="text-xl leading-none flex-shrink-0" aria-hidden="true">
                      {section.icon}
                    </span>
                    <span className="text-base font-semibold text-gray-900 dark:text-white truncate">
                      {section.title}
                    </span>
                  </span>

                  {!isAlwaysOpen && (
                    <span
                      className={[
                        'ml-3 flex-shrink-0 text-gray-400 dark:text-gray-500 text-sm transition-transform duration-200 inline-block',
                        isOpen ? 'rotate-180' : 'rotate-0',
                      ].join(' ')}
                      aria-hidden="true"
                    >
                      ▼
                    </span>
                  )}
                </button>

                {/* Expandable / always-visible body */}
                {isOpen && (
                  <div className="px-4 pb-4">
                    {section.bulletList ? (
                      <ul className="space-y-2 mt-0.5">
                        {section.bulletList.map((item, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300 leading-relaxed"
                          >
                            <span className="mt-[7px] flex-shrink-0 w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mt-0.5">
                        {section.body}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Bottom breathing room */}
        <div className="h-6" />
      </div>
    </div>
  )
}
