import { describe, it, expect } from 'vitest'
import { classifyIntent } from './classify'
import type { Env } from '../../env.d'

const mockEnv = {
  AI: {
    run: async () => ({ choices: [{ message: { content: 'other' } }] }),
  },
} as unknown as Env

describe('classifyIntent', () => {
  it('returns greeting for "hi", not food_log', async () => {
    const result = await classifyIntent(mockEnv, 'hi')
    expect(result.intent).toBe('greeting')
    expect(result.intent).not.toBe('food_log')
  })

  it('returns food_log for "2 eggs for breakfast"', async () => {
    const result = await classifyIntent(mockEnv, '2 eggs for breakfast')
    expect(result.intent).toBe('food_log')
  })

  it('returns command for "/start"', async () => {
    const result = await classifyIntent(mockEnv, '/start')
    expect(result.intent).toBe('command')
  })

  it('returns command for "/help"', async () => {
    const result = await classifyIntent(mockEnv, '/help')
    expect(result.intent).toBe('command')
  })

  it('returns command for "/today"', async () => {
    const result = await classifyIntent(mockEnv, '/today')
    expect(result.intent).toBe('command')
  })

  it('returns greeting for "hello"', async () => {
    const result = await classifyIntent(mockEnv, 'hello')
    expect(result.intent).toBe('greeting')
  })

  it('returns greeting for "good morning"', async () => {
    const result = await classifyIntent(mockEnv, 'good morning')
    expect(result.intent).toBe('greeting')
  })

  it('returns food_log for "had sambar and rice for lunch"', async () => {
    const result = await classifyIntent(mockEnv, 'had sambar and rice for lunch')
    expect(result.intent).toBe('food_log')
  })

  it('returns other or greeting for "thanks" (non-food)', async () => {
    const result = await classifyIntent(mockEnv, 'thanks')
    expect(['other', 'greeting']).toContain(result.intent)
    expect(result.intent).not.toBe('food_log')
  })

  it('returns confidence between 0 and 1', async () => {
    const result = await classifyIntent(mockEnv, '2 chapatis for breakfast')
    expect(result.confidence).toBeGreaterThanOrEqual(0)
    expect(result.confidence).toBeLessThanOrEqual(1)
  })
})
