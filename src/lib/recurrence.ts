/**
 * Recurring-event expansion.
 *
 * A deliberately small subset of RFC 5545 — the part families actually use:
 * daily / weekly / monthly / yearly, an interval, weekly by-weekday, monthly by
 * date or by nth-weekday, and an end of never / on-date / after-N.
 *
 * Everything works on civil dates (see ./dates), so DST never enters into it.
 * Occurrences are generated in *blocks* (one block per period) and each block
 * can be jumped to directly, so rendering March 2027 of a daily event that
 * started in 2019 costs a handful of iterations, not three thousand.
 */

import {
  type ISODate,
  type Time,
  addDays,
  daysBetween,
  daysInMonth,
  formatDate,
  makeISODate,
  startOfWeek,
  weekday,
} from "./dates";

export type Frequency = "daily" | "weekly" | "monthly" | "yearly";

export type RecurrenceEnd =
  | { type: "never" }
  | { type: "onDate"; date: ISODate }
  | { type: "afterCount"; count: number };

export type Recurrence = {
  freq: Frequency;
  /** Repeat every N periods. Always >= 1. */
  interval: number;
  /** Weekly only. 0 = Sunday … 6 = Saturday. Defaults to the series start's weekday. */
  byWeekday?: number[];
  /** Monthly only. Same date each month, or same weekday-of-month (e.g. 3rd Tuesday). */
  monthlyMode?: "dayOfMonth" | "nthWeekday";
  end: RecurrenceEnd;
};

/** A per-occurrence edit: "just this one", or "delete just this one". */
export type OccurrenceOverride = {
  /** The *original* start date of the occurrence being overridden — the stable key. */
  occurrenceDate: ISODate;
  cancelled: boolean;
  startDate?: ISODate | null;
  endDate?: ISODate | null;
  allDay?: boolean | null;
  startTime?: Time | null;
  endTime?: Time | null;
  title?: string | null;
  location?: string | null;
  notes?: string | null;
};

export type Timing = {
  startDate: ISODate;
  /** Inclusive. Equal to startDate for a single-day event. */
  endDate: ISODate;
  allDay: boolean;
  startTime: Time | null;
  endTime: Time | null;
};

export type Series = Timing & {
  recurrence: Recurrence | null;
  overrides?: OccurrenceOverride[];
};

export type Occurrence = Timing & {
  /** Original start date of this occurrence — stable across "just this one" edits. */
  occurrenceDate: ISODate;
  override: OccurrenceOverride | null;
};

/** Hard ceilings so a pathological series can never hang a request. */
const MAX_BLOCKS = 20_000;
const MAX_COUNT = 5_000;

// ---------------------------------------------------------------------------
// Parsing / normalising
// ---------------------------------------------------------------------------

const FREQUENCIES: Frequency[] = ["daily", "weekly", "monthly", "yearly"];

/** Coerce untrusted input (form data, DB JSON) into a safe Recurrence, or null. */
export function parseRecurrence(input: unknown): Recurrence | null {
  if (input == null) return null;
  let raw: unknown = input;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === "null") return null;
    try {
      raw = JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  if (typeof raw !== "object" || raw === null) return null;

  const source = raw as Record<string, unknown>;
  const freq = FREQUENCIES.find((f) => f === source.freq);
  if (!freq) return null;

  const interval = Math.min(
    Math.max(Math.trunc(Number(source.interval) || 1), 1),
    999,
  );

  const recurrence: Recurrence = { freq, interval, end: { type: "never" } };

  if (freq === "weekly" && Array.isArray(source.byWeekday)) {
    const days = source.byWeekday
      .map((d) => Math.trunc(Number(d)))
      .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
    const unique = [...new Set(days)].sort((a, b) => a - b);
    if (unique.length > 0) recurrence.byWeekday = unique;
  }

  if (freq === "monthly") {
    recurrence.monthlyMode =
      source.monthlyMode === "nthWeekday" ? "nthWeekday" : "dayOfMonth";
  }

  const end = source.end as Record<string, unknown> | undefined;
  if (end && typeof end === "object") {
    if (end.type === "onDate" && typeof end.date === "string") {
      recurrence.end = { type: "onDate", date: end.date };
    } else if (end.type === "afterCount") {
      const count = Math.trunc(Number(end.count));
      if (Number.isInteger(count) && count >= 1) {
        recurrence.end = { type: "afterCount", count: Math.min(count, MAX_COUNT) };
      }
    }
  }

  return recurrence;
}

// ---------------------------------------------------------------------------
// Block generation
// ---------------------------------------------------------------------------

