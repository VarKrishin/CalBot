import { Hono } from 'hono'
import type { Env } from '../../env.d'
import { webhookHandler } from './routes'

export const telegramRouter = new Hono<{ Bindings: Env }>()
  .get('/webhook', (c) => c.text('CalBot webhook OK — POST here from Telegram'))
  .post('/webhook', webhookHandler)
