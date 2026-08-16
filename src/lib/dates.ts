/**
 * Civil (wall-clock) date helpers.
 *
 * The whole app stores and reasons about dates as plain `YYYY-MM-DD` strings and
 * times as plain `HH:MM` strings — never as UTC instants. A family calendar is a
 * wall-clock calendar: "swimming at 16:30 every Tuesday" stays at 16:30 when the
 * clocks change, and "Dad's birthday" is a date, not a moment. Keeping everything
 * civil removes every timezone/DST trap from recurrence expansion.
 *
 * Internally we do arithmetic on UTC-based Date objects purely as a calendar
 * engine (Date.UTC never shifts), and format back to strings by hand.
 */

/** A calendar date, `YYYY-MM-DD`. */
export type ISODate = string;
/** A wall-clock time of day, `HH:MM` (24h). */
export type Time = string;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isISODate(value: unknown): value is ISODate {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  // Reject impossible dates like 2026-02-31 that would otherwise roll over.
  return toISODate(parseISODate(value)) === value;
}

export function isTime(value: unknown): value is Time {
  return typeof value === "string" && TIME_RE.test(value);
}

/** Parse `YYYY-MM-DD` into a UTC-anchored Date used only for arithmetic. */
export function parseISODate(date: ISODate): Date {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  return new Date(Date.UTC(year, month - 1, day));
}

export function toISODate(value: Date): ISODate {
  return value.toISOString().slice(0, 10);
}

export function makeISODate(year: number, month1: number, day: number): ISODate {
  return toISODate(new Date(Date.UTC(year, month1 - 1, day)));
}

/** Today's date in the given IANA timezone (defaults to the machine's). */
export function today(timeZone?: string): ISODate {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

/** Current wall-clock time in the given IANA timezone, as `HH:MM`. */
export function nowTime(timeZone?: string): Time {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

export function addDays(date: ISODate, days: number): ISODate {
  const value = parseISODate(date);
  value.setUTCDate(value.getUTCDate() + days);
  return toISODate(value);
}

/**
 * Add months, clamping to the end of the target month.
 * 2026-01-31 + 1 month => 2026-02-28. Used for *navigation*, not recurrence.
 */
export function addMonths(date: ISODate, months: number): ISODate {
  const value = parseISODate(date);
  const day = value.getUTCDate();
  value.setUTCDate(1);
  value.setUTCMonth(value.getUTCMonth() + months);
  const lastDay = daysInMonth(value.getUTCFullYear(), value.getUTCMonth() + 1);
  value.setUTCDate(Math.min(day, lastDay));
  return toISODate(value);
}

export function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

/** Whole days from `from` to `to` (negative if `to` is earlier). */
export function daysBetween(from: ISODate, to: ISODate): number {
  const ms = parseISODate(to).getTime() - parseISODate(from).getTime();
  return Math.round(ms / 86_400_000);
}

/** Day of week, 0 = Sunday … 6 = Saturday. */
export function weekday(date: ISODate): number {
  return parseISODate(date).getUTCDay();
}

/** Start of the week containing `date`. `weekStartsOn` defaults to Monday. */
export function startOfWeek(date: ISODate, weekStartsOn = 1): ISODate {
  const diff = (weekday(date) - weekStartsOn + 7) % 7;
  return addDays(date, -diff);
}

export function endOfWeek(date: ISODate, weekStartsOn = 1): ISODate {
  return addDays(startOfWeek(date, weekStartsOn), 6);
}

export function startOfMonth(date: ISODate): ISODate {
  return `${date.slice(0, 7)}-01`;
}

export function endOfMonth(date: ISODate): ISODate {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  return makeISODate(year, month, daysInMonth(year, month));
}

/** Every date from `from` to `to`, inclusive. */
export function eachDay(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Inclusive-range overlap test. */
export function rangesOverlap(
  aStart: ISODate,
  aEnd: ISODate,
  bStart: ISODate,
  bEnd: ISODate,
): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

/** Minutes since midnight, for laying out timed events on a day grid. */
export function minutesOfDay(time: Time): number {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}

export function timeFromMinutes(minutes: number): Time {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(minutes)));
  const hours = Math.floor(clamped / 60);
  const mins = clamped % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export function addMinutesToTime(time: Time, minutes: number): Time {
  return timeFromMinutes(minutesOfDay(time) + minutes);
}

// ---------------------------------------------------------------------------
// Display formatting (en-GB — this is a UK household app)
// ---------------------------------------------------------------------------

const WEEKDAYS_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const MONTHS_SHORT = MONTHS_LONG.map((m) => m.slice(0, 3));

export function weekdayName(date: ISODate, style: "long" | "short" = "long"): string {
  const names = style === "long" ? WEEKDAYS_LONG : WEEKDAYS_SHORT;
  return names[weekday(date)];
}

export function monthName(month1: number, style: "long" | "short" = "long"): string {
  return (style === "long" ? MONTHS_LONG : MONTHS_SHORT)[month1 - 1];
}

/** "Tue 3 Mar" / "Tuesday 3 March 2026" */
export function formatDate(
  date: ISODate,
  style: "short" | "medium" | "long" = "medium",
): string {
  const day = Number(date.slice(8, 10));
  const month = Number(date.slice(5, 7));
  const year = date.slice(0, 4);
  if (style === "short") return `${day} ${monthName(month, "short")}`;
  if (style === "long") {
    return `${weekdayName(date)} ${day} ${monthName(month)} ${year}`;
  }
  return `${weekdayName(date, "short")} ${day} ${monthName(month, "short")}`;
}

export function formatMonthYear(date: ISODate): string {
  return `${monthName(Number(date.slice(5, 7)))} ${date.slice(0, 4)}`;
}

/** "9:30am", "4pm", "12 noon" — friendlier than 24h for a household. */
export function formatTime(time: Time): string {
  const hours = Number(time.slice(0, 2));
  const minutes = time.slice(3, 5);
  if (hours === 12 && minutes === "00") return "12 noon";
  if (hours === 0 && minutes === "00") return "midnight";
  const suffix = hours < 12 ? "am" : "pm";
  const display = hours % 12 === 0 ? 12 : hours % 12;
  return minutes === "00" ? `${display}${suffix}` : `${display}:${minutes}${suffix}`;
}

/** "Today", "Tomorrow", "Yesterday", else a formatted date. */
export function formatRelativeDay(date: ISODate, reference: ISODate): string {
  const diff = daysBetween(reference, date);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return formatDate(date, "long");
}
