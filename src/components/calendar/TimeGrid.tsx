"use client";

import { useEffect, useRef } from "react";
import type { CalendarOccurrence } from "@/lib/calendar-types";
import { eachDay, formatTime, weekdayName } from "@/lib/dates";
import { layoutDay } from "@/lib/day-layout";
import { memberStyle } from "@/components/ui";

/** Pixels per hour. Tall enough that a 30-minute event is still readable. */
const HOUR_HEIGHT = 48;
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

/** The scroll position when the grid opens — before this is mostly empty. */
const DEFAULT_SCROLL_HOUR = 7;

/**
 * The week and day views are the same grid with a different number of columns.
 * Timed events sit in the hour grid; all-day and multi-day events sit in the
 * strip above it, the way every calendar app does it.
 */
export function TimeGrid({
  from,
  to,
  today,
  nowMinutes,
  occurrences,
  onSelectEvent,
  onAddAt,
  onSelectDay,
}: {
  from: string;
  to: string;
  today: string;
  /** Minutes since midnight, or null when today is not on screen. */
  nowMinutes: number | null;
  occurrences: CalendarOccurrence[];
  onSelectEvent: (occurrence: CalendarOccurrence) => void;
  onAddAt: (date: string, time: string) => void;
  onSelectDay: (date: string) => void;
}) {
  const days = eachDay(from, to);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Open on the part of the day people actually use.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const target = nowMinutes !== null ? Math.max(0, nowMinutes / 60 - 2) : DEFAULT_SCROLL_HOUR;
    container.scrollTop = target * HOUR_HEIGHT;
  }, [from, nowMinutes]);

  const allDay = occurrences.filter(isStripEvent);
  const timed = occurrences.filter((o) => !isStripEvent(o));

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
      <div className="flex border-b border-line bg-sunken">
        <div className="w-12 shrink-0 sm:w-14" />
        {days.map((day) => (
          <button
            key={day}
            type="button"
            onClick={() => onSelectDay(day)}
            className="flex-1 border-l border-line px-1 py-2 text-center transition-colors hover:bg-hover"
          >
            <div className="text-[11px] font-medium tracking-wide text-muted">
              {weekdayName(day, "short")}
            </div>
            <div
              className={`mx-auto mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-sm font-medium ${
                day === today ? "bg-accent text-accent-ink" : "text-ink"
              }`}
            >
              {Number(day.slice(8, 10))}
            </div>
          </button>
        ))}
      </div>

      {allDay.length > 0 ? (
        <div className="flex border-b border-line">
          <div className="flex w-12 shrink-0 items-center justify-end pr-2 text-[10px] text-faint sm:w-14">
            all day
          </div>
          <div className="flex flex-1">
            {days.map((day) => (
              <div key={day} className="min-w-0 flex-1 space-y-0.5 border-l border-line p-1">
                {allDay
                  .filter((o) => o.startDate <= day && o.endDate >= day)
                  .map((occurrence) => (
                    <button
                      key={occurrence.key}
                      type="button"
                      onClick={() => onSelectEvent(occurrence)}
                      style={chipStyle(occurrence)}
                      className="member-chip block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium transition-opacity hover:opacity-80"
                    >
                      {occurrence.title}
                    </button>
                  ))}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div ref={scrollRef} className="max-h-[65dvh] overflow-y-auto">
        <div className="flex">
          <div className="w-12 shrink-0 sm:w-14">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="relative border-t border-transparent text-right"
                style={{ height: HOUR_HEIGHT }}
              >
                <span className="absolute -top-2 right-2 text-[10px] text-faint tabular-nums">
                  {hour === 0 ? "" : formatTime(`${String(hour).padStart(2, "0")}:00`)}
                </span>
              </div>
            ))}
          </div>

          <div className="flex flex-1">
            {days.map((day) => {
              const positioned = layoutDay(timed.filter((o) => o.startDate === day));
              return (
                <div key={day} className="relative min-w-0 flex-1 border-l border-line">
                  {HOURS.map((hour) => (
                    <button
                      key={hour}
                      type="button"
                      onClick={() => onAddAt(day, `${String(hour).padStart(2, "0")}:00`)}
                      aria-label={`Add an event at ${hour}:00 on ${day}`}
                      className="block w-full border-t border-line transition-colors hover:bg-hover"
                      style={{ height: HOUR_HEIGHT }}
                    />
                  ))}

                  {day === today && nowMinutes !== null ? (
                    <div
                      className="pointer-events-none absolute right-0 left-0 z-20 flex items-center"
                      style={{ top: (nowMinutes / 60) * HOUR_HEIGHT }}
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full bg-danger" />
                      <span className="h-px flex-1 bg-danger" />
                    </div>
                  ) : null}

                  {positioned.map(({ event: occurrence, startMinutes, durationMinutes, lane, lanes }) => (
                    <button
                      key={occurrence.key}
                      type="button"
                      onClick={() => onSelectEvent(occurrence)}
                      style={{
                        ...chipStyle(occurrence),
                        top: (startMinutes / 60) * HOUR_HEIGHT,
                        height: (durationMinutes / 60) * HOUR_HEIGHT,
                        left: `calc(${(lane / lanes) * 100}% + 2px)`,
                        width: `calc(${100 / lanes}% - 4px)`,
                      }}
                      className="member-chip absolute z-10 overflow-hidden rounded-md px-1.5 py-0.5 text-left text-[11px] leading-tight shadow-card transition-opacity hover:opacity-85"
                      title={`${occurrence.title} · ${occurrence.startTime ? formatTime(occurrence.startTime) : ""}`}
                    >
                      <span className="block truncate font-medium">{occurrence.title}</span>
                      {durationMinutes >= 45 && occurrence.startTime ? (
                        <span className="block truncate opacity-70">
                          {formatTime(occurrence.startTime)}
                          {occurrence.location ? ` · ${occurrence.location}` : ""}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/** All-day events, and anything spanning more than one day, live in the top strip. */
function isStripEvent(occurrence: CalendarOccurrence): boolean {
  return occurrence.allDay || occurrence.endDate > occurrence.startDate;
}

function chipStyle(occurrence: CalendarOccurrence) {
  return memberStyle(occurrence.members[0]?.colour);
}
