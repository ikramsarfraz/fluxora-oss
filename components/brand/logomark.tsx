type Props = {
  size?: number;
  className?: string;
};

export function Logomark({ size = 32, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 44 44"
      className={className}
      aria-label="Fluxora"
    >
      <rect
        x="1"
        y="1"
        width="42"
        height="42"
        rx="8"
        fill="#F5EFE0"
        stroke="#1F3A2E"
        strokeWidth="1.5"
      />
      <text
        x="22"
        y="33"
        textAnchor="middle"
        fontFamily="Archivo, ui-sans-serif, sans-serif"
        fontSize="28"
        fontWeight="600"
        fill="#1F3A2E"
      >
        F
      </text>
      <rect x="13" y="34" width="4" height="2" fill="#8B7332" />
    </svg>
  );
}
