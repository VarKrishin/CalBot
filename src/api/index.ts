import { Hono } from 'hono'
import type { Env } from '../env.d'
import { telegramRouter } from './telegram'

export const api = new Hono<{ Bindings: Env }>().basePath('/api').route('/telegram', telegramRouter)
