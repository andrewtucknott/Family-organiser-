"use server";

import { redirect } from "next/navigation";
import { getDb, newId, nowIso } from "@/lib/db";
import { createSession, getHousehold, hashPin, validatePin } from "@/lib/auth";
import { createMember } from "@/lib/members";
import { MEMBER_COLOURS } from "@/lib/colours";

export type SetupState = { errors: Record<string, string> };

const MAX_MEMBERS = 12;

export async function completeSetup(
  _previous: SetupState,
  form: FormData,
): Promise<SetupState> {
  // Setup runs exactly once. After that this route is a dead end.
  if (getHousehold()) redirect("/login");

  const errors: Record<string, string> = {};

  const householdName =
    (form.get("householdName") as string | null)?.replace(/\s+/g, " ").trim().slice(0, 60) ?? "";
  if (!householdName) errors.householdName = "Give your family a name.";

  const pin = ((form.get("pin") as string | null) ?? "").trim();
  const confirmPin = ((form.get("confirmPin") as string | null) ?? "").trim();
  const pinError = validatePin(pin);
  if (pinError) errors.pin = pinError;
  else if (pin !== confirmPin) errors.confirmPin = "The two PINs don't match.";

  const names = form
    .getAll("memberName")
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, MAX_MEMBERS);
  if (names.length === 0) errors.members = "Add at least one person.";

  if (Object.keys(errors).length > 0) return { errors };

  const db = getDb();
  const householdId = newId();
  const { hash, salt } = hashPin(pin);

  db.transaction(() => {
    db.prepare(
      `INSERT INTO households (id, name, pin_hash, pin_salt, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(householdId, householdName, hash, salt, nowIso());

    names.forEach((name, index) => {
      createMember(householdId, name, MEMBER_COLOURS[index % MEMBER_COLOURS.length].id, db);
    });
  })();

  // Whoever set the household up is already signed in on this device.
  await createSession(householdId, null);
  redirect("/who");
}
