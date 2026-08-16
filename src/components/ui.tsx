import { type CSSProperties } from "react";
import { colourHex, initials } from "@/lib/colours";
import type { Member } from "@/lib/members";

/** Shared class strings, so buttons and inputs stay identical across every page. */
export const button = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50 disabled:pointer-events-none",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-lg border border-line-strong bg-surface px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-hover disabled:opacity-50 disabled:pointer-events-none",
  ghost:
    "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-hover hover:text-ink",
  danger:
    "inline-flex items-center justify-center gap-2 rounded-lg border border-line-strong bg-surface px-4 py-2.5 text-sm font-medium text-danger transition-colors hover:bg-danger-soft",
};

export const field =
  "w-full rounded-lg border border-line-strong bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-faint transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20";

export const label = "block text-sm font-medium text-ink mb-1.5";

export const card = "rounded-xl border border-line bg-surface shadow-card";

/**
 * Inline style carrying a member's colour through to the CSS in globals.css.
 * An event with nobody assigned gets a neutral tone rather than borrowing a
 * family member's colour.
 */
export function memberStyle(colour?: string | null): CSSProperties {
  return { "--member": colour ? colourHex(colour) : "var(--ink-faint)" } as CSSProperties;
}

export function Avatar({
  member,
  size = "md",
}: {
  member: Pick<Member, "name" | "colour">;
  size?: "sm" | "md" | "lg";
}) {
  const dimensions = {
    sm: "h-5 w-5 text-[10px]",
    md: "h-7 w-7 text-xs",
    lg: "h-10 w-10 text-sm",
  }[size];

  return (
    <span
      className={`member-dot inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${dimensions}`}
      style={memberStyle(member.colour)}
      title={member.name}
    >
      {initials(member.name)}
    </span>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1.5 text-sm text-danger">
      {message}
    </p>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 px-6 py-16 text-center">
      <p className="text-sm font-medium text-muted">{title}</p>
      {hint ? <p className="text-sm text-faint">{hint}</p> : null}
    </div>
  );
}
