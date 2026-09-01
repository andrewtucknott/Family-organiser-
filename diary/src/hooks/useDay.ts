import { useCallback, useEffect, useRef, useState } from 'react'
import { getDay, putDay } from '../lib/db'
import type { DayEntry } from '../lib/types'

const DEBOUNCE_MS = 400

/**
 * Loads one day and autosaves it. There is no Save button anywhere, so this
 * also flushes on tab change, on unmount and when the app goes to the
 * background — close the app mid-sentence and the sentence is still there.
 */
export function useDay(date: string, onSaved?: () => void) {
  const [day, setDay] = useState<DayEntry | null>(null)
  const dayRef = useRef<DayEntry | null>(null)
  const pending = useRef<DayEntry | null>(null)
  const timer = useRef<number | null>(null)
  const savedCb = useRef(onSaved)
  savedCb.current = onSaved

  const flush = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
    const queued = pending.current
    if (!queued) return
    pending.current = null
    void putDay(queued).then(() => savedCb.current?.())
  }, [])

  useEffect(() => {
    let alive = true
    setDay(null)
    dayRef.current = null
    void getDay(date).then((d) => {
      if (!alive) return
      dayRef.current = d
      setDay(d)
    })
    return () => {
      alive = false
      flush()
    }
  }, [date, flush])

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', flush)
    }
  }, [flush])

  const update = useCallback(
    (patch: Partial<DayEntry> | ((d: DayEntry) => Partial<DayEntry>)) => {
      const prev = dayRef.current
      if (!prev) return
      const next = { ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) }
      dayRef.current = next
      setDay(next)
      pending.current = next
      if (timer.current !== null) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => {
        timer.current = null
        flush()
      }, DEBOUNCE_MS)
    },
    [flush],
  )

  return { day, update, flush }
}
