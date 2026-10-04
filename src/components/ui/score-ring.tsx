export function ScoreRing({ value, label }: { value: number; label: string }) {
  const percentage = Math.max(
    0,
    Math.min(100, Number.isFinite(value) ? value : 0),
  );
  return (
    <div
      className="relative size-28 shrink-0"
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percentage)}
    >
      <svg
        viewBox="0 0 120 120"
        className="size-full -rotate-90"
        aria-hidden="true"
      >
        <circle
          cx="60"
          cy="60"
          r="51"
          fill="none"
          className="stroke-muted"
          strokeWidth="5"
        />
        <circle
          cx="60"
          cy="60"
          r="51"
          fill="none"
          className="stroke-primary"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray="320.45"
          strokeDashoffset={320.45 * (1 - percentage / 100)}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-3xl font-semibold tracking-tight">
        {Math.round(percentage)}
        <span className="ml-0.5 text-sm">%</span>
      </span>
    </div>
  );
}
