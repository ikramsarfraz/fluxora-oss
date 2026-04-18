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
