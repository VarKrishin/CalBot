import type { Env } from '../../env.d'
import type { R1Row } from '../../types'

/** Fetch all reference foods from Cloudflare D1 (R1 storage). */
export async function fetchR1(env: Env): Promise<R1Row[]> {
  if (!env.DB) throw new Error('D1 DB binding not configured')
  const stmt = env.DB.prepare(
    'SELECT name, unit, quantity, calories, protein, fat, carbs, vitamins FROM r1_foods ORDER BY name'
  )
  const result = await stmt.all<{
    name: string
    unit: string
    quantity: number
    calories: number
    protein: number
    fat: number
    carbs: number
    vitamins: string | null
  }>()
  const rows = result.results ?? []
  return rows.map((row) => ({
    name: String(row.name ?? '').trim(),
    unit: String(row.unit ?? 'n').trim(),
    quantity: Number(row.quantity) || 1,
    calories: Number(row.calories) || 0,
    protein: Number(row.protein) || 0,
    fat: Number(row.fat) || 0,
    carbs: Number(row.carbs) || 0,
    vitamins: row.vitamins != null ? String(row.vitamins) : undefined,
    source: 'r1' as const,
  })).filter((r) => r.name !== '')
}

/** Insert reference food rows into D1 (for seeding / admin). */
export async function insertR1Rows(
  env: Env,
  rows: Array<{ name: string; unit: string; quantity: number; calories: number; protein: number; fat: number; carbs: number; vitamins?: string }>
): Promise<{ inserted: number }> {
  if (!env.DB) throw new Error('D1 DB binding not configured')
  if (rows.length === 0) return { inserted: 0 }
  const statements = rows.map((r) =>
    env.DB!.prepare(
      'INSERT INTO r1_foods (name, unit, quantity, calories, protein, fat, carbs, vitamins) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      r.name.trim(),
      (r.unit || 'n').trim(),
      r.quantity ?? 1,
      r.calories ?? 0,
      r.protein ?? 0,
      r.fat ?? 0,
      r.carbs ?? 0,
      r.vitamins ?? null
    )
  )
  await env.DB.batch(statements)
  return { inserted: rows.length }
}
