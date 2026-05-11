// Period & date library for Checkmate.
//
// All functions operate on local time. Period boundaries are calendar-aligned
// with weeks starting on Sunday and quarters as Q1=Jan–Mar, Q2=Apr–Jun, etc.

export type Frequency = 'daily' | 'weekly' | 'monthly' | 'quarterly'

export interface ItemSchedule {
  frequency: Frequency
  dayOfWeek: number | null // 0=Sun..6=Sat
  dayOfMonth: number | null // 1..31
  monthOfQuarter: number | null // 1..3
}

export function todayISO(): string {
  return formatISO(new Date())
}

export function formatISO(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function parseISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function isValidISO(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s)
}

export function weekdayOf(dateISO: string): number {
  return parseISO(dateISO).getDay()
}

// Last day of the month containing dateISO. JS Date(year, month, 0) returns the last day of month-1.
export function lastDayOfMonth(year: number, monthZero: number): number {
  return new Date(year, monthZero + 1, 0).getDate()
}

// Sunday of the week containing dateISO, returned as YYYY-MM-DD.
export function startOfWeekISO(dateISO: string): string {
  const d = parseISO(dateISO)
  d.setDate(d.getDate() - d.getDay())
  return formatISO(d)
}

// Quarter (1..4) of the month (1..12).
export function quarterOfMonth(month1to12: number): number {
  return Math.floor((month1to12 - 1) / 3) + 1
}

// First month (1..12) of a quarter (1..4).
export function firstMonthOfQuarter(quarter1to4: number): number {
  return (quarter1to4 - 1) * 3 + 1
}

export interface PeriodRange {
  startISO: string // inclusive
  endISO: string // inclusive
}

// Range of dates that constitute the "current period" for a given frequency relative to dateISO.
export function periodRange(frequency: Frequency, dateISO: string): PeriodRange {
  const d = parseISO(dateISO)
  const y = d.getFullYear()
  const m = d.getMonth() // 0..11
  switch (frequency) {
    case 'daily':
      return {startISO: dateISO, endISO: dateISO}
    case 'weekly': {
      const start = parseISO(startOfWeekISO(dateISO))
      const end = new Date(start)
      end.setDate(end.getDate() + 6)
      return {startISO: formatISO(start), endISO: formatISO(end)}
    }
    case 'monthly': {
      const start = new Date(y, m, 1)
      const end = new Date(y, m, lastDayOfMonth(y, m))
      return {startISO: formatISO(start), endISO: formatISO(end)}
    }
    case 'quarterly': {
      const q = quarterOfMonth(m + 1)
      const startMonth = firstMonthOfQuarter(q) - 1 // back to 0..11
      const endMonth = startMonth + 2
      const start = new Date(y, startMonth, 1)
      const end = new Date(y, endMonth, lastDayOfMonth(y, endMonth))
      return {startISO: formatISO(start), endISO: formatISO(end)}
    }
  }
}

// The specific date the item is "due" within the period containing dateISO,
// or null if the item floats (no specific day assigned). Applies the day-overflow
// clamp rule: assignments past the last day of a month clamp to the last day.
export function dueDateInPeriod(item: ItemSchedule, dateISO: string): string | null {
  const range = periodRange(item.frequency, dateISO)
  switch (item.frequency) {
    case 'daily':
      return range.startISO
    case 'weekly': {
      if (item.dayOfWeek == null) return null
      const start = parseISO(range.startISO)
      const due = new Date(start)
      due.setDate(due.getDate() + item.dayOfWeek)
      return formatISO(due)
    }
    case 'monthly': {
      if (item.dayOfMonth == null) return null
      const start = parseISO(range.startISO)
      const last = lastDayOfMonth(start.getFullYear(), start.getMonth())
      const day = Math.min(item.dayOfMonth, last)
      return formatISO(new Date(start.getFullYear(), start.getMonth(), day))
    }
    case 'quarterly': {
      if (item.monthOfQuarter == null || item.dayOfMonth == null) return null
      const start = parseISO(range.startISO)
      const targetMonthZero = start.getMonth() + (item.monthOfQuarter - 1)
      const last = lastDayOfMonth(start.getFullYear(), targetMonthZero)
      const day = Math.min(item.dayOfMonth, last)
      return formatISO(new Date(start.getFullYear(), targetMonthZero, day))
    }
  }
}

const WEEKDAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTH_FULL = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

// "Monday, May 11" — full weekday + month name + day, no year.
export function formatDayLabel(dateISO: string): string {
  const d = parseISO(dateISO)
  return `${WEEKDAY_FULL[d.getDay()]}, ${MONTH_FULL[d.getMonth()]} ${d.getDate()}`
}

// "May 11, 2026" — month name + day + year.
export function formatDateLabel(dateISO: string): string {
  const d = parseISO(dateISO)
  return `${MONTH_FULL[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

// True if any of the given completion dates fall inside the current period for this item.
export function isCompletedInPeriod(
  item: ItemSchedule,
  completionDatesISO: string[],
  dateISO: string,
): boolean {
  const {startISO, endISO} = periodRange(item.frequency, dateISO)
  return completionDatesISO.some((d) => d >= startISO && d <= endISO)
}
