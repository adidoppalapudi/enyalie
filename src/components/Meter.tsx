interface MeterProps {
  value: number;
  max: number;
  /** What the bar means, for screen readers ("3 of 10 answered"). */
  label: string;
  tone?: 'progress' | 'accuracy' | 'timer';
}

const WIDTH = 10; // characters

/** A text progress bar like [######----]. */
export function Meter({ value, max, label, tone = 'progress' }: MeterProps) {
  const filled = max > 0 ? Math.max(0, Math.min(WIDTH, Math.round((value / max) * WIDTH))) : 0;
  return (
    <span className={`meter meter-${tone}`} role="img" aria-label={label}>
      <span aria-hidden="true">
        [<span className="meter-fill">{'#'.repeat(filled)}</span>
        <span className="meter-empty">{'-'.repeat(WIDTH - filled)}</span>]
      </span>
    </span>
  );
}
