import type { Env } from '../../env.d'

export type Intent = 'food_log' | 'greeting' | 'command' | 'query' | 'other'

export interface ClassifyResult {
  intent: Intent
  confidence: number
}

const MODEL = '@cf/qwen/qwen3-30b-a3b-fp8'

const CLASSIFICATION_PROMPT = `You are a nutrition bot. Classify the user message into exactly one intent.

Intents:
- food_log: user is logging food/meals (e.g. "2 eggs for breakfast", "had rice and dal")
- greeting: hi, hello, hey, good morning, etc.
- command: slash commands like /start, /help, /today
- query: questions about their data (e.g. "what did I eat?", "how many calories?")
- other: thanks, ok, lol, nonsense, or unclear

Reply with only the single intent word, nothing else. No punctuation, no explanation.`

const INTENTS: Intent[] = ['food_log', 'greeting', 'command', 'query', 'other']

function normalizeIntent(s: string): Intent {
  const t = s.toLowerCase().trim().replace(/[\s.]/g, '')
  if (INTENTS.includes(t as Intent)) return t as Intent
  if (t.includes('food') || t.includes('log')) return 'food_log'
  if (t.includes('greet')) return 'greeting'
  if (t.includes('command')) return 'command'
  if (t.includes('query')) return 'query'
  return 'other'
}

/** Fast-path: no LLM. Returns intent or null if we need LLM. */
function fastPath(message: string): Intent | null {
  const t = message.trim().toLowerCase()
  if (t.startsWith('/')) return 'command'
  const greetings = ['hi', 'hello', 'hey', 'good morning', 'hey there', 'good evening', 'good afternoon']
  if (greetings.includes(t) || greetings.some((g) => t === g || t.startsWith(g + ' '))) return 'greeting'
  const foodIndicators = [
    'breakfast', 'lunch', 'dinner', 'snack', 'egg', 'chapati', 'rice', 'sambar', 'protein', 'cup', 'ml', 'g ',
    'ate', 'had', 'eaten', 'food', 'meal', 'calories', 'dosa', 'parotta', 'curry', 'shake', 'oatmeal', 'banana',
    'chapatis', 'dal', 'milk', 'ghee', 'paneer', 'idli', 'paruppu', 'chutney', 'oats', 'vegetables', 'soya',
  ]
  if (foodIndicators.some((w) => t.includes(w))) return 'food_log'
  const queryIndicators = ["what did", 'how many', 'show my', "today's", 'summary', 'ate today']
  if (queryIndicators.some((w) => t.includes(w))) return 'query'
  const otherShort = ['thanks', 'thank you', 'ok', 'okay', 'lol', 'yes', 'no', 'cool', 'nice', 'k', 'asdf', 'nope']
  if (otherShort.includes(t) || (t.length <= 4 && !t.includes(' '))) return 'other'
  return null
}

export async function classifyIntent(env: Env, message: string): Promise<ClassifyResult> {
  const fp = fastPath(message)
  if (fp !== null) return { intent: fp, confidence: 1 }

  try {
    const response = await env.AI.run(MODEL, {
      messages: [
        { role: 'system', content: CLASSIFICATION_PROMPT },
        { role: 'user', content: `Message: ${message}\n\nIntent:` },
      ],
    })
    let content = ''
    if (response.choices?.length) {
      const choice = response.choices[0]
      content = (choice.message?.content ?? (choice as { text?: string }).text ?? '').trim()
    }
    const intent = normalizeIntent(content || 'other')
    return { intent, confidence: 0.85 }
  } catch {
    return { intent: 'other', confidence: 0 }
  }
}
