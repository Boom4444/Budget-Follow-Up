import { useState, useMemo, useRef } from 'react'
import { useStore } from '../store/useStore'
import { CATEGORY_MAP } from '../data/categories'
import type { CategoryId } from '../models/types'

// ── Types ─────────────────────────────────────────────────────────────────────

type WizardStep = 'revenus' | 'investissements' | 'depenses' | 'resultats'

interface BItem  { id: string; name: string; amount: number }
interface BGroup { id: string; name: string; color: string; items: BItem[] }

interface BData {
  revenus: BItem[]
  investissements: BGroup[]
  depenses: BGroup[]
}

// ── Default data ──────────────────────────────────────────────────────────────

let _uid = 0
const uid = () => `id-${++_uid}`

const DEFAULT_DATA: BData = {
  revenus: [
    { id: 'r1', name: 'Salaire', amount: 2500 },
  ],
  investissements: [
    {
      id: 'inv1', name: 'Investissements', color: '#f97316',
      items: [
        { id: 'i1', name: 'Actions', amount: 200 },
        { id: 'i2', name: 'Assurance vie', amount: 200 },
      ],
    },
  ],
  depenses: [
    {
      id: 'd-log', name: 'Logement', color: '#6366f1',
      items: [
        { id: 'd1', name: 'Loyer', amount: 500 },
        { id: 'd2', name: 'Charges', amount: 120 },
      ],
    },
    {
      id: 'd-vie', name: 'Vie quotidienne', color: '#8b5cf6',
      items: [
        { id: 'd3', name: 'Courses', amount: 300 },
        { id: 'd4', name: 'Restaurants', amount: 100 },
      ],
    },
    {
      id: 'd-abo', name: 'Abonnements', color: '#10b981',
      items: [
        { id: 'd5', name: 'Internet / Téléphone', amount: 50 },
        { id: 'd6', name: 'Sport', amount: 20 },
      ],
    },
  ],
}

const GROUP_PALETTE = ['#f97316', '#6366f1', '#8b5cf6', '#10b981', '#ef4444', '#0891b2', '#d97706', '#db2777']

// ── Formatters ────────────────────────────────────────────────────────────────

function fmt(v: number): string {
  return Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' €'
}
function pct(v: number, total: number): string {
  return total > 0 ? (v / total * 100).toFixed(1) + '%' : '0%'
}

// ── Sankey SVG component ──────────────────────────────────────────────────────

interface SankeyItem { name: string; amount: number; color: string }

function SankeyFlow({ items, total }: { items: SankeyItem[]; total: number }) {
  const H = 280
  const leftX = 4, leftW = 32
  const rightX = 190, rightW = 22
  const gap = 5
  const n = items.length
  const rightAvailH = H - (n - 1) * gap

  let ly = 0, ry = 0
  const computed = items.map(item => {
    const prop = total > 0 ? item.amount / total : 0
    const lh = prop * H
    const rh = Math.max(prop * rightAvailH, 10)
    const l0 = ly, l1 = ly + lh
    const r0 = ry, r1 = ry + rh
    ly += lh
    ry += rh + gap
    const mx = leftX + leftW + (rightX - leftX - leftW) * 0.45
    const path = [
      `M ${leftX + leftW} ${l0}`,
      `C ${mx} ${l0}, ${mx} ${r0}, ${rightX} ${r0}`,
      `L ${rightX} ${r1}`,
      `C ${mx} ${r1}, ${mx} ${l1}, ${leftX + leftW} ${l1}`,
      'Z',
    ].join(' ')
    return { ...item, l0, l1, r0, r1, rh, path }
  })

  return (
    <svg viewBox={`0 0 270 ${H}`} style={{ width: '100%' }} overflow="visible">
      {/* Left bar segments */}
      {computed.map(d => (
        <rect key={`ls-${d.name}`} x={leftX} y={d.l0} width={leftW}
          height={Math.max(d.l1 - d.l0, 0.5)} fill={d.color} opacity={0.6} />
      ))}
      {/* Bezier fills */}
      {computed.map(d => (
        <path key={`bf-${d.name}`} d={d.path} fill={d.color} opacity={0.22} />
      ))}
      {/* Right bars + labels */}
      {computed.map(d => {
        const midY = (d.r0 + d.r1) / 2
        const labelAmt = d.rh >= 12 ? ` ${Math.round(d.amount)} €` : ''
        return (
          <g key={`rg-${d.name}`}>
            <rect x={rightX} y={d.r0} width={rightW} height={Math.max(d.rh, 0.5)} rx={2} fill={d.color} />
            {d.rh >= 10 && (
              <text x={rightX + rightW + 5} y={midY} dominantBaseline="middle"
                fontSize={9} fill="#9ca3af">
                {d.name.length > 14 ? d.name.slice(0, 14) + '…' : d.name}{labelAmt}
              </text>
            )}
          </g>
        )
      })}
      {/* Left label */}
      <text x={leftX + leftW / 2} y={H / 2} textAnchor="middle" fontSize={8}
        fill="white" opacity={0.8}
        transform={`rotate(-90, ${leftX + leftW / 2}, ${H / 2})`}>
        Budget
      </text>
    </svg>
  )
}

