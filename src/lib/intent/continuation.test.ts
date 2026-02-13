import { describe, it, expect } from 'vitest'
import { isContinuationMessage } from './continuation'

describe('isContinuationMessage', () => {
  it('returns true for "also had oats for breakfast"', () => {
    expect(isContinuationMessage('also had oats for breakfast')).toBe(true)
  })

  it('returns true for "and also had milk"', () => {
    expect(isContinuationMessage('and also had milk')).toBe(true)
  })

  it('returns true for "plus 2 eggs"', () => {
    expect(isContinuationMessage('plus 2 eggs')).toBe(true)
  })

  it('returns false for "2 eggs for breakfast"', () => {
    expect(isContinuationMessage('2 eggs for breakfast')).toBe(false)
  })

  it('returns false for "had rice and dal"', () => {
    expect(isContinuationMessage('had rice and dal')).toBe(false)
  })
})
