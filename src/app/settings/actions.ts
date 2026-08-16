"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  clearSession,
  getHousehold,
  getSession,
  hashPin,
  setSessionMember,
  validatePin,
  verifyPin,
} from "@/lib/auth";
import { getDb } from "@/lib/db";
import { archiveMember, createMember, listMembers, updateMember } from "@/lib/members";
import { isColourId } from "@/lib/colours";

export type SettingsState = { errors: Record<string, string>; notice?: string };

async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function addMember(
  _previous: SettingsState,
  form: FormData,
): Promise<SettingsState> {
  const session = await requireSession();
  const name = text(form, "name");
  if (!name) return { errors: { name: "Enter a name." } };

  createMember(session.householdId, name);
  revalidatePath("/settings");
  revalidatePath("/calendar");
  return { errors: {}, notice: `${name} added.` };
}

export async function renameOrRecolourMember(form: FormData): Promise<void> {
  const session = await requireSession();
  const memberId = text(form, "memberId");
  const name = text(form, "name");
  const colour = text(form, "colour");
  if (!memberId) return;

  updateMember(session.householdId, memberId, {
    ...(name ? { name } : {}),
    ...(isColourId(colour) ? { colour } : {}),
  });
  revalidatePath("/settings");
  revalidatePath("/calendar");
}

export async function removeMember(form: FormData): Promise<void> {
  const session = await requireSession();
  const memberId = text(form, "memberId");
  if (!memberId) return;

  // Never let the household lock itself out of having anyone at all.
  if (listMembers(session.householdId).length <= 1) return;

  archiveMember(session.householdId, memberId);
  if (session.memberId === memberId) await setSessionMember(null);
  revalidatePath("/settings");
  revalidatePath("/calendar");
}

export async function changePin(
  _previous: SettingsState,
  form: FormData,
): Promise<SettingsState> {
  await requireSession();
  const household = getHousehold();
  if (!household) redirect("/setup");

  const current = text(form, "currentPin");
  const next = text(form, "newPin");
  const confirm = text(form, "confirmPin");

  if (!verifyPin(current, household.pin_hash, household.pin_salt)) {
    return { errors: { currentPin: "That's not the current PIN." } };
  }
  const invalid = validatePin(next);
  if (invalid) return { errors: { newPin: invalid } };
  if (next !== confirm) return { errors: { confirmPin: "The two PINs don't match." } };

  const { hash, salt } = hashPin(next);
  getDb()
    .prepare("UPDATE households SET pin_hash = ?, pin_salt = ? WHERE id = ?")
    .run(hash, salt, household.id);

  // Changing the PIN invalidates every session, including this one.
  await clearSession();
  redirect("/login");
}

export async function signOut(): Promise<void> {
  await clearSession();
  redirect("/login");
}

export async function switchMember(): Promise<void> {
  await setSessionMember(null);
  redirect("/who");
}
