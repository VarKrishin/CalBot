/**
 * Second safety net: reject obvious non-food names before resolving nutrition.
 * Used after intent classification when we still have parsed "food" items.
 */

const NON_FOOD_WORDS = new Set([
  'hi', 'hello', 'hey', 'thanks', 'thank you', 'ok', 'okay', 'yes', 'no', 'lol', 'cool', 'nice', 'k',
  'nope', 'yep', 'nah', 'asdf', 'asdfghjk', 'test', 'unknown', 'other', 'none', 'idk', 'idc', 'wtf', 'omg',
  'good morning', 'good evening', 'good afternoon', 'good night', 'bye', 'goodbye', 'see you',
])

const MIN_FOOD_NAME_LENGTH = 2

export function isPlausibleFood(name: string): boolean {
  const t = name.trim().toLowerCase()
  if (t.length < MIN_FOOD_NAME_LENGTH) return false
  if (NON_FOOD_WORDS.has(t)) return false
  if (/^\d+$/.test(t)) return false
  if (/^[a-z]{1,2}$/i.test(t)) return false
  return true
}
