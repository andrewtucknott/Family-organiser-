/**
 * Turns raw form fields into a validated event, or into per-field error
 * messages. Pure — no database, no request context — so the rules are testable
 * on their own and the same rules serve both create and edit.
 */

import {
  type ISODate,
  type Time,
  addMinutesToTime,
  isISODate,
  isTime,
  minutesOfDay,
} from "./dates";
import { type Recurrence, parseRecurrence } from "./recurrence";

export type EventInput = {
  title: string;
  location: string | null;
  notes: string | null;
  startDate: ISODate;
  endDate: ISODate;
  allDay: boolean;
  startTime: Time | null;
  endTime: Time | null;
  recurrence: Recurrence | null;
  memberIds: string[];
};

export type FieldErrors = Record<string, string>;

export type ParseResult =
  | { ok: true; value: EventInput }
  | { ok: false; errors: FieldErrors };

/** Raw values as they arrive from a form — every field is optional and stringy. */
export type RawEventForm = {
  title?: string;
  location?: string;
  notes?: string;
  startDate?: string;
  endDate?: string;
  allDay?: string | boolean;
  startTime?: string;
  endTime?: string;
  repeat?: string;
  interval?: string;
  byWeekday?: string[];
  monthlyMode?: string;
  repeatEnd?: string;
  repeatUntil?: string;
  repeatCount?: string;
  memberIds?: string[];
};

const MAX_TITLE = 120;
const MAX_LOCATION = 200;
const MAX_NOTES = 2000;
const DEFAULT_DURATION_MINUTES = 60;

function text(value: string | undefined, max: number): string {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function multiline(value: string | undefined, max: number): string {
  return (value ?? "").trim().slice(0, max);
}

function isChecked(value: string | boolean | undefined): boolean {
  return value === true || value === "on" || value === "true" || value === "1";
}

export function parseEventForm(raw: RawEventForm): ParseResult {
  const errors: FieldErrors = {};

  const title = text(raw.title, MAX_TITLE);
  if (!title) errors.title = "Give the event a name.";

  const startDate = raw.startDate ?? "";
  if (!isISODate(startDate)) errors.startDate = "Choose a valid date.";

  const allDay = isChecked(raw.allDay);

  // An empty end date means a single-day event.
  const endDateRaw = (raw.endDate ?? "").trim();
  let endDate = endDateRaw || startDate;
  if (endDateRaw && !isISODate(endDateRaw)) {
    errors.endDate = "Choose a valid end date.";
  } else if (isISODate(startDate) && isISODate(endDate) && endDate < startDate) {
    errors.endDate = "The end date can't be before the start date.";
  }

  let startTime: Time | null = null;
  let endTime: Time | null = null;

  if (!allDay) {
    const rawStart = (raw.startTime ?? "").trim();
    const rawEnd = (raw.endTime ?? "").trim();

    if (!rawStart) {
      errors.startTime = "Choose a start time, or tick All day.";
    } else if (!isTime(rawStart)) {
      errors.startTime = "That isn't a valid time.";
    } else {
      startTime = rawStart;
    }

    if (rawEnd && !isTime(rawEnd)) {
      errors.endTime = "That isn't a valid time.";
    } else if (rawEnd) {
      endTime = rawEnd;
    } else if (startTime) {
      // Default to an hour, clamped so it can't spill past midnight.
      endTime = addMinutesToTime(startTime, DEFAULT_DURATION_MINUTES);
      if (minutesOfDay(endTime) <= minutesOfDay(startTime)) endTime = "23:59";
    }

    // Times only need ordering when the event begins and ends on the same day.
    if (
      startTime &&
      endTime &&
      isISODate(startDate) &&
      endDate === startDate &&
      minutesOfDay(endTime) < minutesOfDay(startTime)
    ) {
      errors.endTime = "The end time is before the start time.";
    }
  }

  const recurrenceResult = parseRepeatFields(raw, errors);

  const memberIds = [...new Set((raw.memberIds ?? []).filter((id) => id.trim()))];

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      title,
      location: text(raw.location, MAX_LOCATION) || null,
      notes: multiline(raw.notes, MAX_NOTES) || null,
      startDate,
      endDate,
      allDay,
      startTime: allDay ? null : startTime,
      endTime: allDay ? null : endTime,
      recurrence: recurrenceResult,
      memberIds,
    },
  };
}

function parseRepeatFields(raw: RawEventForm, errors: FieldErrors): Recurrence | null {
  const repeat = raw.repeat ?? "none";
  if (repeat === "none" || !repeat) return null;

  const interval = Number(raw.interval ?? 1);
  if (!Number.isInteger(interval) || interval < 1 || interval > 999) {
    errors.interval = "Repeat every 1 to 999.";
  }

  const end: Record<string, unknown> = { type: raw.repeatEnd ?? "never" };
  if (raw.repeatEnd === "onDate") {
    const until = (raw.repeatUntil ?? "").trim();
    if (!isISODate(until)) {
      errors.repeatUntil = "Choose a valid date to repeat until.";
    } else if (raw.startDate && until < raw.startDate) {
      errors.repeatUntil = "The repeat must end on or after the first date.";
    }
    end.date = until;
  } else if (raw.repeatEnd === "afterCount") {
    const count = Number(raw.repeatCount ?? 0);
    if (!Number.isInteger(count) || count < 1 || count > 5000) {
      errors.repeatCount = "Choose between 1 and 5000 times.";
    }
    end.count = count;
  }

  const recurrence = parseRecurrence({
    freq: repeat,
    interval,
    byWeekday: raw.byWeekday?.map(Number),
    monthlyMode: raw.monthlyMode,
    end,
  });

  if (!recurrence) errors.repeat = "That repeat pattern isn't supported.";
  return recurrence;
}

/** The last date a series can produce, or null if open-ended. Used to index events. */
export function recurrenceUntil(recurrence: Recurrence | null): ISODate | null {
  if (!recurrence) return null;
  return recurrence.end.type === "onDate" ? recurrence.end.date : null;
}

/** Collect repeated form values (checkboxes, multi-selects) from a FormData. */
export function formToRaw(form: FormData): RawEventForm {
  const single = (key: string) => {
    const value = form.get(key);
    return typeof value === "string" ? value : undefined;
  };
  const many = (key: string) =>
    form.getAll(key).filter((v): v is string => typeof v === "string");

  return {
    title: single("title"),
    location: single("location"),
    notes: single("notes"),
    startDate: single("startDate"),
    endDate: single("endDate"),
    allDay: single("allDay"),
    startTime: single("startTime"),
    endTime: single("endTime"),
    repeat: single("repeat"),
    interval: single("interval"),
    byWeekday: many("byWeekday"),
    monthlyMode: single("monthlyMode"),
    repeatEnd: single("repeatEnd"),
    repeatUntil: single("repeatUntil"),
    repeatCount: single("repeatCount"),
    memberIds: many("memberIds"),
  };
}
