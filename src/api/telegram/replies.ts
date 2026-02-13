import type { Intent } from '../../lib/intent/classify'
import type { ResolvedFood } from '../../types'

/**
 * Returns the reply text for non-food intents. Used by handleTelegramUpdate; extracted for testing.
 */
export function getReplyForNonFoodIntent(intent: Intent, text: string): string {
  if (intent === 'greeting') return 'Hey! Send me what you ate to log it.'
  if (intent === 'command') {
    if (text === '/help') return "Send what you ate to log it, e.g. \"2 eggs for breakfast\". Use /today to see today's meals."
    if (text === '/today') return "Today's summary: use the tracker sheet, or I can add a /today command soon."
    return 'Send what you ate to log it, e.g. "2 eggs for breakfast".'
  }
  if (intent === 'query') return 'Use /today to see your meals.'
  return 'I track nutrition. Try: 2 eggs for breakfast'
}

/**
 * Format the confirmation message after logging. Per PRD: "✅ Breakfast logged: 520 kcal, 28g protein" + per-item lines.
 */
export function formatConfirmationMessage(mealLabel: string, resolved: Array<{ food: ResolvedFood }>): string {
  const totalCal = resolved.reduce((s, { food }) => s + food.calories, 0)
  const totalPro = resolved.reduce((s, { food }) => s + food.protein, 0)
  const lines = [`✅ ${mealLabel} logged: ${totalCal} kcal, ${totalPro}g protein`]
  for (const { food } of resolved) {
    const est = food.estimated ? ' (estimated)' : ''
    lines.push(`• ${food.quantity} ${food.name}: ${food.calories} kcal${est}`)
  }
  return lines.join('\n')
}
