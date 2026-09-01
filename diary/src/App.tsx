import { useCallback, useEffect, useState } from 'react'
import { getSettings, putSettings } from './lib/db'
import { SettingsContext } from './lib/settings-context'
import { DEFAULT_SETTINGS, type Settings } from './lib/types'
import { todayISO } from './lib/dates'
import { scheduleReminders } from './lib/notifications'
import TabBar, { type Tab } from './components/TabBar'
import Today from './screens/Today'
import History from './screens/History'
import Progress from './screens/Progress'
import PlanScreen from './screens/Plan'
import SettingsScreen from './screens/Settings'

export default function App() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [tab, setTab] = useState<Tab>('today')
  const [date, setDate] = useState(todayISO())
  // Bumped whenever a day is written, so History and Progress reload.
  const [revision, setRevision] = useState(0)
  const bump = useCallback(() => setRevision((n) => n + 1), [])

  useEffect(() => {
    void getSettings().then(setSettings)
  }, [])

  // If the app is left open overnight, roll on to the new day — but leave the
  // date alone if you have deliberately stepped back to an earlier one.
  useEffect(() => {
    let known = todayISO()
    const id = window.setInterval(() => {
      const now = todayISO()
      if (now === known) return
      setDate((current) => (current === known ? now : current))
      known = now
    }, 60_000)
    return () => window.clearInterval(id)
  }, [])

  const saveSettings = useCallback(async (next: Settings) => {
    setSettings(next)
    await putSettings(next)
  }, [])

  useEffect(() => {
    if (!settings) return
    scheduleReminders(settings.remindersEnabled, settings.amTime, settings.pmTime)
  }, [settings])

  const openDay = useCallback((iso: string) => {
    setDate(iso)
    setTab('today')
  }, [])

  if (!settings) {
    return <div className="min-h-dvh bg-bg" />
  }

  return (
    <SettingsContext.Provider value={{ settings: settings ?? DEFAULT_SETTINGS, saveSettings }}>
      <div className="min-h-dvh bg-bg text-ink">
        <main className="mx-auto max-w-[560px] pb-[calc(4.75rem+env(safe-area-inset-bottom))]">
          {tab === 'today' && <Today date={date} setDate={setDate} onSaved={bump} />}
          {tab === 'history' && <History revision={revision} onOpenDay={openDay} />}
          {tab === 'progress' && <Progress revision={revision} />}
          {tab === 'plan' && <PlanScreen />}
          {tab === 'settings' && <SettingsScreen onDataChanged={bump} />}
        </main>
        <TabBar tab={tab} onChange={setTab} />
      </div>
    </SettingsContext.Provider>
  )
}
