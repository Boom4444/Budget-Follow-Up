import { useStore } from '../store/useStore'
import { daysLeft, TRASH_RETENTION_DAYS } from '../utils/trash'

/** Full-screen trash: restore or permanently delete items removed in the
 *  last 30 days (opened from Settings → Sauvegarde & Données). */
export default function TrashSheet({ onClose }: { onClose: () => void }) {
  const {
    trashedExpenses, trashedRecurring, restoreExpense, restoreRecurring,
    deleteTrashedExpense, deleteTrashedRecurring, emptyTrash,
  } = useStore()

  const count = trashedExpenses.length + trashedRecurring.length

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#f2f2f7] dark:bg-[#1c1c1e]"
         style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <button onClick={onClose} className="text-blue-600 font-medium text-[15px]">Fermer</button>
        <span className="font-semibold text-[17px] dark:text-white">Corbeille</span>
        {count > 0 ? (
          <button
            onClick={() => { if (window.confirm('Vider la corbeille ? Cette action est définitive.')) emptyTrash() }}
            className="text-red-500 font-medium text-[14px]">Vider</button>
        ) : <div className="w-14" />}
      </div>
      <div className="flex-1 overflow-y-auto scroll-ios pb-8">
        <p className="px-4 pt-3 text-[12px] text-gray-400 dark:text-gray-500">
          Les éléments supprimés sont conservés {TRASH_RETENTION_DAYS} jours sur cet appareil,
          puis supprimés définitivement. Vous pouvez les restaurer ou les supprimer immédiatement.
        </p>
        {count === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <span className="text-4xl mb-3">🗑️</span>
            <p className="text-[15px] text-gray-400 dark:text-gray-500">La corbeille est vide</p>
          </div>
        )}
        {trashedExpenses.length > 0 && (
          <>
            <p className="section-header">Dépenses ({trashedExpenses.length})</p>
            <div className="card mx-4 overflow-hidden">
              {[...trashedExpenses].sort((a, b) => b.deletedAt - a.deletedAt).map((t, i, arr) => (
                <div key={t.id} className={`px-4 py-3 ${i < arr.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-medium truncate dark:text-white">{t.title}</p>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500">
                        {t.date} · {t.type === 'credit' ? '+' : '-'}{t.amount.toFixed(2).replace('.', ',')} {t.currency}
                        {' · '}suppression définitive dans {daysLeft(t.deletedAt)} j
                      </p>
                    </div>
                    <button onClick={() => restoreExpense(t.id)}
                      className="text-blue-600 text-[13px] font-semibold shrink-0">↩︎ Restaurer</button>
                    <button
                      onClick={() => { if (window.confirm(`Supprimer définitivement « ${t.title} » ?`)) deleteTrashedExpense(t.id) }}
                      className="text-red-500 text-[18px] leading-none shrink-0 px-1">×</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        {trashedRecurring.length > 0 && (
          <>
            <p className="section-header">Dépenses récurrentes ({trashedRecurring.length})</p>
            <div className="card mx-4 overflow-hidden">
              {[...trashedRecurring].sort((a, b) => b.deletedAt - a.deletedAt).map((t, i, arr) => (
                <div key={t.id} className={`px-4 py-3 ${i < arr.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-medium truncate dark:text-white">{t.title}</p>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500">
                        {t.amount.toFixed(2).replace('.', ',')} {t.currency}
                        {' · '}suppression définitive dans {daysLeft(t.deletedAt)} j
                      </p>
                    </div>
                    <button onClick={() => restoreRecurring(t.id)}
                      className="text-blue-600 text-[13px] font-semibold shrink-0">↩︎ Restaurer</button>
                    <button
                      onClick={() => { if (window.confirm(`Supprimer définitivement « ${t.title} » ?`)) deleteTrashedRecurring(t.id) }}
                      className="text-red-500 text-[18px] leading-none shrink-0 px-1">×</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
