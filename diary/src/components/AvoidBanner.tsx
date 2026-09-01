export default function AvoidBanner({ items }: { items: string[] }) {
  if (items.length === 0) return null
  return (
    <div className="sticky top-0 z-30 bg-accent px-3 py-2 text-center text-accent-ink">
      <span className="text-[13px] font-bold tracking-wide uppercase">
        Avoid: {items.map((i) => i.toUpperCase()).join(' · ')}
      </span>
    </div>
  )
}
