"use client";

import { useState } from "react";
import { MEMBER_COLOURS, colourHex } from "@/lib/colours";
import type { Member } from "@/lib/calendar-types";
import { Avatar, button, field } from "@/components/ui";
import { removeMember, renameOrRecolourMember } from "./actions";

export function MemberRow({ member, canRemove }: { member: Member; canRemove: boolean }) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (editing) {
    return (
      <li className="p-4">
        <form action={renameOrRecolourMember} className="space-y-3">
          <input type="hidden" name="memberId" value={member.id} />
          <input
            name="name"
            className={field}
            defaultValue={member.name}
            aria-label="Name"
            maxLength={40}
            autoFocus
          />

          <fieldset>
            <legend className="mb-1.5 text-xs font-medium text-muted">Colour</legend>
            <div className="flex flex-wrap gap-2">
              {MEMBER_COLOURS.map((colour) => (
                <label key={colour.id} className="cursor-pointer">
                  <input
                    type="radio"
                    name="colour"
                    value={colour.id}
                    defaultChecked={colour.id === member.colour}
                    className="peer sr-only"
                  />
                  <span
                    className="block h-8 w-8 rounded-full ring-offset-2 ring-offset-surface peer-checked:ring-2 peer-focus-visible:ring-2"
                    style={{ background: colourHex(colour.id), ["--tw-ring-color" as string]: colourHex(colour.id) }}
                    title={colour.name}
                  />
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex gap-2">
            <button type="submit" className={button.primary}>
              Save
            </button>
            <button type="button" className={button.secondary} onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 p-4">
      <Avatar member={member} size="lg" />
      <span className="flex-1 font-medium text-ink">{member.name}</span>

      {confirming ? (
        <form action={removeMember} className="flex items-center gap-2">
          <input type="hidden" name="memberId" value={member.id} />
          <span className="text-sm text-muted">Remove?</span>
          <button type="submit" className={button.danger}>
            Yes
          </button>
          <button type="button" className={button.ghost} onClick={() => setConfirming(false)}>
            No
          </button>
        </form>
      ) : (
        <>
          <button type="button" className={button.ghost} onClick={() => setEditing(true)}>
            Edit
          </button>
          {canRemove ? (
            <button type="button" className={button.ghost} onClick={() => setConfirming(true)}>
              Remove
            </button>
          ) : null}
        </>
      )}
    </li>
  );
}
