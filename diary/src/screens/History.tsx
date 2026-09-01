import { useEffect, useMemo, useState } from 'react'
import { allDays } from '../lib/db'
import { addDays, monthKey, monthLabel, shortDate, todayISO } from '../lib/dates'
import { useSettings } from '../lib/settings-context'
import { foodSummary, isLogged, type DayEntry } from '../lib/types'

export default function History({
  revision,
  onOpenDay,
}: {
  revision: number
  onOpenDay: (iso: string) => void
}) {
  const { settings } = useSettings()
  const [days, setDays] = useState<DayEntry[] | null>(null)

  useEffect(() => {
    void allDays().then(setDays)
  }, [revision])

  const rows = useMemo(() => {
    if (!days) return []
    const byDate = new Map(days.map((d) => [d.date, d]))
    const today = todayISO()
    const earliest = [settings.startDate, ...days.map((d) => d.date)].sort()[0] ?? today
    const latest = [today, ...days.map((d) => d.date)].sort().at(-1) ?? today

    const out: string[] = []
    for (let iso = latest; iso >= earliest; iso = addDays(iso, -1)) out.push(iso)
    return out.map((iso) => ({ iso, day: byDate.get(iso) }))
  }, [days, settings.startDate])

  if (!days) return <div className="px-4 py-8 text-center text-ink-muted">Loading…</div>

  let lastMonth = ''

  return (
    <div>
      <h1 className="border-b border-line bg-surface px-4 py-3 text-[17px] font-bold">History</h1>
      {rows.length === 0 && (
        <p className="px-4 py-8 text-center text-ink-muted">Nothing logged yet.</p>
      )}
      <ul>
        {rows.map(({ iso, day }) => {
          const month = monthKey(iso)
          const showHeader = month !== lastMonth
          lastMonth = month
          return (
            <li key={iso}>
              {showHeader && (
                <div className="sticky top-0 z-20 border-y border-line bg-surface-2 px-4 py-1.5 text-[12px] font-bold tracking-wide text-ink-muted uppercase">
                  {monthLabel(iso)}
                </div>
              )}
              <Row iso={iso} day={day} onOpen={() => onOpenDay(iso)} />
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Row({ iso, day, onOpen }: { iso: string; day?: DayEntry; onOpen: () => void }) {
  const logged = isLogged(day)
  const summary = day ? foodSummary(day) : ''
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left"
    >
      <div className="min-w-0 flex-1">
        <div className={`text-[15px] font-semibold ${logged ? 'text-ink' : 'text-ink-muted'}`}>
          {shortDate(iso)}
        </div>
        <div className={`truncate text-[13px] ${logged ? 'text-ink-muted' : 'text-ink-muted/70'}`}>
          {logged ? summary || 'Logged — no meals written down' : 'Not logged'}
        </div>
      </div>
      {day && logged && (
        <div className="flex shrink-0 items-center gap-1">
          {day.amDone && <Badge tone="good">AM</Badge>}
          {day.pmDone && <Badge tone="good">PM</Badge>}
          {day.swim && <Badge tone="plain">Swim</Badge>}
          {day.photoId && (
            <Badge tone="plain" label="Photo">
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 8h4l2-2h6l2 2h4v12H3z" strokeLinejoin="round" />
                <circle cx="12" cy="13" r="3.2" />
              </svg>
            </Badge>
          )}
          {day.slips.length > 0 && <Badge tone="accent">{day.slips.length}</Badge>}
        </div>
      )}
    </button>
  )
}

function Badge({
  children,
  tone,
  label,
}: {
  children: React.ReactNode
  tone: 'good' | 'accent' | 'plain'
  label?: string
}) {
  const tones = {
    good: 'bg-good text-good-ink',
    accent: 'bg-accent text-accent-ink',
    plain: 'bg-surface-2 text-ink-muted',
  }
  return (
    <span
      aria-label={label}
      className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${tones[tone]}`}
    >
      {children}
    </span>
  )
}
