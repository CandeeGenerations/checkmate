import {describe, expect, test} from 'vitest'

import {type ItemSchedule, dueDateInPeriod, isCompletedInPeriod, periodRange, startOfWeekISO} from './date'

describe('startOfWeekISO (Sunday-week-start)', () => {
  test('Sunday returns itself', () => {
    expect(startOfWeekISO('2026-05-10')).toBe('2026-05-10')
  })
  test('Monday rolls back to Sunday', () => {
    expect(startOfWeekISO('2026-05-11')).toBe('2026-05-10')
  })
  test('Saturday rolls back to previous Sunday', () => {
    expect(startOfWeekISO('2026-05-16')).toBe('2026-05-10')
  })
  test('crosses month boundary', () => {
    // Jun 1 2026 = Mon, Sun = May 31
    expect(startOfWeekISO('2026-06-01')).toBe('2026-05-31')
  })
})

describe('periodRange', () => {
  const date = '2026-05-11' // Monday in May
  test('daily = single day', () => {
    expect(periodRange('daily', date)).toEqual({startISO: date, endISO: date})
  })
  test('weekly = Sunday..Saturday', () => {
    expect(periodRange('weekly', date)).toEqual({startISO: '2026-05-10', endISO: '2026-05-16'})
  })
  test('monthly = 1st..last', () => {
    expect(periodRange('monthly', date)).toEqual({startISO: '2026-05-01', endISO: '2026-05-31'})
  })
  test('quarterly = Apr 1..Jun 30 for May', () => {
    expect(periodRange('quarterly', date)).toEqual({startISO: '2026-04-01', endISO: '2026-06-30'})
  })
  test('quarterly Q1 spans Jan..Mar', () => {
    expect(periodRange('quarterly', '2026-02-15')).toEqual({startISO: '2026-01-01', endISO: '2026-03-31'})
  })
  test('quarterly Q4 spans Oct..Dec', () => {
    expect(periodRange('quarterly', '2026-11-30')).toEqual({startISO: '2026-10-01', endISO: '2026-12-31'})
  })
  test('monthly handles Feb (28 days)', () => {
    expect(periodRange('monthly', '2026-02-15')).toEqual({startISO: '2026-02-01', endISO: '2026-02-28'})
  })
  test('monthly handles leap-year Feb (29 days)', () => {
    expect(periodRange('monthly', '2028-02-15')).toEqual({startISO: '2028-02-01', endISO: '2028-02-29'})
  })
})

describe('dueDateInPeriod', () => {
  const today = '2026-05-11' // Monday, May (Q2)
  const sched = (overrides: Partial<ItemSchedule>): ItemSchedule => ({
    frequency: 'daily',
    dayOfWeek: null,
    dayOfMonth: null,
    monthOfQuarter: null,
    ...overrides,
  })

  test('daily always returns today', () => {
    expect(dueDateInPeriod(sched({frequency: 'daily'}), today)).toBe(today)
  })
  test('weekly with no day = floats (null)', () => {
    expect(dueDateInPeriod(sched({frequency: 'weekly'}), today)).toBeNull()
  })
  test('weekly Wednesday = May 13', () => {
    expect(dueDateInPeriod(sched({frequency: 'weekly', dayOfWeek: 3}), today)).toBe('2026-05-13')
  })
  test('weekly Sunday = start of week', () => {
    expect(dueDateInPeriod(sched({frequency: 'weekly', dayOfWeek: 0}), today)).toBe('2026-05-10')
  })
  test('monthly day 15 in May = May 15', () => {
    expect(dueDateInPeriod(sched({frequency: 'monthly', dayOfMonth: 15}), today)).toBe('2026-05-15')
  })
  test('monthly with no day = floats', () => {
    expect(dueDateInPeriod(sched({frequency: 'monthly'}), today)).toBeNull()
  })
  test('monthly day 31 clamps in February (non-leap)', () => {
    expect(dueDateInPeriod(sched({frequency: 'monthly', dayOfMonth: 31}), '2026-02-15')).toBe('2026-02-28')
  })
  test('monthly day 31 clamps to 30 in April', () => {
    expect(dueDateInPeriod(sched({frequency: 'monthly', dayOfMonth: 31}), '2026-04-15')).toBe('2026-04-30')
  })
  test('monthly day 29 in leap-year Feb returns 29', () => {
    expect(dueDateInPeriod(sched({frequency: 'monthly', dayOfMonth: 29}), '2028-02-15')).toBe('2028-02-29')
  })
  test('quarterly with both null = floats', () => {
    expect(dueDateInPeriod(sched({frequency: 'quarterly'}), today)).toBeNull()
  })
  test('quarterly month-1 day-15 in Q2 = Apr 15', () => {
    expect(dueDateInPeriod(sched({frequency: 'quarterly', monthOfQuarter: 1, dayOfMonth: 15}), today)).toBe(
      '2026-04-15',
    )
  })
  test('quarterly month-2 day-15 in Q2 = May 15', () => {
    expect(dueDateInPeriod(sched({frequency: 'quarterly', monthOfQuarter: 2, dayOfMonth: 15}), today)).toBe(
      '2026-05-15',
    )
  })
  test('quarterly month-3 day-30 in Q2 = Jun 30', () => {
    expect(dueDateInPeriod(sched({frequency: 'quarterly', monthOfQuarter: 3, dayOfMonth: 30}), today)).toBe(
      '2026-06-30',
    )
  })
  test('quarterly month-2 day-31 in Q1 (= Feb 31) clamps to Feb 28', () => {
    expect(dueDateInPeriod(sched({frequency: 'quarterly', monthOfQuarter: 2, dayOfMonth: 31}), '2026-02-15')).toBe(
      '2026-02-28',
    )
  })
  test('quarterly month-1 day-31 in Q2 (= Apr 31) clamps to Apr 30', () => {
    expect(dueDateInPeriod(sched({frequency: 'quarterly', monthOfQuarter: 1, dayOfMonth: 31}), today)).toBe(
      '2026-04-30',
    )
  })
})

