"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { type SaveState, removeEvent, saveEvent } from "@/app/calendar/actions";
import type { CalendarOccurrence, EditScope, Member } from "@/lib/calendar-types";
import { type Frequency, describeRecurrence } from "@/lib/recurrence";
import { addDays, weekday } from "@/lib/dates";
import { Avatar, FieldError, button, field, label, memberStyle } from "@/components/ui";

const EMPTY: SaveState = { errors: {} };

const WEEKDAY_LABELS = [
  { value: 1, label: "M", name: "Monday" },
  { value: 2, label: "T", name: "Tuesday" },
  { value: 3, label: "W", name: "Wednesday" },
  { value: 4, label: "T", name: "Thursday" },
  { value: 5, label: "F", name: "Friday" },
  { value: 6, label: "S", name: "Saturday" },
  { value: 0, label: "S", name: "Sunday" },
];

const REPEAT_OPTIONS: { value: Frequency | "none"; label: string }[] = [
  { value: "none", label: "Doesn't repeat" },
  { value: "daily", label: "Every day" },
  { value: "weekly", label: "Every week" },
  { value: "monthly", label: "Every month" },
  { value: "yearly", label: "Every year" },
];

const SCOPE_OPTIONS: { value: EditScope; label: string }[] = [
  { value: "one", label: "Just this one" },
  { value: "future", label: "This and all future" },
  { value: "all", label: "Every one in the series" },
];

export type DialogTarget =
  | { mode: "create"; date: string; startTime?: string | null }
  | { mode: "edit"; occurrence: CalendarOccurrence };

export function EventDialog({
  target,
  members,
  onClose,
}: {
  target: DialogTarget | null;
  members: Member[];
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (target && !dialog.open) dialog.showModal();
    if (!target && dialog.open) dialog.close();
  }, [target]);

  return (
    <dialog
      ref={dialogRef}
      // Esc and backdrop clicks must go through the same close path as the buttons.
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
      className="m-auto w-[min(34rem,calc(100vw-1.5rem))] rounded-2xl border border-line bg-surface p-0 text-ink shadow-pop backdrop:bg-black/40"
    >
      {target ? (
        // Remounting per target resets every field without manual syncing.
        <EventForm
          key={target.mode === "edit" ? target.occurrence.key : `new-${target.date}`}
          target={target}
          members={members}
          onClose={onClose}
        />
      ) : null}
    </dialog>
  );
}

