interface ProgressBarProps {
  value: number;
  label?: string;
  tone?: "blue" | "green" | "amber";
}

export function ProgressBar({ value, label = "Progress", tone = "blue" }: ProgressBarProps) {
  const safeValue = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={`progress-control progress-${tone}`}>
      <div className="progress-meta"><span>{label}</span><strong>{safeValue}%</strong></div>
      <div className="progress-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={safeValue}>
        <span style={{ "--progress-value": `${safeValue}%` } as React.CSSProperties} />
      </div>
    </div>
  );
}
