import { Hono } from 'hono'
import type { Env } from './env.d'
import { fetchR1, insertR1Rows } from './lib/data/r1'
import { fetchNutrition } from './lib/api/sheets'
import { syncVectorize } from './lib/food/index'
import { syncSheetsToD1 } from './lib/data/sync'
import { setWebHook, getWebHookInfo } from './lib/channels/telegram'
import { api } from './api'

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
