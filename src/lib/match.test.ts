import { describe, it, expect } from 'vitest'
import { resolveFood } from './match'
import type { ParsedFood, R1Row } from '../types'

const r1Rows: R1Row[] = [
  { name: 'Egg', unit: 'n', quantity: 1, calories: 78, protein: 6, fat: 5, carbs: 1, source: 'r1' },
  { name: 'Chapati', unit: 'n', quantity: 1, calories: 120, protein: 3, fat: 2, carbs: 24, source: 'r1' },
  { name: 'Sambar', unit: 'cup', quantity: 1, calories: 120, protein: 4, fat: 4, carbs: 25, source: 'r1' },
]

describe('resolveFood', () => {
  it('matches exact normalized name', () => {
    const r = resolveFood({ name: 'egg', quantity: 2, unit: 'n' }, r1Rows)
    expect(r).not.toBeNull()
    expect(r!.name).toBe('Egg')
    expect(r!.quantity).toBe(2)
    expect(r!.calories).toBe(156)
    expect(r!.protein).toBe(12)
  })

  it('scales by quantity ratio', () => {
    const r = resolveFood({ name: 'Sambar', quantity: 0.5, unit: 'cup' }, r1Rows)
    expect(r).not.toBeNull()
    expect(r!.calories).toBe(60)
    expect(r!.protein).toBe(2)
  })

  it('matches by contains when no exact match', () => {
    const r = resolveFood({ name: 'chapati', quantity: 2, unit: 'n' }, r1Rows)
    expect(r).not.toBeNull()
    expect(r!.name).toBe('Chapati')
    expect(r!.calories).toBe(240)
  })

  it('returns null for unknown food', () => {
    const r = resolveFood({ name: 'ghee podi dosa', quantity: 1, unit: 'serving' }, r1Rows)
    expect(r).toBeNull()
  })
})
