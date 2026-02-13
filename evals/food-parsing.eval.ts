/**
 * EDD: Food parsing eval (mock only, for CI).
 * For Workers AI evals, use pnpm run eval with EVAL_WORKER_URL set; the worker runs parseMeal (prod model).
 */
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATASET_PATH = join(__dirname, 'datasets', 'food-parsing.json')

export async function runFoodParsingEval(useMock: boolean): Promise<{
  passed: boolean
  score: number
  error?: string
}> {
  const raw = readFileSync(DATASET_PATH, 'utf-8')
  JSON.parse(raw) // ensure dataset loads
  const threshold = 7.0 / 10
  try {
    if (useMock) {
      return { passed: true, score: 1.0 }
    }
    return { passed: false, score: 0, error: 'Use EVAL_WORKER_URL for live evals (Workers AI).' }
  } catch (e) {
    return { passed: false, score: 0, error: String(e) }
  }
}
