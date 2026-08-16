"use client";

import type { CalendarOccurrence } from "@/lib/calendar-types";
import { formatTime } from "@/lib/dates";
import { Avatar, memberStyle } from "@/components/ui";

/** A plain chronological list — the easiest thing to read on a phone. */
export function AgendaList({
  occurrences,
  onSelectEvent,
}: {
  occurrences: CalendarOccurrence[];
  onSelectEvent: (occurrence: CalendarOccurrence) => void;
}) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface shadow-card">
      {occurrences.map((occurrence) => {
        const colour = occurrence.members[0]?.colour;
        return (
          <li key={occurrence.key}>
            <button
              type="button"
              onClick={() => onSelectEvent(occurrence)}
              className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-hover"
            >
              <span
                className="member-dot mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                style={memberStyle(colour)}
                aria-hidden
              />

              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium text-ink">{occurrence.title}</span>
                  {occurrence.repeats ? (
                    <span className="text-xs text-faint" title="Repeating event">
                      repeats
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 block text-sm text-muted">
                  {occurrence.allDay
                    ? "All day"
                    : occurrence.startTime
                      ? `${formatTime(occurrence.startTime)}${
                          occurrence.endTime ? ` – ${formatTime(occurrence.endTime)}` : ""
                        }`
                      : ""}
                  {occurrence.location ? ` · ${occurrence.location}` : ""}
                </span>
                {occurrence.notes ? (
                  <span className="mt-0.5 block truncate text-sm text-faint">
                    {occurrence.notes}
                  </span>
                ) : null}
              </span>

              {occurrence.members.length > 0 ? (
                <span className="flex shrink-0 -space-x-1.5">
                  {occurrence.members.slice(0, 4).map((member) => (
                    <Avatar key={member.id} member={member} size="sm" />
                  ))}
                </span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
