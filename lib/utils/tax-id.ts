/**
 * Live input mask for US Employer Identification Numbers (EIN).
 *
 *   ""           → ""
 *   "1"          → "1"
 *   "12"         → "12"
 *   "123"        → "12-3"        (hyphen auto-inserted)
 *   "12-345"     → "12-345"
 *   "123456789"  → "12-3456789"
 *
 * Strips everything except digits, then re-applies the `XX-XXXXXXX`
 * shape. Capped at 9 digits — past that the input rejects further
 * keystrokes via maxLength on the <input>.
 *
 * The Zod schema accepts either `123456789` or `12-3456789`; this
 * mask just makes the formatted shape the path of least resistance
 * for the user.
 */
export function formatEinInput(raw: string): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "").slice(0, 9);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
}
