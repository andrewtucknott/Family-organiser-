import { describe, expect, it } from "vitest";
import { type RawEventForm, parseEventForm, recurrenceUntil } from "./event-input";

function form(overrides: RawEventForm = {}): RawEventForm {
  return {
    title: "Swimming",
    startDate: "2026-03-03",
    startTime: "16:30",
    ...overrides,
  };
}

function expectOk(raw: RawEventForm) {
  const result = parseEventForm(raw);
  if (!result.ok) throw new Error(`expected success, got ${JSON.stringify(result.errors)}`);
  return result.value;
}

function expectErrors(raw: RawEventForm) {
  const result = parseEventForm(raw);
  if (result.ok) throw new Error("expected validation to fail");
  return result.errors;
}

describe("parseEventForm — basics", () => {
  it("accepts a minimal timed event and defaults the end to an hour later", () => {
    const value = expectOk(form());
    expect(value.title).toBe("Swimming");
    expect(value.startTime).toBe("16:30");
    expect(value.endTime).toBe("17:30");
    expect(value.endDate).toBe("2026-03-03");
    expect(value.recurrence).toBeNull();
  });

  it("requires a title", () => {
    expect(expectErrors(form({ title: "   " }))).toHaveProperty("title");
  });

  it("tidies whitespace and trims over-long text", () => {
    const value = expectOk(form({ title: "  Swimming    lesson  ", location: " Leisure  Centre " }));
    expect(value.title).toBe("Swimming lesson");
    expect(value.location).toBe("Leisure Centre");
  });

  it("stores empty optional text as null", () => {
    const value = expectOk(form({ location: "", notes: "  " }));
    expect(value.location).toBeNull();
    expect(value.notes).toBeNull();
  });

  it("rejects an invalid or impossible date", () => {
    expect(expectErrors(form({ startDate: "tomorrow" }))).toHaveProperty("startDate");
    expect(expectErrors(form({ startDate: "2026-02-30" }))).toHaveProperty("startDate");
  });
});

describe("parseEventForm — times", () => {
  it("requires a start time unless the event is all day", () => {
    expect(expectErrors(form({ startTime: "" }))).toHaveProperty("startTime");
    const allDay = expectOk(form({ startTime: "", allDay: "on" }));
    expect(allDay.allDay).toBe(true);
    expect(allDay.startTime).toBeNull();
  });

  it("discards times on an all-day event", () => {
    const value = expectOk(form({ allDay: "on", startTime: "16:30", endTime: "17:30" }));
    expect(value.startTime).toBeNull();
    expect(value.endTime).toBeNull();
  });

  it("rejects an end time before the start on the same day", () => {
    expect(expectErrors(form({ startTime: "16:30", endTime: "09:00" }))).toHaveProperty("endTime");
  });

  it("allows an end time before the start when the event spans days", () => {
    const value = expectOk(
      form({ startTime: "20:00", endTime: "02:00", endDate: "2026-03-04" }),
    );
    expect(value.endTime).toBe("02:00");
    expect(value.endDate).toBe("2026-03-04");
  });

  it("clamps the default end time rather than spilling past midnight", () => {
    expect(expectOk(form({ startTime: "23:30" })).endTime).toBe("23:59");
  });

  it("rejects a malformed time", () => {
    expect(expectErrors(form({ startTime: "16.30" }))).toHaveProperty("startTime");
    expect(expectErrors(form({ startTime: "25:00" }))).toHaveProperty("startTime");
  });
});

describe("parseEventForm — dates", () => {
  it("rejects an end date before the start date", () => {
    expect(expectErrors(form({ endDate: "2026-03-01" }))).toHaveProperty("endDate");
  });

  it("treats a blank end date as a single day", () => {
    expect(expectOk(form({ endDate: "" })).endDate).toBe("2026-03-03");
  });
});

describe("parseEventForm — repeats", () => {
  it("builds a weekly recurrence from the repeat fields", () => {
    const value = expectOk(
      form({ repeat: "weekly", interval: "2", byWeekday: ["2", "4"], repeatEnd: "never" }),
    );
    expect(value.recurrence).toEqual({
      freq: "weekly",
      interval: 2,
      byWeekday: [2, 4],
      end: { type: "never" },
    });
  });

  it("builds a bounded recurrence", () => {
    const value = expectOk(
      form({ repeat: "weekly", interval: "1", repeatEnd: "onDate", repeatUntil: "2026-07-20" }),
    );
    expect(value.recurrence?.end).toEqual({ type: "onDate", date: "2026-07-20" });
  });

  it("rejects a repeat-until before the first date", () => {
    expect(
      expectErrors(
        form({ repeat: "weekly", interval: "1", repeatEnd: "onDate", repeatUntil: "2026-01-01" }),
      ),
    ).toHaveProperty("repeatUntil");
  });

  it("rejects a nonsensical interval or count", () => {
    expect(expectErrors(form({ repeat: "daily", interval: "0" }))).toHaveProperty("interval");
    expect(
      expectErrors(form({ repeat: "daily", interval: "1", repeatEnd: "afterCount", repeatCount: "0" })),
    ).toHaveProperty("repeatCount");
  });

  it("ignores repeat detail when the event does not repeat", () => {
    expect(expectOk(form({ repeat: "none", interval: "0" })).recurrence).toBeNull();
  });
});

describe("parseEventForm — members", () => {
  it("de-duplicates and drops blank member ids", () => {
    const value = expectOk(form({ memberIds: ["a", "b", "a", " "] }));
    expect(value.memberIds).toEqual(["a", "b"]);
  });

  it("allows an event with nobody assigned — it belongs to the whole family", () => {
    expect(expectOk(form()).memberIds).toEqual([]);
  });
});

describe("parseEventForm — error reporting", () => {
  it("reports every bad field at once rather than one at a time", () => {
    const errors = expectErrors({ title: "", startDate: "nope", startTime: "" });
    expect(Object.keys(errors).sort()).toEqual(["startDate", "startTime", "title"]);
  });
});

describe("recurrenceUntil", () => {
  it("returns the bound only for date-bounded series", () => {
    expect(recurrenceUntil(null)).toBeNull();
    expect(
      recurrenceUntil({ freq: "daily", interval: 1, end: { type: "never" } }),
    ).toBeNull();
    expect(
      recurrenceUntil({ freq: "daily", interval: 1, end: { type: "afterCount", count: 5 } }),
    ).toBeNull();
    expect(
      recurrenceUntil({ freq: "daily", interval: 1, end: { type: "onDate", date: "2026-09-01" } }),
    ).toBe("2026-09-01");
  });
});
