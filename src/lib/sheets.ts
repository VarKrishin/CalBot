import * as jose from 'jose'
import type { Env } from '../env.d'
import type { R1Row, TrackerRow } from '../types'

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'

async function getAccessToken(env: Env): Promise<string> {
  const keyPem = env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
  const key = await jose.importPKCS8(keyPem, 'RS256')
  const jwt = await new jose.SignJWT({ scope: SCOPE })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(env.GOOGLE_SERVICE_ACCOUNT_EMAIL)
    .setAudience(TOKEN_URL)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(key)
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  if (!res.ok) throw new Error(`Google token error: ${res.status} ${await res.text()}`)
  const data = (await res.json()) as { access_token: string }
  return data.access_token
}

async function sheetsFetch(env: Env, method: string, url: string, body?: unknown): Promise<Response> {
  const token = await getAccessToken(env)
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return res
}

export function getCurrentMonthSheetName(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}_Tracker`
}

export async function ensureTrackerSheetExists(env: Env): Promise<string> {
  const sheetName = getCurrentMonthSheetName()
  const metaUrl = `${SHEETS_BASE}/${env.TRACKER_SHEET_ID}?fields=sheets(properties(title))`
  const metaRes = await sheetsFetch(env, 'GET', metaUrl)
  if (!metaRes.ok) throw new Error(`Sheets meta failed: ${metaRes.status}`)
  const meta = (await metaRes.json()) as { sheets?: Array<{ properties?: { title?: string } }> }
  const exists = meta.sheets?.some((s) => s.properties?.title === sheetName)
  if (exists) return sheetName

  const batchUrl = `${SHEETS_BASE}/${env.TRACKER_SHEET_ID}:batchUpdate`
  await sheetsFetch(env, 'POST', batchUrl, {
    requests: [
      {
        addSheet: {
          properties: { title: sheetName, gridProperties: { frozenRowCount: 1 } },
        },
      },
    ],
  })

  const appendUrl = `${SHEETS_BASE}/${env.TRACKER_SHEET_ID}/values/${encodeURIComponent(sheetName + '!A1:I1')}:append?valueInputOption=USER_ENTERED`
  await sheetsFetch(env, 'POST', appendUrl, {
    values: [
      [
        'Date',
        'Meal Time',
        'Food Item',
        'Quantity',
        'Calories (kcal)',
        'Protein (g)',
        'Fat (g)',
        'Carbs (g)',
        'Water (glasses)',
      ],
    ],
  })
  return sheetName
}

export async function appendTrackerRows(env: Env, rows: TrackerRow[]): Promise<void> {
  const sheetName = await ensureTrackerSheetExists(env)
  const values = rows.map((r) => [
    r.date,
    r.mealTime,
    r.foodItem,
    r.quantity,
    r.calories,
    r.protein,
    r.fat,
    r.carbs,
    r.water ?? '',
  ])
  const url = `${SHEETS_BASE}/${env.TRACKER_SHEET_ID}/values/${encodeURIComponent(sheetName + '!A:I')}:append?valueInputOption=USER_ENTERED`
  const res = await sheetsFetch(env, 'POST', url, { values })
  if (!res.ok) throw new Error(`Sheets append failed: ${res.status} ${await res.text()}`)
}

/** Fetch Nutrition sheet (API-learned foods). Same column layout as R1 A:H. */
export async function fetchNutrition(env: Env): Promise<R1Row[]> {
  const url = `${SHEETS_BASE}/${env.NUTRITION_SHEET_ID}/values/Nutrition!A2:I`
  const res = await sheetsFetch(env, 'GET', url)
  if (!res.ok) {
    if (res.status === 404) return []
    throw new Error(`Sheets Nutrition read failed: ${res.status} ${await res.text()}`)
  }
  const data = (await res.json()) as { values?: unknown[][] }
  const rows = data.values ?? []
  return rows.map((row) => {
    const qty = parseFloat(String(row[2] ?? 1))
    const cal = parseInt(String(row[3] ?? 0), 10)
    const prot = parseFloat(String(row[4] ?? 0))
    const fat = parseFloat(String(row[5] ?? 0))
    const carb = parseFloat(String(row[6] ?? 0))
    return {
      name: String(row[0] ?? '').trim(),
      unit: String(row[1] ?? 'serving').trim(),
      quantity: Number.isNaN(qty) ? 1 : qty,
      calories: Number.isNaN(cal) ? 0 : cal,
      protein: Number.isNaN(prot) ? 0 : prot,
      fat: Number.isNaN(fat) ? 0 : fat,
      carbs: Number.isNaN(carb) ? 0 : carb,
      source: 'r1' as const,
    }
  }).filter((r) => r.name !== '')
}

/** Append one row to Nutrition sheet. Columns: Food Item, Unit, Quantity, Calories, Protein, Fat, Carbs, Source, Timestamp. */
export async function appendNutritionRow(
  env: Env,
  row: { name: string; unit: string; quantity: number; calories: number; protein: number; fat: number; carbs: number; source: string }
): Promise<void> {
  const url = `${SHEETS_BASE}/${env.NUTRITION_SHEET_ID}/values/Nutrition!A:I:append?valueInputOption=USER_ENTERED`
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19)
  const values = [[row.name, row.unit, row.quantity, row.calories, row.protein, row.fat, row.carbs, row.source, timestamp]]
  const res = await sheetsFetch(env, 'POST', url, { values })
  if (!res.ok) throw new Error(`Sheets Nutrition append failed: ${res.status} ${await res.text()}`)
}

/** Raw Nutrition sheet rows for sync (A:I = name, unit, quantity, calories, protein, fat, carbs, source, timestamp). */
export async function fetchNutritionRaw(env: Env): Promise<Array<{ name: string; unit: string; quantity: number; calories: number; protein: number; fat: number; carbs: number; source: string; timestamp: string }>> {
  const url = `${SHEETS_BASE}/${env.NUTRITION_SHEET_ID}/values/Nutrition!A2:I`
  const res = await sheetsFetch(env, 'GET', url)
  if (!res.ok) {
    if (res.status === 404) return []
    throw new Error(`Sheets Nutrition read failed: ${res.status} ${await res.text()}`)
  }
  const data = (await res.json()) as { values?: unknown[][] }
  const rows = data.values ?? []
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  return rows.map((row) => {
    const qty = parseFloat(String(row[2] ?? 1))
    const cal = parseInt(String(row[3] ?? 0), 10)
    const prot = parseFloat(String(row[4] ?? 0))
    const fat = parseFloat(String(row[5] ?? 0))
    const carb = parseFloat(String(row[6] ?? 0))
    return {
      name: String(row[0] ?? '').trim(),
      unit: String(row[1] ?? 'serving').trim(),
      quantity: Number.isNaN(qty) ? 1 : qty,
      calories: Number.isNaN(cal) ? 0 : cal,
      protein: Number.isNaN(prot) ? 0 : prot,
      fat: Number.isNaN(fat) ? 0 : fat,
      carbs: Number.isNaN(carb) ? 0 : carb,
      source: String(row[7] ?? '').trim() || 'sheet',
      timestamp: row[8] != null ? String(row[8]) : now,
    }
  }).filter((r) => r.name !== '')
}

/** Fetch current month Tracker sheet as TrackerRow[] (for sync). Skips header row. */
export async function fetchTrackerSheet(env: Env, sheetName: string): Promise<TrackerRow[]> {
  const url = `${SHEETS_BASE}/${env.TRACKER_SHEET_ID}/values/${encodeURIComponent(sheetName + '!A2:I')}`
  const res = await sheetsFetch(env, 'GET', url)
  if (!res.ok) {
    if (res.status === 404) return []
    throw new Error(`Sheets Tracker read failed: ${res.status} ${await res.text()}`)
  }
  const data = (await res.json()) as { values?: unknown[][] }
  const rows = data.values ?? []
  return rows.map((row) => ({
    date: String(row[0] ?? '').trim(),
    mealTime: String(row[1] ?? '').trim(),
    foodItem: String(row[2] ?? '').trim(),
    quantity: String(row[3] ?? ''),
    calories: parseInt(String(row[4] ?? 0), 10) || 0,
    protein: parseFloat(String(row[5] ?? 0)) || 0,
    fat: parseFloat(String(row[6] ?? 0)) || 0,
    carbs: parseFloat(String(row[7] ?? 0)) || 0,
    water: row[8] !== undefined && row[8] !== '' ? parseInt(String(row[8]), 10) : undefined,
  })).filter((r) => r.date !== '' && r.foodItem !== '')
}
