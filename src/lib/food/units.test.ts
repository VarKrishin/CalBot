import { describe, it, expect } from 'vitest'
import { quantityMultiplier } from './units'

describe('quantityMultiplier', () => {
  it('same unit uses quantity ratio', () => {
    expect(quantityMultiplier(2, 'n', 1, 'n')).toBe(2)
    expect(quantityMultiplier(1, 'cup', 1, 'cup')).toBe(1)
  })

  it('converts bowl to cups', () => {
    const mult = quantityMultiplier(1, 'bowl', 1, 'cup')
    expect(mult).toBe(1.5)
  })

  it('converts plate to cups', () => {
    const mult = quantityMultiplier(1, 'plate', 1, 'cup')
    expect(mult).toBe(2)
  })

  it('countable falls back to quantity ratio', () => {
    expect(quantityMultiplier(3, 'n', 1, 'n')).toBe(3)
  })
})
