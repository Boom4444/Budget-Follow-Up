import { useState, useRef, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { CATEGORY_MAP } from '../data/categories'
import type { Expense } from '../models/types'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

function buildContext(
  expenses: Expense[],
  baseCurrency: string,
  person1Name: string,
  person2Name: string,
): string {
  const now = new Date()
  const cy = now.getFullYear()
  const cm = now.getMonth() + 1

  const recent = expenses.filter(e => {
    const ey = parseInt(e.date.slice(0, 4))
    const em = parseInt(e.date.slice(5, 7))
    return (cy - ey) * 12 + (cm - em) <= 11
  })

  type MonthData = {
    debits: number
    credits: number
    byCategory: Record<string, number>
    byPerson: Record<string, number>
  }
  const byMonth: Record<string, MonthData> = {}

  recent.forEach(e => {
    const key = e.date.slice(0, 7)
    if (!byMonth[key]) byMonth[key] = { debits: 0, credits: 0, byCategory: {}, byPerson: {} }
    const m = byMonth[key]
    if (e.type === 'debit') {
      m.debits += e.amountInBase
      m.byCategory[e.category] = (m.byCategory[e.category] ?? 0) + e.amountInBase
      const label = e.person === 'person1' ? person1Name : e.person === 'person2' ? person2Name : 'Commun'
      m.byPerson[label] = (m.byPerson[label] ?? 0) + e.amountInBase
    } else {
      m.credits += e.amountInBase
    }
  })

  const lines: string[] = [
    `Foyer : ${person1Name} & ${person2Name} | Devise : ${baseCurrency}`,
    ``,
    `Résumé des 12 derniers mois :`,
  ]

  const sortedMonths = Object.keys(byMonth).sort()
  for (const month of sortedMonths) {
    const d = byMonth[month]
    const solde = d.credits - d.debits
    lines.push(`\n## ${month}`)
    lines.push(`  Dépenses: ${d.debits.toFixed(0)} | Revenus: ${d.credits.toFixed(0)} | Solde: ${solde >= 0 ? '+' : ''}${solde.toFixed(0)} ${baseCurrency}`)

    const topCats = Object.entries(d.byCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([cat, amt]) => `${CATEGORY_MAP[cat]?.label ?? cat}: ${amt.toFixed(0)}`)
    if (topCats.length) lines.push(`  Catégories: ${topCats.join(', ')}`)

    const persons = Object.entries(d.byPerson).map(([p, a]) => `${p}: ${a.toFixed(0)}`).join(', ')
    if (persons) lines.push(`  Par personne: ${persons}`)
  }

  lines.push(`\nTotal dépenses enregistrées : ${expenses.length}`)

  return lines.join('\n')
}

const SUGGESTIONS = [
  'Quelles sont mes plus grosses dépenses ce mois ?',
  'Compare mes dépenses de janvier vs février',
  'Quelle est ma catégorie la plus coûteuse sur 3 mois ?',
  'Quel est mon solde moyen mensuel cette année ?',
  'Donne-moi des conseils pour réduire mes dépenses',
]

export default function AIChatScreen() {
  const { expenses, settings, claudeApiKey } = useStore()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const apiKey = claudeApiKey
  const hasKey = apiKey.startsWith('sk-')

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function sendMessage(text?: string) {
    const content = (text ?? input).trim()
    if (!content || loading) return
    setInput('')
    setError(null)

    const newMessages: Message[] = [...messages, { role: 'user', content }]
    setMessages(newMessages)
    setLoading(true)

    const context = buildContext(expenses, settings.baseCurrency, settings.person1Name, settings.person2Name)
    const systemPrompt = `Tu es un assistant budgétaire personnel pour un foyer composé de ${settings.person1Name} et ${settings.person2Name}. Tu analyses leurs données de budget et réponds à leurs questions de manière concise et utile en français.

Données budgétaires :
${context}

Instructions : Réponds directement et précisément. Si tu calcules des montants, montre les chiffres. Si tu n'as pas assez de données pour répondre, dis-le clairement. Ne dépasse pas 200 mots par réponse sauf si une analyse détaillée est demandée.`

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          system: systemPrompt,
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error((err as any).error?.message ?? `Erreur ${response.status}`)
      }

      const data = await response.json() as { content: Array<{ type: string; text: string }> }
      const reply = data.content?.find(c => c.type === 'text')?.text ?? ''
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
      setMessages(prev => prev.slice(0, -1))
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  if (!hasKey) {
    return (
      <div className="flex flex-col h-full bg-[#f2f2f7] dark:bg-[#1c1c1e]"
           style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <header className="flex-shrink-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
          <h1 className="text-[18px] font-semibold dark:text-white">Assistant IA</h1>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-5">
          <span className="text-6xl">🤖</span>
          <div>
            <h2 className="text-[19px] font-semibold dark:text-white mb-2">Configurez votre clé API</h2>
            <p className="text-[14px] text-gray-500 dark:text-gray-400 leading-relaxed">
              Ajoutez votre clé API Claude dans{' '}
              <span className="font-medium text-gray-700 dark:text-gray-300">Réglages → Assistant IA</span>
              {' '}pour poser des questions sur vos dépenses.
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl px-5 py-4 w-full text-left">
            <p className="text-[12px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Ce que vous pouvez demander</p>
            <ul className="space-y-1.5">
              {SUGGESTIONS.slice(0, 3).map(s => (
                <li key={s} className="text-[13px] text-gray-600 dark:text-gray-300 flex gap-2">
                  <span>💬</span><span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-[12px] text-gray-400 dark:text-gray-500">
            Clé disponible sur console.anthropic.com
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[#f2f2f7] dark:bg-[#1c1c1e]"
         style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <header className="flex-shrink-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
        <h1 className="text-[18px] font-semibold dark:text-white">Assistant IA</h1>
        {messages.length > 0 && (
          <button onClick={() => { setMessages([]); setError(null) }}
            className="text-[13px] text-blue-600">
            Nouvelle discussion
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto scroll-ios px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col gap-3 pt-4">
            <div className="text-center">
              <span className="text-4xl">💬</span>
              <p className="text-[15px] font-medium dark:text-white mt-2">Questions suggérées</p>
            </div>
            <div className="space-y-2">
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => sendMessage(s)}
                  className="w-full text-left bg-white dark:bg-gray-800 rounded-2xl px-4 py-3 text-[14px] text-gray-700 dark:text-gray-200 shadow-sm active:bg-gray-50 dark:active:bg-gray-700">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-[14px] leading-relaxed whitespace-pre-wrap ${
              msg.role === 'user'
                ? 'bg-blue-600 text-white rounded-br-sm'
                : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-bl-sm shadow-sm'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-gray-800 px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm">
              <div className="flex gap-1.5 items-center">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
            <p className="text-[13px] text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="flex-shrink-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-4 py-2"
           style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.5rem)' }}>
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Posez une question sur vos dépenses…"
            rows={1}
            disabled={loading}
            className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-800 rounded-2xl text-[15px] outline-none resize-none dark:text-white dark:placeholder-gray-500 max-h-28 disabled:opacity-60"
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-opacity"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 13V3M3 8l5-5 5 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