// ── Item row ──────────────────────────────────────────────────────────────────

interface ItemRowProps {
  item: BItem
  onChange: (patch: Partial<BItem>) => void
  onDelete: () => void
  isLast: boolean
}

function ItemRow({ item, onChange, onDelete, isLast }: ItemRowProps) {
  const [amtStr, setAmtStr] = useState(String(item.amount))
  const amtFocused = useRef(false)

  if (!amtFocused.current && amtStr !== String(item.amount)) setAmtStr(String(item.amount))

  return (
    <div className={`flex items-center gap-2 px-4 py-2.5${isLast ? '' : ' border-b border-gray-100 dark:border-gray-700/60'}`}>
      <span className="text-gray-200 dark:text-gray-600 text-xs select-none">⠿</span>
      <div className="flex-1 min-w-0 grid grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-0.5">Nom</p>
          <input
            value={item.name}
            onChange={e => onChange({ name: e.target.value })}
            className="text-[14px] font-medium bg-transparent dark:text-white focus:outline-none w-full border-b border-gray-200 dark:border-gray-700 pb-0.5"
            placeholder="Libellé"
          />
        </div>
        <div>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-0.5">Montant</p>
          <div className="flex items-center gap-1.5 border-b border-gray-200 dark:border-gray-700 pb-0.5">
            <input
              type="number"
              inputMode="decimal"
              value={amtStr}
              onFocus={() => { amtFocused.current = true }}
              onChange={e => setAmtStr(e.target.value)}
              onBlur={() => {
                amtFocused.current = false
                const v = parseFloat(amtStr)
                if (!isNaN(v)) { onChange({ amount: v }); setAmtStr(String(v)) }
                else setAmtStr(String(item.amount))
              }}
              className="text-[14px] font-medium bg-transparent dark:text-white focus:outline-none flex-1 min-w-0"
              style={{ WebkitAppearance: 'none' } as React.CSSProperties}
            />
            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500">EUR</span>
          </div>
        </div>
      </div>
      <button onClick={onDelete}
        className="w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 text-[13px] flex-shrink-0 ml-1">
        ×
      </button>
    </div>
  )
}

// ── Group card ────────────────────────────────────────────────────────────────

interface GroupCardProps {
  group: BGroup
  addLabel: string
  onUpdate: (patch: Partial<BGroup>) => void
  onDelete?: () => void
  readonlyName?: boolean
}

