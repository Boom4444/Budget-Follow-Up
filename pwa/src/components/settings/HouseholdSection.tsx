import { useStore } from '../../store/useStore'

/** Foyer: person names, who uses this device, default split for shared expenses. */
export default function HouseholdSection() {
  const { settings, updateSettings } = useStore()
  return (
    <>
      <p className="section-header">Foyer</p>
      <div className="card mx-4 overflow-hidden">
        <div className="flex items-center px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <span className="text-gray-400 dark:text-gray-500 text-sm w-28">Personne 1</span>
          <input type="text" value={settings.person1Name}
            onChange={e => updateSettings({ person1Name: e.target.value })}
            className="flex-1 text-[15px] text-right outline-none bg-transparent dark:text-white" placeholder="Prénom" />
        </div>
        <div className="flex items-center px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <span className="text-gray-400 dark:text-gray-500 text-sm w-28">Personne 2</span>
          <input type="text" value={settings.person2Name}
            onChange={e => updateSettings({ person2Name: e.target.value })}
            className="flex-1 text-[15px] text-right outline-none bg-transparent dark:text-white" placeholder="Prénom" />
        </div>
        {/* Who uses this device — new/imported expenses default to this person */}
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <p className="text-[15px] dark:text-white mb-0.5">Qui utilise cet appareil ?</p>
          <p className="text-[12px] text-gray-400 dark:text-gray-500 mb-2">
            Les nouvelles dépenses et les imports sont attribués à cette personne par défaut
          </p>
          <div className="flex rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700 p-0.5">
            {(['person1', 'person2'] as const).map(p => (
              <button key={p} onClick={() => updateSettings({ currentUser: p })}
                className={`flex-1 py-1.5 text-[13px] font-semibold rounded-lg transition-colors
                  ${(settings.currentUser ?? 'person1') === p ? 'bg-blue-600 text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                {p === 'person1' ? settings.person1Name : settings.person2Name}
              </button>
            ))}
          </div>
        </div>
        {/* Default split for shared expenses */}
        <div className="px-4 py-3">
          <p className="text-[15px] dark:text-white mb-0.5">Répartition des dépenses communes</p>
          <p className="text-[12px] text-gray-400 dark:text-gray-500 mb-2">
            Au prorata : selon les revenus mensuels renseignés dans Budget (ex. loyer).
            Modifiable dépense par dépense.
          </p>
          <div className="flex rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700 p-0.5">
            {([
              { id: 'equal',  label: '50 / 50' },
              { id: 'income', label: 'Prorata des revenus' },
            ] as const).map(opt => (
              <button key={opt.id} onClick={() => updateSettings({ sharedSplitMode: opt.id })}
                className={`flex-1 py-1.5 text-[13px] font-semibold rounded-lg transition-colors
                  ${(settings.sharedSplitMode ?? 'equal') === opt.id ? 'bg-blue-600 text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
