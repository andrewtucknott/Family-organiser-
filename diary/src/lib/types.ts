export type DayEntry = {
  date: string // ISO, YYYY-MM-DD — the primary key
  breakfast: string
  lunch: string
  dinner: string
  snacks: string
  drinks: string
  water: number // glasses, 0-15
  slips: string[] // items from the avoid list
  amDone: boolean // the morning session
  pmDone: boolean // the evening session
  swim: boolean // ad-hoc lunchtime swim
  feel: string
  notes: string
  photoId: string | null // key into the photos store
}

export type Settings = {
  startDate: string
  programmeDays: number
  amTime: string // HH:MM
  pmTime: string // HH:MM
  avoid: string[]
  remindersEnabled: boolean
}

export const MAX_WATER = 15

export const DEFAULT_SETTINGS: Settings = {
  startDate: '2026-09-07',
  programmeDays: 84,
  amTime: '06:00',
  pmTime: '19:20',
  avoid: ['Wheat', 'Dairy', 'Sugar', 'Caffeine', 'Alcohol'],
  remindersEnabled: false,
}

export function emptyDay(date: string): DayEntry {
  return {
    date,
    breakfast: '',
    lunch: '',
    dinner: '',
    snacks: '',
    drinks: '',
    water: 0,
    slips: [],
    amDone: false,
    pmDone: false,
    swim: false,
    feel: '',
    notes: '',
    photoId: null,
  }
}

// A day counts as logged once there is something in it worth keeping.
export function isLogged(d: DayEntry | undefined): boolean {
  if (!d) return false
  return Boolean(
    d.breakfast.trim() ||
      d.lunch.trim() ||
      d.dinner.trim() ||
      d.snacks.trim() ||
      d.drinks.trim() ||
      d.notes.trim() ||
      d.feel.trim() ||
      d.water > 0 ||
      d.slips.length > 0 ||
      d.amDone ||
      d.pmDone ||
      d.swim ||
      d.photoId,
  )
}

export function foodSummary(d: DayEntry): string {
  return [d.breakfast, d.lunch, d.dinner, d.snacks]
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' · ')
}
