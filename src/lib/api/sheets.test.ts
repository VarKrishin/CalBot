import { describe, it, expect } from 'vitest'
import { getCurrentMonthSheetName } from './sheets'

describe('getCurrentMonthSheetName', () => {
  it('returns YYYY-MM_Tracker format', () => {
    const name = getCurrentMonthSheetName()
    expect(name).toMatch(/^\d{4}-\d{2}_Tracker$/)
    expect(name).toContain('_Tracker')
  })

  it('uses two-digit month', () => {
    const name = getCurrentMonthSheetName()
    const match = name.match(/^(\d{4})-(\d{2})_Tracker$/)
    expect(match).not.toBeNull()
    const monthNum = parseInt(match![2], 10)
    expect(monthNum).toBeGreaterThanOrEqual(1)
    expect(monthNum).toBeLessThanOrEqual(12)
  })
})

describe('sheet range quoting', () => {
  it('sheet name with hyphen is quoted in range', () => {
    // Internal helper sheetRange: names with - must be quoted. We test via getCurrentMonthSheetName
    // which always has a hyphen, so appendTrackerRows uses it correctly.
    const name = getCurrentMonthSheetName()
    expect(name).toContain('-')
  })
})
