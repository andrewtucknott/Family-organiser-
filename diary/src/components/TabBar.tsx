export type Tab = 'today' | 'history' | 'progress' | 'plan' | 'settings'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'today', label: 'Today', icon: 'M4 6h16M4 12h16M4 18h10' },
  { id: 'history', label: 'History', icon: 'M4 5h16M4 10h16M4 15h16M4 20h10' },
  { id: 'progress', label: 'Progress', icon: 'M5 20V10M12 20V4M19 20v-7' },
  { id: 'plan', label: 'Plan', icon: 'M6 4h12v16H6zM9 9h6M9 13h6' },
  { id: 'settings', label: 'Settings', icon: 'M4 7h16M4 12h16M4 17h16M9 7v0M15 12v0M7 17v0' },
]

export default function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-[560px]">
        {TABS.map((t) => {
          const active = t.id === tab
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              aria-current={active ? 'page' : undefined}
              className={`tap flex flex-1 flex-col items-center gap-0.5 py-2 ${
                active ? 'text-ink' : 'text-ink-muted'
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={active ? 2.4 : 1.8}
                strokeLinecap="round"
              >
                <path d={t.icon} />
              </svg>
              <span className={`text-[11px] ${active ? 'font-semibold' : 'font-medium'}`}>
                {t.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
