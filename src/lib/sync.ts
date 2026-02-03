import type { Env } from '../env.d'
import type { TrackerRow } from '../types'
import { fetchNutritionRaw, fetchTrackerSheet, getCurrentMonthSheetName } from './sheets'

/**
 * Sync Google Sheets → D1 (per design: Sheets and D1 stay in sync).
 * Pulls Nutrition sheet and current month Tracker sheet into D1.
 */
export async function syncSheetsToD1(env: Env): Promise<{ nutrition: number; tracker: number }> {
  if (!env.DB) throw new Error('D1 DB binding not configured')

  const [nutritionRows, sheetName] = await Promise.all([
    fetchNutritionRaw(env),
    Promise.resolve(getCurrentMonthSheetName()),
  ])
  const trackerRows = await fetchTrackerSheet(env, sheetName)

  const syncedAt = new Date().toISOString().replace('T', ' ').slice(0, 19)

  // Upsert Nutrition into D1 (name + unit = PK)
  for (const r of nutritionRows) {
    await env.DB.prepare(
      `INSERT INTO nutrition_sync (name, unit, quantity, calories, protein, fat, carbs, source, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(name, unit) DO UPDATE SET
         quantity = excluded.quantity,
         calories = excluded.calories,
         protein = excluded.protein,
         fat = excluded.fat,
         carbs = excluded.carbs,
         source = excluded.source,
         synced_at = excluded.synced_at`
    )
      .bind(r.name, r.unit, r.quantity, r.calories, r.protein, r.fat, r.carbs, r.source, r.timestamp || syncedAt)
      .run()
  }

  // Replace current month's tracker in D1 (delete then insert)
  const prefix = sheetName.replace('_Tracker', '') // e.g. 2026-02
  await env.DB.prepare(`DELETE FROM tracker_sync WHERE date LIKE ?`).bind(`${prefix}-%`).run()

  if (trackerRows.length > 0) {
    const stmts = trackerRows.map((r: TrackerRow) =>
      env.DB!.prepare(
        `INSERT INTO tracker_sync (date, meal_time, food_item, quantity, calories, protein, fat, carbs, water, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        r.date,
        r.mealTime,
        r.foodItem,
        r.quantity,
        r.calories,
        r.protein,
        r.fat,
        r.carbs,
        r.water != null ? String(r.water) : null,
        syncedAt
      )
    )
    await env.DB.batch(stmts)
  }

  return { nutrition: nutritionRows.length, tracker: trackerRows.length }
}
