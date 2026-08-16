import "server-only";
import { type DB, getDb, newId, nowIso } from "./db";
import { type ISODate, type Time, addDays } from "./dates";
import {
  type Occurrence,
  type OccurrenceOverride,
  type Recurrence,
  type Series,
  expandSeries,
  parseRecurrence,
} from "./recurrence";
import { type EventInput, recurrenceUntil } from "./event-input";
import type {
  CalendarEvent,
  CalendarOccurrence,
  EditScope,
  Member,
} from "./calendar-types";

/**
 * Reading and writing calendar events.
 *
 * Repeating events are stored once, as a rule, and expanded into occurrences at
 * read time. Editing or deleting a single instance writes a small override row
 * keyed by that instance's original date, so "cancel this Tuesday's swimming"
 * costs one row rather than rewriting the series.
 */

export type {
  CalendarEvent,
  CalendarOccurrence,
  EditScope,
} from "./calendar-types";

type EventRow = {
  id: string;
  title: string;
  location: string | null;
  notes: string | null;
  start_date: string;
  end_date: string;
  all_day: number;
  start_time: string | null;
  end_time: string | null;
  recurrence: string | null;
};

type OverrideRow = {
  event_id: string;
  occurrence_date: string;
  cancelled: number;
  title: string | null;
  location: string | null;
  notes: string | null;
  start_date: string | null;
  end_date: string | null;
  all_day: number | null;
  start_time: string | null;
  end_time: string | null;
  member_ids: string | null;
};

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

/** Every member including archived ones — past events should still read properly. */
function memberLookup(householdId: string, db: DB): Map<string, Member> {
  const rows = db
    .prepare<[string], { id: string; name: string; colour: string; sort_order: number }>(
      "SELECT id, name, colour, sort_order FROM members WHERE household_id = ?",
    )
    .all(householdId);
  return new Map(
    rows.map((r) => [
      r.id,
      { id: r.id, name: r.name, colour: r.colour, sortOrder: r.sort_order },
    ]),
  );
}

function placeholders(count: number): string {
  return new Array(count).fill("?").join(", ");
}

function membersByEvent(eventIds: string[], lookup: Map<string, Member>, db: DB) {
  const result = new Map<string, Member[]>();
  if (eventIds.length === 0) return result;

  const rows = db
    .prepare<string[], { event_id: string; member_id: string }>(
      `SELECT event_id, member_id FROM event_members WHERE event_id IN (${placeholders(eventIds.length)})`,
    )
    .all(...eventIds);

  for (const row of rows) {
    const member = lookup.get(row.member_id);
    if (!member) continue;
    const list = result.get(row.event_id) ?? [];
    list.push(member);
    result.set(row.event_id, list);
  }
  for (const list of result.values()) list.sort((a, b) => a.sortOrder - b.sortOrder);
  return result;
}

function overridesByEvent(eventIds: string[], db: DB) {
  const result = new Map<string, OverrideRow[]>();
  if (eventIds.length === 0) return result;

  const rows = db
    .prepare<string[], OverrideRow>(
      `SELECT * FROM event_overrides WHERE event_id IN (${placeholders(eventIds.length)})`,
    )
    .all(...eventIds);

  for (const row of rows) {
    const list = result.get(row.event_id) ?? [];
    list.push(row);
    result.set(row.event_id, list);
  }
  return result;
}

function toTimingOverride(row: OverrideRow): OccurrenceOverride {
  return {
    occurrenceDate: row.occurrence_date,
    cancelled: row.cancelled === 1,
    startDate: row.start_date,
    endDate: row.end_date,
    allDay: row.all_day === null ? null : row.all_day === 1,
    startTime: row.start_time,
    endTime: row.end_time,
    title: row.title,
    location: row.location,
    notes: row.notes,
  };
}

function parseMemberIds(json: string | null): string[] | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : null;
  } catch {
    return null;
  }
}

function buildOccurrence(
  row: EventRow,
  occurrence: Occurrence,
  seriesMembers: Member[],
  overrideRow: OverrideRow | undefined,
  lookup: Map<string, Member>,
): CalendarOccurrence {
  const overriddenMemberIds = overrideRow ? parseMemberIds(overrideRow.member_ids) : null;
  const members = overriddenMemberIds
    ? overriddenMemberIds
        .map((id) => lookup.get(id))
        .filter((m): m is Member => Boolean(m))
        .sort((a, b) => a.sortOrder - b.sortOrder)
    : seriesMembers;

  return {
    key: `${row.id}:${occurrence.occurrenceDate}`,
    eventId: row.id,
    occurrenceDate: occurrence.occurrenceDate,
    id: row.id,
    title: overrideRow?.title ?? row.title,
    location: overrideRow?.location ?? row.location,
    notes: overrideRow?.notes ?? row.notes,
    startDate: occurrence.startDate,
    endDate: occurrence.endDate,
    allDay: occurrence.allDay,
    startTime: occurrence.startTime,
    endTime: occurrence.endTime,
    members,
    recurrence: parseRecurrence(row.recurrence),
    repeats: row.recurrence !== null,
    edited: overrideRow ? overrideRow.cancelled === 0 : false,
  };
}

