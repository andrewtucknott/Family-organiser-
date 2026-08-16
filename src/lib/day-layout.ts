/**
 * Placing a day's timed events into columns when they clash.
 *
 * Events are grouped into clusters of mutually overlapping items. Each cluster
 * is divided into as many lanes as it needs, so a lone event keeps the full
 * column width and only genuine clashes get narrowed.
 */

import { minutesOfDay } from "./dates";

export type LaidOutEvent<T> = {
  event: T;
  /** Minutes from midnight to the top of the box. */
  startMinutes: number;
  /** Height of the box in minutes, never less than MIN_EVENT_MINUTES. */
  durationMinutes: number;
  /** Zero-based column within the cluster. */
  lane: number;
  /** How many columns this event's cluster was split into. */
  lanes: number;
};

type Timed = { startTime: string | null; endTime: string | null };

/** Below this, an event box is too small to read or tap. */
export const MIN_EVENT_MINUTES = 20;

export function layoutDay<T extends Timed>(events: T[]): LaidOutEvent<T>[] {
  const items = events
    .map((event) => {
      const start = minutesOfDay(event.startTime ?? "00:00");
      const rawEnd = event.endTime ? minutesOfDay(event.endTime) : start + 60;
      return { event, start, end: Math.max(rawEnd, start + MIN_EVENT_MINUTES) };
    })
    // Earliest first; when two start together the longer one takes the left lane.
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const result: LaidOutEvent<T>[] = [];
  let cluster: { event: T; start: number; end: number; lane: number }[] = [];
  let laneEnds: number[] = [];

  const flush = () => {
    const lanes = laneEnds.length || 1;
    for (const item of cluster) {
      result.push({
        event: item.event,
        startMinutes: item.start,
        durationMinutes: item.end - item.start,
        lane: item.lane,
        lanes,
      });
    }
    cluster = [];
    laneEnds = [];
  };

  for (const item of items) {
    // Once nothing is still running, the previous cluster is complete.
    if (cluster.length > 0 && laneEnds.every((end) => end <= item.start)) flush();

    let lane = laneEnds.findIndex((end) => end <= item.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.end);
    } else {
      laneEnds[lane] = item.end;
    }
    cluster.push({ ...item, lane });
  }
  flush();

  return result;
}
