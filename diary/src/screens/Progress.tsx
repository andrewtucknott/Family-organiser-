import { useEffect, useMemo, useState } from 'react'
import { allDays, allPhotos } from '../lib/db'
import { addDays, shortDate, todayISO } from '../lib/dates'
import { useSettings } from '../lib/settings-context'
import { SESSIONS_PER_WEEK, currentStreak, longestStreak, weekRows } from '../lib/stats'
import type { DayEntry } from '../lib/types'

type Photo = { id: string; date: string; url: string }

export default function Progress({ revision }: { revision: number }) {
  const { settings } = useSettings()
  const [days, setDays] = useState<DayEntry[] | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])

  useEffect(() => {
    void allDays().then(setDays)
  }, [revision])

  useEffect(() => {
    let urls: string[] = []
    let alive = true
    void allPhotos().then((rows) => {
      if (!alive) return
      const mapped = rows.map((r) => {
        const url = URL.createObjectURL(r.blob)
        urls.push(url)
        return { id: r.id, date: r.date, url }
      })
      setPhotos(mapped)
    })
    return () => {
      alive = false
      urls.forEach((u) => URL.revokeObjectURL(u))
      urls = []
    }
  }, [revision])

  const rows = useMemo(
    () => (days ? weekRows(days, settings.startDate, settings.programmeDays) : []),
    [days, settings.startDate, settings.programmeDays],
  )
  const streak = useMemo(() => (days ? currentStreak(days) : 0), [days])
  const best = useMemo(() => (days ? longestStreak(days) : 0), [days])
  const maxSessions = Math.max(SESSIONS_PER_WEEK, ...rows.map((r) => r.sessions))

  if (!days) return <div className="px-4 py-8 text-center text-ink-muted">Loading…</div>

  return (
    <div>
      <h1 className="border-b border-line bg-surface px-4 py-3 text-[17px] font-bold">Progress</h1>

      <div className="grid grid-cols-2 gap-3 px-4 py-4">
        <Stat label="Current streak" value={`${streak} ${streak === 1 ? 'day' : 'days'}`} />
        <Stat label="Longest streak" value={`${best} ${best === 1 ? 'day' : 'days'}`} />
      </div>

      <Section title="By week">
        {rows.length === 0 ? (
          <p className="px-4 pb-4 text-[14px] text-ink-muted">
            The programme starts on {shortDate(settings.startDate)}.
          </p>
        ) : (
          <div className="overflow-x-auto px-4 pb-4">
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="text-left text-ink-muted">
                  <Th>Wk</Th>
                  <Th>w/c</Th>
                  <Th right>Logged</Th>
                  <Th right>Clean</Th>
                  <Th right>AM</Th>
                  <Th right>PM</Th>
                  <Th right>Sess</Th>
                  <Th right>Swim</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.week} className="border-t border-line">
                    <Td>{r.week}</Td>
                    <Td>{shortDate(r.start).replace(/^\w+ /, '')}</Td>
                    <Td right>{r.logged}/7</Td>
                    <Td right>{r.clean}</Td>
                    <Td right>{r.am}</Td>
                    <Td right>{r.pm}</Td>
                    <Td right>
                      {r.sessions}/{SESSIONS_PER_WEEK}
                    </Td>
                    <Td right>{r.swims}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {rows.length > 0 && (
        <Section title="Sessions per week">
          <div className="flex items-end gap-1.5 px-4 pb-2" style={{ height: 132 }}>
            {rows.map((r) => (
              <div key={r.week} className="flex flex-1 flex-col items-center justify-end gap-1">
                <div className="text-[10px] text-ink-muted">{r.sessions}</div>
                <div
                  className="w-full rounded-t bg-good"
                  style={{ height: `${Math.max(2, (r.sessions / maxSessions) * 96)}px` }}
                  role="img"
                  aria-label={`Week ${r.week}: ${r.sessions} of ${SESSIONS_PER_WEEK} sessions`}
                />
                <div className="text-[10px] text-ink-muted">{r.week}</div>
              </div>
            ))}
          </div>
          <p className="px-4 pb-4 text-[12px] text-ink-muted">
            Out of {SESSIONS_PER_WEEK} a week.
          </p>
        </Section>
      )}

      <PhotoTimeline photos={photos} />
    </div>
  )
}

