import { describe, it, expect } from 'vitest'
import { getReplyForNonFoodIntent, formatConfirmationMessage } from './replies'
import type { ResolvedFood } from '../../types'

describe('getReplyForNonFoodIntent', () => {
  it('returns greeting reply for greeting intent', () => {
    expect(getReplyForNonFoodIntent('greeting', 'hi')).toBe('Hey! Send me what you ate to log it.')
  })

  it('returns help text for /help command', () => {
    const reply = getReplyForNonFoodIntent('command', '/help')
    expect(reply).toContain('2 eggs for breakfast')
    expect(reply).toContain('/today')
  })

  it('returns today placeholder for /today command', () => {
    const reply = getReplyForNonFoodIntent('command', '/today')
    expect(reply).toContain("Today's summary")
  })

  it('returns generic command reply for other commands', () => {
    const reply = getReplyForNonFoodIntent('command', '/week')
    expect(reply).toContain('Send what you ate')
  })

  it('returns query reply for query intent', () => {
    expect(getReplyForNonFoodIntent('query', 'what did I eat?')).toBe('Use /today to see your meals.')
  })

  it('returns other reply for other intent', () => {
    expect(getReplyForNonFoodIntent('other', 'asdf')).toBe('I track nutrition. Try: 2 eggs for breakfast')
  })
})

describe('formatConfirmationMessage', () => {
  it('includes meal label, total kcal and protein', () => {
    const resolved: Array<{ food: ResolvedFood }> = [
      { food: { name: 'Egg', quantity: 2, unit: 'n', calories: 156, protein: 12, fat: 10, carbs: 2 } },
    ]
    const msg = formatConfirmationMessage('Breakfast', resolved)
    expect(msg).toContain('✅')
    expect(msg).toContain('Breakfast logged')
    expect(msg).toContain('156 kcal')
    expect(msg).toContain('12g protein')
    expect(msg).toContain('2 Egg: 156 kcal')
  })

  it('appends (estimated) for API-sourced foods', () => {
    const resolved: Array<{ food: ResolvedFood }> = [
      { food: { name: 'Dosa', quantity: 1, unit: 'serving', calories: 320, protein: 8, fat: 12, carbs: 45, estimated: true } },
    ]
    const msg = formatConfirmationMessage('Breakfast', resolved)
    expect(msg).toContain('(estimated)')
    expect(msg).toContain('320 kcal')
  })

  it('sums multiple items', () => {
    const resolved: Array<{ food: ResolvedFood }> = [
      { food: { name: 'Chapati', quantity: 2, unit: 'n', calories: 240, protein: 6, fat: 4, carbs: 48 } },
      { food: { name: 'Sambar', quantity: 1, unit: 'cup', calories: 120, protein: 4, fat: 4, carbs: 25 } },
    ]
    const msg = formatConfirmationMessage('Breakfast', resolved)
    expect(msg).toContain('360 kcal')
    expect(msg).toContain('10g protein')
  })
})
