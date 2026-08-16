import { describe, expect, it } from "vitest";
import {
  type Recurrence,
  type Series,
  describeRecurrence,
  expandSeries,
  parseRecurrence,
} from "./recurrence";

/** Build a single-day timed series, with sensible defaults. */
function series(overrides: Partial<Series> = {}): Series {
  const startDate = overrides.startDate ?? "2026-03-03";
  return {
    startDate,
    endDate: overrides.endDate ?? startDate,
    allDay: overrides.allDay ?? false,
    startTime: overrides.startTime ?? "16:30",
    endTime: overrides.endTime ?? "17:30",
    recurrence: overrides.recurrence ?? null,
    overrides: overrides.overrides,
  };
}

const dates = (s: Series, from: string, to: string) =>
  expandSeries(s, from, to).map((o) => o.startDate);

describe("expandSeries — non-recurring", () => {
  it("returns the single occurrence when it falls in range", () => {
    expect(dates(series(), "2026-03-01", "2026-03-31")).toEqual(["2026-03-03"]);
  });

  it("returns nothing when out of range", () => {
    expect(dates(series(), "2026-04-01", "2026-04-30")).toEqual([]);
  });

  it("includes a multi-day event overlapping the range from before it", () => {
    const holiday = series({
      startDate: "2026-03-28",
      endDate: "2026-04-06",
      allDay: true,
    });
    expect(dates(holiday, "2026-04-01", "2026-04-30")).toEqual(["2026-03-28"]);
  });
});

describe("expandSeries — daily", () => {
  const daily = (interval: number): Recurrence => ({
    freq: "daily",
    interval,
    end: { type: "never" },
  });

  it("repeats every day", () => {
    expect(dates(series({ recurrence: daily(1) }), "2026-03-03", "2026-03-06")).toEqual([
      "2026-03-03",
      "2026-03-04",
      "2026-03-05",
      "2026-03-06",
    ]);
  });

  it("honours an interval", () => {
    expect(dates(series({ recurrence: daily(3) }), "2026-03-01", "2026-03-14")).toEqual([
      "2026-03-03",
      "2026-03-06",
      "2026-03-09",
      "2026-03-12",
    ]);
  });

  it("never produces occurrences before the series starts", () => {
    expect(dates(series({ recurrence: daily(1) }), "2026-01-01", "2026-03-04")).toEqual([
      "2026-03-03",
      "2026-03-04",
    ]);
  });

  it("jumps far-future ranges without iterating every day", () => {
    const s = series({ startDate: "2019-01-01", recurrence: daily(1) });
    expect(dates(s, "2027-03-01", "2027-03-03")).toEqual([
      "2027-03-01",
      "2027-03-02",
      "2027-03-03",
    ]);
  });

  it("keeps interval phase when jumping ahead", () => {
    // Every 7 days from 2026-03-03 lands on Tuesdays.
    const s = series({ startDate: "2026-03-03", recurrence: daily(7) });
    expect(dates(s, "2027-03-01", "2027-03-31")).toEqual([
      "2027-03-02",
      "2027-03-09",
      "2027-03-16",
      "2027-03-23",
      "2027-03-30",
    ]);
  });
});

