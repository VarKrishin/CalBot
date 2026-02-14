import type { Env } from '../../env.d'
import type { ParsedMeal } from '../../types'

const MODEL = '@cf/qwen/qwen3-30b-a3b-fp8'

const SYSTEM_PROMPT = `You are a nutrition tracking assistant. Parse the user's message and extract meal details. Return valid JSON only, no markdown or extra text.

Output structure (use exactly these keys and types):
{
  "meal_time": "breakfast" | "lunch" | "snack" | "dinner",
  "foods": [
    {"name": "string", "quantity": number, "unit": "string"}
  ]
}

Meal time rules:
- Explicit: "for breakfast" → breakfast, "for lunch" → lunch, "for dinner" → dinner.
- Implicit: "had X" without a meal word → infer from time of day (morning→breakfast, afternoon→lunch, evening→dinner). If truly unclear, use "snack".
- Default when no clue: "snack".

Quantity rules (be exact):
- "a couple", "two", "2" → 2. "half" → 0.5. "one", "1" → 1. "1/4", "quarter" → 0.25. "1.5" → 1.5.
- Extract the number from the message: "100ml" → quantity 100 unit ml, "50g" → quantity 50 unit g, "2 tbsp" → quantity 2 unit tablespoon.
- Default quantity when not stated: 1.

Unit rules (use these exact strings when applicable):
- Countable items (eggs, chapatis, parottas, idli, banana): unit "n".
- Liquids/volumes: "cup" (cup, bowl→cup), "ml", "tablespoon", "teaspoon". Use "tablespoon" not "tbsp", "teaspoon" not "tsp".
- Weight: "g".
- Otherwise or generic: "serving".
- "1 cup sambar" → quantity 1, unit "cup". "half cup sambar" → quantity 0.5, unit "cup".

Food names:
- Use lowercase. Use singular form for countable items: "egg" not "eggs", "chapati" not "chapatis", "parotta" not "parottas", "idli" not "idlis".
- Keep multi-word names as the user said: "ghee podi dosa", "protein shake", "egg white", "steel cut oats", "peanut butter", "groundnut oil".
- Extract every food; ignore restaurant or place names (e.g. "from Saravana Bhavan" → omit).
- Preserve order of foods as in the message.
- If the message has no food (greeting, "hi", "thanks"), return {"meal_time": "snack", "foods": []}.
- Do not add or invent any food the user did not mention.

Examples (output only the JSON, like below). Learn the pattern; do not rely on memorizing these exact inputs.

Input: "3 eggs for breakfast"
{"meal_time": "breakfast", "foods": [{"name": "egg", "quantity": 3, "unit": "n"}]}

Input: "chapati, dal, 1 cup sambar for lunch"
{"meal_time": "lunch", "foods": [{"name": "chapati", "quantity": 1, "unit": "n"}, {"name": "dal", "quantity": 1, "unit": "serving"}, {"name": "sambar", "quantity": 1, "unit": "cup"}]}

Input: "ate rice and curry"
{"meal_time": "lunch", "foods": [{"name": "rice", "quantity": 1, "unit": "serving"}, {"name": "curry", "quantity": 1, "unit": "serving"}]}

Input: "quarter cup sambar"
{"meal_time": "snack", "foods": [{"name": "sambar", "quantity": 0.25, "unit": "cup"}]}

Input: "200ml buttermilk"
{"meal_time": "snack", "foods": [{"name": "buttermilk", "quantity": 200, "unit": "ml"}]}

Input: "masala dosa at MTR for breakfast"
{"meal_time": "breakfast", "foods": [{"name": "masala dosa", "quantity": 1, "unit": "serving"}]}

Input: "2 teaspoons honey"
{"meal_time": "snack", "foods": [{"name": "honey", "quantity": 2, "unit": "teaspoon"}]}

Input: "rolled oats half cup"
{"meal_time": "snack", "foods": [{"name": "rolled oats", "quantity": 0.5, "unit": "cup"}]}

Input: "1 egg white and 3 whole eggs"
{"meal_time": "snack", "foods": [{"name": "egg white", "quantity": 1, "unit": "n"}, {"name": "egg", "quantity": 3, "unit": "n"}]}

Input: "paneer 75g"
{"meal_time": "snack", "foods": [{"name": "paneer", "quantity": 75, "unit": "g"}]}`

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
