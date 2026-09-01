import { useEffect, useRef, useState } from 'react'
import { deletePhoto, getPhoto, putPhoto } from '../lib/db'
import { shrinkToJpeg } from '../lib/image'
import { Button } from './ui'

export default function PhotoField({
  date,
  photoId,
  onChange,
}: {
  date: string
  photoId: string | null
  onChange: (id: string | null) => void
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let objectUrl: string | null = null
    let alive = true
    if (!photoId) {
      setUrl(null)
      return
    }
    void getPhoto(photoId).then((blob) => {
      if (!alive || !blob) return
      objectUrl = URL.createObjectURL(blob)
      setUrl(objectUrl)
    })
    return () => {
      alive = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [photoId])

  async function handleFile(file: File) {
    setBusy(true)
    setError(null)
    try {
      const jpeg = await shrinkToJpeg(file)
      const id = await putPhoto(date, jpeg)
      if (photoId) await deletePhoto(photoId)
      onChange(id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That photo could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (photoId) await deletePhoto(photoId)
    onChange(null)
  }

  return (
    <div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) void handleFile(file)
        }}
      />
      {url ? (
        <div className="flex items-start gap-3">
          <img
            src={url}
            alt={`Photo for ${date}`}
            className="h-28 w-28 rounded-xl border border-line object-cover"
          />
          <div className="flex flex-col gap-2">
            <Button onClick={() => input.current?.click()} disabled={busy}>
              {busy ? 'Working…' : 'Retake'}
            </Button>
            <Button onClick={() => void remove()} disabled={busy}>
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <Button onClick={() => input.current?.click()} disabled={busy} className="w-full">
          {busy ? 'Working…' : 'Take photo'}
        </Button>
      )}
      <div className="mt-1.5 text-[13px] text-ink-muted">
        {error ?? 'Stored on this phone only. Never uploaded.'}
      </div>
    </div>
  )
}