describe("expandSeries — weekly", () => {
  it("repeats on the start weekday by default", () => {
    // 2026-03-03 is a Tuesday.
    const s = series({
      recurrence: { freq: "weekly", interval: 1, end: { type: "never" } },
    });
    expect(dates(s, "2026-03-01", "2026-03-31")).toEqual([
      "2026-03-03",
      "2026-03-10",
      "2026-03-17",
      "2026-03-24",
      "2026-03-31",
    ]);
  });

  it("supports multiple weekdays in chronological order", () => {
    const s = series({
      recurrence: {
        freq: "weekly",
        interval: 1,
        byWeekday: [2, 4], // Tuesday, Thursday
        end: { type: "never" },
      },
    });
    expect(dates(s, "2026-03-01", "2026-03-14")).toEqual([
      "2026-03-03",
      "2026-03-05",
      "2026-03-10",
      "2026-03-12",
    ]);
  });

  it("skips days earlier in the starting week than the series start", () => {
    // Starts Thursday, repeats Mon+Thu: the Monday before the start is excluded.
    const s = series({
      startDate: "2026-03-05",
      recurrence: {
        freq: "weekly",
        interval: 1,
        byWeekday: [1, 4],
        end: { type: "never" },
      },
    });
    expect(dates(s, "2026-03-01", "2026-03-12")).toEqual([
      "2026-03-05",
      "2026-03-09",
      "2026-03-12",
    ]);
  });

  it("handles Sunday correctly in a Monday-first week", () => {
    const s = series({
      startDate: "2026-03-01", // a Sunday
      recurrence: {
        freq: "weekly",
        interval: 1,
        byWeekday: [0, 6], // Sunday and Saturday
        end: { type: "never" },
      },
    });
    expect(dates(s, "2026-03-01", "2026-03-15")).toEqual([
      "2026-03-01",
      "2026-03-07",
      "2026-03-08",
      "2026-03-14",
      "2026-03-15",
    ]);
  });

  it("honours a fortnightly interval", () => {
    const s = series({
      recurrence: { freq: "weekly", interval: 2, end: { type: "never" } },
    });
    expect(dates(s, "2026-03-01", "2026-04-30")).toEqual([
      "2026-03-03",
      "2026-03-17",
      "2026-03-31",
      "2026-04-14",
      "2026-04-28",
    ]);
  });

  it("keeps fortnightly phase when jumping to a distant range", () => {
    const s = series({ startDate: "2026-01-06", recurrence: { freq: "weekly", interval: 2, end: { type: "never" } } });
    const all = dates(s, "2026-01-06", "2026-12-31");
    const jumped = dates(s, "2026-11-01", "2026-12-31");
    expect(jumped).toEqual(all.filter((d) => d >= "2026-11-01"));
  });
});

describe("expandSeries — monthly", () => {
  it("repeats on the same date", () => {
    const s = series({
      startDate: "2026-03-15",
      recurrence: {
        freq: "monthly",
        interval: 1,
        monthlyMode: "dayOfMonth",
        end: { type: "never" },
      },
    });
    expect(dates(s, "2026-03-01", "2026-06-30")).toEqual([
      "2026-03-15",
      "2026-04-15",
      "2026-05-15",
      "2026-06-15",
    ]);
  });

  it("skips months without the 31st rather than sliding to the 28th", () => {
    const s = series({
      startDate: "2026-01-31",
      recurrence: {
        freq: "monthly",
        interval: 1,
        monthlyMode: "dayOfMonth",
        end: { type: "never" },
      },
    });
    expect(dates(s, "2026-01-01", "2026-06-30")).toEqual([
      "2026-01-31",
      "2026-03-31",
      "2026-05-31",
    ]);
  });

  it("repeats on the nth weekday of the month", () => {
    // 2026-03-10 is the second Tuesday of March.
    const s = series({
      startDate: "2026-03-10",
      recurrence: {
        freq: "monthly",
        interval: 1,
        monthlyMode: "nthWeekday",
        end: { type: "never" },
      },
    });
    expect(dates(s, "2026-03-01", "2026-06-30")).toEqual([
      "2026-03-10",
      "2026-04-14",
      "2026-05-12",
      "2026-06-09",
    ]);
  });

  it("skips months lacking a fifth weekday", () => {
    // 2026-01-31 is the fifth Saturday of January.
    const s = series({
      startDate: "2026-01-31",
      recurrence: {
        freq: "monthly",
        interval: 1,
        monthlyMode: "nthWeekday",
        end: { type: "never" },
      },
    });
    expect(dates(s, "2026-01-01", "2026-08-31")).toEqual([
      "2026-01-31",
      "2026-05-30",
      "2026-08-29",
    ]);
  });
});

