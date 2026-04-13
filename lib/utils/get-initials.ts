/**
 * Get the initials of a name
 */
export function getInitials(name?: string | null) {
  if (!name) return "UU";

  const parts = name.trim().split(/\s+/);

  if (parts.length === 1) {
    const first = parts[0][0] || "";
    const second = parts[0][1] || "";
    return (first + second).toUpperCase();
  }

  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
