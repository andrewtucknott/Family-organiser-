"use client";

import type { CalendarOccurrence } from "@/lib/calendar-types";
import { addDays, eachDay, formatTime, startOfWeek } from "@/lib/dates";
import { colourHex } from "@/lib/colours";
import { memberStyle } from "@/components/ui";

const WEEKDAY_HEADS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Above this, the cell shows a "+N more" link instead of overflowing. */
const MAX_CHIPS_PER_DAY = 3;

export function MonthView({
  month,
  today,
  occurrences,
  onSelectDay,
  onSelectEvent,
  onAddOn,
}: {
  /** Any date within the month being shown. */
  month: string;
  today: string;
  occurrences: CalendarOccurrence[];
  onSelectDay: (date: string) => void;
  onSelectEvent: (occurrence: CalendarOccurrence) => void;
  onAddOn: (date: string) => void;
}) {
  const gridStart = startOfWeek(`${month.slice(0, 7)}-01`);
  const days = eachDay(gridStart, addDays(gridStart, 41));
  const currentMonth = month.slice(0, 7);

  const byDay = groupByDay(occurrences);

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
      <div className="grid grid-cols-7 border-b border-line bg-sunken">
        {WEEKDAY_HEADS.map((day) => (
          <div
            key={day}
            className="px-2 py-2 text-center text-xs font-medium tracking-wide text-muted"
          >
            <span className="hidden sm:inline">{day}</span>
            <span className="sm:hidden">{day.slice(0, 1)}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day, index) => {
          const dayEvents = byDay.get(day) ?? [];
          const outside = day.slice(0, 7) !== currentMonth;
          const isToday = day === today;
          const visible = dayEvents.slice(0, MAX_CHIPS_PER_DAY);
          const hidden = dayEvents.length - visible.length;

          return (
            <div
              key={day}
              className={`group relative min-h-16 border-b border-r border-line p-1 sm:min-h-28 ${
                index % 7 === 6 ? "border-r-0" : ""
              } ${index >= 35 ? "border-b-0" : ""} ${
                outside ? "bg-sunken/40" : ""
              } ${isToday ? "bg-today" : ""}`}
            >
              <div className="mb-1 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => onSelectDay(day)}
                  className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-medium transition-colors ${
                    isToday
                      ? "bg-accent text-accent-ink"
                      : outside
                        ? "text-faint hover:bg-hover"
                        : "text-ink hover:bg-hover"
                  }`}
                  aria-label={`View ${day}`}
                >
                  {Number(day.slice(8, 10))}
                </button>
                <button
                  type="button"
                  onClick={() => onAddOn(day)}
                  className="rounded px-1 text-sm leading-none text-faint opacity-0 transition-opacity hover:text-accent focus-visible:opacity-100 group-hover:opacity-100"
                  aria-label={`Add an event on ${day}`}
                >
                  +
                </button>
              </div>

              {/* A phone-width month cell is about 45px across — far too narrow
                  for any title — so small screens get a dot per event and tap
                  through to the day. */}
              {dayEvents.length > 0 ? (
                <button
                  type="button"
                  onClick={() => onSelectDay(day)}
                  aria-label={`${dayEvents.length} events on ${day}`}
                  className="flex w-full flex-wrap justify-center gap-1 py-1 sm:hidden"
                >
                  {dayEvents.slice(0, 6).map((occurrence) => (
                    <span
                      key={occurrence.key}
                      className="member-dot h-1.5 w-1.5 rounded-full"
                      style={memberStyle(occurrence.members[0]?.colour)}
                    />
                  ))}
                </button>
              ) : null}

              <div className="hidden space-y-0.5 sm:block">
                {visible.map((occurrence) => (
                  <MonthChip
                    key={occurrence.key}
                    occurrence={occurrence}
                    day={day}
                    onSelect={onSelectEvent}
                  />
                ))}
                {hidden > 0 ? (
                  <button
                    type="button"
                    onClick={() => onSelectDay(day)}
                    className="w-full px-1 text-left text-[11px] font-medium text-muted hover:text-accent"
                  >
                    +{hidden} more
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthChip({
  occurrence,
  day,
  onSelect,
}: {
  occurrence: CalendarOccurrence;
  day: string;
  onSelect: (occurrence: CalendarOccurrence) => void;
}) {
  const spans = occurrence.endDate > occurrence.startDate;
  const continues = spans && occurrence.startDate < day;
  const colour = occurrence.members[0]?.colour;

  return (
    <button
      type="button"
      onClick={() => onSelect(occurrence)}
      style={memberStyle(colour)}
      className={`member-chip flex w-full items-center gap-1 overflow-hidden rounded px-1.5 py-0.5 text-left text-[11px] leading-tight transition-opacity hover:opacity-80 ${
        continues ? "rounded-l-none" : ""
      }`}
      title={`${occurrence.title}${occurrence.startTime ? ` · ${formatTime(occurrence.startTime)}` : ""}`}
    >
      {/* On a phone a month cell is barely wide enough for the title, so the
          time is dropped rather than truncating both into uselessness. */}
      {!occurrence.allDay && occurrence.startTime && !continues ? (
        <span className="hidden shrink-0 tabular-nums opacity-70 sm:inline">
          {formatTime(occurrence.startTime).replace(":00", "")}
        </span>
      ) : null}
      <span className="min-w-0 truncate font-medium">
        {continues ? `… ${occurrence.title}` : occurrence.title}
      </span>
      {occurrence.members.length > 1 ? (
        <span className="ml-auto flex shrink-0 -space-x-1">
          {occurrence.members.slice(1, 4).map((member) => (
            <span
              key={member.id}
              className="h-2 w-2 rounded-full ring-1 ring-surface"
              style={{ background: colourHex(member.colour) }}
            />
          ))}
        </span>
      ) : null}
    </button>
  );
}

/** Index occurrences by every day they cover, so multi-day events appear throughout. */
export function groupByDay(
  occurrences: CalendarOccurrence[],
): Map<string, CalendarOccurrence[]> {
  const map = new Map<string, CalendarOccurrence[]>();
  for (const occurrence of occurrences) {
    for (const day of eachDay(occurrence.startDate, occurrence.endDate)) {
      const list = map.get(day) ?? [];
      list.push(occurrence);
      map.set(day, list);
    }
  }
  return map;
}
