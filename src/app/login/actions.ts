"use server";

import { redirect } from "next/navigation";
import {
  LOCKOUT_MESSAGE,
  checkLockout,
  createSession,
  getHousehold,
  recordLoginAttempt,
  verifyPin,
} from "@/lib/auth";

export type LoginState = { error?: string };

export async function signIn(_previous: LoginState, form: FormData): Promise<LoginState> {
  const household = getHousehold();
  if (!household) redirect("/setup");

  const { lockedOut } = await checkLockout();
  if (lockedOut) return { error: LOCKOUT_MESSAGE };

  const pin = ((form.get("pin") as string | null) ?? "").trim();
  if (!pin) return { error: "Enter your family PIN." };

  if (!verifyPin(pin, household.pin_hash, household.pin_salt)) {
    await recordLoginAttempt(false);
    const { attemptsLeft } = await checkLockout();
    return {
      error:
        attemptsLeft <= 3 && attemptsLeft > 0
          ? `That PIN isn't right. ${attemptsLeft} ${attemptsLeft === 1 ? "try" : "tries"} left.`
          : attemptsLeft === 0
            ? LOCKOUT_MESSAGE
            : "That PIN isn't right. Have another go.",
    };
  }

  await recordLoginAttempt(true);
  await createSession(household.id, null);
  redirect("/who");
}
