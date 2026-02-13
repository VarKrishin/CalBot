import type { Env } from '../../env.d'
import type { ParsedMeal } from '../../types'

const MODEL = '@cf/qwen/qwen3-30b-a3b-fp8'

const SYSTEM_PROMPT = `You are a nutrition tracking assistant. Parse the user's message and extract meal details.

Return JSON only, no markdown or explanation, with this exact structure:
{
  "meal_time": "breakfast" | "lunch" | "snack" | "dinner",
  "foods": [
    {"name": "food name", "quantity": number, "unit": "n" | "cup" | "serving" | "g" | "ml" | "teaspoon" | etc}
  ]
}

Rules:
- Infer meal time from context (morning = breakfast, afternoon = lunch, evening = dinner). Default to "snack" if unclear.
- Normalize quantities: "a couple" = 2, "half" = 0.5, "one" = 1. Extract numbers from "2 chapatis", "1 cup sambar".
- Extract every food item separated by commas or "and". Ignore restaurant or place names; focus on food.
- Use "n" for countable items (eggs, chapatis), "cup" for cups, "serving" for servings, "g" for grams, "ml" for ml.
- If the message does not contain any food items (e.g. greeting, "hi", "thanks"), return {"meal_time": "snack", "foods": []}.
- Never invent food items that the user did not mention.`

function extractJson(text: string): string {
  const trimmed = text.trim()
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}') + 1
  if (start === -1 || end <= start) return trimmed
  return trimmed.slice(start, end)
}

export async function parseMeal(env: Env, userMessage: string): Promise<ParsedMeal> {
  const response = await env.AI.run(MODEL, {
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `User message: ${userMessage}\n\nReturn JSON only:` },
    ],
  })
  let content = ''
  if (response.choices?.length) {
    const choice = response.choices[0]
    content = (choice.message?.content ?? choice.text ?? '').trim()
  }
  if (!content) {
    return { meal_time: 'snack', foods: [] }
  }
  const raw = extractJson(content)
  try {
    const parsed = JSON.parse(raw) as { meal_time?: string; foods?: Array<{ name?: string; quantity?: number; unit?: string }> }
    const mealTime = (parsed.meal_time ?? 'snack').toLowerCase()
    const validMeal = ['breakfast', 'lunch', 'snack', 'dinner'].includes(mealTime)
      ? (mealTime as ParsedMeal['meal_time'])
      : 'snack'
    const mapped = (parsed.foods ?? []).map((f) => ({
      name: String(f.name ?? '').trim() || 'unknown',
      quantity: typeof f.quantity === 'number' && f.quantity > 0 ? f.quantity : 1,
      unit: String(f.unit ?? 'serving').trim() || 'serving',
    }))
    const foods = mapped.filter((f) => f.name !== 'unknown')
    return {
      meal_time: validMeal,
      foods: foods.length ? foods : [],
    }
  } catch {
    return { meal_time: 'snack', foods: [] }
  }
}
