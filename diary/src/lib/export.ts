import { zipSync } from 'fflate'
import { allDays, allPhotos, getSettings, putDay, putSettings } from './db'
import { DEFAULT_SETTINGS, emptyDay, type DayEntry, type Settings } from './types'

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

function csvCell(value: string | number | boolean): string {
  const s = String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function buildCsv(): Promise<Blob> {
  const days = await allDays()
  const header = [
    'date', 'breakfast', 'lunch', 'dinner', 'snacks', 'drinks', 'water',
    'slips', 'am_done', 'pm_done', 'swim', 'feel', 'notes', 'photo',
  ]
  const rows = days.map((d) =>
    [
      d.date, d.breakfast, d.lunch, d.dinner, d.snacks, d.drinks, d.water,
      d.slips.join('; '),
      d.amDone ? 'yes' : 'no',
      d.pmDone ? 'yes' : 'no',
      d.swim ? 'yes' : 'no',
      d.feel, d.notes,
      d.photoId ? 'yes' : 'no',
    ].map(csvCell).join(','),
  )
  // A BOM so Excel opens it as UTF-8 without being asked.
  return new Blob(['﻿' + [header.join(','), ...rows].join('\r\n') + '\r\n'], {
    type: 'text/csv;charset=utf-8',
  })
}

export async function buildPhotoZip(): Promise<{ blob: Blob; count: number }> {
  const photos = await allPhotos()
  const files: Record<string, Uint8Array> = {}
  const usedNames = new Set<string>()
  for (const p of photos) {
    let name = `${p.date}.jpg`
    let n = 2
    while (usedNames.has(name)) name = `${p.date}-${n++}.jpg`
    usedNames.add(name)
    files[name] = new Uint8Array(await p.blob.arrayBuffer())
  }
  // level 0: JPEGs are already compressed, so storing them is quicker on a phone.
  const zipped = zipSync(files, { level: 0 })
  return { blob: new Blob([zipped as unknown as BlobPart], { type: 'application/zip' }), count: photos.length }
}

type Backup = {
  format: 'food-exercise-diary'
  version: 1
  exportedAt: string
  settings: Settings
  days: DayEntry[]
  photos: { id: string; date: string; dataUrl: string }[]
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('Could not read a photo for the backup.'))
    r.readAsDataURL(blob)
  })
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl)
  return res.blob()
}

export async function buildBackup(): Promise<Blob> {
  const [settings, days, photos] = await Promise.all([getSettings(), allDays(), allPhotos()])
  const backup: Backup = {
    format: 'food-exercise-diary',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings,
    days,
    photos: await Promise.all(
      photos.map(async (p) => ({ id: p.id, date: p.date, dataUrl: await blobToDataUrl(p.blob) })),
    ),
  }
  return new Blob([JSON.stringify(backup)], { type: 'application/json' })
}

/** Reads a backup file back in, replacing anything with the same date or photo id. */
export async function restoreBackup(
  text: string,
  putPhotoRaw: (id: string, date: string, blob: Blob) => Promise<void>,
): Promise<{ days: number; photos: number }> {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('That file is not a diary backup — it is not valid JSON.')
  }
  const backup = parsed as Partial<Backup>
  if (backup?.format !== 'food-exercise-diary' || !Array.isArray(backup.days)) {
    throw new Error('That file is not a diary backup.')
  }

  for (const raw of backup.days) {
    if (!raw?.date) continue
    const day: DayEntry = { ...emptyDay(raw.date), ...raw }
    day.slips = Array.isArray(day.slips) ? day.slips : []
    day.water = Number.isFinite(day.water) ? day.water : 0
    await putDay(day)
  }

  let photoCount = 0
  for (const p of backup.photos ?? []) {
    if (!p?.id || !p?.dataUrl) continue
    await putPhotoRaw(p.id, p.date, await dataUrlToBlob(p.dataUrl))
    photoCount++
  }

  if (backup.settings) await putSettings({ ...DEFAULT_SETTINGS, ...backup.settings })

  return { days: backup.days.length, photos: photoCount }
}