/**
 * Every occurrence touching `from`..`to` (inclusive), in chronological order.
 * Passing `memberIds` narrows to those people; events assigned to nobody belong
 * to the whole family and always show.
 */
export function listOccurrences(
  householdId: string,
  from: ISODate,
  to: ISODate,
  options: { memberIds?: string[] } = {},
  db: DB = getDb(),
): CalendarOccurrence[] {
  const rows = db
    .prepare<[string, string, string, string, string, string, string], EventRow>(
      `SELECT id, title, location, notes, start_date, end_date, all_day,
              start_time, end_time, recurrence
         FROM events
        WHERE household_id = ?
          AND (
            -- one-off events overlapping the window
            (recurrence IS NULL AND end_date >= ? AND start_date <= ?)
            -- repeating series that started before the window and may still run
            OR (recurrence IS NOT NULL AND start_date <= ?
                AND (recurrence_until IS NULL OR recurrence_until >= ?))
            -- an instance dragged into the window by a "just this one" edit
            OR EXISTS (
                 SELECT 1 FROM event_overrides o
                  WHERE o.event_id = events.id AND o.cancelled = 0
                    AND o.start_date IS NOT NULL
                    AND o.start_date <= ?
                    AND COALESCE(o.end_date, o.start_date) >= ?
               )
          )`,
    )
    .all(householdId, from, to, to, from, to, from);

  if (rows.length === 0) return [];

  const lookup = memberLookup(householdId, db);
  const eventIds = rows.map((r) => r.id);
  const members = membersByEvent(eventIds, lookup, db);
  const overrides = overridesByEvent(eventIds, db);

  const filter = options.memberIds?.length ? new Set(options.memberIds) : null;
  const results: CalendarOccurrence[] = [];

  for (const row of rows) {
    const eventOverrides = overrides.get(row.id) ?? [];
    const series: Series = {
      startDate: row.start_date,
      endDate: row.end_date,
      allDay: row.all_day === 1,
      startTime: row.start_time,
      endTime: row.end_time,
      recurrence: parseRecurrence(row.recurrence),
      overrides: eventOverrides.map(toTimingOverride),
    };
    const overrideByDate = new Map(eventOverrides.map((o) => [o.occurrence_date, o]));
    const seriesMembers = members.get(row.id) ?? [];

    for (const occurrence of expandSeries(series, from, to)) {
      const built = buildOccurrence(
        row,
        occurrence,
        seriesMembers,
        overrideByDate.get(occurrence.occurrenceDate),
        lookup,
      );
      // Unassigned events belong to everyone, so they survive every filter.
      if (filter && built.members.length > 0 && !built.members.some((m) => filter.has(m.id))) {
        continue;
      }
      results.push(built);
    }
  }

  return results.sort(compareOccurrences);
}

/** All-day events first, then by start time, then alphabetically. */
function compareOccurrences(a: CalendarOccurrence, b: CalendarOccurrence): number {
  if (a.startDate !== b.startDate) return a.startDate < b.startDate ? -1 : 1;
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  const timeDiff = (a.startTime ?? "").localeCompare(b.startTime ?? "");
  if (timeDiff !== 0) return timeDiff;
  return a.title.localeCompare(b.title);
}

export function getEvent(
  householdId: string,
  eventId: string,
  db: DB = getDb(),
): CalendarEvent | null {
  const row = db
    .prepare<[string, string], EventRow>(
      `SELECT id, title, location, notes, start_date, end_date, all_day,
              start_time, end_time, recurrence
         FROM events WHERE id = ? AND household_id = ?`,
    )
    .get(eventId, householdId);
  if (!row) return null;

  const lookup = memberLookup(householdId, db);
  return {
    id: row.id,
    title: row.title,
    location: row.location,
    notes: row.notes,
    startDate: row.start_date,
    endDate: row.end_date,
    allDay: row.all_day === 1,
    startTime: row.start_time,
    endTime: row.end_time,
    recurrence: parseRecurrence(row.recurrence),
    members: membersByEvent([row.id], lookup, db).get(row.id) ?? [],
  };
}

