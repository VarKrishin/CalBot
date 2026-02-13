import { describe, it, expect } from 'vitest'
import { validateParsedMeal } from './parsedMealValidator'
import type { ParsedMeal } from '../../types'

describe('validateParsedMeal', () => {
  it('accepts valid meal with foods', () => {
    const input: ParsedMeal = {
      meal_time: 'breakfast',
      foods: [{ name: 'egg', quantity: 2, unit: 'n' }],
    }
    const result = validateParsedMeal(input)
    expect(result.meal_time).toBe('breakfast')
    expect(result.foods).toHaveLength(1)
    expect(result.foods[0].name).toBe('egg')
  })

  it('strips invalid meal_time to snack', () => {
    const input = {
      meal_time: 'brunch',
      foods: [{ name: 'egg', quantity: 1, unit: 'n' }],
    } as unknown as ParsedMeal
    const result = validateParsedMeal(input)
    expect(result.meal_time).toBe('snack')
  })

  it('filters out foods with empty or unknown name', () => {
    const input: ParsedMeal = {
      meal_time: 'lunch',
      foods: [
        { name: 'rice', quantity: 1, unit: 'serving' },
        { name: '', quantity: 1, unit: 'serving' },
        { name: 'unknown', quantity: 1, unit: 'serving' },
      ],
    }
    const result = validateParsedMeal(input)
    expect(result.foods).toHaveLength(1)
    expect(result.foods[0].name).toBe('rice')
  })

  it('normalizes quantity to 1 when invalid', () => {
    const input: ParsedMeal = {
      meal_time: 'snack',
      foods: [{ name: 'egg', quantity: -1, unit: 'n' }],
    }
    const result = validateParsedMeal(input)
    expect(result.foods[0].quantity).toBe(1)
  })

  it('returns empty foods when all filtered out', () => {
    const input: ParsedMeal = {
      meal_time: 'breakfast',
      foods: [{ name: 'unknown', quantity: 1, unit: 'serving' }],
    }
    const result = validateParsedMeal(input)
    expect(result.foods).toEqual([])
  })
})
