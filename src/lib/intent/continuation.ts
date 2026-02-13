/**
 * Detect if the user message is a continuation of the previous meal (e.g. "also had oats").
 * Used for multi-entry same meal: append to last meal time instead of defaulting.
 */

const CONTINUATION_PREFIXES = ['also ', 'and also ', 'plus ']

export function isContinuationMessage(text: string): boolean {
  const t = text.trim().toLowerCase()
  return CONTINUATION_PREFIXES.some((p) => t.startsWith(p))
}
