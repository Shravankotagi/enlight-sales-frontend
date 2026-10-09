import { describe, expect, it } from 'vitest'
import {
  formatLocalDate,
  getDaysAgo,
  getFirstDayOfMonth,
  getFirstDayOfPreviousMonth,
  getFirstDayOfPreviousWeek,
  getFirstDayOfPreviousYear,
  getFirstDayOfQuarter,
  getFirstDayOfWeek,
  getFirstDayOfYear,
  getIsoEndOfDay,
  getIsoStartOfDay,
  getLastDayOfMonth,
  getLastDayOfPreviousMonth,
  getLastDayOfPreviousWeek,
  getLastDayOfPreviousYear,
  getLastDayOfQuarter,
  getLastDayOfWeek,
  getLastDayOfYear,
} from './dateUtils'

// Friday 9 October 2026, local time.
const FRIDAY = new Date(2026, 9, 9, 15, 30)
const SUNDAY = new Date(2026, 9, 11, 9, 0)
const NEW_YEAR = new Date(2026, 0, 1, 10, 0)

describe('dateUtils', () => {
  it('formats local dates as YYYY-MM-DD without UTC shifts', () => {
    expect(formatLocalDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })

  it('treats weeks as Monday to Sunday', () => {
    expect(getFirstDayOfWeek(FRIDAY)).toBe('2026-10-05')
    expect(getLastDayOfWeek(FRIDAY)).toBe('2026-10-11')
    expect(getFirstDayOfWeek(SUNDAY)).toBe('2026-10-05')
    expect(getLastDayOfWeek(SUNDAY)).toBe('2026-10-11')
  })

  it('computes the previous week, including across a year boundary', () => {
    expect(getFirstDayOfPreviousWeek(FRIDAY)).toBe('2026-09-28')
    expect(getLastDayOfPreviousWeek(FRIDAY)).toBe('2026-10-04')
    expect(getFirstDayOfPreviousWeek(NEW_YEAR)).toBe('2025-12-22')
    expect(getLastDayOfPreviousWeek(NEW_YEAR)).toBe('2025-12-28')
  })

  it('computes this month and the previous month, including across a year boundary', () => {
    expect(getFirstDayOfMonth(FRIDAY)).toBe('2026-10-01')
    expect(getLastDayOfMonth(FRIDAY)).toBe('2026-10-31')
    expect(getFirstDayOfPreviousMonth(FRIDAY)).toBe('2026-09-01')
    expect(getLastDayOfPreviousMonth(FRIDAY)).toBe('2026-09-30')
    expect(getFirstDayOfPreviousMonth(NEW_YEAR)).toBe('2025-12-01')
    expect(getLastDayOfPreviousMonth(NEW_YEAR)).toBe('2025-12-31')
  })

  it('handles February in leap and common years', () => {
    expect(getLastDayOfMonth(new Date(2028, 1, 10))).toBe('2028-02-29')
    expect(getLastDayOfPreviousMonth(new Date(2027, 2, 10))).toBe('2027-02-28')
  })

  it('computes quarters', () => {
    expect(getFirstDayOfQuarter(FRIDAY)).toBe('2026-10-01')
    expect(getLastDayOfQuarter(FRIDAY)).toBe('2026-12-31')
  })

  it('computes this year and the previous year', () => {
    expect(getFirstDayOfYear(FRIDAY)).toBe('2026-01-01')
    expect(getLastDayOfYear(FRIDAY)).toBe('2026-12-31')
    expect(getFirstDayOfPreviousYear(FRIDAY)).toBe('2025-01-01')
    expect(getLastDayOfPreviousYear(FRIDAY)).toBe('2025-12-31')
  })

  it('computes rolling day offsets', () => {
    expect(getDaysAgo(7, FRIDAY)).toBe('2026-10-02')
    expect(getDaysAgo(30, FRIDAY)).toBe('2026-09-09')
  })

  it('expands date-only strings to full-day ISO bounds', () => {
    expect(getIsoStartOfDay('2026-10-09')).toBe('2026-10-09T00:00:00.000Z')
    expect(getIsoEndOfDay('2026-10-09')).toBe('2026-10-09T23:59:59.999Z')
    expect(getIsoEndOfDay('2026-10-09T10:00:00Z')).toBe('2026-10-09T10:00:00Z')
    expect(getIsoStartOfDay('')).toBe('')
  })
})
