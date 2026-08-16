"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { MEMBER_COLOURS } from "@/lib/colours";
import { MAX_PIN_LENGTH, MIN_PIN_LENGTH } from "@/lib/pin";
import { FieldError, button, field, label, memberStyle } from "@/components/ui";
import { type SetupState, completeSetup } from "./actions";

const MAX_MEMBERS = 12;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={`${button.primary} w-full`} disabled={pending}>
      {pending ? "Setting up…" : "Create our calendar"}
    </button>
  );
}

export function SetupForm() {
  const [state, action] = useActionState<SetupState, FormData>(completeSetup, { errors: {} });
  // Start with two rows: most households add a second person immediately.
  const [rows, setRows] = useState([0, 1]);

  return (
    <form action={action} className="space-y-8">
      <section>
        <label className={label} htmlFor="householdName">
          What shall we call your family?
        </label>
        <input
          id="householdName"
          name="householdName"
          className={field}
          placeholder="The Tucknotts"
          autoComplete="off"
          autoFocus
          maxLength={60}
        />
        <FieldError message={state.errors.householdName} />
      </section>

      <section>
        <h2 className="text-sm font-medium text-ink">Who's in the family?</h2>
        <p className="mt-1 mb-3 text-sm text-muted">
          Everyone gets their own colour so you can see whose day is whose. You can
          change all of this later.
        </p>

        <div className="space-y-2">
          {rows.map((rowKey, index) => (
            <div key={rowKey} className="flex items-center gap-2.5">
              <span
                className="member-dot h-8 w-8 shrink-0 rounded-full"
                style={memberStyle(MEMBER_COLOURS[index % MEMBER_COLOURS.length].id)}
                aria-hidden
              />
              <input
                name="memberName"
                className={field}
                placeholder={index === 0 ? "Your name" : "Another family member"}
                autoComplete="off"
                maxLength={40}
              />
              {rows.length > 1 ? (
                <button
                  type="button"
                  onClick={() => setRows(rows.filter((r) => r !== rowKey))}
                  className="shrink-0 rounded-lg px-2.5 py-2 text-sm text-muted transition-colors hover:bg-hover hover:text-danger"
                  aria-label="Remove this person"
                >
                  Remove
                </button>
              ) : null}
            </div>
          ))}
        </div>

        {rows.length < MAX_MEMBERS ? (
          <button
            type="button"
            onClick={() => setRows([...rows, Math.max(...rows) + 1])}
            className="mt-2.5 text-sm font-medium text-accent hover:underline"
          >
            + Add another person
          </button>
        ) : null}
        <FieldError message={state.errors.members} />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-medium text-ink">Choose a family PIN</h2>
          <p className="mt-1 text-sm text-muted">
            Everyone uses the same PIN to get in. Pick something the children can
            remember but that isn't a birthday.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="pin">
              PIN
            </label>
            <input
              id="pin"
              name="pin"
              type="password"
              inputMode="numeric"
              pattern="\d*"
              className={field}
              placeholder={"•".repeat(MIN_PIN_LENGTH)}
              autoComplete="new-password"
              minLength={MIN_PIN_LENGTH}
              maxLength={MAX_PIN_LENGTH}
            />
            <FieldError message={state.errors.pin} />
          </div>
          <div>
            <label className={label} htmlFor="confirmPin">
              PIN again
            </label>
            <input
              id="confirmPin"
              name="confirmPin"
              type="password"
              inputMode="numeric"
              pattern="\d*"
              className={field}
              placeholder={"•".repeat(MIN_PIN_LENGTH)}
              autoComplete="new-password"
              minLength={MIN_PIN_LENGTH}
              maxLength={MAX_PIN_LENGTH}
            />
            <FieldError message={state.errors.confirmPin} />
          </div>
        </div>
      </section>

      <SubmitButton />
    </form>
  );
}
