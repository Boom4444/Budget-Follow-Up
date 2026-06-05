import { useState } from 'react'
import SimulateurScreen from './SimulateurScreen'
import PatrimoineScreen from './PatrimoineScreen'

type Tool = 'simulateur' | 'patrimoine' | null

export default function OutilsScreen() {
  const [openTool, setOpenTool] = useState<Tool>(null)

  const tools = [
    {
      id: 'simulateur' as Tool,
      icon: '📈',
      title: "Simulateur d’intérêts composés",
      desc: "Projetez la croissance de votre épargne sur le long terme et comparez plusieurs scénarios.",
      accent: '#6366f1',
    },
    {
      id: 'patrimoine' as Tool,
      icon: '🏦',
      title: 'Calculateur de patrimoine',
      desc: 'Analysez votre cashflow mensuel : revenus, investissements et dépenses par catégorie.',
      accent: '#f97316',
    },
  ]

  return (
    <div className="flex flex-col h-full bg-[#f2f2f7] dark:bg-[#1c1c1e]"
         style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>

      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700 flex-shrink-0 px-4 py-3">
        <h1 className="text-[17px] font-semibold dark:text-white">Outils financiers</h1>
        <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">Calculateurs & simulateurs</p>
      </div>

      <div className="flex-1 overflow-y-auto scroll-ios pb-6">
        <div className="px-4 pt-4 space-y-3">
          {tools.map(tool => (
            <button key={String(tool.id)} onClick={() => setOpenTool(tool.id)}
              className="w-full card p-4 flex items-start gap-4 text-left active:opacity-80 transition-opacity">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 text-2xl"
                   style={{ backgroundColor: tool.accent + '20' }}>
                {tool.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold dark:text-white mb-1">{tool.title}</p>
                <p className="text-[12px] text-gray-400 dark:text-gray-500 leading-relaxed">{tool.desc}</p>
              </div>
              <span className="text-gray-300 dark:text-gray-600 text-[22px] font-light flex-shrink-0 mt-1">›</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tool overlays */}
      {openTool === 'simulateur' && (
        <div className="fixed inset-0 z-40 flex flex-col bg-[#f2f2f7] dark:bg-[#1c1c1e]">
          <SimulateurScreen onClose={() => setOpenTool(null)} />
        </div>
      )}

      {openTool === 'patrimoine' && (
        <div className="fixed inset-0 z-40 flex flex-col bg-[#f2f2f7] dark:bg-[#1c1c1e]">
          <PatrimoineScreen onClose={() => setOpenTool(null)} />
        </div>
      )}
    </div>
  )
}
