/** Cloudflare Worker bindings for CalBot */
export interface Env {
  /** Telegram */
  TELEGRAM_BOT_TOKEN: string
  /** Base URL for webhook (e.g. https://calbot.xxx.workers.dev). Set for production; used by POST /admin/telegram-set-webhook. */
  TELEGRAM_WEBHOOK_BASE_URL?: string
  /** If set (e.g. "true"), bot only echoes the message back; no meal logging. For local testing. */
  TELEGRAM_ECHO_ONLY?: string

  /** Reference foods (R1) – Cloudflare D1. Run: wrangler d1 create calbot-r1, then apply migrations. */
  DB: D1Database

  /** Google Sheets – Nutrition tab + Tracker tabs. Set via wrangler secret put. */
  GOOGLE_SERVICE_ACCOUNT_EMAIL: string
  GOOGLE_PRIVATE_KEY: string
  NUTRITION_SHEET_ID: string
  TRACKER_SHEET_ID: string

  /** FatSecret Platform API (recommended for unknown foods) */
  FATSECRET_CLIENT_ID?: string
  FATSECRET_CLIENT_SECRET?: string

  /** Nutritionix (optional fallback) */
  NUTRITIONIX_APP_ID?: string
  NUTRITIONIX_API_KEY?: string

  /** Workers AI */
  AI: Ai

  /** Vectorize (Phase 2) */
  VECTORIZE?: VectorizeIndex

  /** Optional: require Authorization: Bearer <ADMIN_SECRET> for /admin/sync-vectorize */
  ADMIN_SECRET?: string
}

/** Minimal D1 binding type (reference foods table). */
export interface D1Database {
  prepare(sql: string): D1PreparedStatement
  batch(statements: D1PreparedStatement[]): Promise<D1BatchResult>
}
export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  all<T = unknown>(): Promise<{ results?: T[] }>
  run(): Promise<{ success: boolean }>
}
export interface D1BatchResult {
  results?: Array<{ results?: unknown[]; success?: boolean }>
}

export interface Ai {
  run(
    model: string,
    options: {
      messages?: Array<{ role: string; content: string }>
      prompt?: string
      audio?: ArrayBuffer
      /** Used by embedding models (e.g. @cf/qwen/qwen3-embedding-0.6b) */
      text?: string | string[]
    }
  ): Promise<{ response?: string; choices?: Array<{ message?: { content?: string }; text?: string }>; data?: number[][] }>
}

export interface VectorizeIndex {
  query(vector: number[], options: { topK: number; returnMetadata?: boolean }): Promise<{
    matches: Array<{ score: number; metadata?: Record<string, unknown> }>
  }>
  upsert(vectors: Array<{ id: string; values: number[]; metadata?: Record<string, unknown> }>): Promise<{ count: number }>
}
