import type { Env } from '../../env.d'
import type { R1Row, ResolvedFood } from '../../types'

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
    estimated: (m.source as string) !== 'r1',
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

/** Vectorize IDs are max 64 bytes. We hash (name, unit) to a fixed 32-char hex ID so long names never exceed the limit. */
async function vectorId(key: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))
  const hex = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return hex.slice(0, 32)
}

/** One vector per (name, unit). R1 wins over Nutrition sheet when both have the same food. */
export async function syncVectorize(env: Env, r1Rows: R1Row[], nutritionRows: R1Row[]): Promise<number> {
  if (!env.VECTORIZE) throw new Error('VECTORIZE binding not configured')
  const key = (r: R1Row & { source?: string }) =>
    `${String(r.name).trim()}-${String(r.unit).trim()}`.replace(/\s+/g, '_')
  const byKey = new Map<string, R1Row & { source: 'r1' | 'sheet' }>()
  for (const r of r1Rows) {
    byKey.set(key(r), { ...r, source: 'r1' })
  }
  for (const r of nutritionRows) {
    if (!byKey.has(key(r))) byKey.set(key(r), { ...r, source: 'sheet' } as unknown as R1Row & { source: 'r1' | 'sheet' })
  }
  const vectors: Array<{ id: string; values: number[]; metadata: Record<string, unknown> }> = []
  for (const row of byKey.values()) {
    const id = await vectorId(key(row))
    const values = await embed(env, row.name)
    vectors.push({ id, values, metadata: toMetadata(row) })
  }
  const result = await env.VECTORIZE.upsert(vectors)
  return result.count ?? vectors.length
}