describe("expandSeries — yearly", () => {
  it("repeats annually", () => {
    const s = series({
      startDate: "2026-03-03",
      allDay: true,
      recurrence: { freq: "yearly", interval: 1, end: { type: "never" } },
    });
    expect(dates(s, "2028-01-01", "2028-12-31")).toEqual(["2028-03-03"]);
  });

  it("skips 29 February in non-leap years", () => {
    const s = series({
      startDate: "2024-02-29",
      allDay: true,
      recurrence: { freq: "yearly", interval: 1, end: { type: "never" } },
    });
    expect(dates(s, "2024-01-01", "2032-12-31")).toEqual([
      "2024-02-29",
      "2028-02-29",
      "2032-02-29",
    ]);
  });
});

describe("expandSeries — end conditions", () => {
  it("stops on the end date, inclusive", () => {
    const s = series({
      recurrence: {
        freq: "weekly",
        interval: 1,
        end: { type: "onDate", date: "2026-03-17" },
      },
    });
    expect(dates(s, "2026-03-01", "2026-04-30")).toEqual([
      "2026-03-03",
      "2026-03-10",
      "2026-03-17",
    ]);
  });

  it("stops after N occurrences", () => {
    const s = series({
      recurrence: {
        freq: "weekly",
        interval: 1,
        end: { type: "afterCount", count: 3 },
      },
    });
    expect(dates(s, "2026-03-01", "2026-12-31")).toEqual([
      "2026-03-03",
      "2026-03-10",
      "2026-03-17",
    ]);
  });

  it("counts from the series start even when the range starts later", () => {
    const s = series({
      recurrence: {
        freq: "weekly",
        interval: 1,
        end: { type: "afterCount", count: 3 },
      },
    });
    expect(dates(s, "2026-03-09", "2026-12-31")).toEqual(["2026-03-10", "2026-03-17"]);
  });

  it("counts cancelled occurrences toward the total, as iCalendar does", () => {
    const s = series({
      recurrence: {
        freq: "weekly",
        interval: 1,
        end: { type: "afterCount", count: 3 },
      },
      overrides: [{ occurrenceDate: "2026-03-10", cancelled: true }],
    });
    expect(dates(s, "2026-03-01", "2026-12-31")).toEqual(["2026-03-03", "2026-03-17"]);
  });
});

describe("expandSeries — per-occurrence overrides", () => {
  const weekly: Recurrence = { freq: "weekly", interval: 1, end: { type: "never" } };

  it("omits a cancelled occurrence", () => {
    const s = series({
      recurrence: weekly,
      overrides: [{ occurrenceDate: "2026-03-10", cancelled: true }],
    });
    expect(dates(s, "2026-03-01", "2026-03-24")).toEqual([
      "2026-03-03",
      "2026-03-17",
      "2026-03-24",
    ]);
  });

  it("moves a single occurrence to another date", () => {
    const s = series({
      recurrence: weekly,
      overrides: [
        { occurrenceDate: "2026-03-10", cancelled: false, startDate: "2026-03-11" },
      ],
    });
    expect(dates(s, "2026-03-01", "2026-03-17")).toEqual([
      "2026-03-03",
      "2026-03-11",
      "2026-03-17",
    ]);
  });

  it("keeps the occurrence's original date as its stable key", () => {
    const s = series({
      recurrence: weekly,
      overrides: [
        { occurrenceDate: "2026-03-10", cancelled: false, startDate: "2026-03-11" },
      ],
    });
    const moved = expandSeries(s, "2026-03-11", "2026-03-11")[0];
    expect(moved.occurrenceDate).toBe("2026-03-10");
    expect(moved.startDate).toBe("2026-03-11");
  });

  it("preserves duration when only the start is moved", () => {
    const s = series({
      startDate: "2026-03-03",
      endDate: "2026-03-05",
      allDay: true,
      recurrence: { freq: "monthly", interval: 1, monthlyMode: "dayOfMonth", end: { type: "never" } },
      overrides: [
        { occurrenceDate: "2026-04-03", cancelled: false, startDate: "2026-04-10" },
      ],
    });
    const april = expandSeries(s, "2026-04-01", "2026-04-30")[0];
    expect(april.startDate).toBe("2026-04-10");
    expect(april.endDate).toBe("2026-04-12");
  });

  it("pulls an occurrence into range when it was moved in from outside", () => {
    const s = series({
      recurrence: weekly,
      overrides: [
        { occurrenceDate: "2026-06-02", cancelled: false, startDate: "2026-03-04" },
      ],
    });
    expect(dates(s, "2026-03-01", "2026-03-07")).toEqual(["2026-03-03", "2026-03-04"]);
  });

  it("overrides the time of a single occurrence only", () => {
    const s = series({
      recurrence: weekly,
      overrides: [
        { occurrenceDate: "2026-03-10", cancelled: false, startTime: "18:00", endTime: "19:00" },
      ],
    });
    const [first, second] = expandSeries(s, "2026-03-01", "2026-03-12");
    expect(first.startTime).toBe("16:30");
    expect(second.startTime).toBe("18:00");
    expect(second.endTime).toBe("19:00");
  });
});

