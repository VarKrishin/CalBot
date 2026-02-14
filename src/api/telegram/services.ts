import type { Env } from '../../env.d'
import type { ParsedFood, ResolvedFood, TrackerRow } from '../../types'
import { sendMessage } from '../../lib/channels/telegram'
import { fetchR1 } from '../../lib/data/r1'
import { appendTrackerRows, appendNutritionRow } from '../../lib/api/sheets'
import { classifyIntent } from '../../lib/intent/classify'
import { parseMeal, validateParsedMeal, resolveFood, quantityMultiplier, searchFood, isPlausibleFood } from '../../lib/food'
import { getNutritionFromFatSecret } from '../../lib/api/fatsecret'
import { getNutritionFromAPI } from '../../lib/api/nutritionix'
import { transcribeVoice } from '../../lib/voice'
import { withRetry } from '../../lib/utils/retry'
import { getReplyForNonFoodIntent, formatConfirmationMessage } from './replies'
import type { TelegramUpdate } from './schema'

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

/**
 * Handle an incoming Telegram update (webhook payload).
 * Sends /start reply synchronously; schedules meal-logging pipeline with executionCtx.waitUntil.
 */
export async function handleTelegramUpdate(
  env: Env,
  update: TelegramUpdate,
  executionCtx: ExecutionContext
): Promise<void> {
  const msg = update.message
  if (!msg?.chat?.id) return

  const chatId = msg.chat.id
  const reply = (text: string) => sendMessage(env, chatId, text).catch((e) => console.error('sendMessage', e))

  let text: string
  if (msg.voice) {
    try {
      text = await transcribeVoice(env, msg.voice.file_id)
      console.log('[telegram] voice transcript:', JSON.stringify(text))
      if (!text) {
        await reply('Could not transcribe the voice message. Try sending as text.')
        return
      }
    } catch (e) {
      console.error('Voice transcription error', e)
      await reply('Voice transcription failed. Try sending as text.')
      return
    }
  } else {
    text = msg.text?.trim() ?? ''
  }

  if (!text) return

  if (env.TELEGRAM_ECHO_ONLY === 'true' || env.TELEGRAM_ECHO_ONLY === '1') {
    await reply(text)
    return
  }

  if (text === '/start') {
    await reply(
      'Send what you ate, e.g. "2 eggs for breakfast" or "2 chapatis, 1 cup sambar for lunch". Voice messages work too.'
    )
    return
  }

  const { intent } = await classifyIntent(env, text)
  if (intent !== 'food_log') {
    await reply(getReplyForNonFoodIntent(intent, text))
    return
  }

  executionCtx.waitUntil(
    (async () => {
      try {
        const parsed = validateParsedMeal(await withRetry(() => parseMeal(env, text)))
        const foodsToResolve = parsed.foods.filter((f) => isPlausibleFood(f.name))
        if (foodsToResolve.length === 0) {
          await reply("I didn't understand that. Try: 2 eggs for breakfast")
          return
        }
        const r1Rows = await withRetry(() => fetchR1(env))
        const resolved: Array<{ food: ResolvedFood; parsed: ParsedFood }> = []

        for (const f of foodsToResolve) {
          let r: ResolvedFood | null = null
          const vectorMatch = await searchFood(env, f.name)
          if (vectorMatch) {
            r = scaleResolved(vectorMatch, f.quantity, f.unit)
          } else {
            const r1Match = resolveFood(f, r1Rows)
            if (r1Match) r = r1Match
            else {
              const apiFood = env.FATSECRET_CLIENT_ID
                ? await withRetry(() => getNutritionFromFatSecret(env, f.name))
                : await withRetry(() => getNutritionFromAPI(env, f.name))
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
                await appendNutritionRow(env, {
                  name: r.name,
                  unit: r.unit,
                  quantity: r.quantity,
                  calories: r.calories,
                  protein: r.protein,
                  fat: r.fat,
                  carbs: r.carbs,
                  source: env.FATSECRET_CLIENT_ID ? 'fatsecret' : 'nutritionix',
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
        if (rows.length) await withRetry(() => appendTrackerRows(env, rows))
        await reply(formatConfirmationMessage(mealLabel, resolved))
      } catch (e) {
        console.error('Pipeline error', e)
        await reply('Something went wrong; try again.')
      }
    })()
  )
}
