import { describe, it, expect, vi } from 'vitest'
import { parseMeal } from './inputParser'
import type { Env } from '../../env.d'

describe('parseMeal', () => {
  const mockEnv = {
    AI: {
      run: vi.fn(),
    },
  } as unknown as Env

  it('returns valid meal_time', async () => {
    vi.mocked(mockEnv.AI.run).mockResolvedValueOnce({
      choices: [
        {
          message: { content: '{"meal_time": "breakfast", "foods": [{"name": "egg", "quantity": 2, "unit": "n"}]}' },
        },
      ],
    })
    const result = await parseMeal(mockEnv, '2 eggs for breakfast')
    expect(['breakfast', 'lunch', 'snack', 'dinner']).toContain(result.meal_time)
  })

  it('returns foods array', async () => {
    vi.mocked(mockEnv.AI.run).mockResolvedValueOnce({
      choices: [
        {
          message: { content: '{"meal_time": "breakfast", "foods": [{"name": "egg", "quantity": 2, "unit": "n"}]}' },
        },
      ],
    })
    const result = await parseMeal(mockEnv, '2 eggs for breakfast')
    expect(Array.isArray(result.foods)).toBe(true)
    expect(result.foods.length).toBeGreaterThanOrEqual(0)
  })

  it('food names are non-empty strings', async () => {
    vi.mocked(mockEnv.AI.run).mockResolvedValueOnce({
      choices: [
        {
          message: {
            content:
              '{"meal_time": "lunch", "foods": [{"name": "chapati", "quantity": 2, "unit": "n"}, {"name": "sambar", "quantity": 1, "unit": "cup"}]}',
          },
        },
      ],
    })
    const result = await parseMeal(mockEnv, '2 chapatis, 1 cup sambar')
    for (const f of result.foods) {
      expect(typeof f.name).toBe('string')
      expect(f.name.length).toBeGreaterThan(0)
      expect(f.name).not.toBe('unknown')
    }
  })

  it('quantities are positive numbers', async () => {
    vi.mocked(mockEnv.AI.run).mockResolvedValueOnce({
      choices: [
        {
          message: { content: '{"meal_time": "snack", "foods": [{"name": "egg", "quantity": 2, "unit": "n"}]}' },
        },
      ],
    })
    const result = await parseMeal(mockEnv, '2 eggs')
    for (const f of result.foods) {
      expect(typeof f.quantity).toBe('number')
      expect(f.quantity).toBeGreaterThan(0)
    }
  })

  it('returns empty foods on empty or invalid response', async () => {
    vi.mocked(mockEnv.AI.run).mockResolvedValueOnce({ choices: [] })
    const result = await parseMeal(mockEnv, 'hi')
    expect(result.foods).toEqual([])
  })

  it('returns empty foods when LLM returns no food items', async () => {
    vi.mocked(mockEnv.AI.run).mockResolvedValueOnce({
      choices: [{ message: { content: '{"meal_time": "snack", "foods": []}' } }],
    })
    const result = await parseMeal(mockEnv, 'thanks')
    expect(result.foods).toEqual([])
  })
})
