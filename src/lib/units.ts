/** Cup-equivalent per 1 unit for scaling. Countable "n" has no cup equivalent. */
const UNIT_TO_CUPS: Record<string, number> = {
  cup: 1,
  cups: 1,
  serving: 1,
  bowl: 1.5,
  plate: 2,
  tbsp: 0.0625,
  tablespoon: 0.0625,
  teaspoon: 0.0208,
  tsp: 0.0208,
  g: 0, // weight - no direct conversion
  ml: 0,
  n: 0, // countable
}

/** Multiplier for user quantity to base quantity when units differ. Uses cup-equivalent when both units have one. */
export function quantityMultiplier(
  userQty: number,
  userUnit: string,
  baseQty: number,
  baseUnit: string
): number {
  const u = userUnit.toLowerCase().trim()
  const b = baseUnit.toLowerCase().trim()
  const userCups = UNIT_TO_CUPS[u]
  const baseCups = UNIT_TO_CUPS[b]
  if (userCups != null && userCups > 0 && baseCups != null && baseCups > 0) {
    const userCupEquiv = userQty * userCups
    const baseCupEquiv = baseQty * baseCups
    return baseCupEquiv ? userCupEquiv / baseCupEquiv : userQty / baseQty
  }
  return baseQty ? userQty / baseQty : userQty
}
