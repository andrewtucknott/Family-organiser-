// All dates are local calendar dates held as YYYY-MM-DD. No timezone maths,
// because a diary day is whatever day it is where you are standing.

export function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fromISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayISO(): string {
  return toISO(new Date())
}

export function addDays(iso: string, n: number): string {
  const d = fromISO(iso)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

export function daysBetween(a: string, b: string): number {
  const ms = fromISO(b).getTime() - fromISO(a).getTime()
  return Math.round(ms / 86400000)
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// 0 = Monday, matching the plan.
export function planDayIndex(iso: string): number {
  return (fromISO(iso).getDay() + 6) % 7
}

export function weekdayName(iso: string): string {
  return WEEKDAYS[fromISO(iso).getDay()]
}

export function monthLabel(iso: string): string {
  const d = fromISO(iso)
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7)
}

/** "Sat 7 Sep" — short enough for a header on a 390px screen. */
export function shortDate(iso: string): string {
  const d = fromISO(iso)
  return `${WEEKDAYS[d.getDay()].slice(0, 3)} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`
}

/** "Sat 7 September 2026" */
export function longDate(iso: string): string {
  const d = fromISO(iso)
  return `${WEEKDAYS[d.getDay()].slice(0, 3)} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

/** The Monday on or before the given date. */
export function startOfWeek(iso: string): string {
  return addDays(iso, -planDayIndex(iso))
}

export function isFuture(iso: string): boolean {
  return iso > todayISO()
}
