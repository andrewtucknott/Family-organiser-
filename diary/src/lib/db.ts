import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { DEFAULT_SETTINGS, type DayEntry, type Settings, emptyDay } from './types'

interface DiaryDB extends DBSchema {
  days: { key: string; value: DayEntry }
  photos: { key: string; value: { id: string; date: string; blob: Blob } }
  settings: { key: string; value: unknown }
}

let dbPromise: Promise<IDBPDatabase<DiaryDB>> | null = null

function db() {
  if (!dbPromise) {
    dbPromise = openDB<DiaryDB>('food-exercise-diary', 1, {
      upgrade(d) {
        d.createObjectStore('days', { keyPath: 'date' })
        d.createObjectStore('photos', { keyPath: 'id' })
        d.createObjectStore('settings')
      },
    })
  }
  return dbPromise
}

export async function getDay(date: string): Promise<DayEntry> {
  const found = await (await db()).get('days', date)
  // Merge over a fresh empty day so older records missing a field still load.
  return found ? { ...emptyDay(date), ...found, date } : emptyDay(date)
}

export async function putDay(day: DayEntry): Promise<void> {
  await (await db()).put('days', day)
}

export async function deleteDay(date: string): Promise<void> {
  await (await db()).delete('days', date)
}

export async function allDays(): Promise<DayEntry[]> {
  const rows = await (await db()).getAll('days')
  return rows.sort((a, b) => a.date.localeCompare(b.date))
}

export async function getSettings(): Promise<Settings> {
  const stored = (await (await db()).get('settings', 'settings')) as Partial<Settings> | undefined
  return { ...DEFAULT_SETTINGS, ...(stored ?? {}) }
}

export async function putSettings(s: Settings): Promise<void> {
  await (await db()).put('settings', s, 'settings')
}

export async function putPhoto(date: string, blob: Blob): Promise<string> {
  const id = `${date}-${Date.now().toString(36)}`
  await (await db()).put('photos', { id, date, blob })
  return id
}

export async function getPhoto(id: string): Promise<Blob | null> {
  const row = await (await db()).get('photos', id)
  return row?.blob ?? null
}

export async function deletePhoto(id: string): Promise<void> {
  await (await db()).delete('photos', id)
}

export async function allPhotos(): Promise<{ id: string; date: string; blob: Blob }[]> {
  const rows = await (await db()).getAll('photos')
  return rows.sort((a, b) => a.date.localeCompare(b.date))
}

export async function eraseEverything(): Promise<void> {
  const d = await db()
  const tx = d.transaction(['days', 'photos', 'settings'], 'readwrite')
  await Promise.all([
    tx.objectStore('days').clear(),
    tx.objectStore('photos').clear(),
    tx.objectStore('settings').clear(),
    tx.done,
  ])
}

/** Used by restore, which must keep the photo ids the day records point at. */
export async function putPhotoRaw(id: string, date: string, blob: Blob): Promise<void> {
  await (await db()).put('photos', { id, date, blob })
}