describe("parseRecurrence", () => {
  it("returns null for empty input", () => {
    expect(parseRecurrence(null)).toBeNull();
    expect(parseRecurrence("")).toBeNull();
    expect(parseRecurrence("null")).toBeNull();
    expect(parseRecurrence("not json")).toBeNull();
    expect(parseRecurrence({ freq: "hourly" })).toBeNull();
  });

  it("parses a JSON string from the database", () => {
    const parsed = parseRecurrence(
      '{"freq":"weekly","interval":2,"byWeekday":[2,4],"end":{"type":"afterCount","count":10}}',
    );
    expect(parsed).toEqual({
      freq: "weekly",
      interval: 2,
      byWeekday: [2, 4],
      end: { type: "afterCount", count: 10 },
    });
  });

  it("clamps a hostile interval and de-duplicates weekdays", () => {
    const parsed = parseRecurrence({
      freq: "weekly",
      interval: -5,
      byWeekday: [4, 2, 4, 99, "3"],
      end: { type: "never" },
    });
    expect(parsed?.interval).toBe(1);
    expect(parsed?.byWeekday).toEqual([2, 3, 4]);
  });

  it("falls back to never-ending on a malformed end", () => {
    expect(parseRecurrence({ freq: "daily", interval: 1, end: { type: "wat" } })?.end).toEqual({
      type: "never",
    });
  });
});

describe("describeRecurrence", () => {
  it("describes the common patterns in plain English", () => {
    expect(describeRecurrence(null, "2026-03-03")).toBe("Does not repeat");
    expect(
      describeRecurrence({ freq: "daily", interval: 1, end: { type: "never" } }, "2026-03-03"),
    ).toBe("Every day");
    expect(
      describeRecurrence(
        { freq: "weekly", interval: 1, byWeekday: [2, 4], end: { type: "never" } },
        "2026-03-03",
      ),
    ).toBe("Every Tuesday and Thursday");
    expect(
      describeRecurrence({ freq: "weekly", interval: 2, end: { type: "never" } }, "2026-03-03"),
    ).toBe("Every 2 weeks on Tuesday");
    expect(
      describeRecurrence(
        { freq: "monthly", interval: 1, monthlyMode: "nthWeekday", end: { type: "never" } },
        "2026-03-10",
      ),
    ).toBe("Every month on the second Tuesday");
    expect(
      describeRecurrence(
        { freq: "weekly", interval: 1, end: { type: "afterCount", count: 6 } },
        "2026-03-03",
      ),
    ).toBe("Every Tuesday, 6 times");
  });
});
