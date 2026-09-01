import { useEffect, useRef, useState } from 'react'
import { eraseEverything, putPhotoRaw } from '../lib/db'
import { buildBackup, buildCsv, buildPhotoZip, downloadBlob, restoreBackup } from '../lib/export'
import { useSettings } from '../lib/settings-context'
import { DEFAULT_SETTINGS } from '../lib/types'
import { todayISO } from '../lib/dates'
import { permission, requestPermission } from '../lib/notifications'
import { Button, TextInput, Toast } from '../components/ui'

export default function SettingsScreen({ onDataChanged }: { onDataChanged: () => void }) {
  const { settings, saveSettings } = useSettings()
  const [toast, setToast] = useState<string | null>(null)
  const [newAvoid, setNewAvoid] = useState('')
  const [confirmErase, setConfirmErase] = useState(false)
  const [notifState, setNotifState] = useState(permission())
  const restoreInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setNotifState(permission())
  }, [])

  const set = <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) =>
    void saveSettings({ ...settings, [key]: value })

  async function toggleReminders() {
    if (settings.remindersEnabled) {
      set('remindersEnabled', false)
      return
    }
    const result = await requestPermission()
    setNotifState(result)
    if (result === 'granted') {
      set('remindersEnabled', true)
      setToast('Reminders on while the app is open.')
    } else if (result === 'unsupported') {
      setToast('This browser has no notifications. Use a phone alarm instead.')
    } else {
      setToast('Notifications are blocked, so reminders stay off.')
    }
  }

  async function exportCsv() {
    downloadBlob(await buildCsv(), `diary-${todayISO()}.csv`)
    setToast('CSV saved.')
  }

  async function exportPhotos() {
    const { blob, count } = await buildPhotoZip()
    if (count === 0) {
      setToast('There are no photos to export.')
      return
    }
    downloadBlob(blob, `diary-photos-${todayISO()}.zip`)
    setToast(`${count} ${count === 1 ? 'photo' : 'photos'} saved.`)
  }

  async function backup() {
    downloadBlob(await buildBackup(), `diary-backup-${todayISO()}.json`)
    setToast('Backup saved. Keep it somewhere safe.')
  }

  async function restore(file: File) {
    try {
      const { days, photos } = await restoreBackup(await file.text(), putPhotoRaw)
      onDataChanged()
      setToast(`Restored ${days} days and ${photos} photos.`)
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'That backup could not be read.')
    }
  }

  async function erase() {
    await eraseEverything()
    await saveSettings(DEFAULT_SETTINGS)
    setConfirmErase(false)
    onDataChanged()
    setToast('Everything erased.')
  }

  return (
    <div>
      <h1 className="border-b border-line bg-surface px-4 py-3 text-[17px] font-bold">Settings</h1>

      <div className="space-y-6 px-4 py-4">
        <Group title="Programme">
          <Field label="Start date">
            <TextInput
              type="date"
              value={settings.startDate}
              onChange={(v) => v && set('startDate', v)}
            />
          </Field>
          <Field label="Length (days)">
            <TextInput
              type="number"
              inputMode="numeric"
              value={String(settings.programmeDays)}
              onChange={(v) => set('programmeDays', Math.max(1, Math.min(730, Number(v) || 1)))}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Morning session">
              <TextInput type="time" value={settings.amTime} onChange={(v) => v && set('amTime', v)} />
            </Field>
            <Field label="Evening session">
              <TextInput type="time" value={settings.pmTime} onChange={(v) => v && set('pmTime', v)} />
            </Field>
          </div>
        </Group>

        <Group title="Avoid list">
          <div className="flex flex-wrap gap-2">
            {settings.avoid.map((item) => (
              <span
                key={item}
                className="flex items-center gap-1 rounded-xl border border-line bg-surface py-1 pr-1 pl-3 text-[15px]"
              >
                {item}
                <button
                  type="button"
                  aria-label={`Remove ${item}`}
                  onClick={() => set('avoid', settings.avoid.filter((a) => a !== item))}
                  className="tap flex items-center justify-center text-ink-muted"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <TextInput value={newAvoid} onChange={setNewAvoid} placeholder="Add an item" />
            <Button
              onClick={() => {
                const item = newAvoid.trim()
                if (!item || settings.avoid.includes(item)) return
                set('avoid', [...settings.avoid, item])
                setNewAvoid('')
              }}
            >
              Add
            </Button>
          </div>
        </Group>

        <Group title="Your data">
          <p className="text-[13px] leading-snug text-ink-muted">
            Everything is stored on this device only. Nothing is sent anywhere and there is no
            account. If you clear the browser's site data, or lose the phone, it is gone — so take a
            backup now and then.
          </p>
          <div className="grid gap-2">
            <Button onClick={() => void exportCsv()}>Export CSV</Button>
            <Button onClick={() => void exportPhotos()}>Export photos (zip)</Button>
            <Button tone="strong" onClick={() => void backup()}>
              Backup everything (JSON)
            </Button>
            <Button onClick={() => restoreInput.current?.click()}>Restore from backup</Button>
            <input
              ref={restoreInput}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) void restore(file)
              }}
            />
          </div>
        </Group>

        <Group title="Reminders">
          <Button onClick={() => void toggleReminders()}>
            {settings.remindersEnabled ? 'Turn reminders off' : 'Turn reminders on'}
          </Button>
          <p className="text-[13px] leading-snug text-ink-muted">
            Straight answer: this is unreliable and you should not depend on it. The app can only
            fire a reminder while it is actually running, and{' '}
            <strong className="text-ink">
              a web app added to the iPhone home screen cannot be trusted to give you scheduled
              notifications at all
            </strong>
            . Set two repeating alarms on your phone — {settings.amTime} and {settings.pmTime} — and
            treat anything this app manages as a bonus.
            {notifState === 'unsupported' && ' This browser has no notification support at all.'}
            {notifState === 'denied' && ' Notifications are currently blocked for this app.'}
          </p>
        </Group>

        <Group title="Danger">
          {confirmErase ? (
            <div className="space-y-2">
              <p className="text-[14px]">
                Erase every day, photo and setting on this device? This cannot be undone.
              </p>
              <div className="flex gap-2">
                <Button tone="strong" onClick={() => void erase()}>
                  Yes, erase everything
                </Button>
                <Button onClick={() => setConfirmErase(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <Button onClick={() => setConfirmErase(true)}>Erase all data</Button>
          )}
        </Group>
      </div>

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-[12px] font-bold tracking-wide text-ink-muted uppercase">{title}</h2>
      {children}
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[13px] text-ink-muted">{label}</span>
      {children}
    </label>
  )
}
