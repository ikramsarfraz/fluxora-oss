/**
 * Format a phone number string for display.
 * Handles 10-digit US numbers: (123) 456-7890
 * Handles 11-digit with country code: +1 (234) 567-8901
 * Returns original string if format not recognized.
 */
export function formatPhone(phone: string | null | undefined): string {
  if (phone == null || phone === "") return "—";

  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, "");

  // 10 digit US number: (123) 456-7890
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  // 11 digit with country code: +1 (234) 567-8901
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  // Return original if we can't format it
  return phone;
}

/**
 * Live input mask for US phone numbers. Use as a controlled-input
 * onChange handler so the value the user sees lines up with what we
 * store. Strips non-digits, then re-applies the format based on how
 * many digits are present:
 *
 *   ""             → ""
 *   "5"            → "(5"
 *   "555"          → "(555) "
 *   "5551"         → "(555) 1"
 *   "5551234"      → "(555) 123-4"
 *   "5551234567"   → "(555) 123-4567"
 *   "+44..."       → "+44…"  (anything with a leading + is passed through
 *                              digits-only, so international numbers
 *                              aren't forced into a US shape)
 *
 * Pairs with `normalizePhone`, which strips the mask back to digits
 * for storage.
 */
export function formatPhoneInput(raw: string): string {
  if (!raw) return "";

  // International — preserve as the user typed it (digits + leading
  // plus), no mask. The schema's normalizePhone() handles validation
  // on submit.
  if (raw.trim().startsWith("+")) {
    return "+" + raw.replace(/\D/g, "");
  }

  const digits = raw.replace(/\D/g, "").slice(0, 11);

  // 11-digit input — display as +1 (xxx) xxx-xxxx if it starts with 1.
  if (digits.length === 11 && digits.startsWith("1")) {
    const rest = digits.slice(1);
    return `+1 (${rest.slice(0, 3)}) ${rest.slice(3, 6)}-${rest.slice(6, 10)}`;
  }

  // US 10-digit progressive mask.
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

/**
 * Normalize a phone number for storage. Goal: canonicalize US numbers
 * (10-digit local or 11-digit with country code 1) into a single digit
 * string so `(555) 123-4567`, `555-123-4567`, and `+1 555 123 4567` all
 * round-trip identically.
 *
 *   - `null` / `""` / whitespace → `null` (treated as "no phone given")
 *   - US 10-digit (`5551234567`) → `"5551234567"`
 *   - US 11-digit starting with `1` (`15551234567`) → `"5551234567"`
 *     (drop country code; the formatter re-adds it for display)
 *   - Other lengths (international, extensions, etc.) → digit string
 *     preserved as-is. A leading `+` is preserved.
 *
 * Returns `{ value, isValid }`. `isValid` is `false` if there are fewer
 * than 7 or more than 15 digits — too short to be a real number, or
 * past ITU-T E.164's 15-digit ceiling. Validators can use it to reject
 * obvious garbage without rejecting legitimate international numbers.
 */
export function normalizePhone(raw: string | null | undefined): {
  value: string | null;
  isValid: boolean;
} {
  if (raw == null) return { value: null, isValid: true };
  const trimmed = raw.trim();
  if (trimmed === "") return { value: null, isValid: true };

  // Strip everything except digits and a leading +.
  const hasLeadingPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");

  if (digits.length === 0) return { value: null, isValid: false };

  // US local — store as 10 digits.
  if (!hasLeadingPlus && digits.length === 10) {
    return { value: digits, isValid: true };
  }
  // US with country code 1 — drop the 1 to keep storage canonical.
  if (digits.length === 11 && digits.startsWith("1")) {
    return { value: digits.slice(1), isValid: true };
  }

  // Anything else: keep the digits as-is, with optional leading +.
  // Validate length against ITU-T E.164 (1–15 digits including
  // country code); the lower bound is loose since some short codes
  // exist, but anything under 7 is almost certainly bogus input.
  const isValid = digits.length >= 7 && digits.length <= 15;
  return {
    value: hasLeadingPlus ? `+${digits}` : digits,
    isValid,
  };
}
