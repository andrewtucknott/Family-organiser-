import "server-only";
import { type DB, getDb, newId, nowIso } from "./db";
import { DEFAULT_COLOUR, isColourId, nextColour } from "./colours";

import type { Member } from "./calendar-types";

export type { Member };

type MemberRow = {
  id: string;
  name: string;
  colour: string;
  sort_order: number;
};

const toMember = (row: MemberRow): Member => ({
  id: row.id,
  name: row.name,
  colour: row.colour,
  sortOrder: row.sort_order,
});

export const MAX_MEMBER_NAME = 40;

export function listMembers(householdId: string, db: DB = getDb()): Member[] {
  return db
    .prepare<[string], MemberRow>(
      `SELECT id, name, colour, sort_order
         FROM members
        WHERE household_id = ? AND archived = 0
        ORDER BY sort_order, created_at`,
    )
    .all(householdId)
    .map(toMember);
}

export function getMember(
  householdId: string,
  memberId: string,
  db: DB = getDb(),
): Member | null {
  const row = db
    .prepare<[string, string], MemberRow>(
      `SELECT id, name, colour, sort_order
         FROM members
        WHERE household_id = ? AND id = ? AND archived = 0`,
    )
    .get(householdId, memberId);
  return row ? toMember(row) : null;
}

export function createMember(
  householdId: string,
  name: string,
  colour?: string,
  db: DB = getDb(),
): Member {
  const clean = name.replace(/\s+/g, " ").trim().slice(0, MAX_MEMBER_NAME);
  if (!clean) throw new Error("A family member needs a name.");

  const existing = listMembers(householdId, db);
  const chosen = isColourId(colour)
    ? colour
    : (nextColour(existing.map((m) => m.colour)) ?? DEFAULT_COLOUR);
  const sortOrder = existing.length;
  const id = newId();

  db.prepare(
    `INSERT INTO members (id, household_id, name, colour, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, householdId, clean, chosen, sortOrder, nowIso());

  return { id, name: clean, colour: chosen, sortOrder };
}

export function updateMember(
  householdId: string,
  memberId: string,
  changes: { name?: string; colour?: string },
  db: DB = getDb(),
): void {
  const sets: string[] = [];
  const values: unknown[] = [];

  if (changes.name !== undefined) {
    const clean = changes.name.replace(/\s+/g, " ").trim().slice(0, MAX_MEMBER_NAME);
    if (!clean) throw new Error("A family member needs a name.");
    sets.push("name = ?");
    values.push(clean);
  }
  if (changes.colour !== undefined && isColourId(changes.colour)) {
    sets.push("colour = ?");
    values.push(changes.colour);
  }
  if (sets.length === 0) return;

  values.push(memberId, householdId);
  db.prepare(`UPDATE members SET ${sets.join(", ")} WHERE id = ? AND household_id = ?`).run(
    ...values,
  );
}

/**
 * Archive rather than delete: their name stays readable on past events, and
 * nothing in the family's history silently disappears.
 */
export function archiveMember(
  householdId: string,
  memberId: string,
  db: DB = getDb(),
): void {
  db.prepare("UPDATE members SET archived = 1 WHERE id = ? AND household_id = ?").run(
    memberId,
    householdId,
  );
}

export function reorderMembers(
  householdId: string,
  orderedIds: string[],
  db: DB = getDb(),
): void {
  const update = db.prepare(
    "UPDATE members SET sort_order = ? WHERE id = ? AND household_id = ?",
  );
  db.transaction(() => {
    orderedIds.forEach((id, index) => update.run(index, id, householdId));
  })();
}

/** Keep only ids that really belong to this household — form input is untrusted. */
export function filterHouseholdMemberIds(
  householdId: string,
  memberIds: string[],
  db: DB = getDb(),
): string[] {
  if (memberIds.length === 0) return [];
  const valid = new Set(listMembers(householdId, db).map((m) => m.id));
  return memberIds.filter((id) => valid.has(id));
}
