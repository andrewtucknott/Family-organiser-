/**
 * The family-member palette.
 *
 * Colour is how you read this calendar at a glance from across the kitchen, so
 * the eight choices are picked to stay distinguishable when they sit next to
 * each other as small chips. Tints are derived at render time with color-mix,
 * so each colour is defined exactly once.
 */

export type MemberColour = {
  id: string;
  name: string;
  hex: string;
};

export const MEMBER_COLOURS: MemberColour[] = [
  { id: "rose", name: "Rose", hex: "#e11d48" },
  { id: "amber", name: "Amber", hex: "#d97706" },
  { id: "emerald", name: "Emerald", hex: "#059669" },
  { id: "sky", name: "Sky", hex: "#0284c7" },
  { id: "violet", name: "Violet", hex: "#7c3aed" },
  { id: "fuchsia", name: "Fuchsia", hex: "#c026d3" },
  { id: "teal", name: "Teal", hex: "#0d9488" },
  { id: "slate", name: "Slate", hex: "#475569" },
];

const BY_ID = new Map(MEMBER_COLOURS.map((c) => [c.id, c]));

export const DEFAULT_COLOUR = MEMBER_COLOURS[0].id;

export function colourHex(id: string): string {
  return BY_ID.get(id)?.hex ?? MEMBER_COLOURS[MEMBER_COLOURS.length - 1].hex;
}

export function isColourId(id: unknown): id is string {
  return typeof id === "string" && BY_ID.has(id);
}

/** The next unused colour, so adding family members doesn't need a decision. */
export function nextColour(taken: string[]): string {
  const used = new Set(taken);
  return (MEMBER_COLOURS.find((c) => !used.has(c.id)) ?? MEMBER_COLOURS[0]).id;
}

/** Initials for the member avatar: "Andrew" -> "A", "Mary Jane" -> "MJ". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
