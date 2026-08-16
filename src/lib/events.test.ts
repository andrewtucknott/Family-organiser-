import { beforeEach, describe, expect, it } from "vitest";
import { type DB, createTestDb, newId, nowIso } from "./db";
import { createMember, listMembers } from "./members";
import {
  type CalendarOccurrence,
  createEvent,
  deleteEvent,
  getOccurrence,
  listOccurrences,
  updateEvent,
} from "./events";
import { type EventInput } from "./event-input";
import { hashPin } from "./auth";

const HOUSEHOLD = "household-1";

let db: DB;

function seedHousehold(database: DB) {
  const { hash, salt } = hashPin("1234");
  database
    .prepare(
      `INSERT INTO households (id, name, pin_hash, pin_salt, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(HOUSEHOLD, "The Tucknotts", hash, salt, nowIso());
}

function input(overrides: Partial<EventInput> = {}): EventInput {
  return {
    title: "Swimming",
    location: null,
    notes: null,
    startDate: "2026-03-03",
    endDate: "2026-03-03",
    allDay: false,
    startTime: "16:30",
    endTime: "17:30",
    recurrence: null,
    memberIds: [],
    ...overrides,
  };
}

const weekly = { freq: "weekly", interval: 1, end: { type: "never" } } as const;

/**
 * The edit form is always pre-filled with the instance being edited, so a
 * single-occurrence edit carries that instance's own date. Mirroring that here
 * keeps these tests honest — passing the series' start date would legitimately
 * *move* the instance rather than leave it in place.
 */
function editOf(occurrenceDate: string, overrides: Partial<EventInput> = {}): EventInput {
  return input({ startDate: occurrenceDate, endDate: occurrenceDate, ...overrides });
}

const titlesOn = (from: string, to: string) =>
  listOccurrences(HOUSEHOLD, from, to, {}, db).map((o) => `${o.startDate} ${o.title}`);

const startDates = (from: string, to: string) =>
  listOccurrences(HOUSEHOLD, from, to, {}, db).map((o) => o.startDate);

beforeEach(() => {
  db = createTestDb();
  seedHousehold(db);
});

describe("createEvent / listOccurrences", () => {
  it("stores and returns a one-off event", () => {
    createEvent(HOUSEHOLD, input({ location: "Leisure Centre" }), null, db);
    const [occurrence] = listOccurrences(HOUSEHOLD, "2026-03-01", "2026-03-31", {}, db);
    expect(occurrence.title).toBe("Swimming");
    expect(occurrence.location).toBe("Leisure Centre");
    expect(occurrence.startTime).toBe("16:30");
    expect(occurrence.repeats).toBe(false);
  });

  it("expands a repeating event across the window", () => {
    createEvent(HOUSEHOLD, input({ recurrence: { ...weekly } }), null, db);
    expect(startDates("2026-03-01", "2026-03-31")).toEqual([
      "2026-03-03",
      "2026-03-10",
      "2026-03-17",
      "2026-03-24",
      "2026-03-31",
    ]);
  });

  it("keeps events out of a window they do not touch", () => {
    createEvent(HOUSEHOLD, input(), null, db);
    expect(startDates("2026-04-01", "2026-04-30")).toEqual([]);
  });

  it("orders all-day events before timed ones, then by time", () => {
    createEvent(HOUSEHOLD, input({ title: "Dentist", startTime: "09:00", endTime: "10:00" }), null, db);
    createEvent(HOUSEHOLD, input({ title: "Bank holiday", allDay: true, startTime: null, endTime: null }), null, db);
    createEvent(HOUSEHOLD, input({ title: "Swimming" }), null, db);
    expect(titlesOn("2026-03-03", "2026-03-03")).toEqual([
      "2026-03-03 Bank holiday",
      "2026-03-03 Dentist",
      "2026-03-03 Swimming",
    ]);
  });

  it("returns a multi-day event when the window only touches its middle", () => {
    createEvent(
      HOUSEHOLD,
      input({ title: "Half term", startDate: "2026-02-14", endDate: "2026-02-22", allDay: true, startTime: null, endTime: null }),
      null,
      db,
    );
    expect(titlesOn("2026-02-17", "2026-02-18")).toEqual(["2026-02-14 Half term"]);
  });
});

describe("member assignment", () => {
  let alice: string;
  let bob: string;

  beforeEach(() => {
    alice = createMember(HOUSEHOLD, "Alice", "rose", db).id;
    bob = createMember(HOUSEHOLD, "Bob", "sky", db).id;
  });

  it("attaches members to an event", () => {
    createEvent(HOUSEHOLD, input({ memberIds: [alice] }), null, db);
    const [occurrence] = listOccurrences(HOUSEHOLD, "2026-03-03", "2026-03-03", {}, db);
    expect(occurrence.members.map((m) => m.name)).toEqual(["Alice"]);
  });

  it("filters to the selected people", () => {
    createEvent(HOUSEHOLD, input({ title: "Alice only", memberIds: [alice] }), null, db);
    createEvent(HOUSEHOLD, input({ title: "Bob only", memberIds: [bob] }), null, db);
    const filtered = listOccurrences(HOUSEHOLD, "2026-03-03", "2026-03-03", { memberIds: [alice] }, db);
    expect(filtered.map((o) => o.title)).toEqual(["Alice only"]);
  });

  it("always shows events assigned to nobody — they belong to the whole family", () => {
    createEvent(HOUSEHOLD, input({ title: "Bin day", memberIds: [] }), null, db);
    createEvent(HOUSEHOLD, input({ title: "Bob only", memberIds: [bob] }), null, db);
    const filtered = listOccurrences(HOUSEHOLD, "2026-03-03", "2026-03-03", { memberIds: [alice] }, db);
    expect(filtered.map((o) => o.title)).toEqual(["Bin day"]);
  });

  it("keeps an archived member readable on their past events", () => {
    createEvent(HOUSEHOLD, input({ memberIds: [alice] }), null, db);
    db.prepare("UPDATE members SET archived = 1 WHERE id = ?").run(alice);
    expect(listMembers(HOUSEHOLD, db).map((m) => m.name)).toEqual(["Bob"]);
    const [occurrence] = listOccurrences(HOUSEHOLD, "2026-03-03", "2026-03-03", {}, db);
    expect(occurrence.members.map((m) => m.name)).toEqual(["Alice"]);
  });
});

describe("editing a single occurrence", () => {
  let eventId: string;

  beforeEach(() => {
    eventId = createEvent(HOUSEHOLD, input({ recurrence: { ...weekly } }), null, db);
  });

  it("changes only that instance", () => {
    updateEvent(
      HOUSEHOLD,
      eventId,
      editOf("2026-03-10", { title: "Swimming gala", recurrence: { ...weekly } }),
      "one",
      "2026-03-10",
      db,
    );
    expect(titlesOn("2026-03-01", "2026-03-17")).toEqual([
      "2026-03-03 Swimming",
      "2026-03-10 Swimming gala",
      "2026-03-17 Swimming",
    ]);
  });

  it("leaves untouched fields following the series", () => {
    updateEvent(
      HOUSEHOLD,
      eventId,
      editOf("2026-03-10", { title: "Swimming gala", recurrence: { ...weekly } }),
      "one",
      "2026-03-10",
      db,
    );
    // Renaming the series should still reach the un-overridden instances...
    updateEvent(HOUSEHOLD, eventId, input({ title: "Swim club", recurrence: { ...weekly } }), "all", null, db);
    expect(titlesOn("2026-03-01", "2026-03-17")).toEqual([
      "2026-03-03 Swim club",
      "2026-03-10 Swimming gala",
      "2026-03-17 Swim club",
    ]);
  });

  it("moves a single instance to a different day", () => {
    updateEvent(
      HOUSEHOLD,
      eventId,
      input({ startDate: "2026-03-11", endDate: "2026-03-11", recurrence: { ...weekly } }),
      "one",
      "2026-03-10",
      db,
    );
    expect(startDates("2026-03-01", "2026-03-17")).toEqual([
      "2026-03-03",
      "2026-03-11",
      "2026-03-17",
    ]);
  });

  it("changes who a single instance is for", () => {
    const alice = createMember(HOUSEHOLD, "Alice", "rose", db).id;
    const bob = createMember(HOUSEHOLD, "Bob", "sky", db).id;
    updateEvent(HOUSEHOLD, eventId, input({ memberIds: [alice], recurrence: { ...weekly } }), "all", null, db);
    updateEvent(
      HOUSEHOLD,
      eventId,
      editOf("2026-03-10", { memberIds: [bob], recurrence: { ...weekly } }),
      "one",
      "2026-03-10",
      db,
    );

    const found = listOccurrences(HOUSEHOLD, "2026-03-01", "2026-03-17", {}, db);
    expect(found.map((o) => o.members.map((m) => m.name).join(","))).toEqual([
      "Alice",
      "Bob",
      "Alice",
    ]);
  });

  it("marks the instance as edited", () => {
    updateEvent(
      HOUSEHOLD,
      eventId,
      editOf("2026-03-10", { title: "Gala", recurrence: { ...weekly } }),
      "one",
      "2026-03-10",
      db,
    );
    const found = listOccurrences(HOUSEHOLD, "2026-03-01", "2026-03-17", {}, db);
    expect(found.map((o) => o.edited)).toEqual([false, true, false]);
  });
});

describe("editing the whole series", () => {
  it("drops per-instance edits once the dates move, since they are keyed by date", () => {
    const eventId = createEvent(HOUSEHOLD, input({ recurrence: { ...weekly } }), null, db);
    updateEvent(HOUSEHOLD, eventId, editOf("2026-03-10", { title: "Gala", recurrence: { ...weekly } }), "one", "2026-03-10", db);

    updateEvent(
      HOUSEHOLD,
      eventId,
      input({ startDate: "2026-03-04", endDate: "2026-03-04", recurrence: { ...weekly } }),
      "all",
      null,
      db,
    );

    expect(titlesOn("2026-03-01", "2026-03-19")).toEqual([
      "2026-03-04 Swimming",
      "2026-03-11 Swimming",
      "2026-03-18 Swimming",
    ]);
  });

  it("applies to a one-off event whatever scope is requested", () => {
    const eventId = createEvent(HOUSEHOLD, input(), null, db);
    updateEvent(HOUSEHOLD, eventId, input({ title: "Dentist" }), "one", "2026-03-03", db);
    expect(titlesOn("2026-03-01", "2026-03-31")).toEqual(["2026-03-03 Dentist"]);
  });
});

describe("editing this and all future occurrences", () => {
  it("splits the series, leaving earlier instances alone", () => {
    const eventId = createEvent(HOUSEHOLD, input({ recurrence: { ...weekly } }), null, db);
    updateEvent(
      HOUSEHOLD,
      eventId,
      input({ title: "Swimming", startDate: "2026-03-17", endDate: "2026-03-17", startTime: "18:00", endTime: "19:00", recurrence: { ...weekly } }),
      "future",
      "2026-03-17",
      db,
    );

    const found = listOccurrences(HOUSEHOLD, "2026-03-01", "2026-03-31", {}, db);
    expect(found.map((o) => `${o.startDate} ${o.startTime}`)).toEqual([
      "2026-03-03 16:30",
      "2026-03-10 16:30",
      "2026-03-17 18:00",
      "2026-03-24 18:00",
      "2026-03-31 18:00",
    ]);
  });

  it("replaces the whole series when splitting at its first occurrence", () => {
    const eventId = createEvent(HOUSEHOLD, input({ recurrence: { ...weekly } }), null, db);
    updateEvent(
      HOUSEHOLD,
      eventId,
      input({ title: "Karate", recurrence: { ...weekly } }),
      "future",
      "2026-03-03",
      db,
    );
    expect(titlesOn("2026-03-01", "2026-03-17")).toEqual([
      "2026-03-03 Karate",
      "2026-03-10 Karate",
      "2026-03-17 Karate",
    ]);
    expect(db.prepare("SELECT COUNT(*) AS n FROM events").get()).toEqual({ n: 1 });
  });
});

describe("deleting", () => {
  let eventId: string;

  beforeEach(() => {
    eventId = createEvent(HOUSEHOLD, input({ recurrence: { ...weekly } }), null, db);
  });

  it("removes a single occurrence", () => {
    deleteEvent(HOUSEHOLD, eventId, "one", "2026-03-10", db);
    expect(startDates("2026-03-01", "2026-03-17")).toEqual(["2026-03-03", "2026-03-17"]);
  });

  it("removes this and all future occurrences", () => {
    deleteEvent(HOUSEHOLD, eventId, "future", "2026-03-17", db);
    expect(startDates("2026-03-01", "2026-04-30")).toEqual(["2026-03-03", "2026-03-10"]);
  });

  it("removes the whole series", () => {
    deleteEvent(HOUSEHOLD, eventId, "all", "2026-03-10", db);
    expect(startDates("2026-01-01", "2026-12-31")).toEqual([]);
  });

  it("removes the whole event when deleting future from the very first occurrence", () => {
    deleteEvent(HOUSEHOLD, eventId, "future", "2026-03-03", db);
    expect(startDates("2026-01-01", "2026-12-31")).toEqual([]);
  });

  it("cascades to members and overrides", () => {
    const alice = createMember(HOUSEHOLD, "Alice", "rose", db).id;
    updateEvent(HOUSEHOLD, eventId, input({ memberIds: [alice], recurrence: { ...weekly } }), "all", null, db);
    deleteEvent(HOUSEHOLD, eventId, "one", "2026-03-10", db);
    deleteEvent(HOUSEHOLD, eventId, "all", null, db);

    expect(db.prepare("SELECT COUNT(*) AS n FROM event_members").get()).toEqual({ n: 0 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM event_overrides").get()).toEqual({ n: 0 });
  });
});

describe("getOccurrence", () => {
  it("resolves an instance through its override", () => {
    const eventId = createEvent(HOUSEHOLD, input({ recurrence: { ...weekly } }), null, db);
    updateEvent(HOUSEHOLD, eventId, input({ title: "Gala", recurrence: { ...weekly } }), "one", "2026-03-10", db);

    const found = getOccurrence(HOUSEHOLD, eventId, "2026-03-10", db) as CalendarOccurrence;
    expect(found.title).toBe("Gala");
    expect(found.occurrenceDate).toBe("2026-03-10");
    expect(found.repeats).toBe(true);
  });

  it("still resolves an instance that has been cancelled", () => {
    const eventId = createEvent(HOUSEHOLD, input({ recurrence: { ...weekly } }), null, db);
    deleteEvent(HOUSEHOLD, eventId, "one", "2026-03-10", db);
    expect(getOccurrence(HOUSEHOLD, eventId, "2026-03-10", db)).not.toBeNull();
  });

  it("returns null for an unknown event or date", () => {
    const eventId = createEvent(HOUSEHOLD, input({ recurrence: { ...weekly } }), null, db);
    expect(getOccurrence(HOUSEHOLD, eventId, "2026-03-11", db)).toBeNull();
    expect(getOccurrence(HOUSEHOLD, newId(), "2026-03-10", db)).toBeNull();
  });
});

describe("household isolation", () => {
  const OTHER = "household-2";

  beforeEach(() => {
    const { hash, salt } = hashPin("9999");
    db.prepare(
      "INSERT INTO households (id, name, pin_hash, pin_salt, created_at) VALUES (?, ?, ?, ?, ?)",
    ).run(OTHER, "Someone else", hash, salt, nowIso());
  });

  it("never returns another household's events", () => {
    createEvent(OTHER, input({ title: "Not yours" }), null, db);
    expect(titlesOn("2026-01-01", "2026-12-31")).toEqual([]);
    expect(listOccurrences(OTHER, "2026-03-03", "2026-03-03", {}, db)).toHaveLength(1);
  });

  it("refuses to edit an event belonging to another household", () => {
    const eventId = createEvent(OTHER, input(), null, db);
    expect(() => updateEvent(HOUSEHOLD, eventId, input(), "all", null, db)).toThrow();
    expect(listOccurrences(OTHER, "2026-03-03", "2026-03-03", {}, db)[0].title).toBe("Swimming");
  });

  it("refuses to delete an event belonging to another household", () => {
    const eventId = createEvent(OTHER, input(), null, db);
    deleteEvent(HOUSEHOLD, eventId, "all", null, db);
    expect(listOccurrences(OTHER, "2026-03-03", "2026-03-03", {}, db)).toHaveLength(1);
  });

  it("ignores member ids that belong to another household", () => {
    const outsider = createMember(OTHER, "Stranger", "sky", db).id;
    const eventId = createEvent(HOUSEHOLD, input({ memberIds: [outsider] }), null, db);
    const [occurrence] = listOccurrences(HOUSEHOLD, "2026-03-03", "2026-03-03", {}, db);
    expect(occurrence.eventId).toBe(eventId);
    expect(occurrence.members).toEqual([]);
  });
});
