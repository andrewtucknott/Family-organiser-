/**
 * PIN rules, kept free of any server import so the login keypad and the setup
 * form can share exactly the same constraints the server enforces.
 */

export const MIN_PIN_LENGTH = 4;
export const MAX_PIN_LENGTH = 12;

/** Returns a message explaining why a PIN is unacceptable, or null if it's fine. */
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
