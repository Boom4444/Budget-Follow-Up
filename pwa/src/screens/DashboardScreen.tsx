import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts'
import { useStore } from '../store/useStore'
import { CATEGORY_MAP } from '../data/categories'
import { CURRENCY_MAP } from '../data/currencies'
import { formatAmount, formatPercent } from '../utils/formatters'
import { currentYear, shortMonth, longMonth } from '../utils/dates'
import AddExpenseModal from '../components/AddExpenseModal'

export default function DashboardScreen() {
  const { expenses, settings } = useStore()
  const base = settings.baseCurrency
  const sym = CURRENCY_MAP[base].symbol

  const [year, setYear] = useState(currentYear())
  const [month, setMonth] = useState<number | null>(null)
  const [filterPerson, setFilterPerson] = useState<'all' | 'person1' | 'person2' | 'shared'>('all')
  const [showAdd, setShowAdd] = useState(false)
  const [selectedCat, setSelectedCat] = useState<string | null>(null)

  const NOW = currentYear()

  const filtered = useMemo(() => expenses.filter(e => {
    const ey = parseInt(e.date.slice(0, 4))
    const em = parseInt(e.date.slice(5, 7))
    if (ey !== year) return false
    if (month !== null && em !== month) return false
    if (filterPerson !== 'all' && e.person !== filterPerson) return false
    return true
  }), [expenses, year, month, filterPerson])

  const debits  = filtered.filter(e => e.type === 'debit')
  const credits = filtered.filter(e => e.type === 'credit')

  const totalDepenses = debits.reduce((s, e) => s + e.amountInBase, 0)
  const totalRevenus  = credits.reduce((s, e) => s + e.amountInBase, 0)
  const solde         = totalRevenus - totalDepenses
  const totalFixed    = debits.filter(e => e.isFixed).reduce((s, e) => s + e.amountInBase, 0)
  const totalVariable = totalDepenses - totalFixed
  const totalP1       = debits.filter(e => e.person === 'person1').reduce((s, e) => s + e.amountInBase, 0)
  const totalP2       = debits.filter(e => e.person === 'person2').reduce((s, e) => s + e.amountInBase, 0)
  const totalShared   = debits.filter(e => e.person === 'shared').reduce((s, e) => s + e.amountInBase, 0)

  const monthlyData = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const m = i + 1
    const mes = expenses.filter(e =>
      parseInt(e.date.slice(0, 4)) === year &&
      parseInt(e.date.slice(5, 7)) === m &&
      (filterPerson === 'all' || e.person === filterPerson)
    )
    const debitMes  = mes.filter(e => e.type === 'debit')
    const creditMes = mes.filter(e => e.type === 'credit')
    return {
      name: shortMonth(m),
      fixed:    Math.round(debitMes.filter(e => e.isFixed).reduce((s, e) => s + e.amountInBase, 0)),
      variable: Math.round(debitMes.filter(e => !e.isFixed).reduce((s, e) => s + e.amountInBase, 0)),
      revenus:  Math.round(creditMes.reduce((s, e) => s + e.amountInBase, 0)),
    }
  }), [expenses, year, filterPerson])

  const catData = useMemo(() => {
    const map: Record<string, number> = {}
    debits.forEach(e => { map[e.category] = (map[e.category] ?? 0) + e.amountInBase })
    return Object.entries(map)
      .map(([id, val]) => ({
        id,
        label: CATEGORY_MAP[id as keyof typeof CATEGORY_MAP]?.label ?? id,
        value: val,
        color: CATEGORY_MAP[id as keyof typeof CATEGORY_MAP]?.color ?? '#666',
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [debits])

  const fmt = (v: number) => v === 0 ? '' : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
  const isDark = document.documentElement.classList.contains('dark')
  const tooltipStyle = {
    borderRadius: 8, border: 'none',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    fontSize: 12,
    background: isDark ? '#1f2937' : '#fff',
    color: isDark ? '#f9fafb' : '#111827',
  }

  return (
    <div className="flex flex-col h-full"
         style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      {/* Nav */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700 px-4 pt-3 pb-0 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-[22px] font-bold dark:text-white">Tableau de bord</h1>
          <button onClick={() => setShowAdd(true)}
            className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center text-white text-xl font-light shadow-sm">
            +
          </button>
        </div>

        {/* Year nav */}
        <div className="flex items-center justify-center gap-6 mb-3">
          <button onClick={() => setYear(y => y - 1)} className="text-blue-600 text-2xl px-2">‹</button>
          <span className="text-[17px] font-bold w-16 text-center dark:text-white">{year}</span>
          <button onClick={() => setYear(y => Math.min(y + 1, NOW))}
            className={`text-2xl px-2 ${year >= NOW ? 'text-gray-200 dark:text-gray-600' : 'text-blue-600'}`}>›</button>
        </div>

        {/* Month chips */}
        <div className="flex gap-1.5 overflow-x-auto pb-3 no-scrollbar">
          {[null, 1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
            <button key={m ?? 'all'} onClick={() => setMonth(m)}
              className={`px-3 py-1 rounded-full text-[13px] font-medium whitespace-nowrap flex-shrink-0 transition-colors
                ${month === m
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
              {m === null ? 'Année' : shortMonth(m)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-ios pb-6">

        {/* Person filter */}
        <div className="flex gap-2 px-4 mt-4 flex-wrap">
          {[
            { v: 'all', label: '👥 Foyer' },
            { v: 'person1', label: settings.person1Name },
            { v: 'person2', label: settings.person2Name },
            { v: 'shared', label: 'Commun' },
          ].map(opt => (
            <button key={opt.v} onClick={() => setFilterPerson(opt.v as typeof filterPerson)}
              className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors
                ${filterPerson === opt.v
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600'}`}>
              {opt.label}
            </button>
          ))}
        </div>

        {/* Solde card */}
        <div className="mx-4 mt-3 card p-4">
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-1">
            {month !== null ? `${longMonth(month)} ${year}` : `Solde ${year}`}
          </p>
          <p className={`text-[34px] font-bold tracking-tight ${solde >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {solde >= 0 ? '+' : ''}{solde.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} {sym}
          </p>
          <div className="flex gap-4 mt-2">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-red-400 inline-block"></span>
              <span className="text-[12px] text-gray-500 dark:text-gray-400">{formatAmount(totalDepenses, base)} dépenses</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-green-400 inline-block"></span>
              <span className="text-[12px] text-gray-500 dark:text-gray-400">{formatAmount(totalRevenus, base)} revenus</span>
            </div>
          </div>
        </div>

        {/* Summary cards */}
        <div className="px-4 mt-3 grid grid-cols-2 gap-3">
          <div className="card p-3">
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-1">💸 Dépenses</p>
            <p className="text-[18px] font-bold text-red-500">{formatAmount(totalDepenses, base)}</p>
          </div>
          <div className="card p-3">
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-1">💰 Revenus</p>
            <p className="text-[18px] font-bold text-green-600">{formatAmount(totalRevenus, base)}</p>
          </div>
          <div className="card p-3">
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-1">🔒 Incompressible</p>
            <p className="text-[18px] font-bold text-orange-500">{formatAmount(totalFixed, base)}</p>
            {totalDepenses > 0 && <p className="text-[11px] text-gray-400 dark:text-gray-500">{formatPercent(totalFixed, totalDepenses)} des dépenses</p>}
          </div>
          <div className="card p-3">
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-1">📈 Variable</p>
            <p className="text-[18px] font-bold text-blue-500">{formatAmount(totalVariable, base)}</p>
            {totalDepenses > 0 && <p className="text-[11px] text-gray-400 dark:text-gray-500">{formatPercent(totalVariable, totalDepenses)} des dépenses</p>}
          </div>
        </div>

        {/* Per-person cards */}
        <div className="px-4 mt-3 grid grid-cols-2 gap-3">
          <div className="card p-3">
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-1">👤 {settings.person1Name}</p>
            <p className="text-[18px] font-bold dark:text-white">{formatAmount(totalP1, base)}</p>
          </div>
          <div className="card p-3">
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-1">👤 {settings.person2Name}</p>
            <p className="text-[18px] font-bold dark:text-white">{formatAmount(totalP2, base)}</p>
          </div>
        </div>
        {totalShared > 0 && (
          <div className="card mx-4 mt-3 p-3">
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-1">👥 Commun</p>
            <p className="text-[18px] font-bold dark:text-white">{formatAmount(totalShared, base)}</p>
          </div>
        )}

        {/* Monthly bar chart */}
        {monthlyData.some(d => d.fixed + d.variable + d.revenus > 0) && (
          <div className="card mx-4 mt-4 p-4">
            <p className="text-[15px] font-semibold mb-3 dark:text-white">Évolution mensuelle</p>
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={monthlyData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }} barSize={5} barGap={1} barCategoryGap={4}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: isDark ? '#6b7280' : '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: isDark ? '#6b7280' : '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={fmt} />
                <Tooltip contentStyle={tooltipStyle}
                  formatter={(v: number, name: string) => [
                    `${v} ${sym}`,
                    name === 'fixed' ? 'Incompressible' : name === 'variable' ? 'Variable' : 'Revenus',
                  ]}
                />
                <Bar dataKey="fixed"    stackId="debits" fill="#f87171" radius={[0, 0, 2, 2]} />
                <Bar dataKey="variable" stackId="debits" fill="#60a5fa" radius={[2, 2, 0, 0]} />
                <Bar dataKey="revenus"  stackId="rev"    fill="#4ade80" radius={[2, 2, 2, 2]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 mt-2 flex-wrap">
              <span className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400"><span className="w-3 h-2 rounded-sm bg-red-400 inline-block" /> Incompressible</span>
              <span className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400"><span className="w-3 h-2 rounded-sm bg-blue-400 inline-block" /> Variable</span>
              <span className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400"><span className="w-3 h-2 rounded-sm bg-green-400 inline-block" /> Revenus</span>
            </div>
          </div>
        )}

        {/* Category breakdown (debits only) */}
        {catData.length > 0 && (
          <div className="card mx-4 mt-4 p-4">
            <p className="text-[15px] font-semibold mb-3 dark:text-white">Dépenses par catégorie</p>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={catData} dataKey="value" nameKey="label" cx="50%" cy="50%"
                  innerRadius="55%" outerRadius="80%"
                  onClick={d => setSelectedCat(selectedCat === d.id ? null : d.id)}>
                  {catData.map(entry => (
                    <Cell key={entry.id} fill={entry.color}
                      opacity={selectedCat === null || selectedCat === entry.id ? 1 : 0.3} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle}
                  formatter={(v: number) => [`${v.toFixed(0)} ${sym}`, '']}
                />
              </PieChart>
            </ResponsiveContainer>

            <div className="space-y-2 mt-1">
              {catData.map(c => (
                <button key={c.id} className="w-full flex items-center gap-2 text-left"
                  onClick={() => setSelectedCat(selectedCat === c.id ? null : c.id)}>
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c.color }} />
                  <span className="text-[13px] text-gray-700 dark:text-gray-200 flex-1 truncate">{c.label}</span>
                  <span className="text-[12px] text-gray-400 dark:text-gray-500">{formatPercent(c.value, totalDepenses)}</span>
                  <span className="text-[13px] font-semibold dark:text-white">{c.value.toFixed(0)} {sym}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
            <span className="text-5xl mb-4">📊</span>
            <p className="text-[17px] font-semibold text-gray-700 dark:text-gray-200 mb-1">Aucune dépense</p>
            <p className="text-[14px] text-gray-400 dark:text-gray-500 mb-4">Commencez à saisir vos dépenses</p>
            <button onClick={() => setShowAdd(true)}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-medium text-[15px]">
              Ajouter une dépense
            </button>
          </div>
        )}
      </div>

      {showAdd && <AddExpenseModal onClose={() => setShowAdd(false)} />}
    </div>
  )
}
