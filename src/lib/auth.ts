import "server-only";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { type DB, getDb, getSetting, nowIso, setSetting } from "./db";

/**
 * Household PIN authentication.
 *
 * One shared PIN gets you into the household; you then say which family member
 * you are, purely so events can be attributed and pre-filtered. The member
 * choice is convenience, not a security boundary — the PIN is the boundary.
 *
 * Sessions are stateless signed cookies. The signature covers a fingerprint of
 * the current PIN hash, so changing the PIN silently logs every device out.
 */

const SESSION_COOKIE = "family_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 365; // a year — family phones shouldn't nag
const SCRYPT_KEYLEN = 64;

export const MIN_PIN_LENGTH = 4;
export const MAX_PIN_LENGTH = 12;

/** Failed attempts allowed from one client before it is locked out. */
const MAX_FAILED_ATTEMPTS = 8;
const LOCKOUT_WINDOW_MINUTES = 15;

export type Session = {
  householdId: string;
  memberId: string | null;
};

// ---------------------------------------------------------------------------
// PIN hashing
// ---------------------------------------------------------------------------

export function hashPin(pin: string): { hash: string; salt: string } {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pin.normalize("NFKC"), salt, SCRYPT_KEYLEN).toString("hex");
  return { hash, salt };
}

export function verifyPin(pin: string, hash: string, salt: string): boolean {
  let candidate: Buffer;
  try {
    candidate = scryptSync(pin.normalize("NFKC"), salt, SCRYPT_KEYLEN);
  } catch {
    return false;
  }
  const expected = Buffer.from(hash, "hex");
  if (expected.length !== candidate.length) return false;
  return timingSafeEqual(candidate, expected);
}

/** A PIN must be digits only — the login pad only produces digits. */
export function validatePin(pin: string): string | null {
  if (!/^\d+$/.test(pin)) return "Your PIN must be numbers only.";
  if (pin.length < MIN_PIN_LENGTH) {
    return `Your PIN must be at least ${MIN_PIN_LENGTH} digits.`;
  }
  if (pin.length > MAX_PIN_LENGTH) {
    return `Your PIN can be at most ${MAX_PIN_LENGTH} digits.`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Session signing
// ---------------------------------------------------------------------------

/**
 * The signing secret comes from SESSION_SECRET when set. Otherwise one is
 * generated on first run and stored in the database, so a self-hosted family
 * install works without anybody having to invent a secret.
 */
function sessionSecret(db: DB): string {
  const fromEnv = process.env.SESSION_SECRET;
  if (fromEnv && fromEnv.length >= 16) return fromEnv;

  const stored = getSetting(db, "session_secret");
  if (stored) return stored;

  const generated = randomBytes(32).toString("hex");
  setSetting(db, "session_secret", generated);
  return generated;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(db: DB, payload: string): string {
  return createHmac("sha256", sessionSecret(db)).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** First 16 hex chars of the PIN hash — changing the PIN invalidates sessions. */
function pinFingerprint(pinHash: string): string {
  return pinHash.slice(0, 16);
}

function encodeToken(db: DB, session: Session, fingerprint: string): string {
  const payload = base64url(
    JSON.stringify({ h: session.householdId, m: session.memberId, f: fingerprint }),
  );
  return `${payload}.${sign(db, payload)}`;
}

function decodeToken(db: DB, token: string): { householdId: string; memberId: string | null; fingerprint: string } | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  if (!safeEqual(signature, sign(db, payload))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof data?.h !== "string" || typeof data?.f !== "string") return null;
    return {
      householdId: data.h,
      memberId: typeof data.m === "string" ? data.m : null,
      fingerprint: data.f,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Session lifecycle
// ---------------------------------------------------------------------------

export async function createSession(householdId: string, memberId: string | null): Promise<void> {
  const db = getDb();
  const household = db
    .prepare<[string], { pin_hash: string }>("SELECT pin_hash FROM households WHERE id = ?")
    .get(householdId);
  if (!household) throw new Error("Unknown household");

  const token = encodeToken(db, { householdId, memberId }, pinFingerprint(household.pin_hash));
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const db = getDb();
  const decoded = decodeToken(db, token);
  if (!decoded) return null;

  const household = db
    .prepare<[string], { pin_hash: string }>("SELECT pin_hash FROM households WHERE id = ?")
    .get(decoded.householdId);
  // Household deleted, or the PIN was changed since this cookie was issued.
  if (!household || pinFingerprint(household.pin_hash) !== decoded.fingerprint) return null;

  // A member removed from the household falls back to "not yet chosen".
  let memberId = decoded.memberId;
  if (memberId) {
    const member = db
      .prepare<[string, string], { id: string }>(
        "SELECT id FROM members WHERE id = ? AND household_id = ? AND archived = 0",
      )
      .get(memberId, decoded.householdId);
    if (!member) memberId = null;
  }

  return { householdId: decoded.householdId, memberId };
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Switch which family member the current device is acting as. */
export async function setSessionMember(memberId: string | null): Promise<void> {
  const session = await getSession();
  if (!session) throw new Error("Not signed in");
  await createSession(session.householdId, memberId);
}

// ---------------------------------------------------------------------------
// Brute-force protection
// ---------------------------------------------------------------------------

async function clientKey(): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headerList.get("x-real-ip") ?? "unknown";
}

function windowStart(): string {
  return new Date(Date.now() - LOCKOUT_WINDOW_MINUTES * 60_000).toISOString();
}

export type LockoutState = { lockedOut: boolean; attemptsLeft: number };

export async function checkLockout(): Promise<LockoutState> {
  const db = getDb();
  const client = await clientKey();
  const { failures } = db
    .prepare<[string, string], { failures: number }>(
      "SELECT COUNT(*) AS failures FROM login_attempts WHERE client = ? AND success = 0 AND at > ?",
    )
    .get(client, windowStart()) ?? { failures: 0 };

  return {
    lockedOut: failures >= MAX_FAILED_ATTEMPTS,
    attemptsLeft: Math.max(0, MAX_FAILED_ATTEMPTS - failures),
  };
}

export async function recordLoginAttempt(success: boolean): Promise<void> {
  const db = getDb();
  const client = await clientKey();
  db.prepare("INSERT INTO login_attempts (client, at, success) VALUES (?, ?, ?)").run(
    client,
    nowIso(),
    success ? 1 : 0,
  );
  if (success) {
    // A correct PIN clears the client's failure history.
    db.prepare("DELETE FROM login_attempts WHERE client = ? AND success = 0").run(client);
  }
  // Keep the table from growing without bound.
  db.prepare("DELETE FROM login_attempts WHERE at < ?").run(
    new Date(Date.now() - 24 * 60 * 60_000).toISOString(),
  );
}

export const LOCKOUT_MESSAGE = `Too many incorrect PINs. Please wait ${LOCKOUT_WINDOW_MINUTES} minutes and try again.`;

// ---------------------------------------------------------------------------
// Setup state
// ---------------------------------------------------------------------------

/** The single household this install serves, if setup has been completed. */
export function getHousehold(db: DB = getDb()) {
  return db
    .prepare<[], {
      id: string;
      name: string;
      pin_hash: string;
      pin_salt: string;
      week_starts_on: number;
      time_zone: string;
    }>("SELECT * FROM households ORDER BY created_at LIMIT 1")
    .get() ?? null;
}