/** The candidate start dates produced by block `index` (may be empty if skipped). */
function blockDates(start: ISODate, recurrence: Recurrence, index: number): ISODate[] {
  const { freq, interval } = recurrence;

  if (freq === "daily") {
    return [addDays(start, index * interval)];
  }

  if (freq === "weekly") {
    const anchor = startOfWeek(start);
    const weekStart = addDays(anchor, index * interval * 7);
    const days = recurrence.byWeekday?.length
      ? recurrence.byWeekday
      : [weekday(start)];
    // Order days by their position within a Monday-first week.
    return days
      .map((day) => addDays(weekStart, (day - 1 + 7) % 7))
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }

  const startYear = Number(start.slice(0, 4));
  const startMonth = Number(start.slice(5, 7));
  const startDay = Number(start.slice(8, 10));

  if (freq === "monthly") {
    const monthsFromStart = index * interval;
    const absolute = startYear * 12 + (startMonth - 1) + monthsFromStart;
    const year = Math.floor(absolute / 12);
    const month = (absolute % 12) + 1;

    if (recurrence.monthlyMode === "nthWeekday") {
      const nth = Math.ceil(startDay / 7); // 1st..5th occurrence of that weekday
      const targetWeekday = weekday(start);
      const firstOfMonth = makeISODate(year, month, 1);
      const offset = (targetWeekday - weekday(firstOfMonth) + 7) % 7;
      const day = 1 + offset + (nth - 1) * 7;
      // A 5th Tuesday simply doesn't exist in most months — skip, don't fudge.
      return day <= daysInMonth(year, month) ? [makeISODate(year, month, day)] : [];
    }

    // Same date each month. The 31st skips short months (RFC 5545 behaviour),
    // rather than silently landing on the 28th.
    return startDay <= daysInMonth(year, month)
      ? [makeISODate(year, month, startDay)]
      : [];
  }

  // yearly — 29 February skips non-leap years.
  const year = startYear + index * interval;
  return startDay <= daysInMonth(year, startMonth)
    ? [makeISODate(year, startMonth, startDay)]
    : [];
}

/**
 * Smallest block index that could contain a date >= `minDate`.
 * Always errs low (never skips a real occurrence); the caller filters exactly.
 */
function firstBlockOnOrAfter(
  start: ISODate,
  recurrence: Recurrence,
  minDate: ISODate,
): number {
  if (minDate <= start) return 0;
  const { freq, interval } = recurrence;

  if (freq === "daily") {
    return Math.max(0, Math.floor(daysBetween(start, minDate) / interval));
  }
  if (freq === "weekly") {
    const weeks = Math.floor(
      daysBetween(startOfWeek(start), startOfWeek(minDate)) / 7,
    );
    return Math.max(0, Math.floor(weeks / interval));
  }

  const startYear = Number(start.slice(0, 4));
  const minYear = Number(minDate.slice(0, 4));

  if (freq === "monthly") {
    const months =
      (minYear - startYear) * 12 +
      (Number(minDate.slice(5, 7)) - Number(start.slice(5, 7)));
    return Math.max(0, Math.floor(months / interval));
  }
  return Math.max(0, Math.floor((minYear - startYear) / interval));
}

// ---------------------------------------------------------------------------
// Expansion
// ---------------------------------------------------------------------------

function applyOverride(occurrence: Occurrence, override: OccurrenceOverride): Occurrence {
  const allDay = override.allDay ?? occurrence.allDay;
  const startDate = override.startDate ?? occurrence.startDate;
  // Moving an occurrence keeps its length unless the end is overridden too.
  const endDate =
    override.endDate ??
    addDays(startDate, daysBetween(occurrence.startDate, occurrence.endDate));
  return {
    ...occurrence,
    allDay,
    startDate,
    endDate: endDate < startDate ? startDate : endDate,
    startTime: allDay ? null : (override.startTime ?? occurrence.startTime),
    endTime: allDay ? null : (override.endTime ?? occurrence.endTime),
    override,
  };
}

/**
 * Every occurrence of `series` that touches `rangeStart`..`rangeEnd` (inclusive),
 * in chronological order. Cancelled occurrences are omitted; occurrences moved
 * *into* the range by a "just this one" edit are included.
 */
