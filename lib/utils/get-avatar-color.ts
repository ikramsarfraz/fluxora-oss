/**
 * Get the color of an avatar based on the first letter of the name
 */
export function getAvatarColor(name?: string) {
  if (!name) return "bg-muted text-muted-foreground";

  const colors = [
    "bg-blue-300 text-blue-800",
    "bg-emerald-300 text-emerald-800",
    "bg-amber-300 text-amber-800",
    "bg-rose-300 text-rose-800",
    "bg-indigo-300 text-indigo-800",
  ];

  const index = name.charCodeAt(0) % colors.length;

  return colors[index];
}
