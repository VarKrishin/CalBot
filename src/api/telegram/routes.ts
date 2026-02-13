import type { Context } from 'hono'
import type { Env } from '../../env.d'
import { handleTelegramUpdate } from './services'
import type { TelegramUpdate } from './schema'

/** POST /api/telegram/webhook — receives Telegram update payloads (set via setWebHook). */
export async function webhookHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  let update: TelegramUpdate
  try {
    update = await c.req.json<TelegramUpdate>()
  } catch {
    return c.json({ ok: false }, 400)
  }
  console.log('[telegram] webhook update_id=%s', update.update_id)
  await handleTelegramUpdate(c.env, update, c.executionCtx)
  return c.json({ ok: true })
}
