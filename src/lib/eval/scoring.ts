/**
 * Shared scoring for evals. Used by the worker admin/run-eval route (Workers AI) and by Node evals when comparing to expected.
 */

export function normalizeName(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ')
}

export interface FoodItemExpected {
  name: string
  quantity: number
  unit: string
}

export interface ParsedExpected {
  meal_time: string
  foods: FoodItemExpected[]
}

/** Loose equality: same meal_time, same number of foods, each food name matches (normalized), quantity and unit close. */
export function parsingMatch(
  actual: { meal_time: string; foods: Array<{ name: string; quantity: number; unit: string }> },
  expected: ParsedExpected
): number {
  if (actual.meal_time !== expected.meal_time) return 0
  if (actual.foods.length !== expected.foods.length) return 0
  let score = 1
  for (let i = 0; i < expected.foods.length; i++) {
    const a = actual.foods[i]
    const e = expected.foods[i]
    if (!a) return 0
    if (normalizeName(a.name) !== normalizeName(e.name)) score -= 0.4
    if (Math.abs((a.quantity || 1) - e.quantity) > 0.5) score -= 0.3
    if (a.unit !== e.unit && normalizeName(a.unit) !== normalizeName(e.unit)) score -= 0.2
  }
  return Math.max(0, score)
}
