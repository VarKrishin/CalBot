import { Hono } from 'hono'
import type { Env } from './env.d'
import type { ParsedFood, ResolvedFood, TelegramUpdate, TrackerRow } from './types'
import { sendMessage } from './lib/telegram'
import { fetchR1, insertR1Rows } from './lib/r1'
import { appendTrackerRows, appendNutritionRow } from './lib/sheets'
import { parseMeal } from './lib/parse'
import { resolveFood } from './lib/match'
import { searchFood } from './lib/vectorize'
import { getNutritionFromFatSecret } from './lib/fatsecret'
import { getNutritionFromAPI } from './lib/nutritionix'
import { transcribeVoice } from './lib/voice'
import { syncVectorize } from './lib/vectorize'
import { syncSheetsToD1 } from './lib/sync'
import { fetchNutrition } from './lib/sheets'
import { quantityMultiplier } from './lib/units'
import { withRetry } from './lib/retry'

const app = new Hono<{ Bindings: Env }>()

app.get('/', (c) => c.text('CalBot'))

function scaleResolved(
  base: Omit<ResolvedFood, 'quantity'> & { quantity: number; unit: string },
  userQty: number,
  userUnit: string
): ResolvedFood {
  const mult = quantityMultiplier(userQty, userUnit, base.quantity, base.unit)
  return {
    ...base,
    quantity: userQty,
    calories: Math.round(base.calories * mult),
    protein: Math.round((base.protein * mult) * 10) / 10,
    fat: Math.round((base.fat * mult) * 10) / 10,
    carbs: Math.round((base.carbs * mult) * 10) / 10,
  }
}

app.post('/webhook', async (c) => {
  let update: TelegramUpdate
  try {
    update = await c.req.json<TelegramUpdate>()
  } catch {
    return c.json({ ok: false }, 400)
  }
  const msg = update.message
  if (!msg?.chat?.id) return c.json({ ok: true })

  const chatId = msg.chat.id
  const reply = (text: string) => sendMessage(c.env, chatId, text).catch((e) => console.error('sendMessage', e))

  let text: string
  if (msg.voice) {
    try {
      text = await transcribeVoice(c.env, msg.voice.file_id)
      if (!text) {
        await reply('Could not transcribe the voice message. Try sending as text.')
        return c.json({ ok: true })
      }
    } catch (e) {
      console.error('Voice transcription error', e)
      await reply('Voice transcription failed. Try sending as text.')
      return c.json({ ok: true })
    }
  } else {
    text = msg.text?.trim() ?? ''
  }

  if (!text) return c.json({ ok: true })

  if (text === '/start') {
    await reply('Send what you ate, e.g. "2 eggs for breakfast" or "2 chapatis, 1 cup sambar for lunch". Voice messages work too.')
    return c.json({ ok: true })
  }

  c.executionCtx.waitUntil(
    (async () => {
      try {
        const parsed = await withRetry(() => parseMeal(c.env, text))
        const r1Rows = await withRetry(() => fetchR1(c.env))
        const resolved: Array<{ food: ResolvedFood; parsed: ParsedFood }> = []

        for (const f of parsed.foods) {
          let r: ResolvedFood | null = null
          const vectorMatch = await searchFood(c.env, f.name)
          if (vectorMatch) {
            r = scaleResolved(vectorMatch, f.quantity, f.unit)
          } else {
            const r1Match = resolveFood(f, r1Rows)
            if (r1Match) r = r1Match
            else {
              const apiFood = c.env.FATSECRET_CLIENT_ID
                ? await withRetry(() => getNutritionFromFatSecret(c.env, f.name))
                : await withRetry(() => getNutritionFromAPI(c.env, f.name))
              const mult = quantityMultiplier(f.quantity, f.unit, apiFood.quantity, apiFood.unit)
              r = {
                ...apiFood,
                quantity: f.quantity,
                calories: Math.round(apiFood.calories * mult),
                protein: Math.round((apiFood.protein * mult) * 10) / 10,
                fat: Math.round((apiFood.fat * mult) * 10) / 10,
                carbs: Math.round((apiFood.carbs * mult) * 10) / 10,
              }
              try {
                await appendNutritionRow(c.env, {
                  name: r.name,
                  unit: r.unit,
                  quantity: r.quantity,
                  calories: r.calories,
                  protein: r.protein,
                  fat: r.fat,
                  carbs: r.carbs,
                  source: c.env.FATSECRET_CLIENT_ID ? 'fatsecret' : 'nutritionix',
                })
              } catch (e) {
                console.error('Append Nutrition row failed', e)
              }
            }
          }
          if (r) resolved.push({ food: r, parsed: f })
        }

        const today = new Date().toISOString().split('T')[0]
        const mealLabel = parsed.meal_time.charAt(0).toUpperCase() + parsed.meal_time.slice(1)
        const rows: TrackerRow[] = resolved.map(({ food, parsed: p }) => ({
          date: today,
          mealTime: mealLabel,
          foodItem: food.name,
          quantity: String(p.quantity) + (p.unit !== 'n' ? ` ${p.unit}` : ''),
          calories: food.calories,
          protein: food.protein,
          fat: food.fat,
          carbs: food.carbs,
        }))
        if (rows.length) await withRetry(() => appendTrackerRows(c.env, rows))
        const totalCal = rows.reduce((s, r) => s + r.calories, 0)
        const totalPro = rows.reduce((s, r) => s + r.protein, 0)
        const lines = [`✅ ${mealLabel} logged: ${totalCal} kcal, ${totalPro}g protein`]
        for (const { food } of resolved) {
          const est = food.estimated ? ' (estimated)' : ''
          lines.push(`• ${food.quantity} ${food.name}: ${food.calories} kcal${est}`)
        }
        await reply(lines.join('\n'))
      } catch (e) {
        console.error('Pipeline error', e)
        await reply('Something went wrong; try again.')
      }
    })()
  )

  return c.json({ ok: true })
})

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

/** Sync Google Sheets → D1 (Nutrition + current month Tracker). Per design: keeps Sheets and D1 in sync. */
app.post('/admin/sync', async (c) => {
  if (c.env.ADMIN_SECRET) {
    const auth = c.req.header('Authorization')
    if (auth !== `Bearer ${c.env.ADMIN_SECRET}`) return c.json({ error: 'Unauthorized' }, 401)
  }
  try {
    const { nutrition, tracker } = await syncSheetsToD1(c.env)
    return c.json({ ok: true, nutrition, tracker })
  } catch (e) {
    console.error('Sync sheets→D1 error', e)
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