function EventForm({
  target,
  members,
  onClose,
}: {
  target: DialogTarget;
  members: Member[];
  onClose: () => void;
}) {
  const formId = useId();
  const editing = target.mode === "edit";
  const occurrence = target.mode === "edit" ? target.occurrence : null;
  const isSeries = Boolean(occurrence?.repeats);

  const [saveState, saveAction, saving] = useActionState<SaveState, FormData>(saveEvent, EMPTY);
  const [deleteState, deleteAction, deleting] = useActionState<SaveState, FormData>(
    removeEvent,
    EMPTY,
  );

  const startDate = occurrence?.startDate ?? (target.mode === "create" ? target.date : "");
  const suggestedTime = target.mode === "create" ? (target.startTime ?? "09:00") : null;

  const [allDay, setAllDay] = useState(occurrence?.allDay ?? false);
  const [multiDay, setMultiDay] = useState(
    Boolean(occurrence && occurrence.endDate !== occurrence.startDate),
  );
  const [selectedMembers, setSelectedMembers] = useState<string[]>(
    occurrence?.members.map((m) => m.id) ?? [],
  );
  const [repeat, setRepeat] = useState<Frequency | "none">(
    occurrence?.recurrence?.freq ?? "none",
  );
  const [interval, setInterval] = useState(String(occurrence?.recurrence?.interval ?? 1));
  const [byWeekday, setByWeekday] = useState<number[]>(
    occurrence?.recurrence?.byWeekday ?? (startDate ? [weekday(startDate)] : []),
  );
  const [monthlyMode, setMonthlyMode] = useState(
    occurrence?.recurrence?.monthlyMode ?? "dayOfMonth",
  );
  const [repeatEnd, setRepeatEnd] = useState(occurrence?.recurrence?.end.type ?? "never");
  const [repeatUntil, setRepeatUntil] = useState(
    occurrence?.recurrence?.end.type === "onDate" ? occurrence.recurrence.end.date : "",
  );
  const [repeatCount, setRepeatCount] = useState(
    occurrence?.recurrence?.end.type === "afterCount"
      ? String(occurrence.recurrence.end.count)
      : "10",
  );
  const [scope, setScope] = useState<EditScope>("one");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Close only once the server has actually accepted the change.
  useEffect(() => {
    if (saveState.ok || deleteState.ok) onClose();
  }, [saveState.ok, deleteState.ok, onClose]);

  const errors = { ...deleteState.errors, ...saveState.errors };

  const previewRecurrence =
    repeat === "none"
      ? null
      : {
          freq: repeat,
          interval: Math.max(1, Number(interval) || 1),
          byWeekday: repeat === "weekly" ? byWeekday : undefined,
          monthlyMode: repeat === "monthly" ? (monthlyMode as "dayOfMonth" | "nthWeekday") : undefined,
          end:
            repeatEnd === "onDate" && repeatUntil
              ? ({ type: "onDate", date: repeatUntil } as const)
              : repeatEnd === "afterCount"
                ? ({ type: "afterCount", count: Math.max(1, Number(repeatCount) || 1) } as const)
                : ({ type: "never" } as const),
        };

  const toggle = (list: number[], value: number) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  return (
    <div className="flex max-h-[85dvh] flex-col">
      <header className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 className="text-base font-semibold text-ink">
          {editing ? "Edit event" : "New event"}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-2 py-1 text-sm text-muted transition-colors hover:bg-hover hover:text-ink"
        >
          Close
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        <form id={formId} action={saveAction} className="space-y-5">
          {occurrence ? (
            <>
              <input type="hidden" name="eventId" value={occurrence.eventId} />
              <input type="hidden" name="occurrenceDate" value={occurrence.occurrenceDate} />
            </>
          ) : null}
          <input type="hidden" name="scope" value={isSeries ? scope : "all"} />

          <div>
            <label className={label} htmlFor={`${formId}-title`}>
              What's happening?
            </label>
            <input
              id={`${formId}-title`}
              name="title"
              className={field}
              defaultValue={occurrence?.title ?? ""}
              placeholder="Swimming lesson"
              autoComplete="off"
              autoFocus
              maxLength={120}
            />
            <FieldError message={errors.title} />
          </div>

          {members.length > 0 ? (
            <fieldset>
              <legend className={label}>Who's it for?</legend>
              <div className="flex flex-wrap gap-2">
                {members.map((member) => {
                  const on = selectedMembers.includes(member.id);
                  return (
                    <button
                      key={member.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setSelectedMembers((current) =>
                          current.includes(member.id)
                            ? current.filter((id) => id !== member.id)
                            : [...current, member.id],
                        )
                      }
                      style={memberStyle(member.colour)}
                      className={`flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm transition-colors ${
                        on
                          ? "member-ring border-transparent bg-hover font-medium text-ink"
                          : "border-line text-muted hover:bg-hover"
                      }`}
                    >
                      <Avatar member={member} size="sm" />
                      {member.name}
                    </button>
                  );
                })}
              </div>
              {selectedMembers.map((id) => (
                <input key={id} type="hidden" name="memberIds" value={id} />
              ))}
              <p className="mt-2 text-xs text-faint">
                {selectedMembers.length === 0
                  ? "Nobody picked — this shows on everyone's calendar."
                  : "Only these people are highlighted."}
              </p>
            </fieldset>
          ) : null}

          <div className="space-y-3 rounded-xl border border-line bg-sunken/50 p-4">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  name="allDay"
                  checked={allDay}
                  onChange={(event) => setAllDay(event.target.checked)}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                All day
              </label>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={multiDay}
                  onChange={(event) => setMultiDay(event.target.checked)}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                Runs over several days
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted" htmlFor={`${formId}-startDate`}>
                  {multiDay ? "First day" : "Date"}
                </label>
                <input
                  id={`${formId}-startDate`}
                  type="date"
                  name="startDate"
                  className={field}
                  defaultValue={startDate}
                />
                <FieldError message={errors.startDate} />
              </div>

              {multiDay ? (
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted" htmlFor={`${formId}-endDate`}>
                    Last day
                  </label>
                  <input
                    id={`${formId}-endDate`}
                    type="date"
                    name="endDate"
                    className={field}
                    defaultValue={occurrence?.endDate ?? (startDate ? addDays(startDate, 1) : "")}
                  />
                  <FieldError message={errors.endDate} />
                </div>
              ) : null}

              {!allDay ? (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted" htmlFor={`${formId}-startTime`}>
                      From
                    </label>
                    <input
                      id={`${formId}-startTime`}
                      type="time"
                      name="startTime"
                      className={field}
                      defaultValue={occurrence?.startTime ?? suggestedTime ?? "09:00"}
                    />
                    <FieldError message={errors.startTime} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted" htmlFor={`${formId}-endTime`}>
                      Until
                    </label>
                    <input
                      id={`${formId}-endTime`}
                      type="time"
                      name="endTime"
                      className={field}
                      defaultValue={occurrence?.endTime ?? ""}
                    />
                    <FieldError message={errors.endTime} />
                  </div>
                </>
              ) : null}
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className={label} htmlFor={`${formId}-repeat`}>
                Repeat
              </label>
              <select
                id={`${formId}-repeat`}
                name="repeat"
                className={field}
                value={repeat}
                onChange={(event) => setRepeat(event.target.value as Frequency | "none")}
              >
                {REPEAT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {repeat !== "none" ? (
              <div className="space-y-3 rounded-xl border border-line bg-sunken/50 p-4">
                <div className="flex items-center gap-2 text-sm text-ink">
                  <span>Every</span>
                  <input
                    type="number"
                    name="interval"
                    min={1}
                    max={999}
                    value={interval}
                    onChange={(event) => setInterval(event.target.value)}
                    className="w-16 rounded-lg border border-line-strong bg-surface px-2 py-1.5 text-sm"
                  />
                  <span>
                    {repeat === "daily"
                      ? "day(s)"
                      : repeat === "weekly"
                        ? "week(s)"
                        : repeat === "monthly"
                          ? "month(s)"
                          : "year(s)"}
                  </span>
                </div>
                <FieldError message={errors.interval} />

                {repeat === "weekly" ? (
                  <div className="flex gap-1.5">
                    {WEEKDAY_LABELS.map((day) => {
                      const on = byWeekday.includes(day.value);
                      return (
                        <button
                          key={day.value}
                          type="button"
                          aria-pressed={on}
                          aria-label={day.name}
                          onClick={() => setByWeekday((current) => toggle(current, day.value))}
                          className={`h-9 w-9 rounded-full border text-sm transition-colors ${
                            on
                              ? "border-transparent bg-accent font-medium text-accent-ink"
                              : "border-line text-muted hover:bg-hover"
                          }`}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                {byWeekday.map((day) => (
                  <input key={day} type="hidden" name="byWeekday" value={day} />
                ))}

                {repeat === "monthly" && startDate ? (
                  <select
                    name="monthlyMode"
                    className={field}
                    value={monthlyMode}
                    onChange={(event) => setMonthlyMode(event.target.value as typeof monthlyMode)}
                  >
                    <option value="dayOfMonth">On the same date each month</option>
                    <option value="nthWeekday">On the same weekday each month</option>
                  </select>
                ) : null}

                <div className="grid gap-2 sm:grid-cols-2">
                  <select
                    name="repeatEnd"
                    className={field}
                    value={repeatEnd}
                    onChange={(event) => setRepeatEnd(event.target.value as typeof repeatEnd)}
                  >
                    <option value="never">Keep going forever</option>
                    <option value="onDate">Until a date</option>
                    <option value="afterCount">For a number of times</option>
                  </select>

                  {repeatEnd === "onDate" ? (
                    <input
                      type="date"
                      name="repeatUntil"
                      className={field}
                      value={repeatUntil}
                      onChange={(event) => setRepeatUntil(event.target.value)}
                    />
                  ) : null}
                  {repeatEnd === "afterCount" ? (
                    <input
                      type="number"
                      name="repeatCount"
                      min={1}
                      max={5000}
                      className={field}
                      value={repeatCount}
                      onChange={(event) => setRepeatCount(event.target.value)}
                    />
                  ) : null}
                </div>
                <FieldError message={errors.repeatUntil} />
                <FieldError message={errors.repeatCount} />

                {startDate ? (
                  <p className="text-xs text-faint">
                    {describeRecurrence(previewRecurrence, startDate)}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={label} htmlFor={`${formId}-location`}>
                Where <span className="font-normal text-faint">(optional)</span>
              </label>
              <input
                id={`${formId}-location`}
                name="location"
                className={field}
                defaultValue={occurrence?.location ?? ""}
                placeholder="Leisure centre"
                autoComplete="off"
                maxLength={200}
              />
            </div>
            <div>
              <label className={label} htmlFor={`${formId}-notes`}>
                Notes <span className="font-normal text-faint">(optional)</span>
              </label>
              <input
                id={`${formId}-notes`}
                name="notes"
                className={field}
                defaultValue={occurrence?.notes ?? ""}
                placeholder="Bring goggles"
                autoComplete="off"
                maxLength={2000}
              />
            </div>
          </div>

          {isSeries ? (
            <fieldset className="rounded-xl border border-line bg-sunken/50 p-4">
              <legend className="px-1 text-xs font-medium text-muted">
                This event repeats. Apply changes to:
              </legend>
              <div className="space-y-2">
                {SCOPE_OPTIONS.map((option) => (
                  <label key={option.value} className="flex items-center gap-2.5 text-sm text-ink">
                    <input
                      type="radio"
                      name="scopeChoice"
                      value={option.value}
                      checked={scope === option.value}
                      onChange={() => setScope(option.value)}
                      className="h-4 w-4 accent-[var(--accent)]"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          <FieldError message={errors.form} />
        </form>
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-line px-5 py-4">
        {editing ? (
          confirmingDelete ? (
            <form action={deleteAction} className="flex items-center gap-2">
              <input type="hidden" name="eventId" value={occurrence!.eventId} />
              <input type="hidden" name="occurrenceDate" value={occurrence!.occurrenceDate} />
              <input type="hidden" name="scope" value={isSeries ? scope : "all"} />
              <button type="submit" className={button.danger} disabled={deleting}>
                {deleting ? "Deleting…" : "Yes, delete"}
              </button>
              <button
                type="button"
                className={button.ghost}
                onClick={() => setConfirmingDelete(false)}
              >
                Keep it
              </button>
            </form>
          ) : (
            <button
              type="button"
              className={button.danger}
              onClick={() => setConfirmingDelete(true)}
            >
              Delete
            </button>
          )
        ) : (
          <span />
        )}

        <div className="flex items-center gap-2">
          <button type="button" className={button.secondary} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form={formId} className={button.primary} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </footer>
    </div>
  );
}
