"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CalendarOccurrence, CalendarView, Member } from "@/lib/calendar-types";
import {
  addDays,
  addMonths,
  formatDate,
  formatMonthYear,
  formatRelativeDay,
  minutesOfDay,
} from "@/lib/dates";
import { Avatar, EmptyState, button, memberStyle } from "@/components/ui";
import { MonthView } from "./MonthView";
import { TimeGrid } from "./TimeGrid";
import { AgendaList } from "./AgendaList";
import { type DialogTarget, EventDialog } from "./EventDialog";

const VIEW_LABELS: Record<CalendarView, string> = {
  month: "Month",
  week: "Week",
  day: "Day",
};

export function CalendarShell({
  view,
  date,
  today,
  nowTime,
  rangeStart,
  rangeEnd,
  members,
  selectedMemberIds,
  occurrences,
  householdName,
  currentMember,
}: {
  view: CalendarView;
  date: string;
  today: string;
  nowTime: string;
  rangeStart: string;
  rangeEnd: string;
  members: Member[];
  selectedMemberIds: string[];
  occurrences: CalendarOccurrence[];
  householdName: string;
  currentMember: Member | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [target, setTarget] = useState<DialogTarget | null>(null);

  const go = useCallback(
    (next: { view?: CalendarView; date?: string; who?: string[] }) => {
      const params = new URLSearchParams();
      params.set("view", next.view ?? view);
      params.set("date", next.date ?? date);
      const who = next.who ?? selectedMemberIds;
      if (who.length > 0) params.set("who", who.join(","));
      startTransition(() => router.push(`/calendar?${params}`, { scroll: false }));
    },
    [router, view, date, selectedMemberIds],
  );

  const step = (direction: 1 | -1) => {
    const next =
      view === "month"
        ? addMonths(date, direction)
        : addDays(date, direction * (view === "week" ? 7 : 1));
    go({ date: next });
  };

  const toggleMember = (memberId: string) => {
    const next = selectedMemberIds.includes(memberId)
      ? selectedMemberIds.filter((id) => id !== memberId)
      : [...selectedMemberIds, memberId];
    go({ who: next });
  };

  const heading =
    view === "month"
      ? formatMonthYear(date)
      : view === "day"
        ? formatRelativeDay(date, today)
        : `${formatDate(rangeStart, "short")} – ${formatDate(rangeEnd, "short")}`;

  const nowMinutes = useMemo(
    () => (today >= rangeStart && today <= rangeEnd ? minutesOfDay(nowTime) : null),
    [today, rangeStart, rangeEnd, nowTime],
  );

  const openEvent = useCallback(
    (occurrence: CalendarOccurrence) => setTarget({ mode: "edit", occurrence }),
    [],
  );
  const closeDialog = useCallback(() => setTarget(null), []);

  return (
    <div className="mx-auto max-w-6xl px-3 pb-16 sm:px-5">
      <header className="flex flex-wrap items-center gap-3 py-4">
        <div className="mr-auto">
          <h1 className="text-lg font-semibold tracking-tight text-ink sm:text-xl">{heading}</h1>
          <p className="text-xs text-muted">{householdName}</p>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => step(-1)}
            className={button.ghost}
            aria-label="Previous"
          >
            ‹
          </button>
          <button type="button" onClick={() => go({ date: today })} className={button.ghost}>
            Today
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            className={button.ghost}
            aria-label="Next"
          >
            ›
          </button>
        </div>

        <div
          role="tablist"
          aria-label="Calendar view"
          className="flex rounded-lg border border-line bg-surface p-0.5"
        >
          {(Object.keys(VIEW_LABELS) as CalendarView[]).map((option) => (
            <button
              key={option}
              role="tab"
              aria-selected={view === option}
              type="button"
              onClick={() => go({ view: option })}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                view === option
                  ? "bg-accent text-accent-ink"
                  : "text-muted hover:bg-hover hover:text-ink"
              }`}
            >
              {VIEW_LABELS[option]}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setTarget({ mode: "create", date: view === "month" ? today : date })}
          className={button.primary}
        >
          + Add
        </button>
      </header>

      {members.length > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {members.map((member) => {
            const on = selectedMemberIds.includes(member.id);
            return (
              <button
                key={member.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggleMember(member.id)}
                style={memberStyle(member.colour)}
                className={`flex items-center gap-1.5 rounded-full border py-1 pr-3 pl-1 text-sm transition-colors ${
                  on
                    ? "member-ring border-transparent bg-surface font-medium text-ink"
                    : "border-line text-muted hover:bg-hover"
                }`}
              >
                <Avatar member={member} size="sm" />
                {member.name}
              </button>
            );
          })}
          {selectedMemberIds.length > 0 ? (
            <button
              type="button"
              onClick={() => go({ who: [] })}
              className="text-sm text-muted underline-offset-2 hover:text-ink hover:underline"
            >
              Show everyone
            </button>
          ) : null}
        </div>
      ) : null}

      <div className={pending ? "opacity-60 transition-opacity" : "transition-opacity"}>
        {view === "month" ? (
          <MonthView
            month={date}
            today={today}
            occurrences={occurrences}
            onSelectDay={(day) => go({ view: "day", date: day })}
            onSelectEvent={openEvent}
            onAddOn={(day) => setTarget({ mode: "create", date: day })}
          />
        ) : (
          <div className={view === "week" ? "overflow-x-auto" : ""}>
            <div className={view === "week" ? "min-w-[44rem]" : ""}>
              <TimeGrid
                from={rangeStart}
                to={rangeEnd}
                today={today}
                nowMinutes={nowMinutes}
                occurrences={occurrences}
                onSelectEvent={openEvent}
                onAddAt={(day, time) => setTarget({ mode: "create", date: day, startTime: time })}
                onSelectDay={(day) => go({ view: "day", date: day })}
              />
            </div>
          </div>
        )}
      </div>

      {view === "day" ? (
        <section className="mt-4">
          <h2 className="mb-2 text-sm font-medium text-muted">
            Everything on {formatDate(date, "long")}
          </h2>
          {occurrences.length > 0 ? (
            <AgendaList occurrences={occurrences} onSelectEvent={openEvent} />
          ) : (
            <div className="rounded-xl border border-line bg-surface">
              <EmptyState
                title="Nothing planned"
                hint="Tap a time above, or use Add, to put something in."
              />
            </div>
          )}
        </section>
      ) : null}

      <EventDialog target={target} members={members} onClose={closeDialog} />

      {currentMember ? (
        <p className="mt-8 text-center text-xs text-faint">
          Signed in as {currentMember.name} ·{" "}
          <a href="/settings" className="underline underline-offset-2 hover:text-muted">
            Settings
          </a>
        </p>
      ) : (
        <p className="mt-8 text-center text-xs text-faint">
          <a href="/settings" className="underline underline-offset-2 hover:text-muted">
            Settings
          </a>
        </p>
      )}
    </div>
  );
}
