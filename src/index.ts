import { Hono } from 'hono'
import type { Env } from './env.d'
import { fetchR1, insertR1Rows } from './lib/data/r1'
import { fetchNutrition } from './lib/api/sheets'
import { syncVectorize } from './lib/food/index'
import { syncSheetsToD1 } from './lib/data/sync'
import { setWebHook, getWebHookInfo } from './lib/channels/telegram'
import { classifyIntent } from './lib/intent/classify'
import { parseMeal, validateParsedMeal, searchFood } from './lib/food'
import { parsingMatch, type ParsedExpected } from './lib/eval/scoring'
import { api } from './api'

const EVAL_THRESHOLD = 7.0 / 10
const EVAL_THRESHOLD_VECTOR_SEARCH = 0.5 // lower until R1/Vectorize is fully populated and names align with dataset

const app = new Hono<{ Bindings: Env }>()

app.get('/', (c) => c.text('CalBot'))

app.route('/', api)

/** Set Telegram webhook from the app: call this on your running app (ngrok URL when local, worker URL when deployed) and pass the base URL. App registers that URL + /api/telegram/webhook with Telegram. */
app.post('/admin/telegram-set-webhook', async (c) => {
  if (c.env.ADMIN_SECRET) {
    const auth = c.req.header('Authorization')
    if (auth !== `Bearer ${c.env.ADMIN_SECRET}`) return c.json({ error: 'Unauthorized' }, 401)
  }
  let baseUrl = c.env.TELEGRAM_WEBHOOK_BASE_URL
  try {
    const body = (await c.req.json<{ baseUrl?: string }>().catch(() => ({}))) as { baseUrl?: string }
    if (body.baseUrl) baseUrl = body.baseUrl
  } catch {
    /* ignore */
  }
  if (!baseUrl) return c.json({ error: 'TELEGRAM_WEBHOOK_BASE_URL not set and no baseUrl in body' }, 400)
  const webhookUrl = baseUrl.replace(/\/$/, '') + '/api/telegram/webhook'
  try {
    await setWebHook(c.env, webhookUrl)
    return c.json({ ok: true, webhookUrl })
  } catch (e) {
    console.error('setWebHook error', e)
    return c.json({ error: String(e) }, 500)
  }
})

/** Get current Telegram webhook URL (for debugging). */
app.get('/admin/telegram-webhook-info', async (c) => {
  if (c.env.ADMIN_SECRET) {
    const auth = c.req.header('Authorization')
    if (auth !== `Bearer ${c.env.ADMIN_SECRET}`) return c.json({ error: 'Unauthorized' }, 401)
  }
  try {
    const info = await getWebHookInfo(c.env)
    return c.json({ ok: true, ...info })
  } catch (e) {
    console.error('getWebHookInfo error', e)
    return c.json({ error: String(e) }, 500)
  }
})

/** Full sync: Sheets → D1, then R1 + Nutrition → Vectorize. One call updates both. */
app.post('/admin/sync', async (c) => {
  if (c.env.ADMIN_SECRET) {
    const auth = c.req.header('Authorization')
    if (auth !== `Bearer ${c.env.ADMIN_SECRET}`) return c.json({ error: 'Unauthorized' }, 401)
  }
  try {
    const { nutrition, tracker } = await syncSheetsToD1(c.env)
    const r1Rows = await fetchR1(c.env)
    const nutritionRows = await fetchNutrition(c.env)
    const vectorizeCount = await syncVectorize(c.env, r1Rows, nutritionRows)
    return c.json({ ok: true, nutrition, tracker, vectorize: vectorizeCount })
  } catch (e) {
    console.error('Sync error', e)
    return c.json({ error: String(e) }, 500)
  }
})

/** Refresh only the vector search index (R1 + Nutrition → Vectorize). Use when you don't need to re-copy Sheets → D1. */
app.post('/admin/sync-vectorize', async (c) => {
  if (c.env.ADMIN_SECRET) {
    const auth = c.req.header('Authorization')
    if (auth !== `Bearer ${c.env.ADMIN_SECRET}`) return c.json({ error: 'Unauthorized' }, 401)
  }
  try {
    const r1Rows = await fetchR1(c.env)
    const nutritionRows = await fetchNutrition(c.env)
    const count = await syncVectorize(c.env, r1Rows, nutritionRows)
    return c.json({ ok: true, count })
  } catch (e) {
    console.error('Sync vectorize error', e)
    return c.json({ error: String(e) }, 500)
  }
})