/** A single instance, resolved through any override — what the edit form loads. */
export function getOccurrence(
  householdId: string,
  eventId: string,
  occurrenceDate: ISODate,
  db: DB = getDb(),
): CalendarOccurrence | null {
  const event = getEvent(householdId, eventId, db);
  if (!event) return null;

  const overrideRows = overridesByEvent([eventId], db).get(eventId) ?? [];
  const series: Series = {
    startDate: event.startDate,
    endDate: event.endDate,
    allDay: event.allDay,
    startTime: event.startTime,
    endTime: event.endTime,
    recurrence: event.recurrence,
    // Ignore cancellations here: an edit form asked for a specific instance
    // should still render it rather than 404 on a race with a deletion.
    overrides: overrideRows.map(toTimingOverride).map((o) => ({ ...o, cancelled: false })),
  };

  const row: EventRow = {
    id: event.id,
    title: event.title,
    location: event.location,
    notes: event.notes,
    start_date: event.startDate,
    end_date: event.endDate,
    all_day: event.allDay ? 1 : 0,
    start_time: event.startTime,
    end_time: event.endTime,
    recurrence: event.recurrence ? JSON.stringify(event.recurrence) : null,
  };

  // Expand a window wide enough to contain the requested instance wherever it moved.
  const window = expandSeries(series, addDays(occurrenceDate, -400), addDays(occurrenceDate, 400));
  const match = window.find((o) => o.occurrenceDate === occurrenceDate);
  if (!match) return null;

  const lookup = memberLookup(householdId, db);
  return buildOccurrence(
    row,
    match,
    event.members,
    overrideRows.find((o) => o.occurrence_date === occurrenceDate),
    lookup,
  );
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

function writeMembers(eventId: string, memberIds: string[], db: DB): void {
  db.prepare("DELETE FROM event_members WHERE event_id = ?").run(eventId);
  const insert = db.prepare(
    "INSERT OR IGNORE INTO event_members (event_id, member_id) VALUES (?, ?)",
  );
  for (const memberId of memberIds) insert.run(eventId, memberId);
}

export function createEvent(
  householdId: string,
  input: EventInput,
  createdBy: string | null,
  db: DB = getDb(),
): string {
  const id = newId();
  const now = nowIso();

  db.transaction(() => {
    db.prepare(
      `INSERT INTO events (id, household_id, title, location, notes, start_date, end_date,
                           all_day, start_time, end_time, recurrence, recurrence_until,
                           created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      householdId,
      input.title,
      input.location,
      input.notes,
      input.startDate,
      input.endDate,
      input.allDay ? 1 : 0,
      input.startTime,
      input.endTime,
      input.recurrence ? JSON.stringify(input.recurrence) : null,
      recurrenceUntil(input.recurrence),
      createdBy,
      now,
      now,
    );
    writeMembers(id, input.memberIds, db);
  })();

  return id;
}

/** Overrides are keyed by date, so they stop meaning anything if the dates move. */
function patternChanged(before: CalendarEvent, after: EventInput): boolean {
  return (
    before.startDate !== after.startDate ||
    JSON.stringify(before.recurrence) !== JSON.stringify(after.recurrence)
  );
}

function updateSeriesRow(eventId: string, input: EventInput, db: DB): void {
  db.prepare(
    `UPDATE events
        SET title = ?, location = ?, notes = ?, start_date = ?, end_date = ?,
            all_day = ?, start_time = ?, end_time = ?, recurrence = ?,
            recurrence_until = ?, updated_at = ?
      WHERE id = ?`,
  ).run(
    input.title,
    input.location,
    input.notes,
    input.startDate,
    input.endDate,
    input.allDay ? 1 : 0,
    input.startTime,
    input.endTime,
    input.recurrence ? JSON.stringify(input.recurrence) : null,
    recurrenceUntil(input.recurrence),
    nowIso(),
    eventId,
  );
}

/** Only store what actually differs, so unedited fields keep following the series. */
function writeOverride(
  eventId: string,
  occurrenceDate: ISODate,
  base: CalendarOccurrence,
  input: EventInput,
  db: DB,
): void {
  const differs = <T>(a: T, b: T) => (a === b ? null : b);
  const baseMemberIds = base.members.map((m) => m.id).sort();
  const inputMemberIds = [...input.memberIds].sort();
  const membersDiffer =
    baseMemberIds.length !== inputMemberIds.length ||
    baseMemberIds.some((id, i) => id !== inputMemberIds[i]);

  db.prepare(
    `INSERT INTO event_overrides
       (event_id, occurrence_date, cancelled, title, location, notes,
        start_date, end_date, all_day, start_time, end_time, member_ids)
     VALUES (?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(event_id, occurrence_date) DO UPDATE SET
       cancelled = 0, title = excluded.title, location = excluded.location,
       notes = excluded.notes, start_date = excluded.start_date,
       end_date = excluded.end_date, all_day = excluded.all_day,
       start_time = excluded.start_time, end_time = excluded.end_time,
       member_ids = excluded.member_ids`,
  ).run(
    eventId,
    occurrenceDate,
    differs(base.title, input.title),
    differs(base.location, input.location),
    differs(base.notes, input.notes),
    differs(base.startDate, input.startDate),
    differs(base.endDate, input.endDate),
    base.allDay === input.allDay ? null : input.allDay ? 1 : 0,
    differs(base.startTime, input.startTime),
    differs(base.endTime, input.endTime),
    membersDiffer ? JSON.stringify(input.memberIds) : null,
  );
}

/**
 * Apply an edit at the requested scope.
 *
 *  - `one`    writes an override for that instance only.
 *  - `future` truncates the series the day before, then starts a new one.
 *  - `all`    rewrites the series; per-instance edits are dropped only if the
 *             dates moved, since they are keyed by date.
 */
export function updateEvent(
  householdId: string,
  eventId: string,
  input: EventInput,
  scope: EditScope,
  occurrenceDate: ISODate | null,
  db: DB = getDb(),
): void {
  const existing = getEvent(householdId, eventId, db);
  if (!existing) throw new Error("That event no longer exists.");

  // Scoped edits only mean something for a repeating series.
  const effectiveScope: EditScope = existing.recurrence && occurrenceDate ? scope : "all";

  if (effectiveScope === "all") {
    db.transaction(() => {
      if (patternChanged(existing, input)) {
        db.prepare("DELETE FROM event_overrides WHERE event_id = ?").run(eventId);
      }
      updateSeriesRow(eventId, input, db);
      writeMembers(eventId, input.memberIds, db);
    })();
    return;
  }

  if (effectiveScope === "one") {
    const base = getOccurrence(householdId, eventId, occurrenceDate!, db);
    if (!base) throw new Error("That occurrence no longer exists.");
    db.transaction(() => writeOverride(eventId, occurrenceDate!, base, input, db))();
    return;
  }

  // "This and all future" — split the series in two.
  db.transaction(() => {
    const splitDate = occurrenceDate!;
    const newId = createEvent(householdId, input, null, db);

    // Carry across any per-instance edits at or after the split point.
    db.prepare(
      "UPDATE event_overrides SET event_id = ? WHERE event_id = ? AND occurrence_date >= ?",
    ).run(newId, eventId, splitDate);

    if (splitDate <= existing.startDate) {
      // The split covers the whole series, so the original has nothing left.
      db.prepare("DELETE FROM events WHERE id = ?").run(eventId);
      return;
    }

    const truncated: Recurrence | null = existing.recurrence
      ? { ...existing.recurrence, end: { type: "onDate", date: addDays(splitDate, -1) } }
      : null;
    db.prepare(
      "UPDATE events SET recurrence = ?, recurrence_until = ?, updated_at = ? WHERE id = ?",
    ).run(
      truncated ? JSON.stringify(truncated) : null,
      recurrenceUntil(truncated),
      nowIso(),
      eventId,
    );
  })();
}

export function deleteEvent(
  householdId: string,
  eventId: string,
  scope: EditScope,
  occurrenceDate: ISODate | null,
  db: DB = getDb(),
): void {
  const existing = getEvent(householdId, eventId, db);
  if (!existing) return;

  const effectiveScope: EditScope = existing.recurrence && occurrenceDate ? scope : "all";

  if (effectiveScope === "all") {
    db.prepare("DELETE FROM events WHERE id = ? AND household_id = ?").run(eventId, householdId);
    return;
  }

  if (effectiveScope === "one") {
    db.prepare(
      `INSERT INTO event_overrides (event_id, occurrence_date, cancelled)
       VALUES (?, ?, 1)
       ON CONFLICT(event_id, occurrence_date) DO UPDATE SET cancelled = 1`,
    ).run(eventId, occurrenceDate!);
    return;
  }

  // Cancel this instance and everything after it.
  db.transaction(() => {
    const splitDate = occurrenceDate!;
    if (splitDate <= existing.startDate) {
      db.prepare("DELETE FROM events WHERE id = ?").run(eventId);
      return;
    }
    db.prepare("DELETE FROM event_overrides WHERE event_id = ? AND occurrence_date >= ?").run(
      eventId,
      splitDate,
    );
    const truncated: Recurrence = {
      ...existing.recurrence!,
      end: { type: "onDate", date: addDays(splitDate, -1) },
    };
    db.prepare(
      "UPDATE events SET recurrence = ?, recurrence_until = ?, updated_at = ? WHERE id = ?",
    ).run(JSON.stringify(truncated), recurrenceUntil(truncated), nowIso(), eventId);
  })();
}
