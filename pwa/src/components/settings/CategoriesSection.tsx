import { useState, useRef } from 'react'
import { useStore } from '../../store/useStore'
import { CATEGORY_MAP, getActiveCategories } from '../../data/categories'
import type { CustomCategoryDef } from '../../models/types'
import { v4 as uuid } from 'uuid'

const EMOJI_GROUPS = [
  { label: 'Logement & Maison', emojis: ['🏠', '🏡', '🏢', '🛋️', '💡', '🔧', '🪴', '🛁', '🚿', '🪑', '🛏️', '🪟'] },
  { label: 'Nourriture', emojis: ['🍽️', '🛒', '🥘', '🍕', '☕', '🧺', '🍷', '🍰', '🥗', '🌮', '🍣', '🍜'] },
  { label: 'Transport', emojis: ['🚗', '✈️', '🚂', '⛽', '🛵', '🚌', '🚕', '🛞', '🚴', '🏍️', '⛵', '🚁'] },
  { label: 'Loisirs & Voyage', emojis: ['🎯', '🎮', '🏖️', '🎬', '🎸', '🎲', '🎨', '🎭', '⛷️', '🏄', '🎃', '🎡'] },
  { label: 'Travail', emojis: ['💼', '💻', '📊', '📱', '📧', '💰', '📝', '🗃️', '📋', '🖊️', '🔒', '📞'] },
  { label: 'Santé', emojis: ['💊', '🏥', '🩺', '💉', '🩹', '🧬', '👓', '🦷', '🩻', '🌡️', '🧪', '💆'] },
  { label: 'Mode', emojis: ['👔', '👗', '💄', '👠', '👟', '🧳', '💍', '👜', '🎩', '👒', '🧣', '🥿'] },
  { label: 'Sport', emojis: ['🏋️', '🏊', '⚽', '🎾', '🚴', '🏃', '🥊', '⛷️', '🤸', '🧘', '🎿', '🏇'] },
  { label: 'Beauté', emojis: ['💇', '💅', '🧴', '🪒', '🪭', '🧖', '🌸', '✨', '💐', '🌺', '🌹', '💋'] },
  { label: 'Famille & Cadeaux', emojis: ['👨‍👩‍👧', '🎁', '💝', '🎂', '👶', '🐾', '🎀', '🧸', '🎈', '🥳', '🎉', '💌'] },
  { label: 'Finance', emojis: ['💳', '🏦', '💸', '💎', '🪙', '💵', '📈', '🧾', '📑', '🏧', '💹', '🔐'] },
  { label: 'Tech', emojis: ['📱', '💻', '📺', '🎧', '📷', '🕹️', '🖥️', '⌚', '🔋', '📡', '🤖', '🖨️'] },
  { label: 'Divers', emojis: ['⭐', '🌟', '✨', '🔖', '📌', '🗓️', '🏷️', '📦', '🗝️', '🔑', '🎗️', '🌈'] },
]

/** Built-in (editable + deletable) and custom categories, plus the emoji picker
 *  and edit modal shared between "add category" and "edit category". */
