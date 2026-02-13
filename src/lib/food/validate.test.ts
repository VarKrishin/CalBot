import { describe, it, expect } from 'vitest'
import { isPlausibleFood } from './validate'

describe('isPlausibleFood', () => {
  it('returns false for "hi"', () => {
    expect(isPlausibleFood('hi')).toBe(false)
  })

  it('returns true for "egg"', () => {
    expect(isPlausibleFood('egg')).toBe(true)
  })

  it('returns false for "asdfghjk"', () => {
    expect(isPlausibleFood('asdfghjk')).toBe(false)
  })

  it('returns true for "protein shake"', () => {
    expect(isPlausibleFood('protein shake')).toBe(true)
  })

  it('returns false for "hello"', () => {
    expect(isPlausibleFood('hello')).toBe(false)
  })

  it('returns false for "thanks"', () => {
    expect(isPlausibleFood('thanks')).toBe(false)
  })

  it('returns true for "sambar"', () => {
    expect(isPlausibleFood('sambar')).toBe(true)
  })

  it('returns false for single character', () => {
    expect(isPlausibleFood('x')).toBe(false)
  })
})
