/**
 * Domain types shared by the server data layer and the client components.
 *
 * Kept free of any server-only import so a client component can describe the
 * data it renders without dragging the database into the browser bundle.
 */

import type { ISODate, Time } from "./dates";
import type { Recurrence } from "./recurrence";

export type Member = {
  id: string;
  name: string;
  colour: string;
  sortOrder: number;
};

export type CalendarEvent = {
  id: string;
  title: string;
  location: string | null;
  notes: string | null;
  startDate: ISODate;
  endDate: ISODate;
  allDay: boolean;
  startTime: Time | null;
  endTime: Time | null;
  recurrence: Recurrence | null;
  members: Member[];
};

export type CalendarOccurrence = CalendarEvent & {
  /** Stable identifier for this instance: `${eventId}:${occurrenceDate}`. */
  key: string;
  eventId: string;
  occurrenceDate: ISODate;
  /** The series' rule, carried along so the edit form can prefill its repeat picker. */
  recurrence: Recurrence | null;
  repeats: boolean;
  /** True when this instance has been edited away from the series. */
  edited: boolean;
};

/** How far an edit or deletion reaches within a repeating series. */
export type EditScope = "one" | "future" | "all";

/** Which calendar layout is on screen. */
export type CalendarView = "month" | "week" | "day";

export const CALENDAR_VIEWS: CalendarView[] = ["month", "week", "day"];

export function isCalendarView(value: unknown): value is CalendarView {
  return typeof value === "string" && (CALENDAR_VIEWS as string[]).includes(value);
}
