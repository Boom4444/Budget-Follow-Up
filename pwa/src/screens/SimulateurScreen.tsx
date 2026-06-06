import { useState, useMemo } from 'react'
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'

interface Scenario {
  id: string
  label: string
  capitalInitial: number
  epargneMensuelle: number
  horizonAnnees: number
  tauxAnnuel: number
  intervalleMois: number
}

interface ScenarioResult {
  capitalFinal: number
  totalVersements: number
  totalInterets: number
  yearlyData: { year: number; versements: number; interets: number; total: number }[]
}

const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444']

const INIT_SCENARIO: Scenario = {
  id: 'sc-init',
  label: 'Scénario 1',
  capitalInitial: 10000,
  epargneMensuelle: 100,
  horizonAnnees: 20,
  tauxAnnuel: 5,
  intervalleMois: 12,
}

function cloneScenario(base: Scenario, n: number): Scenario {
  return { ...base, id: `sc-${Date.now()}-${n}`, label: `Scénario ${n}` }
}

function computeScenario(s: Scenario): ScenarioResult {
  const ratePerPeriod = (s.tauxAnnuel / 100) * (s.intervalleMois / 12)
  let capital = s.capitalInitial
  let totalSaved = s.capitalInitial
  const yearlyData: ScenarioResult['yearlyData'] = [
    { year: 0, versements: Math.round(s.capitalInitial), interets: 0, total: Math.round(s.capitalInitial) },
  ]

  for (let year = 1; year <= s.horizonAnnees; year++) {
    for (let m = 1; m <= 12; m++) {
      capital += s.epargneMensuelle
      totalSaved += s.epargneMensuelle
      if (((year - 1) * 12 + m) % s.intervalleMois === 0) {
        capital *= (1 + ratePerPeriod)
      }
    }
    yearlyData.push({
      year,
      versements: Math.round(totalSaved),
      interets: Math.round(capital - totalSaved),
      total: Math.round(capital),
    })
  }

  return { capitalFinal: capital, totalVersements: totalSaved, totalInterets: capital - totalSaved, yearlyData }
}

function fmt(v: number): string {
  return Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' €'
}

function fmtK(v: number): string {
  if (Math.abs(v) >= 1000) return `${Math.round(v / 1000)} k€`
  return `${Math.round(v)} €`
}

// ── InputRow ─────────────────────────────────────────────────────────────────

interface InputRowProps {
  label: string
  value: number
  onChange: (v: number) => void
  unit: string
  min?: number
  max?: number
  step?: number
  isLast?: boolean
}

