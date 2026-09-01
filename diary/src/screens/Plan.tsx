import { GROUND_RULES, PHASES, PLAN } from '../lib/plan'
import { planDayIndex, todayISO } from '../lib/dates'
import { useSettings } from '../lib/settings-context'

export default function PlanScreen() {
  const { settings } = useSettings()
  const todayIndex = planDayIndex(todayISO())

  return (
    <div>
      <h1 className="border-b border-line bg-surface px-4 py-3 text-[17px] font-bold">Plan</h1>

      <div className="space-y-3 px-4 py-4">
        {PLAN.map((d, i) => (
          <div
            key={d.day}
            className={`rounded-xl border bg-surface ${
              i === todayIndex ? 'border-ink' : 'border-line'
            }`}
          >
            <div className="flex items-baseline justify-between border-b border-line px-4 py-2">
              <h2 className="text-[16px] font-bold">{d.day}</h2>
              {i === todayIndex && (
                <span className="text-[11px] font-bold tracking-wide text-ink-muted uppercase">
                  Today
                </span>
              )}
            </div>
            <div className="divide-y divide-line">
              <SessionRow time={settings.amTime} session={d.am} />
              <SessionRow time={settings.pmTime} session={d.pm} />
            </div>
          </div>
        ))}

        <section className="rounded-xl border border-line bg-surface px-4 py-3">
          <h2 className="mb-2 text-[12px] font-bold tracking-wide text-ink-muted uppercase">
            Phases
          </h2>
          <div className="space-y-3">
            {PHASES.map((p) => (
              <div key={p.name}>
                <div className="text-[15px] font-bold">{p.name}</div>
                <p className="text-[14px] leading-snug text-ink-muted">{p.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-line bg-surface px-4 py-3">
          <h2 className="mb-2 text-[12px] font-bold tracking-wide text-ink-muted uppercase">
            Ground rules
          </h2>
          <ul className="space-y-1.5">
            {GROUND_RULES.map((r) => (
              <li key={r} className="flex gap-2 text-[14px] leading-snug">
                <span aria-hidden="true" className="text-ink-muted">
                  —
                </span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}

function SessionRow({ time, session }: { time: string; session: { title: string; detail: string } }) {
  return (
    <div className="px-4 py-3">
      <div className="text-[12px] font-bold tracking-wide text-ink-muted uppercase">
        {time} — 20 min
      </div>
      <div className="text-[15px] font-bold">{session.title}</div>
      <p className="mt-0.5 text-[14px] leading-snug text-ink-muted">{session.detail}</p>
    </div>
  )
}
