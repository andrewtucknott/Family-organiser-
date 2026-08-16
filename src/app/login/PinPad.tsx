"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { MAX_PIN_LENGTH, MIN_PIN_LENGTH } from "@/lib/pin";
import { type LoginState, signIn } from "./actions";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

/**
 * A keypad rather than a text field: this gets used on a phone in the hallway,
 * and a physical keyboard is still fully supported for laptops.
 */
export function PinPad() {
  const [state, action, pending] = useActionState<LoginState, FormData>(signIn, {});
  const [pin, setPin] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  // A rejected PIN clears itself, ready for another go.
  useEffect(() => {
    if (state.error) setPin("");
  }, [state.error]);

  const press = (digit: string) => {
    if (pending) return;
    setPin((current) => (current.length >= MAX_PIN_LENGTH ? current : current + digit));
  };

  const submit = () => {
    if (pin.length >= MIN_PIN_LENGTH && !pending) formRef.current?.requestSubmit();
  };

  // Physical keyboards work too — this is used on laptops as well as phones.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (pending) return;
      if (event.key >= "0" && event.key <= "9") {
        setPin((c) => (c.length >= MAX_PIN_LENGTH ? c : c + event.key));
      } else if (event.key === "Backspace") {
        setPin((c) => c.slice(0, -1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending]);

  const keyClass =
    "flex h-16 items-center justify-center rounded-xl border border-line bg-surface text-xl font-medium text-ink shadow-card transition-colors hover:bg-hover active:bg-sunken disabled:opacity-50";

  return (
    <form ref={formRef} action={action} className="w-full">
      <input type="hidden" name="pin" value={pin} />

      <div className="mb-6 flex h-8 items-center justify-center gap-3" aria-live="polite">
        {Array.from({ length: Math.max(MIN_PIN_LENGTH, pin.length) }).map((_, index) => (
          <span
            key={index}
            className={`h-3 w-3 rounded-full transition-colors ${
              index < pin.length ? "bg-accent" : "bg-line-strong"
            }`}
          />
        ))}
      </div>

      <p className="mb-5 min-h-10 text-center text-sm text-danger" role="alert">
        {state.error ?? ""}
      </p>

      <div className="grid grid-cols-3 gap-3">
        {KEYS.map((digit) => (
          <button
            key={digit}
            type="button"
            className={keyClass}
            onClick={() => press(digit)}
            disabled={pending}
          >
            {digit}
          </button>
        ))}
        <button
          type="button"
          className={`${keyClass} text-base text-muted`}
          onClick={() => setPin((c) => c.slice(0, -1))}
          disabled={pending || pin.length === 0}
        >
          Delete
        </button>
        <button type="button" className={keyClass} onClick={() => press("0")} disabled={pending}>
          0
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={pending || pin.length < MIN_PIN_LENGTH}
          className="flex h-16 items-center justify-center rounded-xl bg-accent text-base font-medium text-accent-ink shadow-card transition-colors hover:bg-accent-hover disabled:opacity-40"
        >
          {pending ? "…" : "Enter"}
        </button>
      </div>
    </form>
  );
}
