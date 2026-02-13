import type { ParsedMeal, ParsedFood } from '../../types'

const VALID_MEAL_TIMES = ['breakfast', 'lunch', 'snack', 'dinner'] as const

/**
 * Validates and sanitizes LLM parser output. Filters out invalid food names, normalizes quantities and meal_time.
 */
export function validateParsedMeal(parsed: ParsedMeal): ParsedMeal {
  const mealTime = parsed.meal_time?.toLowerCase()
  const validMeal = VALID_MEAL_TIMES.includes(mealTime as (typeof VALID_MEAL_TIMES)[number])
    ? (mealTime as ParsedMeal['meal_time'])
    : 'snack'

  const foods: ParsedFood[] = (parsed.foods ?? []).map((f) => {
    const name = String(f?.name ?? '').trim()
    let quantity = typeof f?.quantity === 'number' && f.quantity > 0 ? f.quantity : 1
    const unit = String(f?.unit ?? 'serving').trim() || 'serving'
    return { name: name || 'unknown', quantity, unit }
  })

  const filtered = foods.filter((f) => f.name !== 'unknown' && f.name.length > 0)

  return {
    meal_time: validMeal,
    foods: filtered,
  }
}
