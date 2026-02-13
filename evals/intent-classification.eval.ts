/**
 * EDD: Intent classification eval (rule-based only, for CI).
 * For Workers AI evals, use pnpm run eval with EVAL_WORKER_URL set; the worker runs the same prod code.
 */
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATASET_PATH = join(__dirname, 'datasets', 'intent-classification.json')

type Intent = 'food_log' | 'greeting' | 'command' | 'query' | 'other'

/** Rule-based classifier used when useMock=true (CI). Matches logic in classify.ts. */
function ruleBasedClassify(message: string): Intent {
  const t = message.trim().toLowerCase()
  if (t.startsWith('/')) return 'command'
  const greetings = ['hi', 'hello', 'hey', 'good morning', 'hey there', 'good evening', 'good afternoon']
  if (greetings.includes(t) || greetings.some((g) => t === g || t.startsWith(g + ' '))) return 'greeting'
  const foodIndicators = [
    'breakfast', 'lunch', 'dinner', 'snack', 'egg', 'chapati', 'rice', 'sambar', 'protein', 'cup', 'ml', 'g ',
    'ate', 'had', 'eaten', 'food', 'meal', 'calories', 'dosa', 'parotta', 'curry', 'shake', 'oatmeal', 'banana'
  ]
  if (foodIndicators.some((w) => t.includes(w))) return 'food_log'
  const queryIndicators = ['what did', 'how many', 'show my', 'today\'s', 'summary', 'ate today']
  if (queryIndicators.some((w) => t.includes(w))) return 'query'
  return 'other'
}

interface IntentExample {
  message: string
  expectedIntent: string
}

export async function runIntentClassificationEval(useMock: boolean): Promise<{
  passed: boolean
  score: number
  error?: string
}> {
  const raw = readFileSync(DATASET_PATH, 'utf-8')
  const dataset: IntentExample[] = JSON.parse(raw)

  let correct = 0
  const threshold = 7.0 / 10

  try {
    for (const ex of dataset) {
      const predicted = ruleBasedClassify(ex.message)
      if (predicted === ex.expectedIntent) correct++
    }
    const score = dataset.length ? correct / dataset.length : 0
    const passed = score >= threshold
    return { passed, score }
  } catch (e) {
    return { passed: false, score: 0, error: String(e) }
  }
}
