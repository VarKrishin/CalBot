import type { Env } from '../env.d'
import type { R1Row, ResolvedFood } from '../types'

const EMBEDDING_MODEL = '@cf/qwen/qwen3-embedding-0.6b'
const SIMILARITY_THRESHOLD = 0.85

export async function embed(env: Env, text: string): Promise<number[]> {
  const result = await env.AI.run(EMBEDDING_MODEL, { text })
  const data = result.data as number[][] | undefined
  if (!data?.length || !Array.isArray(data[0])) throw new Error('Invalid embedding response')
  return data[0]
}

/** Returns base nutrition (per 1 unit) from index, or null. Caller scales by user quantity. */
export async function searchFood(env: Env, foodName: string): Promise<Omit<ResolvedFood, 'quantity'> & { quantity: number } | null> {
  if (!env.VECTORIZE) return null
  const vector = await embed(env, foodName)
  const result = await env.VECTORIZE.query(vector, { topK: 3, returnMetadata: true })
  const match = result.matches?.[0]
  if (!match || match.score < SIMILARITY_THRESHOLD) return null
  const m = match.metadata as Record<string, unknown> | undefined
  if (!m) return null
  const baseQty = Number(m.quantity ?? 1) || 1
  const calories = Number(m.calories ?? 0)
  const protein = Number(m.protein ?? 0)
  const fat = Number(m.fat ?? 0)
  const carbs = Number(m.carbs ?? 0)
  return {
    name: m.name as string,
    quantity: baseQty,
    unit: (m.unit as string) ?? 'serving',
    calories,
    protein,
    fat,
    carbs,
    estimated: ((m.source as string) === 'nutritionix' || (m.source as string) === 'fatsecret'),
  }
}

/** Build metadata for upsert (numeric values for Vectorize). */
function toMetadata(row: R1Row & { source?: string }): Record<string, unknown> {
  return {
    name: row.name,
    calories: row.calories,
    protein: row.protein,
    fat: row.fat,
    carbs: row.carbs,
    unit: row.unit,
    quantity: row.quantity,
    source: row.source ?? 'r1',
  }
}

export async function syncVectorize(env: Env, r1Rows: R1Row[], nutritionRows: R1Row[]): Promise<number> {
  if (!env.VECTORIZE) throw new Error('VECTORIZE binding not configured')
  const all = [
    ...r1Rows.map((r) => ({ ...r, source: 'r1' as const })),
    ...nutritionRows.map((r) => ({ ...r, source: 'nutritionix' as const })),
  ]
  const vectors: Array<{ id: string; values: number[]; metadata: Record<string, unknown> }> = []
  for (const row of all) {
    const id = `${row.source}-${row.name}-${row.unit}`.replace(/\s+/g, '_')
    const values = await embed(env, row.name)
    vectors.push({ id, values, metadata: toMetadata(row) })
  }
  const result = await env.VECTORIZE.upsert(vectors)
  return result.count ?? vectors.length
}