function GroupCard({ group, addLabel, onUpdate, onDelete, readonlyName = false }: GroupCardProps) {
  const total = group.items.reduce((s, i) => s + i.amount, 0)

  function updateItem(id: string, patch: Partial<BItem>) {
    onUpdate({ items: group.items.map(i => i.id === id ? { ...i, ...patch } : i) })
  }
  function deleteItem(id: string) {
    onUpdate({ items: group.items.filter(i => i.id !== id) })
  }
  function addItem() {
    onUpdate({ items: [...group.items, { id: uid(), name: '', amount: 0 }] })
  }

  return (
    <div className="card mx-4 overflow-hidden">
      {/* Group header */}
      <div className="flex items-center justify-between px-4 py-3 border-b-2"
           style={{ borderBottomColor: group.color }}>
        {readonlyName ? (
          <span className="text-[15px] font-bold dark:text-white">{group.name}</span>
        ) : (
          <input
            value={group.name}
            onChange={e => onUpdate({ name: e.target.value })}
            className="text-[15px] font-bold bg-transparent dark:text-white focus:outline-none flex-1 min-w-0"
            placeholder="Nom de la catégorie"
          />
        )}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[14px] font-semibold text-gray-400 dark:text-gray-500">{fmt(total)}</span>
          {onDelete && (
            <button onClick={onDelete}
              className="w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 text-[13px]">
              ×
            </button>
          )}
        </div>
      </div>
      {/* Items */}
      {group.items.map((item, i) => (
        <ItemRow key={item.id} item={item} isLast={i === group.items.length - 1}
          onChange={patch => updateItem(item.id, patch)}
          onDelete={() => deleteItem(item.id)} />
      ))}
      {/* Add item */}
      <button onClick={addItem}
        className="w-full px-4 py-2.5 text-[13px] text-gray-400 dark:text-gray-500 text-left flex items-center gap-1.5">
        {addLabel} <span className="text-[16px] leading-none">+</span>
      </button>
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

const STEPS: { id: WizardStep; label: string }[] = [
  { id: 'revenus',          label: 'Revenus' },
  { id: 'investissements',  label: 'Investissements' },
  { id: 'depenses',         label: 'Dépenses' },
]

interface Props { onClose?: () => void }

export default function PatrimoineScreen({ onClose }: Props = {}) {
  const [data, setData]   = useState<BData>(() => JSON.parse(JSON.stringify(DEFAULT_DATA)))
  const [step, setStep]   = useState<WizardStep>('revenus')
  const isDark = document.documentElement.classList.contains('dark')
  const { expenses } = useStore()

  // ── Computed results ─────────────────────────────────────────────────────

  const totalRevenu  = useMemo(() => data.revenus.reduce((s, i) => s + i.amount, 0), [data.revenus])
  const totalInvest  = useMemo(() =>
    data.investissements.flatMap(g => g.items).reduce((s, i) => s + i.amount, 0)
  , [data.investissements])
  const totalDepenses = useMemo(() =>
    data.depenses.flatMap(g => g.items).reduce((s, i) => s + i.amount, 0)
  , [data.depenses])
  const disponible   = totalRevenu - totalInvest - totalDepenses
  const tauxEpargne  = totalRevenu > 0 ? totalInvest / totalRevenu * 100 : 0
  const tauxPossible = totalRevenu > 0 ? (totalInvest + Math.max(0, disponible)) / totalRevenu * 100 : 0

  const sankeyItems = useMemo((): SankeyItem[] => {
    const groups: SankeyItem[] = []
    // investments as one block
    if (totalInvest > 0) groups.push({ name: 'Investissements', amount: totalInvest, color: '#f97316' })
    // expense categories
    data.depenses.forEach(g => {
      const t = g.items.reduce((s, i) => s + i.amount, 0)
      if (t > 0) groups.push({ name: g.name, amount: t, color: g.color })
    })
    // disponible
    if (disponible > 0) groups.push({ name: 'Disponible', amount: disponible, color: '#10b981' })
    return groups
  }, [data.depenses, totalInvest, disponible])

  // ── Data mutators ────────────────────────────────────────────────────────

  function setRevenus(items: BItem[]) { setData(d => ({ ...d, revenus: items })) }

  function setInvestissements(groups: BGroup[]) { setData(d => ({ ...d, investissements: groups })) }

  function setDepenses(groups: BGroup[]) { setData(d => ({ ...d, depenses: groups })) }

  function addDepenseGroup() {
    const used = data.depenses.length
    const color = GROUP_PALETTE[(used + 1) % GROUP_PALETTE.length]
    setDepenses([...data.depenses, { id: uid(), name: 'Nouvelle catégorie', color, items: [] }])
  }

  function addInvestGroup() {
    const used = data.investissements.length
    const color = GROUP_PALETTE[used % GROUP_PALETTE.length]
    setInvestissements([...data.investissements, { id: uid(), name: 'Nouvelle catégorie', color, items: [] }])
  }

  // ── Import from real expenses ─────────────────────────────────────────────

  function importExpenses() {
    // Last 3 full months
    const now   = new Date()
    const from  = new Date(now.getFullYear(), now.getMonth() - 2, 1)
    const fromStr = from.toISOString().slice(0, 10)

    const debits = expenses.filter(e => e.type === 'debit' && e.date >= fromStr)
    if (debits.length === 0) return

    // Determine actual months spanned (1-3)
    const monthKeys = new Set(debits.map(e => e.date.slice(0, 7)))
    const months = Math.max(monthKeys.size, 1)

    // Aggregate by category → subCategory
    const catAgg: Record<string, Record<string, number>> = {}
    debits.forEach(e => {
      const cat = e.category
      if (!catAgg[cat]) catAgg[cat] = {}
      const sub = e.subCategory || 'Autre'
      catAgg[cat][sub] = (catAgg[cat][sub] ?? 0) + e.amountInBase
    })

    const groups: BGroup[] = Object.entries(catAgg).map(([catId, subs], idx) => {
      const meta = CATEGORY_MAP[catId as CategoryId]
      const items: BItem[] = Object.entries(subs)
        .map(([name, total]) => ({
          id: uid(),
          name,
          amount: Math.round(total / months),
        }))
        .filter(i => i.amount > 0)
        .sort((a, b) => b.amount - a.amount)

      return {
        id: `imp-${catId}`,
        name: meta?.label ?? catId,
        color: GROUP_PALETTE[idx % GROUP_PALETTE.length],
        items,
      }
    }).filter(g => g.items.length > 0)
      .sort((a, b) =>
        b.items.reduce((s, i) => s + i.amount, 0) -
        a.items.reduce((s, i) => s + i.amount, 0)
      )

    if (groups.length > 0) setDepenses(groups)
  }

  // ── Tooltip style ─────────────────────────────────────────────────────────
  void isDark

  // ── Render ───────────────────────────────────────────────────────────────

  const isResults = step === 'resultats'
  const currentStepIdx = STEPS.findIndex(s => s.id === step)

  return (
    <div className="flex flex-col h-full bg-[#f2f2f7] dark:bg-[#1c1c1e]"
         style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>

      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
        <div className="px-4 py-3 flex items-center gap-3">
          {(isResults || onClose) && (
            <button onClick={isResults ? () => setStep('depenses') : onClose}
              className="text-blue-600 text-[22px] font-light leading-none px-1">‹</button>
          )}
          <div className="flex-1">
            <h1 className="text-[17px] font-semibold dark:text-white">Calculateur de patrimoine</h1>
            <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">
              Analysez votre cashflow mensuel
            </p>
          </div>
        </div>
        {/* Step tabs */}
        {!isResults && (
          <div className="flex border-t border-gray-100 dark:border-gray-700">
            {STEPS.map((s, i) => {
              const isActive = s.id === step
              return (
                <button key={s.id} onClick={() => setStep(s.id)}
                  className={`flex-1 py-2.5 text-[13px] font-medium relative transition-colors
                    ${isActive ? 'dark:text-white text-gray-900' : 'text-gray-400 dark:text-gray-500'}
                    ${i < STEPS.length - 1 ? 'border-r border-gray-100 dark:border-gray-700' : ''}`}>
                  {s.label}
                  {isActive && (
                    <div className="absolute bottom-0 left-8 right-8 h-0.5 rounded-t-full bg-amber-500" />
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scroll-ios pb-32">

        {/* ── Revenus ──────────────────────────────────────────────────── */}
        {step === 'revenus' && (
          <div className="pt-4 space-y-3">
            <div className="card mx-4 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b-2 border-amber-400">
                <span className="text-[15px] font-bold dark:text-white">Revenus</span>
                <span className="text-[14px] font-semibold text-gray-400 dark:text-gray-500">
                  {fmt(totalRevenu)}
                </span>
              </div>
              {data.revenus.map((item, i) => (
                <ItemRow key={item.id} item={item} isLast={i === data.revenus.length - 1}
                  onChange={patch => setRevenus(data.revenus.map(r => r.id === item.id ? { ...r, ...patch } : r))}
                  onDelete={() => setRevenus(data.revenus.filter(r => r.id !== item.id))} />
              ))}
              <button
                onClick={() => setRevenus([...data.revenus, { id: uid(), name: '', amount: 0 }])}
                className="w-full px-4 py-2.5 text-[13px] text-gray-400 dark:text-gray-500 text-left flex items-center gap-1.5">
                Ajouter une source de revenu <span className="text-[16px] leading-none">+</span>
              </button>
            </div>
          </div>
        )}

        {/* ── Investissements ───────────────────────────────────────────── */}
        {step === 'investissements' && (
          <div className="pt-4 space-y-3">
            {data.investissements.map(g => (
              <GroupCard key={g.id} group={g} addLabel="Ajouter un investissement"
                onUpdate={patch => setInvestissements(data.investissements.map(x => x.id === g.id ? { ...x, ...patch } : x))}
                onDelete={data.investissements.length > 1 ? () => setInvestissements(data.investissements.filter(x => x.id !== g.id)) : undefined} />
            ))}
            <button onClick={addInvestGroup}
              className="mx-4 w-[calc(100%-2rem)] border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl py-3 flex items-center justify-center gap-2 text-[13px] text-gray-400 dark:text-gray-500">
              Ajouter une catégorie <span className="text-[16px] leading-none">+</span>
            </button>
          </div>
        )}

        {/* ── Dépenses ─────────────────────────────────────────────────── */}
        {step === 'depenses' && (
          <div className="pt-4 space-y-3">
            {/* Import from real data */}
            {expenses.filter(e => e.type === 'debit').length > 0 && (
              <button onClick={importExpenses}
                className="mx-4 w-[calc(100%-2rem)] bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-700 rounded-2xl py-3 flex items-center justify-center gap-2 text-[13px] font-medium text-indigo-600 dark:text-indigo-400">
                <span className="text-[16px]">📊</span>
                Importer mes dépenses réelles
                <span className="text-[11px] text-indigo-400 dark:text-indigo-500">(moy. 3 mois)</span>
              </button>
            )}
            {data.depenses.map(g => (
              <GroupCard key={g.id} group={g} addLabel="Ajouter une dépense"
                onUpdate={patch => setDepenses(data.depenses.map(x => x.id === g.id ? { ...x, ...patch } : x))}
                onDelete={data.depenses.length > 1 ? () => setDepenses(data.depenses.filter(x => x.id !== g.id)) : undefined} />
            ))}
            <button onClick={addDepenseGroup}
              className="mx-4 w-[calc(100%-2rem)] border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl py-3 flex items-center justify-center gap-2 text-[13px] text-gray-400 dark:text-gray-500">
              Ajouter une catégorie <span className="text-[16px] leading-none">+</span>
            </button>
          </div>
        )}

        {/* ── Résultats ────────────────────────────────────────────────── */}
        {step === 'resultats' && (
          <div className="pt-4 space-y-3">
            {/* Summary text */}
            <div className="card mx-4 p-4">
              <p className="text-[14px] text-center text-gray-600 dark:text-gray-300 leading-relaxed">
                Votre taux d'épargne est de{' '}
                <strong className="dark:text-white">{tauxEpargne.toFixed(2)}%</strong>
                {' '}(taux d'épargne possible&nbsp;:{' '}
                <strong className="dark:text-white">{tauxPossible.toFixed(2)}%</strong>).{' '}
                Vous avez un revenu total de{' '}
                <strong className="dark:text-white">{fmt(totalRevenu)}</strong>,{' '}
                des dépenses de{' '}
                <strong className="dark:text-white">{fmt(totalDepenses)}</strong>{' '}
                et investissez{' '}
                <strong className="dark:text-white">{fmt(totalInvest)}</strong>{' '}
                tous les mois, il vous reste{' '}
                <strong className={disponible >= 0 ? 'text-green-600' : 'text-red-500'}>
                  {fmt(Math.abs(disponible))}
                </strong>{' '}
                {disponible >= 0 ? 'disponible' : 'de déficit'}.
              </p>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-3 gap-2 mx-4">
              {[
                { label: 'Revenus', value: totalRevenu, color: '#6366f1' },
                { label: 'Investis', value: totalInvest, color: '#f97316' },
                { label: 'Dépenses', value: totalDepenses, color: '#ef4444' },
              ].map(k => (
                <div key={k.label} className="card p-3 text-center">
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-1">{k.label}</p>
                  <p className="text-[14px] font-bold" style={{ color: k.color }}>{fmt(k.value)}</p>
                </div>
              ))}
            </div>

            {/* Disponible badge */}
            <div className={`card mx-4 p-3 flex items-center justify-between ${disponible >= 0 ? 'border-l-4 border-green-500' : 'border-l-4 border-red-500'}`}>
              <span className="text-[13px] text-gray-600 dark:text-gray-300">
                {disponible >= 0 ? '✅ Cashflow positif' : '⚠️ Cashflow négatif'}
              </span>
              <span className={`text-[16px] font-bold ${disponible >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {disponible >= 0 ? '+' : '-'}{fmt(Math.abs(disponible))}
              </span>
            </div>

            {/* Sankey flow */}
            {sankeyItems.length > 0 && (
              <div className="card mx-4 px-4 pt-4 pb-3">
                <p className="text-[13px] font-semibold text-gray-500 dark:text-gray-400 mb-3">
                  Répartition du budget
                </p>
                <SankeyFlow items={sankeyItems} total={totalRevenu} />
              </div>
            )}

            {/* Category breakdown list */}
            <div className="card mx-4 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-700">
                <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  Détail mensuel
                </p>
              </div>
              {sankeyItems.map((item, i) => (
                <div key={item.name}
                  className={`flex items-center gap-3 px-4 py-3${i < sankeyItems.length - 1 ? ' border-b border-gray-100 dark:border-gray-700' : ''}`}>
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="flex-1 text-[14px] dark:text-white">{item.name}</span>
                  <span className="text-[12px] text-gray-400 dark:text-gray-500 mr-1">
                    {pct(item.amount, totalRevenu)}
                  </span>
                  <span className="text-[14px] font-semibold dark:text-white">{fmt(item.amount)}</span>
                </div>
              ))}
            </div>

            {/* Per-group details */}
            {data.depenses.map(g => {
              const gTotal = g.items.reduce((s, i) => s + i.amount, 0)
              if (gTotal === 0) return null
              return (
                <div key={g.id} className="card mx-4 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-gray-700 border-l-4"
                    style={{ borderLeftColor: g.color }}>
                    <span className="text-[13px] font-semibold dark:text-white">{g.name}</span>
                    <span className="text-[13px] text-gray-400 dark:text-gray-500">{fmt(gTotal)}</span>
                  </div>
                  {g.items.map((item, i) => (
                    <div key={item.id}
                      className={`flex items-center justify-between px-4 py-2.5${i < g.items.length - 1 ? ' border-b border-gray-100 dark:border-gray-700' : ''}`}>
                      <span className="text-[13px] text-gray-600 dark:text-gray-300">{item.name}</span>
                      <span className="text-[13px] font-medium dark:text-white">{fmt(item.amount)}</span>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Bottom navigation */}
      {!isResults && (
        <div className="absolute bottom-0 left-0 right-0 bg-[#f2f2f7]/90 dark:bg-[#1c1c1e]/90 backdrop-blur-sm border-t border-gray-200 dark:border-gray-700 flex gap-3 px-4 pt-3 pb-safe"
             style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}>
          {currentStepIdx > 0 && (
            <button
              onClick={() => setStep(STEPS[currentStepIdx - 1].id)}
              className="flex-1 py-3 rounded-2xl bg-gray-200 dark:bg-gray-700 text-[15px] font-semibold text-gray-600 dark:text-gray-200">
              RETOUR
            </button>
          )}
          {currentStepIdx < STEPS.length - 1 ? (
            <button
              onClick={() => setStep(STEPS[currentStepIdx + 1].id)}
              className="flex-1 py-3 rounded-2xl bg-white dark:bg-gray-800 text-[15px] font-semibold text-gray-800 dark:text-white shadow-sm">
              SUIVANT
            </button>
          ) : (
            <button
              onClick={() => setStep('resultats')}
              className="flex-1 py-3 rounded-2xl bg-amber-500 text-[14px] font-bold text-white shadow-sm">
              DÉCOUVRIR MON CASHFLOW
            </button>
          )}
        </div>
      )}
    </div>
  )
}