export function expandSeries(
  series: Series,
  rangeStart: ISODate,
  rangeEnd: ISODate,
): Occurrence[] {
  const durationDays = Math.max(0, daysBetween(series.startDate, series.endDate));
  const overrides = new Map(
    (series.overrides ?? []).map((o) => [o.occurrenceDate, o]),
  );

  const base = (occurrenceDate: ISODate): Occurrence => ({
    occurrenceDate,
    startDate: occurrenceDate,
    endDate: addDays(occurrenceDate, durationDays),
    allDay: series.allDay,
    startTime: series.allDay ? null : series.startTime,
    endTime: series.allDay ? null : series.endTime,
    override: null,
  });

  const results: Occurrence[] = [];
  const seen = new Set<ISODate>();
  const push = (occurrenceDate: ISODate) => {
    if (seen.has(occurrenceDate)) return;
    seen.add(occurrenceDate);
    const override = overrides.get(occurrenceDate);
    if (override?.cancelled) return;
    const occurrence = override
      ? applyOverride(base(occurrenceDate), override)
      : base(occurrenceDate);
    // Filter on the *effective* dates so moved occurrences land correctly.
    if (occurrence.startDate <= rangeEnd && occurrence.endDate >= rangeStart) {
      results.push(occurrence);
    }
  };

  // Non-recurring: a single occurrence.
  if (!series.recurrence) {
    push(series.startDate);
    return results;
  }

  const recurrence = series.recurrence;
  const counted = recurrence.end.type === "afterCount";
  const limit = counted ? (recurrence.end as { count: number }).count : Infinity;
  // A multi-day occurrence starting before the range can still overlap it.
  const earliestStart = addDays(rangeStart, -durationDays);
  const lastAllowedStart =
    recurrence.end.type === "onDate"
      ? (recurrence.end.date < rangeEnd ? recurrence.end.date : rangeEnd)
      : rangeEnd;

  // Counting from the start is only necessary when the series ends after N.
  let index = counted ? 0 : firstBlockOnOrAfter(series.startDate, recurrence, earliestStart);
  let produced = 0;
  let blocks = 0;

  while (blocks < MAX_BLOCKS && produced < limit) {
    blocks += 1;
    const dates = blockDates(series.startDate, recurrence, index);
    index += 1;

    // An empty block (skipped 31st, missing 5th Tuesday) tells us nothing about
    // whether we have run past the end, so probe ahead rather than stopping.
    if (dates.length === 0) continue;

    let pastEnd = true;
    for (const date of dates) {
      if (date < series.startDate) continue; // partial first week
      if (date > lastAllowedStart) continue;
      pastEnd = false;
      produced += 1;
      // A cancelled occurrence still consumes a slot of an "after N times" series.
      push(date);
      if (produced >= limit) break;
    }

    // Stop once every date in the block is beyond the window we care about.
    if (pastEnd && dates[dates.length - 1] > lastAllowedStart) break;
  }

  // A "just this one" edit can drag an occurrence into this range from a date
  // the scan above never visited (e.g. June's swimming lesson moved to March).
  for (const override of overrides.values()) {
    if (override.cancelled || seen.has(override.occurrenceDate)) continue;
    push(override.occurrenceDate);
  }

  // "Just this one" edits can move an occurrence earlier than its slot, so the
  // generated order is not guaranteed to be the displayed order.
  results.sort((a, b) =>
    a.startDate === b.startDate
      ? (a.startTime ?? "").localeCompare(b.startTime ?? "")
      : a.startDate < b.startDate
        ? -1
        : 1,
  );
  return results;
}

// ---------------------------------------------------------------------------
// Human-readable description
// ---------------------------------------------------------------------------

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ORDINALS = ["first", "second", "third", "fourth", "fifth"];

function ordinal(n: number): string {
  const suffix =
    n % 100 >= 11 && n % 100 <= 13
      ? "th"
      : n % 10 === 1
        ? "st"
        : n % 10 === 2
          ? "nd"
          : n % 10 === 3
            ? "rd"
            : "th";
  return `${n}${suffix}`;
}

function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** "Every Tuesday and Thursday, until 3 Mar 2027" — shown under the repeat picker. */
export function describeRecurrence(
  recurrence: Recurrence | null,
  startDate: ISODate,
): string {
  if (!recurrence) return "Does not repeat";
  const { freq, interval } = recurrence;
  const every = interval === 1 ? "Every" : `Every ${ordinal(interval)}`;
  let main: string;

  if (freq === "daily") {
    main = interval === 1 ? "Every day" : `Every ${interval} days`;
  } else if (freq === "weekly") {
    const days = (recurrence.byWeekday?.length
      ? recurrence.byWeekday
      : [weekday(startDate)]
    ).map((d) => DAY_NAMES[d]);
    main = interval === 1
      ? `Every ${listNames(days)}`
      : `Every ${interval} weeks on ${listNames(days)}`;
  } else if (freq === "monthly") {
    if (recurrence.monthlyMode === "nthWeekday") {
      const nth = ORDINALS[Math.ceil(Number(startDate.slice(8, 10)) / 7) - 1] ?? "last";
      main = `${every} month on the ${nth} ${DAY_NAMES[weekday(startDate)]}`;
    } else {
      main = `${every} month on the ${ordinal(Number(startDate.slice(8, 10)))}`;
    }
  } else {
    main = `${every} year on ${formatDate(startDate, "short")}`;
  }

  if (recurrence.end.type === "onDate") {
    return `${main}, until ${formatDate(recurrence.end.date, "short")} ${recurrence.end.date.slice(0, 4)}`;
  }
  if (recurrence.end.type === "afterCount") {
    return `${main}, ${recurrence.end.count} times`;
  }
  return main;
}
