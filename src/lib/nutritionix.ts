import type { Env } from '../env.d'
import type { ResolvedFood } from '../types'

const NUTRITIONIX_URL = 'https://trackapi.nutritionix.com/v2/search/instant'

interface InstantItem {
  food_name: string
  serving_qty?: number
  serving_unit?: string
  nf_calories?: number
  nf_protein?: number
  nf_total_fat?: number
  nf_total_carbohydrate?: number
}

export async function getNutritionFromAPI(env: Env, foodName: string): Promise<ResolvedFood> {
  if (!env.NUTRITIONIX_APP_ID || !env.NUTRITIONIX_API_KEY) {
    return fallbackEstimate(foodName)
  }
  const url = `${NUTRITIONIX_URL}?query=${encodeURIComponent(foodName)}`
  const res = await fetch(url, {
    headers: {
      'x-app-id': env.NUTRITIONIX_APP_ID,
      'x-app-key': env.NUTRITIONIX_API_KEY,
      'Content-Type': 'application/json',
    },
  })
  if (!res.ok) return fallbackEstimate(foodName)
  const data = (await res.json()) as { common?: InstantItem[]; branded?: InstantItem[] }
  const item = data.common?.[0] ?? data.branded?.[0]
  if (!item) return fallbackEstimate(foodName)
  const qty = item.serving_qty ?? 1
  const cal = item.nf_calories ?? 0
  const prot = item.nf_protein ?? 0
  const fat = item.nf_total_fat ?? 0
  const carbs = item.nf_total_carbohydrate ?? 0
  return {
    name: item.food_name,
    quantity: qty,
    unit: (item.serving_unit as string) ?? 'serving',
    calories: Math.round(cal),
    protein: prot,
    fat: fat,
    carbs: carbs,
    estimated: true,
  }
}

function fallbackEstimate(foodName: string): ResolvedFood {
  return {
    name: foodName,
    quantity: 1,
    unit: 'serving',
    calories: 200,
    protein: 10,
    fat: 5,
    carbs: 25,
    estimated: true,
  }
}
