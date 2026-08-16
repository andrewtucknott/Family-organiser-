import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  daysBetween,
  eachDay,
  endOfMonth,
  formatDate,
  formatRelativeDay,
  formatTime,
  isISODate,
  isTime,
  minutesOfDay,
  startOfWeek,
  timeFromMinutes,
  weekday,
} from "./dates";

describe("date arithmetic", () => {
  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-03-31", 1)).toBe("2026-04-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
  });

  it("does not shift across a DST boundary", () => {
    // UK clocks go forward on 2026-03-29. A naive local-time Date would slip.
    expect(addDays("2026-03-28", 1)).toBe("2026-03-29");
    expect(addDays("2026-03-29", 1)).toBe("2026-03-30");
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
  });

  it("clamps when adding months", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
  });

  it("finds the end of a month, leap years included", () => {
    expect(endOfMonth("2026-02-10")).toBe("2026-02-28");
    expect(endOfMonth("2024-02-10")).toBe("2024-02-29");
    expect(endOfMonth("2026-12-01")).toBe("2026-12-31");
  });

  it("starts weeks on Monday by default", () => {
    expect(weekday("2026-03-03")).toBe(2); // Tuesday
    expect(startOfWeek("2026-03-03")).toBe("2026-03-02");
    expect(startOfWeek("2026-03-01")).toBe("2026-02-23"); // Sunday belongs to the prior week
    expect(startOfWeek("2026-03-01", 0)).toBe("2026-03-01"); // unless weeks start Sunday
  });

  it("enumerates an inclusive range", () => {
    expect(eachDay("2026-03-30", "2026-04-02")).toEqual([
      "2026-03-30",
      "2026-03-31",
      "2026-04-01",
      "2026-04-02",
    ]);
  });
});

describe("validation", () => {
  it("accepts real dates and rejects impossible ones", () => {
    expect(isISODate("2026-03-03")).toBe(true);
    expect(isISODate("2024-02-29")).toBe(true);
    expect(isISODate("2026-02-30")).toBe(false);
    expect(isISODate("2026-13-01")).toBe(false);
    expect(isISODate("3 March 2026")).toBe(false);
    expect(isISODate(20260303)).toBe(false);
  });

  it("accepts 24-hour times only", () => {
    expect(isTime("00:00")).toBe(true);
    expect(isTime("23:59")).toBe(true);
    expect(isTime("24:00")).toBe(false);
    expect(isTime("9:30")).toBe(false);
    expect(isTime("16:60")).toBe(false);
  });
});

describe("time helpers", () => {
  it("converts between times and minutes", () => {
    expect(minutesOfDay("16:30")).toBe(990);
    expect(timeFromMinutes(990)).toBe("16:30");
    expect(timeFromMinutes(-30)).toBe("00:00");
    expect(timeFromMinutes(99_999)).toBe("23:59");
  });
});

describe("formatting", () => {
  it("formats dates for a UK household", () => {
    expect(formatDate("2026-03-03", "short")).toBe("3 Mar");
    expect(formatDate("2026-03-03")).toBe("Tue 3 Mar");
    expect(formatDate("2026-03-03", "long")).toBe("Tuesday 3 March 2026");
  });

  it("formats times conversationally", () => {
    expect(formatTime("09:30")).toBe("9:30am");
    expect(formatTime("16:00")).toBe("4pm");
    expect(formatTime("12:00")).toBe("12 noon");
    expect(formatTime("00:00")).toBe("midnight");
    expect(formatTime("13:05")).toBe("1:05pm");
  });

  it("names nearby days", () => {
    expect(formatRelativeDay("2026-03-03", "2026-03-03")).toBe("Today");
    expect(formatRelativeDay("2026-03-04", "2026-03-03")).toBe("Tomorrow");
    expect(formatRelativeDay("2026-03-02", "2026-03-03")).toBe("Yesterday");
    expect(formatRelativeDay("2026-03-09", "2026-03-03")).toBe("Monday 9 March 2026");
  });
});
