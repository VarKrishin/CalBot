/** Telegram API types (minimal for webhook) */
export interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
}

export interface TelegramMessage {
  message_id: number
  from?: { id: number; first_name?: string; username?: string }
  chat: { id: number; type: string }
  date: number
  text?: string
  voice?: { file_id: string; duration?: number }
}

/** Parsed meal from LLM */
export interface ParsedFood {
  name: string
  quantity: number
  unit: string
}

export interface ParsedMeal {
  meal_time: 'breakfast' | 'lunch' | 'snack' | 'dinner'
  foods: ParsedFood[]
}

/** R1 reference row (from Google Sheet) */
export interface R1Row {
  name: string
  unit: string
  quantity: number
  calories: number
  protein: number
  fat: number
  carbs: number
  vitamins?: string
  source: 'r1'
}

/** Resolved food with nutrition (for logging) */
export interface ResolvedFood {
  name: string
  quantity: number
  unit: string
  calories: number
  protein: number
  fat: number
  carbs: number
  estimated?: boolean
}

/** Daily Tracker row */
export interface TrackerRow {
  date: string
  mealTime: string
  foodItem: string
  quantity: string
  calories: number
  protein: number
  fat: number
  carbs: number
  water?: number
}
