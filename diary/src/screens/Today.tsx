import { useDay } from '../hooks/useDay'
import { useSettings } from '../lib/settings-context'
import { addDays, longDate, planDayIndex, todayISO, weekdayName } from '../lib/dates'
import { PLAN } from '../lib/plan'
import { AutoTextarea, FieldLabel } from '../components/ui'
import AvoidBanner from '../components/AvoidBanner'
import WaterRow from '../components/WaterRow'
import PhotoField from '../components/PhotoField'
import type { DayEntry } from '../lib/types'

const FEELINGS = ['Sharp', 'Fine', 'Flat', 'Bloated', 'Hungry', 'Tired']

const MEALS: { key: keyof DayEntry; label: string; placeholder: string }[] = [
  { key: 'breakfast', label: 'Breakfast', placeholder: 'What you had' },
  { key: 'lunch', label: 'Lunch', placeholder: 'What you had' },
  { key: 'dinner', label: 'Dinner', placeholder: 'What you had' },
  { key: 'snacks', label: 'Snacks', placeholder: 'Anything between meals' },
  { key: 'drinks', label: 'Drinks', placeholder: 'Tea, coffee, anything else' },
]

export default function Today({
  date,
  setDate,
  onSaved,
}: {
  date: string
  setDate: (d: string) => void
  onSaved: () => void
}) {
  const { settings } = useSettings()
  const { day, update } = useDay(date, onSaved)
  const planDay = PLAN[planDayIndex(date)]
  const isToday = date === todayISO()

  return (
    <div>
      <AvoidBanner items={settings.avoid} />

      <header className="flex items-center justify-between border-b border-line bg-surface px-2 py-2">
        <button
          type="button"
          aria-label="Previous day"
          onClick={() => setDate(addDays(date, -1))}
          className="tap flex items-center justify-center rounded-xl text-ink-muted"
        >
          <Chevron dir="left" />
        </button>
        <div className="text-center">
          <div className="text-[17px] font-bold">{isToday ? 'Today' : longDate(date)}</div>
          <div className="text-[12px] text-ink-muted">
            {isToday ? longDate(date) : weekdayName(date)}
          </div>
        </div>
        <button
          type="button"
          aria-label="Next day"
          onClick={() => setDate(addDays(date, 1))}
          disabled={isToday}
          className="tap flex items-center justify-center rounded-xl text-ink-muted disabled:opacity-25"
        >
          <Chevron dir="right" />
        </button>
      </header>

      {!day ? (
        <div className="px-4 py-8 text-center text-ink-muted">Loading…</div>
      ) : (
        <div className="space-y-5 px-4 py-4">
          {MEALS.map((m) => (
            <div key={m.key}>
              <FieldLabel>{m.label}</FieldLabel>
              <AutoTextarea
                value={day[m.key] as string}
                placeholder={m.placeholder}
                onChange={(e) => update({ [m.key]: e.target.value } as Partial<DayEntry>)}
              />
            </div>
          ))}

          <div>
            <FieldLabel>Water</FieldLabel>
            <WaterRow value={day.water} onChange={(water) => update({ water })} />
          </div>

          <div>
            <FieldLabel>Slips</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {settings.avoid.map((item) => {
                const on = day.slips.includes(item)
                return (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      update((d) => ({
                        slips: on ? d.slips.filter((s) => s !== item) : [...d.slips, item],
                      }))
                    }
                    className={`tap rounded-xl border px-4 text-[15px] font-semibold ${
                      on
                        ? 'border-transparent bg-accent text-accent-ink'
                        : 'border-line bg-surface text-ink'
                    }`}
                  >
                    {item}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-3">
            <FieldLabel>Exercise</FieldLabel>
            <SessionCard
              time={settings.amTime}
              title={planDay.am.title}
              detail={planDay.am.detail}
              done={day.amDone}
              onToggle={() => update((d) => ({ amDone: !d.amDone }))}
            />
            <SessionCard
              time={settings.pmTime}
              title={planDay.pm.title}
              detail={planDay.pm.detail}
              done={day.pmDone}
              onToggle={() => update((d) => ({ pmDone: !d.pmDone }))}
            />
            <button
              type="button"
              aria-pressed={day.swim}
              onClick={() => update((d) => ({ swim: !d.swim }))}
              className={`tap flex w-full items-center justify-between rounded-xl border px-4 py-2.5 text-left ${
                day.swim ? 'border-good bg-good/10' : 'border-line bg-surface'
              }`}
            >
              <span className="text-[15px] font-semibold">Swim</span>
              <span
                className={`rounded-lg px-3 py-1 text-[13px] font-bold ${
                  day.swim ? 'bg-good text-good-ink' : 'bg-surface-2 text-ink-muted'
                }`}
              >
                {day.swim ? 'Done' : 'Not done'}
              </span>
            </button>
          </div>

          <div>
            <FieldLabel>Feel</FieldLabel>
            <input
              type="text"
              value={day.feel}
              placeholder="A word or two"
              onChange={(e) => update({ feel: e.target.value })}
              className="tap w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-[16px] text-ink placeholder:text-ink-muted/70 focus:border-ink-muted focus:outline-none"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {FEELINGS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => update({ feel: f })}
                  className={`min-h-[38px] rounded-xl border px-3 text-[14px] font-medium ${
                    day.feel === f ? 'border-ink bg-surface-2 text-ink' : 'border-line bg-surface text-ink-muted'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div>
            <FieldLabel>Photo</FieldLabel>
            <PhotoField
              date={date}
              photoId={day.photoId}
              onChange={(photoId) => update({ photoId })}
            />
          </div>

          <div>
            <FieldLabel>Notes</FieldLabel>
            <AutoTextarea
              value={day.notes}
              placeholder="Anything worth remembering"
              onChange={(e) => update({ notes: e.target.value })}
            />
          </div>

          <p className="pb-2 text-center text-[12px] text-ink-muted">Saved as you type.</p>
        </div>
      )}
    </div>
  )
}

function SessionCard({
  time,
  title,
  detail,
  done,
  onToggle,
}: {
  time: string
  title: string
  detail: string
  done: boolean
  onToggle: () => void
}) {
  return (
    <div className={`rounded-xl border ${done ? 'border-good bg-good/10' : 'border-line bg-surface'}`}>
      <div className="px-4 pt-3">
        <div className="text-[12px] font-bold tracking-wide text-ink-muted uppercase">{time}</div>
        <div className="text-[16px] font-bold">{title}</div>
        <p className="mt-1 text-[14px] leading-snug text-ink-muted">{detail}</p>
      </div>
      <div className="px-4 pt-3 pb-3">
        <button
          type="button"
          aria-pressed={done}
          onClick={onToggle}
          className={`tap w-full rounded-xl border px-4 text-[15px] font-bold ${
            done ? 'border-transparent bg-good text-good-ink' : 'border-line bg-surface-2 text-ink'
          }`}
        >
          {done ? '✓ Done' : 'Mark done'}
        </button>
      </div>
    </div>
  )
}

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d={dir === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
    </svg>
  )
}
