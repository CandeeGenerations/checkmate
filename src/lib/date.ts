// Period & date library for Checkmate.
// Mirrors server/lib/date.ts exactly — keep them in sync.

export type Frequency = 'daily' | 'weekly' | 'monthly' | 'quarterly'

export interface ItemSchedule {
  frequency: Frequency
  dayOfWeek: number | null
  dayOfMonth: number | null
  monthOfQuarter: number | null
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

export function shiftDays(dateISO: string, delta: number): string {
  const d = parseISO(dateISO)
  d.setDate(d.getDate() + delta)
  return formatISO(d)
}

export function weekdayOf(dateISO: string): number {
  return parseISO(dateISO).getDay()
}

export function lastDayOfMonth(year: number, monthZero: number): number {
  return new Date(year, monthZero + 1, 0).getDate()
}

export function startOfWeekISO(dateISO: string): string {
  const d = parseISO(dateISO)
  d.setDate(d.getDate() - d.getDay())
  return formatISO(d)
}

export function quarterOfMonth(month1to12: number): number {
  return Math.floor((month1to12 - 1) / 3) + 1
}

export function firstMonthOfQuarter(quarter1to4: number): number {
  return (quarter1to4 - 1) * 3 + 1
}

export interface PeriodRange {
  startISO: string
  endISO: string
}

export function periodRange(frequency: Frequency, dateISO: string): PeriodRange {
  const d = parseISO(dateISO)
  const y = d.getFullYear()
  const m = d.getMonth()
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
      const startMonth = firstMonthOfQuarter(q) - 1
      const endMonth = startMonth + 2
      const start = new Date(y, startMonth, 1)
      const end = new Date(y, endMonth, lastDayOfMonth(y, endMonth))
      return {startISO: formatISO(start), endISO: formatISO(end)}
    }
  }
}

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

export function isCompletedInPeriod(
  item: ItemSchedule,
  completionDatesISO: string[],
  dateISO: string,
): boolean {
  const {startISO, endISO} = periodRange(item.frequency, dateISO)
  return completionDatesISO.some((d) => d >= startISO && d <= endISO)
}

export function isToday(dateISO: string): boolean {
  return dateISO === todayISO()
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

// "May 11, 2026" — month name + day + year. For range bounds where the weekday is noise.
export function formatDateLabel(dateISO: string): string {
  const d = parseISO(dateISO)
  return `${MONTH_FULL[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

export function formatClock(d: Date): string {
  let hours = d.getHours()
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12
  if (hours === 0) hours = 12
  return `${hours}:${minutes} ${ampm}`
}

export const WEEKDAY_SHORT: ReadonlyArray<{value: number; label: string; full: string}> = [
  {value: 0, label: 'S', full: 'Sun'},
  {value: 1, label: 'M', full: 'Mon'},
  {value: 2, label: 'T', full: 'Tue'},
  {value: 3, label: 'W', full: 'Wed'},
  {value: 4, label: 'T', full: 'Thu'},
  {value: 5, label: 'F', full: 'Fri'},
  {value: 6, label: 'S', full: 'Sat'},
]
