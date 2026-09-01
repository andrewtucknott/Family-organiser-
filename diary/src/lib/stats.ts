import { addDays, daysBetween, todayISO } from './dates'
import { isLogged, type DayEntry } from './types'

export type WeekRow = {
  week: number
  start: string
  logged: number
  clean: number
  am: number
  pm: number
  sessions: number
  swims: number
}

export const SESSIONS_PER_WEEK = 14

export function weekRows(days: DayEntry[], startDate: string, programmeDays: number): WeekRow[] {
  const byDate = new Map(days.map((d) => [d.date, d]))
  const totalWeeks = Math.max(1, Math.ceil(programmeDays / 7))
  const today = todayISO()
  const rows: WeekRow[] = []

  for (let w = 0; w < totalWeeks; w++) {
    const start = addDays(startDate, w * 7)
    // Don't list weeks that have not begun.
    if (start > today) break
    const row: WeekRow = { week: w + 1, start, logged: 0, clean: 0, am: 0, pm: 0, sessions: 0, swims: 0 }
    for (let i = 0; i < 7; i++) {
      const day = byDate.get(addDays(start, i))
      if (!isLogged(day) || !day) continue
      row.logged++
      if (day.slips.length === 0) row.clean++
      if (day.amDone) row.am++
      if (day.pmDone) row.pm++
      if (day.swim) row.swims++
    }
    row.sessions = row.am + row.pm
    rows.push(row)
  }
  return rows
}

/** Consecutive logged days ending today (or yesterday, if today is not done yet). */
export function currentStreak(days: DayEntry[]): number {
  const logged = new Set(days.filter(isLogged).map((d) => d.date))
  const today = todayISO()
  let cursor = logged.has(today) ? today : addDays(today, -1)
  if (!logged.has(cursor)) return 0
  let n = 0
  while (logged.has(cursor)) {
    n++
    cursor = addDays(cursor, -1)
  }
  return n
}

export function longestStreak(days: DayEntry[]): number {
  const dates = days.filter(isLogged).map((d) => d.date).sort()
  let best = 0
  let run = 0
  let previous: string | null = null
  for (const date of dates) {
    run = previous && daysBetween(previous, date) === 1 ? run + 1 : 1
    previous = date
    if (run > best) best = run
  }
  return best
}