/**
 * Run evals using Workers AI (same model as prod). Body: { eval: 'intent' | 'food_parsing' | 'vector_search', dataset: [...] }.
 * Used by pnpm run eval when EVAL_WORKER_URL is set (e.g. http://localhost:8787 with wrangler dev).
 */
app.post('/admin/run-eval', async (c) => {
  if (c.env.ADMIN_SECRET) {
    const auth = c.req.header('Authorization')
    if (auth !== `Bearer ${c.env.ADMIN_SECRET}`) return c.json({ error: 'Unauthorized' }, 401)
  }
  try {
    const body = await c.req.json<{ eval: string; dataset: unknown[] }>()
    const { eval: evalType, dataset } = body
    if (!evalType || !Array.isArray(dataset) || dataset.length === 0) {
      return c.json({ error: 'Body must be { eval: "intent"|"food_parsing"|"vector_search", dataset: [...] }' }, 400)
    }

    if (evalType === 'intent') {
      let correct = 0
      for (const ex of dataset as Array<{ message: string; expectedIntent: string }>) {
        const { intent } = await classifyIntent(c.env, ex.message)
        if (intent === ex.expectedIntent) correct++
      }
      const score = correct / dataset.length
      return c.json({ passed: score >= EVAL_THRESHOLD, score })
    }

    if (evalType === 'food_parsing') {
      let totalScore = 0
      for (const ex of dataset as Array<{ message: string; expected: ParsedExpected }>) {
        const parsed = await parseMeal(c.env, ex.message)
        const validated = validateParsedMeal(parsed)
        totalScore += parsingMatch(validated, ex.expected)
      }
      const score = totalScore / dataset.length
      return c.json({ passed: score >= EVAL_THRESHOLD, score })
    }

    if (evalType === 'vector_search') {
      if (!c.env.VECTORIZE) return c.json({ passed: false, score: 0, error: 'VECTORIZE not configured' }, 500)
      const norm = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ')
      let correct = 0
      for (const ex of dataset as Array<{ query: string; expectedMatch: string | null; shouldMatch: boolean }>) {
        const match = await searchFood(c.env, ex.query)
        const gotMatch = match !== null
        const nameMatch =
          ex.expectedMatch !== null && match !== null && norm(match.name) === norm(ex.expectedMatch)
        if (ex.shouldMatch && nameMatch) correct++
        else if (!ex.shouldMatch && !gotMatch) correct++
      }
      const score = correct / dataset.length
      return c.json({ passed: score >= EVAL_THRESHOLD_VECTOR_SEARCH, score })
    }

    return c.json({ error: 'Unknown eval type. Use intent, food_parsing, or vector_search.' }, 400)
  } catch (e) {
    console.error('Run eval error', e)
    return c.json({ passed: false, score: 0, error: String(e) }, 500)
  }
})

/** Seed reference foods (R1) in D1. Body: JSON array of { name, unit, quantity, calories, protein, fat, carbs, vitamins? }. */
app.post('/admin/seed-r1', async (c) => {
  if (c.env.ADMIN_SECRET) {
    const auth = c.req.header('Authorization')
    if (auth !== `Bearer ${c.env.ADMIN_SECRET}`) return c.json({ error: 'Unauthorized' }, 401)
  }
  try {
    const body = await c.req.json<Array<{ name: string; unit?: string; quantity?: number; calories?: number; protein?: number; fat?: number; carbs?: number; vitamins?: string }>>()
    if (!Array.isArray(body) || body.length === 0) return c.json({ error: 'Body must be a non-empty array of food rows' }, 400)
    const rows = body.map((r) => ({
      name: String(r.name ?? '').trim(),
      unit: String(r.unit ?? 'n').trim(),
      quantity: Number(r.quantity) || 1,
      calories: Number(r.calories) || 0,
      protein: Number(r.protein) || 0,
      fat: Number(r.fat) || 0,
      carbs: Number(r.carbs) || 0,
      vitamins: r.vitamins != null ? String(r.vitamins) : undefined,
    })).filter((r) => r.name !== '')
    if (rows.length === 0) return c.json({ error: 'No valid rows (name required)' }, 400)
    const { inserted } = await insertR1Rows(c.env, rows)
    return c.json({ ok: true, inserted })
  } catch (e) {
    console.error('Seed R1 error', e)
    return c.json({ error: String(e) }, 500)
  }
})

export default app
