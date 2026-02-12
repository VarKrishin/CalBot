import type { Env } from '../../env.d'
import type { ResolvedFood } from '../../types'

const TOKEN_URL = 'https://oauth.fatsecret.com/connect/token'
const SEARCH_URL = 'https://platform.fatsecret.com/rest/foods/search/v1'

async function getAccessToken(env: Env): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'basic',
      client_id: env.FATSECRET_CLIENT_ID,
      client_secret: env.FATSECRET_CLIENT_SECRET,
    }),
  })
  if (!res.ok) throw new Error(`FatSecret token error: ${res.status}`)
  const data = (await res.json()) as { access_token: string }
  return data.access_token
}

// Parse "Per 100g - Calories: 22kcal | Fat: 0.34g | Carbs: 3.28g | Protein: 3.09g" or "Per 1 serving - ..."
function parseFoodDescription(desc: string): { quantity: number; unit: string; calories: number; protein: number; fat: number; carbs: number } | null {
  const perMatch = desc.match(/Per\s+([\d./]+)\s*(\w+)\s*[-–]/i)
  const calMatch = desc.match(/Calories:\s*([\d.]+)\s*kcal/i)
  const fatMatch = desc.match(/Fat:\s*([\d.]+)\s*g/i)
  const carbMatch = desc.match(/Carbs:\s*([\d.]+)\s*g/i)
  const proteinMatch = desc.match(/Protein:\s*([\d.]+)\s*g/i)
  if (!calMatch) return null
  const quantity = perMatch ? parseFloat(perMatch[1].replace('/', '.')) || 1 : 1
  const unit = (perMatch?.[2] ?? 'serving').toLowerCase().replace(/s$/, '') // "grams" -> "gram"
  if (unit === 'serving' || unit === 'gram' || unit === 'g' || unit === 'ml' || unit === 'cup' || unit === 'oz') {
    // keep as-is
  }
  return {
    quantity,
    unit: unit === 'gram' ? 'g' : unit,
    calories: parseFloat(calMatch[1]) || 0,
    protein: proteinMatch ? parseFloat(proteinMatch[1]) : 0,
    fat: fatMatch ? parseFloat(fatMatch[1]) : 0,
    carbs: carbMatch ? parseFloat(carbMatch[1]) : 0,
  }
}

interface FatSecretFood {
  food_id?: string
  food_name?: string
  food_type?: string
  food_description?: string
}

export async function getNutritionFromFatSecret(env: Env, foodName: string): Promise<ResolvedFood> {
  if (!env.FATSECRET_CLIENT_ID || !env.FATSECRET_CLIENT_SECRET) {
    return fallbackEstimate(foodName)
  }
  try {
    const token = await getAccessToken(env)
    const url = `${SEARCH_URL}?search_expression=${encodeURIComponent(foodName)}&format=json&max_results=1`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return fallbackEstimate(foodName)
    const data = (await res.json()) as { foods?: { food?: FatSecretFood | FatSecretFood[] } }
    const foodObj = data.foods?.food
    const food: FatSecretFood | undefined = Array.isArray(foodObj) ? foodObj[0] : foodObj
    if (!food?.food_name || !food.food_description) return fallbackEstimate(foodName)
    const parsed = parseFoodDescription(food.food_description)
    if (!parsed) return fallbackEstimate(foodName)
    return {
      name: food.food_name,
      quantity: parsed.quantity,
      unit: parsed.unit,
      calories: Math.round(parsed.calories),
      protein: parsed.protein,
      fat: parsed.fat,
      carbs: parsed.carbs,
      estimated: true,
    }
  } catch {
    return fallbackEstimate(foodName)
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
