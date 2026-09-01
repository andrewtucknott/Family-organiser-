import {
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react'

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-1.5 text-xs font-semibold tracking-wide text-ink-muted uppercase">
      {children}
    </div>
  )
}

type AutoTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { value: string }

/** A text box that grows as you type, so nothing is hidden behind a scrollbar. */
export function AutoTextarea({ value, className = '', ...rest }: AutoTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])

  return (
    <textarea
      ref={ref}
      value={value}
      rows={2}
      className={`w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-[16px] leading-snug text-ink placeholder:text-ink-muted/70 focus:border-ink-muted focus:outline-none ${className}`}
      {...rest}
    />
  )
}

export function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  ...rest
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'>) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="tap w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-[16px] text-ink placeholder:text-ink-muted/70 focus:border-ink-muted focus:outline-none"
      {...rest}
    />
  )
}

export function Button({
  children,
  onClick,
  tone = 'plain',
  className = '',
  disabled,
}: {
  children: ReactNode
  onClick?: () => void
  tone?: 'plain' | 'strong' | 'accent' | 'good'
  className?: string
  disabled?: boolean
}) {
  const tones = {
    plain: 'border-line bg-surface-2 text-ink',
    strong: 'border-transparent bg-ink text-bg',
    accent: 'border-transparent bg-accent text-accent-ink',
    good: 'border-transparent bg-good text-good-ink',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`tap rounded-xl border px-4 py-2.5 text-[15px] font-semibold disabled:opacity-50 ${tones[tone]} ${className}`}
    >
      {children}
    </button>
  )
}

/** A one-line confirmation that fades itself out. */
export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const id = window.setTimeout(onDone, 3200)
    return () => window.clearTimeout(id)
  }, [message, onDone])

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4">
      <div className="max-w-[22rem] rounded-xl bg-ink px-4 py-2.5 text-center text-[14px] font-medium text-bg shadow-lg">
        {message}
      </div>
    </div>
  )
}
