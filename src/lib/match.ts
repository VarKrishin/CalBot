import type { ParsedFood, R1Row, ResolvedFood } from '../types'

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ')
}

/** Phase 1: match by exact normalized name or "contains". Scale nutrition by user qty / base qty. */
export function resolveFood(parsed: ParsedFood, r1Rows: R1Row[]): ResolvedFood | null {
  const want = normalize(parsed.name)
  if (!want) return null

  let best: R1Row | null = null
  for (const row of r1Rows) {
    const n = normalize(row.name)
    if (n === want) {
      best = row
      break
    }
    if (!best && (n.includes(want) || want.includes(n))) best = row
  }
  if (!best) return null

  const baseQty = best.quantity > 0 ? best.quantity : 1
  const mult = parsed.quantity / baseQty
  return {
    name: best.name,
    quantity: parsed.quantity,
    unit: parsed.unit,
    calories: Math.round(best.calories * mult),
    protein: Math.round((best.protein * mult) * 10) / 10,
    fat: Math.round((best.fat * mult) * 10) / 10,
    carbs: Math.round((best.carbs * mult) * 10) / 10,
    estimated: false,
  }
}
