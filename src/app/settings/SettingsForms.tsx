"use client";

import { useActionState } from "react";
import { MAX_PIN_LENGTH, MIN_PIN_LENGTH } from "@/lib/pin";
import { FieldError, button, field, label } from "@/components/ui";
import { type SettingsState, addMember, changePin } from "./actions";

const EMPTY: SettingsState = { errors: {} };

export function AddMemberForm() {
  const [state, action, pending] = useActionState<SettingsState, FormData>(addMember, EMPTY);

  return (
    <form action={action} className="flex flex-wrap items-start gap-2 p-4">
      <div className="min-w-48 flex-1">
        <input
          name="name"
          className={field}
          placeholder="Add someone else"
          aria-label="New family member's name"
          maxLength={40}
        />
        <FieldError message={state.errors.name} />
        {state.notice ? <p className="mt-1.5 text-sm text-muted">{state.notice}</p> : null}
      </div>
      <button type="submit" className={button.secondary} disabled={pending}>
        {pending ? "Adding…" : "Add"}
      </button>
    </form>
  );
}

export function ChangePinForm() {
  const [state, action, pending] = useActionState<SettingsState, FormData>(changePin, EMPTY);

  const pinInput = {
    type: "password" as const,
    inputMode: "numeric" as const,
    pattern: "\\d*",
    className: field,
    autoComplete: "new-password",
    minLength: MIN_PIN_LENGTH,
    maxLength: MAX_PIN_LENGTH,
  };

  return (
    <form action={action} className="space-y-4 p-4">
      <p className="text-sm text-muted">
        Changing the PIN signs everyone out, on every device. They'll need the new
        one to get back in.
      </p>

      <div>
        <label className={label} htmlFor="currentPin">
          Current PIN
        </label>
        <input id="currentPin" name="currentPin" {...pinInput} autoComplete="current-password" />
        <FieldError message={state.errors.currentPin} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="newPin">
            New PIN
          </label>
          <input id="newPin" name="newPin" {...pinInput} />
          <FieldError message={state.errors.newPin} />
        </div>
        <div>
          <label className={label} htmlFor="confirmPin">
            New PIN again
          </label>
          <input id="confirmPin" name="confirmPin" {...pinInput} />
          <FieldError message={state.errors.confirmPin} />
        </div>
      </div>

      <button type="submit" className={button.secondary} disabled={pending}>
        {pending ? "Changing…" : "Change PIN"}
      </button>
    </form>
  );
}