describe('isCompletedInPeriod', () => {
  const today = '2026-05-11' // Mon
  const daily: ItemSchedule = {frequency: 'daily', dayOfWeek: null, dayOfMonth: null, monthOfQuarter: null}
  const weekly: ItemSchedule = {frequency: 'weekly', dayOfWeek: 3, dayOfMonth: null, monthOfQuarter: null}
  const monthly: ItemSchedule = {frequency: 'monthly', dayOfMonth: 15, dayOfWeek: null, monthOfQuarter: null}
  const quarterly: ItemSchedule = {frequency: 'quarterly', monthOfQuarter: 2, dayOfMonth: 15, dayOfWeek: null}

  test('daily: completion today counts', () => {
    expect(isCompletedInPeriod(daily, ['2026-05-11'], today)).toBe(true)
  })
  test('daily: yesterday does not count', () => {
    expect(isCompletedInPeriod(daily, ['2026-05-10'], today)).toBe(false)
  })
  test('weekly: completion anywhere in this week counts', () => {
    expect(isCompletedInPeriod(weekly, ['2026-05-12'], today)).toBe(true) // Tue, in week
    expect(isCompletedInPeriod(weekly, ['2026-05-16'], today)).toBe(true) // Sat, in week
    expect(isCompletedInPeriod(weekly, ['2026-05-09'], today)).toBe(false) // prev Sat
    expect(isCompletedInPeriod(weekly, ['2026-05-17'], today)).toBe(false) // next Sun
  })
  test('frequency change preserves completion: daily completion shows in weekly view', () => {
    // Item completed today as daily; switch frequency to weekly. The weekly period is May 10–16.
    // The completion date (2026-05-11) is inside, so weekly view should show it as completed.
    expect(isCompletedInPeriod(weekly, ['2026-05-11'], today)).toBe(true)
  })
  test('monthly: completion anywhere in May counts', () => {
    expect(isCompletedInPeriod(monthly, ['2026-05-01'], today)).toBe(true)
    expect(isCompletedInPeriod(monthly, ['2026-05-31'], today)).toBe(true)
    expect(isCompletedInPeriod(monthly, ['2026-04-30'], today)).toBe(false)
    expect(isCompletedInPeriod(monthly, ['2026-06-01'], today)).toBe(false)
  })
  test('quarterly: completion anywhere in Q2 counts', () => {
    expect(isCompletedInPeriod(quarterly, ['2026-04-01'], today)).toBe(true)
    expect(isCompletedInPeriod(quarterly, ['2026-06-30'], today)).toBe(true)
    expect(isCompletedInPeriod(quarterly, ['2026-03-31'], today)).toBe(false)
    expect(isCompletedInPeriod(quarterly, ['2026-07-01'], today)).toBe(false)
  })
})
