import { useRef } from 'react'
import { MAX_WATER } from '../lib/types'

/** Tap a glass to set the count. Press and hold any glass to reset to none. */
export default function WaterRow({
  value,
  onChange,
}: {
  value: number
  onChange: (n: number) => void
}) {
  const held = useRef(false)
  const timer = useRef<number | null>(null)

  const startHold = () => {
    held.current = false
    timer.current = window.setTimeout(() => {
      held.current = true
      onChange(0)
    }, 500)
  }

  const endHold = () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = null
  }

  return (
    <div>
      <div className="flex flex-wrap">
        {Array.from({ length: MAX_WATER }, (_, i) => {
          const filled = i < value
          return (
            <button
              key={i}
              type="button"
              aria-label={`${i + 1} ${i === 0 ? 'glass' : 'glasses'} of water`}
              aria-pressed={filled}
              onPointerDown={startHold}
              onPointerUp={endHold}
              onPointerLeave={endHold}
              onPointerCancel={endHold}
              onContextMenu={(e) => e.preventDefault()}
              onClick={() => {
                if (held.current) {
                  held.current = false
                  return
                }
                // Tapping the last filled glass clears it, so a mis-tap is undoable.
                onChange(value === i + 1 ? i : i + 1)
              }}
              className="tap flex items-center justify-center"
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
                <path
                  d="M6 4h12l-1.4 15.2A2 2 0 0 1 14.6 21H9.4a2 2 0 0 1-2-1.8L6 4Z"
                  fill={filled ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                  className={filled ? 'text-ink' : 'text-ink-muted'}
                />
              </svg>
            </button>
          )
        })}
      </div>
      <div className="mt-1 text-[13px] text-ink-muted">
        {value === 0 ? 'None yet — press and hold to reset' : `${value} ${value === 1 ? 'glass' : 'glasses'}`}
      </div>
    </div>
  )
}
