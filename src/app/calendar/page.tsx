import { redirect } from "next/navigation";
import { getHousehold, getSession } from "@/lib/auth";
import { getMember, listMembers } from "@/lib/members";
import { listOccurrences } from "@/lib/events";
import {
  type ISODate,
  endOfMonth,
  endOfWeek,
  isISODate,
  nowTime,
  startOfMonth,
  startOfWeek,
  today as todayIn,
} from "@/lib/dates";
import { type CalendarView, isCalendarView } from "@/lib/calendar-types";
import { CalendarShell } from "@/components/calendar/CalendarShell";

export const dynamic = "force-dynamic";

/** The span of dates a view needs — month views bleed into neighbouring weeks. */
function rangeFor(view: CalendarView, date: ISODate): { from: ISODate; to: ISODate } {
  if (view === "day") return { from: date, to: date };
  if (view === "week") return { from: startOfWeek(date), to: endOfWeek(date) };
  return { from: startOfWeek(startOfMonth(date)), to: endOfWeek(endOfMonth(date)) };
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const household = getHousehold();
  if (!household) redirect("/setup");

  const session = await getSession();
  if (!session) redirect("/login");

  const params = await searchParams;
  const first = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const today = todayIn(household.time_zone);
  const view: CalendarView = isCalendarView(first("view")) ? (first("view") as CalendarView) : "month";
  const dateParam = first("date");
  const date = isISODate(dateParam) ? dateParam : today;

  const members = listMembers(session.householdId);
  const validIds = new Set(members.map((m) => m.id));
  const selectedMemberIds = (first("who") ?? "")
    .split(",")
    .filter((id) => validIds.has(id));

  const { from, to } = rangeFor(view, date);
  const occurrences = listOccurrences(session.householdId, from, to, {
    memberIds: selectedMemberIds,
  });

  return (
    <main>
      <CalendarShell
        view={view}
        date={date}
        today={today}
        nowTime={nowTime(household.time_zone)}
        rangeStart={from}
        rangeEnd={to}
        members={members}
        selectedMemberIds={selectedMemberIds}
        occurrences={occurrences}
        householdName={household.name}
        currentMember={session.memberId ? getMember(session.householdId, session.memberId) : null}
      />
    </main>
  );
}