function PhotoTimeline({ photos }: { photos: Photo[] }) {
  // Default the comparison across weeks, not days: today against the same
  // weekday four weeks back, snapped to the nearest photo actually taken.
  const [left, setLeft] = useState<string | null>(null)
  const [right, setRight] = useState<string | null>(null)

  useEffect(() => {
    if (photos.length < 2) {
      setLeft(null)
      setRight(null)
      return
    }
    const nearest = (target: string, exclude?: string) => {
      const pool = photos.filter((p) => p.id !== exclude)
      return pool.reduce((bestPhoto, p) =>
        Math.abs(dayGap(p.date, target)) < Math.abs(dayGap(bestPhoto.date, target)) ? p : bestPhoto,
      ).id
    }
    const today = todayISO()
    const r = nearest(today)
    setRight(r)
    const rDate = photos.find((p) => p.id === r)!.date
    setLeft(nearest(addDays(rDate, -28), r))
  }, [photos])

  const leftPhoto = photos.find((p) => p.id === left) ?? null
  const rightPhoto = photos.find((p) => p.id === right) ?? null

  return (
    <Section title="Photos">
      {photos.length === 0 ? (
        <p className="px-4 pb-4 text-[14px] text-ink-muted">No photos yet.</p>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto px-4 pb-3">
            {photos.map((p) => (
              <figure key={p.id} className="shrink-0">
                <img
                  src={p.url}
                  alt={`Photo from ${shortDate(p.date)}`}
                  className="h-24 w-20 rounded-lg border border-line object-cover"
                />
                <figcaption className="mt-1 text-center text-[11px] text-ink-muted">
                  {shortDate(p.date).replace(/^\w+ /, '')}
                </figcaption>
              </figure>
            ))}
          </div>

          {photos.length < 2 ? (
            <p className="px-4 pb-4 text-[13px] text-ink-muted">
              Take another photo in a few weeks to compare.
            </p>
          ) : (
            <div className="px-4 pb-4">
              <div className="mb-2 text-[12px] font-bold tracking-wide text-ink-muted uppercase">
                Compare
              </div>
              <div className="grid grid-cols-2 gap-2">
                <ComparePane photos={photos} selected={left} onSelect={setLeft} photo={leftPhoto} />
                <ComparePane photos={photos} selected={right} onSelect={setRight} photo={rightPhoto} />
              </div>
            </div>
          )}
        </>
      )}
    </Section>
  )
}

function ComparePane({
  photos,
  selected,
  onSelect,
  photo,
}: {
  photos: Photo[]
  selected: string | null
  onSelect: (id: string) => void
  photo: Photo | null
}) {
  return (
    <div>
      {photo ? (
        <img
          src={photo.url}
          alt={`Photo from ${shortDate(photo.date)}`}
          className="aspect-[3/4] w-full rounded-lg border border-line object-cover"
        />
      ) : (
        <div className="aspect-[3/4] w-full rounded-lg border border-line bg-surface-2" />
      )}
      <select
        value={selected ?? ''}
        onChange={(e) => onSelect(e.target.value)}
        className="tap mt-2 w-full rounded-lg border border-line bg-surface px-2 text-[14px] text-ink"
      >
        {photos.map((p) => (
          <option key={p.id} value={p.id}>
            {shortDate(p.date)}
          </option>
        ))}
      </select>
    </div>
  )
}

function dayGap(a: string, b: string): number {
  return (new Date(a).getTime() - new Date(b).getTime()) / 86400000
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-3">
      <div className="text-[12px] font-semibold tracking-wide text-ink-muted uppercase">{label}</div>
      <div className="text-[20px] font-bold">{value}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line pt-4">
      <h2 className="px-4 pb-2 text-[12px] font-bold tracking-wide text-ink-muted uppercase">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-1 pb-1 font-semibold ${right ? 'text-right' : 'text-left'}`}>{children}</th>
  )
}

function Td({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <td className={`px-1 py-1.5 whitespace-nowrap ${right ? 'text-right' : 'text-left'}`}>
      {children}
    </td>
  )
}
