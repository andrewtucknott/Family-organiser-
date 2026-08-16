import { describe, expect, it } from "vitest";
import { MIN_EVENT_MINUTES, layoutDay } from "./day-layout";

type Event = { id: string; startTime: string | null; endTime: string | null };

const event = (id: string, startTime: string, endTime: string | null = null): Event => ({
  id,
  startTime,
  endTime,
});

/** "id:lane/lanes" — the whole placement of each event in one readable string. */
const placements = (events: Event[]) =>
  layoutDay(events).map((p) => `${p.event.id}:${p.lane}/${p.lanes}`);

describe("layoutDay", () => {
  it("gives a lone event the full width", () => {
    expect(placements([event("a", "09:00", "10:00")])).toEqual(["a:0/1"]);
  });

  it("keeps back-to-back events full width", () => {
    expect(
      placements([event("a", "09:00", "10:00"), event("b", "10:00", "11:00")]),
    ).toEqual(["a:0/1", "b:0/1"]);
  });

  it("splits two clashing events into two lanes", () => {
    expect(
      placements([event("a", "09:00", "10:30"), event("b", "10:00", "11:00")]),
    ).toEqual(["a:0/2", "b:1/2"]);
  });

  it("splits three-way clashes into three lanes", () => {
    expect(
      placements([
        event("a", "09:00", "12:00"),
        event("b", "09:30", "11:00"),
        event("c", "10:00", "10:30"),
      ]),
    ).toEqual(["a:0/3", "b:1/3", "c:2/3"]);
  });

  it("reuses a lane once its event has finished", () => {
    // b and c never overlap, so they share lane 1 behind the long event a.
    expect(
      placements([
        event("a", "09:00", "12:00"),
        event("b", "09:30", "10:00"),
        event("c", "10:30", "11:00"),
      ]),
    ).toEqual(["a:0/2", "b:1/2", "c:1/2"]);
  });

  it("starts a fresh cluster after a gap, so later events regain full width", () => {
    expect(
      placements([
        event("a", "09:00", "10:30"),
        event("b", "10:00", "11:00"),
        event("c", "14:00", "15:00"),
      ]),
    ).toEqual(["a:0/2", "b:1/2", "c:0/1"]);
  });

  it("puts the longer event on the left when two start together", () => {
    expect(
      placements([event("short", "09:00", "09:30"), event("long", "09:00", "11:00")]),
    ).toEqual(["long:0/2", "short:1/2"]);
  });

  it("orders output chronologically regardless of input order", () => {
    const result = layoutDay([
      event("c", "15:00", "16:00"),
      event("a", "09:00", "10:00"),
      event("b", "11:00", "12:00"),
    ]);
    expect(result.map((p) => p.event.id)).toEqual(["a", "b", "c"]);
  });
});

describe("layoutDay — sizing", () => {
  it("converts times to minutes from midnight", () => {
    const [placed] = layoutDay([event("a", "09:30", "11:00")]);
    expect(placed.startMinutes).toBe(570);
    expect(placed.durationMinutes).toBe(90);
  });

  it("defaults a missing end time to an hour", () => {
    expect(layoutDay([event("a", "09:00")])[0].durationMinutes).toBe(60);
  });

  it("enforces a minimum height so short events stay tappable", () => {
    expect(layoutDay([event("a", "09:00", "09:05")])[0].durationMinutes).toBe(
      MIN_EVENT_MINUTES,
    );
  });

  it("treats a missing start time as midnight", () => {
    expect(layoutDay([{ id: "a", startTime: null, endTime: null }])[0].startMinutes).toBe(0);
  });

  it("does not let a minimum-height event steal a lane from a genuinely later one", () => {
    // a is 5 minutes long but padded to 20; b starts well after the padding ends.
    expect(placements([event("a", "09:00", "09:05"), event("b", "09:30", "10:00")])).toEqual([
      "a:0/1",
      "b:0/1",
    ]);
  });

  it("handles an empty day", () => {
    expect(layoutDay([])).toEqual([]);
  });
});