export default function CategoriesSection() {
  const { settings, updateSettings, recategorizeExpenses } = useStore()
  const [newCatEmoji, setNewCatEmoji] = useState('📦')
  const [newCatLabel, setNewCatLabel] = useState('')
  const [newCatFixed, setNewCatFixed] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [editingCat, setEditingCat] = useState<{ id: string; isBuiltin: boolean } | null>(null)
  const [editCatLabel, setEditCatLabel] = useState('')
  const [editCatEmoji, setEditCatEmoji] = useState('📦')
  const emojiTarget = useRef<'add' | 'edit'>('add')

  function addCustomCategory() {
    const label = newCatLabel.trim()
    if (!label) return
    const custom = settings.customCategories ?? []
    const newCat: CustomCategoryDef = { id: `custom_${uuid().slice(0, 8)}`, label, emoji: newCatEmoji, isFixed: newCatFixed }
    updateSettings({ customCategories: [...custom, newCat] })
    setNewCatLabel('')
    setNewCatEmoji('📦')
    setNewCatFixed(false)
  }

  function removeCustomCategory(id: string) {
    recategorizeExpenses(id, 'a_classer')
    updateSettings({ customCategories: (settings.customCategories ?? []).filter(c => c.id !== id) })
  }

  function deleteBuiltinCategory(id: string) {
    recategorizeExpenses(id, 'a_classer')
    // Remove any custom override and mark as deleted
    const cleanedCustom = (settings.customCategories ?? []).filter(c => c.id !== id)
    const deletedBuiltins = [...new Set([...(settings.deletedBuiltinCategories ?? []), id])]
    updateSettings({ customCategories: cleanedCustom, deletedBuiltinCategories: deletedBuiltins })
  }

  function openEditCategory(id: string) {
    const custom = settings.customCategories ?? []
    const override = custom.find(c => c.id === id)
    const builtin = CATEGORY_MAP[id]
    const isBuiltin = !!builtin
    const current = override ?? builtin
    if (!current) return
    setEditingCat({ id, isBuiltin })
    setEditCatLabel(current.label)
    setEditCatEmoji(current.emoji)
  }

  function saveEditCategory() {
    if (!editingCat || !editCatLabel.trim()) return
    const custom = settings.customCategories ?? []
    const withoutThis = custom.filter(c => c.id !== editingCat.id)
    const isFixed = editingCat.isBuiltin
      ? (CATEGORY_MAP[editingCat.id]?.isFixed ?? false)
      : (custom.find(c => c.id === editingCat.id)?.isFixed ?? false)
    updateSettings({ customCategories: [...withoutThis, { id: editingCat.id, label: editCatLabel.trim(), emoji: editCatEmoji, isFixed }] })
    setEditingCat(null)
  }

  function resetBuiltinCategory(id: string) {
    updateSettings({ customCategories: (settings.customCategories ?? []).filter(c => c.id !== id) })
  }

  return (
    <>
      {/* All categories — built-in (editable + deletable) + custom, sorted alphabetically */}
      <p className="section-header">Catégories</p>
      <div className="card mx-4 overflow-hidden">
        {(() => {
          const customMap = Object.fromEntries((settings.customCategories ?? []).map(c => [c.id, c]))
          const allRows = getActiveCategories(settings.customCategories, settings.deletedBuiltinCategories)
            .map(cat => ({
              ...cat,
              isBuiltin: !!CATEGORY_MAP[cat.id],
              isOverridden: !!CATEGORY_MAP[cat.id] && !!customMap[cat.id],
              isDeletable: cat.id !== 'a_classer',
            }))
          return allRows.map((cat, i) => (
            <div key={cat.id}
              className={`flex items-center gap-3 px-4 py-3 ${i < allRows.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''}`}>
              <span className="text-xl w-8 text-center">{cat.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] dark:text-white truncate">{cat.label}</p>
                <p className="text-[11px] text-gray-400 dark:text-gray-500">
                  {cat.isFixed ? '🔒 Incompressible' : cat.isBuiltin ? 'Prédéfinie' : 'Personnalisée'}
                  {cat.isOverridden && ' · modifiée'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {cat.isOverridden && (
                  <button onClick={() => resetBuiltinCategory(cat.id)}
                    className="text-[12px] text-orange-400 font-medium">
                    Réinitialiser
                  </button>
                )}
                <button onClick={() => openEditCategory(cat.id)}
                  className="text-blue-500 text-[13px] font-medium px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40">
                  Modifier
                </button>
                {cat.isDeletable && (
                  <button onClick={() => {
                    if (!window.confirm(`Supprimer "${cat.label}" ? Les transactions seront déplacées dans "À classer".`)) return
                    cat.isBuiltin ? deleteBuiltinCategory(cat.id) : removeCustomCategory(cat.id)
                  }}
                    className="text-red-400 text-xl leading-none">×</button>
                )}
              </div>
            </div>
          ))
        })()}
        {/* Add new custom category */}
        <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-3">
          <div className="flex items-center gap-2 mb-2.5">
            <button
              type="button"
              onClick={() => { emojiTarget.current = 'add'; setShowEmojiPicker(true) }}
              className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-[26px] border-2 border-dashed border-gray-300 dark:border-gray-600 flex-shrink-0">
              {newCatEmoji}
            </button>
            <input
              type="text"
              placeholder="Nouvelle catégorie…"
              value={newCatLabel}
              onChange={e => setNewCatLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCustomCategory()}
              className="flex-1 text-[15px] outline-none bg-transparent dark:text-white dark:placeholder-gray-500 py-1"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={newCatFixed} onChange={e => setNewCatFixed(e.target.checked)}
                className="w-4 h-4 accent-red-500" />
              <span className="text-[13px] text-gray-500 dark:text-gray-400">Charge incompressible</span>
            </label>
            <button
              onClick={addCustomCategory}
              disabled={!newCatLabel.trim()}
              className="px-4 py-1.5 bg-blue-600 text-white rounded-xl text-[14px] font-semibold disabled:opacity-30 transition-opacity">
              Ajouter
            </button>
          </div>
        </div>
      </div>

      {/* Emoji picker sheet */}
      {showEmojiPicker && (
        <div className="fixed inset-0 z-50 flex flex-col"
             style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          <div className="flex-1 bg-black/40" onClick={() => setShowEmojiPicker(false)} />
          <div className="bg-white dark:bg-gray-900 rounded-t-3xl flex flex-col"
               style={{ maxHeight: '70vh' }}>
            <div className="flex items-center justify-between px-5 pt-4 pb-2 flex-shrink-0">
              <span className="text-[17px] font-semibold dark:text-white">Choisir une icône</span>
              <button onClick={() => setShowEmojiPicker(false)}
                className="text-blue-600 font-medium text-[15px]">Fermer</button>
            </div>
            <div className="overflow-y-auto scroll-ios pb-6 px-4">
              {EMOJI_GROUPS.map(group => (
                <div key={group.label} className="mb-4">
                  <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">
                    {group.label}
                  </p>
                  <div className="grid grid-cols-6 gap-2">
                    {group.emojis.map(emoji => {
                      const activeEmoji = emojiTarget.current === 'edit' ? editCatEmoji : newCatEmoji
                      return (
                        <button
                          key={emoji}
                          onClick={() => {
                            if (emojiTarget.current === 'edit') setEditCatEmoji(emoji)
                            else setNewCatEmoji(emoji)
                            setShowEmojiPicker(false)
                          }}
                          className={`h-12 rounded-xl text-[24px] flex items-center justify-center transition-colors
                            ${activeEmoji === emoji
                              ? 'bg-blue-100 dark:bg-blue-900/40 ring-2 ring-blue-500'
                              : 'bg-gray-100 dark:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700'}`}>
                          {emoji}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Category edit modal */}
      {editingCat && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-800 rounded-t-3xl w-full p-6"
               style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}>
            <p className="text-[17px] font-bold text-center mb-4 dark:text-white">
              {editingCat.isBuiltin ? 'Modifier la catégorie' : 'Renommer'}
            </p>
            <div className="flex items-center gap-3 mb-5">
              <button
                type="button"
                onClick={() => { emojiTarget.current = 'edit'; setShowEmojiPicker(true) }}
                className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-[30px] border-2 border-dashed border-gray-300 dark:border-gray-600 flex-shrink-0">
                {editCatEmoji}
              </button>
              <input
                type="text"
                placeholder="Nom de la catégorie…"
                value={editCatLabel}
                onChange={e => setEditCatLabel(e.target.value)}
                className="flex-1 text-[17px] outline-none bg-gray-100 dark:bg-gray-700 rounded-xl px-4 py-3 dark:text-white dark:placeholder-gray-500"
                autoFocus
              />
            </div>
            <button onClick={saveEditCategory} disabled={!editCatLabel.trim()}
              className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-semibold text-[16px] mb-3 disabled:opacity-30">
              Enregistrer
            </button>
            <button onClick={() => setEditingCat(null)}
              className="w-full py-3.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-medium text-[16px]">
              Annuler
            </button>
          </div>
        </div>
      )}
    </>
  )
}