function InputRow({ label, value, onChange, unit, min = 0, max, step = 1, isLast = false }: InputRowProps) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3${isLast ? '' : ' border-b border-gray-100 dark:border-gray-700'}`}>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 mb-0.5">{label}</p>
        <input
          type="number"
          inputMode="decimal"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={e => {
            const v = parseFloat(e.target.value)
            if (!isNaN(v)) onChange(v)
          }}
          className="text-[17px] font-medium bg-transparent dark:text-white focus:outline-none w-full"
          style={{ WebkitAppearance: 'none' } as React.CSSProperties}
        />
      </div>
      <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 tracking-wider flex-shrink-0">{unit}</span>
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

const COMP_ROWS: { key: keyof Omit<ScenarioResult, 'yearlyData'>; label: string; colored: boolean }[] = [
  { key: 'capitalFinal',     label: 'Capital final', colored: true  },
  { key: 'totalVersements',  label: 'Versements',    colored: false },
  { key: 'totalInterets',    label: 'Intérêts',      colored: false },
]

interface Props { onClose?: () => void }

export default function SimulateurScreen({ onClose }: Props = {}) {
  const [scenarios, setScenarios] = useState<Scenario[]>([INIT_SCENARIO])
  const [activeId, setActiveId]   = useState<string>(INIT_SCENARIO.id)
  const isDark = document.documentElement.classList.contains('dark')

  const activeScenario = scenarios.find(s => s.id === activeId) ?? scenarios[0]
  const activeIdx      = scenarios.findIndex(s => s.id === activeId)
  const activeColor    = COLORS[activeIdx] ?? COLORS[0]
  const isComparing    = scenarios.length > 1

  const results = useMemo(() =>
    scenarios.map(s => ({ id: s.id, ...computeScenario(s) }))
  , [scenarios])

  const activeResult = results.find(r => r.id === activeId) ?? results[0]

  const compChartData = useMemo(() => {
    if (!isComparing) return []
    const maxYear = Math.max(...results.map(r => r.yearlyData[r.yearlyData.length - 1].year))
    return Array.from({ length: maxYear + 1 }, (_, year) => {
      const point: Record<string, number | null> = { year }
      results.forEach((r, i) => {
        const d = r.yearlyData.find(d => d.year === year)
        point[`s${i}`] = d?.total ?? null
      })
      return point
    })
  }, [results, isComparing])

  const tooltipStyle = {
    borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,.15)', fontSize: 12,
    background: isDark ? '#1f2937' : '#fff', color: isDark ? '#f9fafb' : '#111827',
  }

  const xTickInterval = Math.max(0, Math.ceil(activeScenario.horizonAnnees / 5) - 1)
  const maxHorizon    = isComparing ? Math.max(...scenarios.map(s => s.horizonAnnees)) : 0
  const compXInterval = Math.max(0, Math.ceil(maxHorizon / 5) - 1)

  function updateActive(patch: Partial<Scenario>) {
    setScenarios(prev => prev.map(s => s.id === activeId ? { ...s, ...patch } : s))
  }

  function addScenario() {
    if (scenarios.length >= 4) return
    const newS = cloneScenario(activeScenario, scenarios.length + 1)
    setScenarios(prev => [...prev, newS])
    setActiveId(newS.id)
  }

  function removeScenario(id: string) {
    if (scenarios.length <= 1) return
    const next = scenarios.filter(s => s.id !== id)
    setScenarios(next)
    if (activeId === id) setActiveId(next[0].id)
  }

  return (
    <div className="flex flex-col h-full bg-[#f2f2f7] dark:bg-[#1c1c1e]"
         style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>

      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700 flex-shrink-0 px-4 py-3 flex items-center gap-3">
        {onClose && (
          <button onClick={onClose} className="text-blue-600 text-[22px] font-light leading-none px-1">‹</button>
        )}
        <div>
          <h1 className="text-[17px] font-semibold dark:text-white">Intérêts composés</h1>
          <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">Simulez la croissance de votre épargne</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-ios pb-8">

        {/* ── Scenario chips ──────────────────────────────────────────────── */}
        <div className="px-4 pt-4 pb-2 flex items-center gap-2">
          <div className="flex gap-2 overflow-x-auto flex-1 pb-0.5">
            {scenarios.map((s, i) => {
              const isActive = s.id === activeId
              return (
                <button key={s.id} onClick={() => setActiveId(s.id)}
                  className={`flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full text-[13px] font-medium flex-shrink-0 transition-all
                    ${isActive ? 'text-white shadow-sm' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}
                  style={isActive ? { backgroundColor: COLORS[i] } : {}}>
                  <span className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: isActive ? 'rgba(255,255,255,0.55)' : COLORS[i] }} />
                  {s.label}
                  {scenarios.length > 1 && (
                    <span role="button"
                      onClick={e => { e.stopPropagation(); removeScenario(s.id) }}
                      className="w-4 h-4 ml-0.5 rounded-full flex items-center justify-center opacity-60 hover:opacity-100 text-[13px]">
                      ×
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          {scenarios.length < 4 && (
            <button onClick={addScenario}
              className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xl font-light leading-none">
              +
            </button>
          )}
        </div>

        {/* ── Scenario form ───────────────────────────────────────────────── */}
        <div className="card mx-4 overflow-hidden">
          <div className="px-4 py-2.5 border-b-2" style={{ borderBottomColor: activeColor }}>
            <input
              value={activeScenario.label}
              onChange={e => updateActive({ label: e.target.value })}
              className="text-[15px] font-semibold bg-transparent dark:text-white focus:outline-none w-full"
              placeholder="Nom du scénario"
            />
          </div>
          <InputRow
            label="Capital initial" value={activeScenario.capitalInitial}
            onChange={v => updateActive({ capitalInitial: Math.max(0, v) })}
            unit="EUR" step={1000} />
          <InputRow
            label="Épargne mensuelle" value={activeScenario.epargneMensuelle}
            onChange={v => updateActive({ epargneMensuelle: Math.max(0, v) })}
            unit="EUR / MOIS" step={100} />
          <InputRow
            label="Horizon de placement" value={activeScenario.horizonAnnees}
            onChange={v => updateActive({ horizonAnnees: Math.max(1, Math.min(50, Math.round(v))) })}
            unit="ANNÉES" min={1} max={50} />
          <InputRow
            label="Taux d'intérêt annuel" value={activeScenario.tauxAnnuel}
            onChange={v => updateActive({ tauxAnnuel: Math.max(0.01, Math.round(v * 10) / 10) })}
            unit="%" step={0.5} />
          <InputRow
            label="Fréquence de capitalisation" value={activeScenario.intervalleMois}
            onChange={v => updateActive({ intervalleMois: Math.max(1, Math.min(12, Math.round(v))) })}
            unit="MOIS" min={1} max={12} isLast />
        </div>

        {/* ── Single scenario results ─────────────────────────────────────── */}
        {!isComparing && (
          <>
            {/* Capital hero */}
            <div className="card mx-4 mt-3 p-4">
              <p className="text-[12px] text-gray-400 dark:text-gray-500 text-center">Capital final</p>
              <p className="text-[40px] font-bold text-center tracking-tight leading-tight mt-1"
                 style={{ color: activeColor }}>
                {fmt(activeResult.capitalFinal)}
              </p>

              <div className="flex mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 flex-shrink-0" />
                    <span className="text-[12px] text-gray-400 dark:text-gray-500">Versements</span>
                  </div>
                  <p className="text-[17px] font-semibold dark:text-white ml-4">{fmt(activeResult.totalVersements)}</p>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 flex-shrink-0" />
                    <span className="text-[12px] text-gray-400 dark:text-gray-500">Intérêts</span>
                  </div>
                  <p className="text-[17px] font-semibold dark:text-white ml-4">{fmt(activeResult.totalInterets)}</p>
                </div>
              </div>
            </div>

            {/* Stacked area chart */}
            <div className="card mx-4 mt-3 px-2 pt-4 pb-3">
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={activeResult.yearlyData}
                  margin={{ top: 0, right: 8, left: -4, bottom: 0 }}>
                  <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#9ca3af' }}
                    interval={xTickInterval}
                    tickFormatter={v => v === 0 ? "Auj." : `${v} ans`} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={fmtK} width={48} />
                  <Tooltip contentStyle={tooltipStyle}
                    labelFormatter={v => `Année ${v}`}
                    formatter={(v: number, key: string) => [fmt(v), key === 'versements' ? 'Versements' : 'Intérêts']} />
                  <Area type="monotone" dataKey="versements" stackId="1"
                    stroke="#6366f1" fill="#6366f1" fillOpacity={0.85} strokeWidth={0} />
                  <Area type="monotone" dataKey="interets" stackId="1"
                    stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.85} strokeWidth={0} />
                </AreaChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-6 mt-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-indigo-500" />
                  <span className="text-[12px] text-gray-500 dark:text-gray-400">Versements</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-amber-400" />
                  <span className="text-[12px] text-gray-500 dark:text-gray-400">Intérêts</span>
                </div>
              </div>
            </div>

            {/* Summary text */}
            <div className="card mx-4 mt-3 p-4">
              <p className="text-[14px] text-center text-gray-600 dark:text-gray-300 leading-relaxed">
                Avec <strong className="dark:text-white">{fmt(activeScenario.capitalInitial)}</strong> placés et{' '}
                <strong className="dark:text-white">{fmt(activeScenario.epargneMensuelle)}/mois</strong> pendant{' '}
                <strong className="dark:text-white">{activeScenario.horizonAnnees} ans</strong> à{' '}
                <strong className="dark:text-white">{activeScenario.tauxAnnuel}%</strong>, vous obtenez{' '}
                <strong style={{ color: activeColor }}>{fmt(activeResult.capitalFinal)}</strong>{' '}
                dont <strong style={{ color: activeColor }}>{fmt(activeResult.totalInterets)}</strong> d'intérêts générés.
              </p>
            </div>
          </>
        )}

        {/* ── Comparison results ──────────────────────────────────────────── */}
        {isComparing && (
          <>
            {/* Multi-line chart */}
            <div className="card mx-4 mt-3 px-2 pt-4 pb-3">
              <p className="text-[13px] font-semibold text-gray-500 dark:text-gray-400 px-2 mb-3">Évolution du capital</p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={compChartData}
                  margin={{ top: 0, right: 8, left: -4, bottom: 0 }}>
                  <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#9ca3af' }}
                    interval={compXInterval}
                    tickFormatter={v => `${v}a`} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={fmtK} width={48} />
                  <Tooltip contentStyle={tooltipStyle}
                    labelFormatter={v => `Année ${v}`}
                    formatter={(v: number, key: string) => {
                      const i = parseInt((key as string).replace('s', ''))
                      return [fmt(v), scenarios[i]?.label ?? key]
                    }} />
                  {scenarios.map((s, i) => (
                    <Line key={s.id} type="monotone" dataKey={`s${i}`}
                      stroke={COLORS[i]} strokeWidth={2.5} dot={false} connectNulls />
                  ))}
                </LineChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-4 mt-2">
                {scenarios.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i] }} />
                    <span className="text-[12px] text-gray-500 dark:text-gray-400">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Comparison table */}
            <div className="card mx-4 mt-3 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-700">
                <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Comparaison</p>
              </div>
              {/* Header */}
              <div className="flex border-b border-gray-100 dark:border-gray-700">
                <div className="w-28 flex-shrink-0" />
                {scenarios.map((s, i) => (
                  <div key={s.id} className="flex-1 px-2 py-2.5 text-center">
                    <span className="text-[11px] font-bold" style={{ color: COLORS[i] }}>{s.label}</span>
                  </div>
                ))}
              </div>
              {/* Rows */}
              {COMP_ROWS.map(({ key, label, colored }, ri) => (
                <div key={key} className={`flex${ri < COMP_ROWS.length - 1 ? ' border-b border-gray-100 dark:border-gray-700' : ''}`}>
                  <div className="w-28 flex-shrink-0 px-4 py-3">
                    <p className="text-[12px] text-gray-500 dark:text-gray-400">{label}</p>
                  </div>
                  {results.map((r, i) => (
                    <div key={r.id} className="flex-1 px-2 py-3 text-center">
                      <p className={`text-[13px] font-semibold${colored ? '' : ' dark:text-white'}`}
                         style={colored ? { color: COLORS[i] } : {}}>
                        {fmtK(r[key])}
                      </p>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Per-scenario mini summaries */}
            {results.map((r, i) => (
              <div key={r.id} className="card mx-4 mt-3 px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i] }} />
                  <span className="text-[13px] font-semibold dark:text-white">{scenarios[i].label}</span>
                  <span className="text-[12px] text-gray-400 dark:text-gray-500 ml-auto">
                    {scenarios[i].horizonAnnees} ans · {scenarios[i].tauxAnnuel}%
                  </span>
                </div>
                <p className="text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed">
                  {fmt(scenarios[i].capitalInitial)} + {fmt(scenarios[i].epargneMensuelle)}/mois →{' '}
                  <strong style={{ color: COLORS[i] }}>{fmt(r.capitalFinal)}</strong>
                  {' '}({fmt(r.totalInterets)} d'intérêts)
                </p>
              </div>
            ))}
          </>
        )}

      </div>
    </div>
  )
}
