/**
 * Shows cases and weight (lbs) for catch-weight UX.
 */
interface CatchWeightDisplayProps {
  cases?: number;
  weightLbs: string | number;
  label?: string;
}

export function CatchWeightDisplay({ cases, weightLbs, label }: CatchWeightDisplayProps) {
  const w = typeof weightLbs === "string" ? parseFloat(weightLbs) : weightLbs;
  const display = cases != null
    ? `${cases} cases · ${w.toFixed(2)} lbs`
    : `${w.toFixed(2)} lbs`;
  return (
    <span className="catch-weight" title={label ?? "Billed weight (catch weight)"}>
      {display}
    </span>
  );
}
