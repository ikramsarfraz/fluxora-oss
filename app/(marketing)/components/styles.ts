// ERP-appropriate color palette: deep navy, teal accent, warm neutrals
export const gradStyle = {
  background: "linear-gradient(135deg, oklch(0.50 0.14 230) 0%, oklch(0.55 0.15 195) 100%)",
  WebkitBackgroundClip: "text" as const,
  WebkitTextFillColor: "transparent" as const,
  backgroundClip: "text" as const,
};

export const primaryBtn = {
  background: "oklch(0.35 0.10 230)",
  color: "white",
} as React.CSSProperties;

export const primaryBtnHover = "hover:opacity-90";

// Decorative grid pattern SVG as data URI - smaller, more subtle
export const gridPattern = `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg stroke='%23cbd5e1' stroke-width='0.5'%3E%3Cpath d='M0 0h40v40H0z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`;

// Dot pattern for backgrounds - smaller dots
export const dotPattern = `url("data:image/svg+xml,%3Csvg width='16' height='16' viewBox='0 0 16 16' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='1' cy='1' r='0.8' fill='%23cbd5e1' fill-opacity='0.5'/%3E%3C/svg%3E")`;

// Diagonal lines pattern
export const diagonalLinesPattern = `url("data:image/svg+xml,%3Csvg width='6' height='6' viewBox='0 0 6 6' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23cbd5e1' fill-opacity='0.3' fill-rule='evenodd'%3E%3Cpath d='M5 0h1L0 6V5zM6 5v1H5z'/%3E%3C/g%3E%3C/svg%3E")`;

// Cross pattern
export const crossPattern = `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23cbd5e1' fill-opacity='0.3'%3E%3Crect x='9' y='0' width='1' height='20'/%3E%3Crect x='0' y='9' width='20' height='1'/%3E%3C/g%3E%3C/svg%3E")`;
