"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { formToRaw, parseEventForm } from "@/lib/event-input";
import { createEvent, deleteEvent, updateEvent } from "@/lib/events";
import { filterHouseholdMemberIds } from "@/lib/members";
import type { EditScope } from "@/lib/calendar-types";

export type SaveState = {
  ok?: boolean;
  errors: Record<string, string>;
};

function readScope(form: FormData): EditScope {
  const scope = form.get("scope");
  return scope === "one" || scope === "future" ? scope : "all";
}

function readText(form: FormData, key: string): string | null {
  const value = form.get(key);
  return typeof value === "string" && value ? value : null;
}

export async function saveEvent(_previous: SaveState, form: FormData): Promise<SaveState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const parsed = parseEventForm(formToRaw(form));
  if (!parsed.ok) return { errors: parsed.errors };

  // Never trust member ids from the browser — they must be this household's.
  const input = {
    ...parsed.value,
    memberIds: filterHouseholdMemberIds(session.householdId, parsed.value.memberIds),
  };

  const eventId = readText(form, "eventId");
  const occurrenceDate = readText(form, "occurrenceDate");

  try {
    if (eventId) {
      updateEvent(session.householdId, eventId, input, readScope(form), occurrenceDate);
    } else {
      createEvent(session.householdId, input, session.memberId);
    }
  } catch (error) {
    return {
      errors: {
        form: error instanceof Error ? error.message : "Something went wrong saving that.",
      },
    };
  }

  revalidatePath("/calendar");
  return { ok: true, errors: {} };
}

export async function removeEvent(_previous: SaveState, form: FormData): Promise<SaveState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const eventId = readText(form, "eventId");
  if (!eventId) return { errors: { form: "That event has already gone." } };

  try {
    deleteEvent(
      session.householdId,
      eventId,
      readScope(form),
      readText(form, "occurrenceDate"),
    );
  } catch (error) {
    return {
      errors: {
        form: error instanceof Error ? error.message : "Something went wrong deleting that.",
      },
    };
  }

  revalidatePath("/calendar");
  return { ok: true, errors: {} };
}
