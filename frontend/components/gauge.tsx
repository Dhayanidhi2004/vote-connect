// Score dial — a clean ring, coloured by band, with a tabular numeral.

function color(score: number) {
  if (score >= 85) return "#1F9254"; // green
  if (score >= 70) return "#0B6BCB"; // blue
  if (score >= 50) return "#C98A00"; // amber
  return "#C0392B"; // red
}

export function ScoreGauge({
  score,
  max = 100,
  label,
  band,
  size = 140,
  stars,
}: {
  score: number;
  max?: number;
  label?: string;
  band?: string;
  size?: number;
  stars?: boolean;
}) {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const circumference = 2 * Math.PI * r;
  const arc = 0.75; // 270° arc, gap at bottom
  const pct = Math.max(0, Math.min(1, score / max));
  const dash = circumference * arc;
  const offset = dash * (1 - pct);
  const c = color(score);

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="rotate-[135deg]">
          <circle
            cx={cx}
            cy={cx}
            r={r}
            fill="none"
            stroke="#EAEEF3"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
          />
          <circle
            cx={cx}
            cy={cx}
            r={r}
            fill="none"
            stroke={c}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.9s ease-out" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="tnum font-bold leading-none text-ink"
            style={{ fontSize: size * 0.26 }}
          >
            {Math.round(score)}
          </span>
          <span className="text-xs font-medium text-muted">/ {max}</span>
        </div>
      </div>
      {band && (
        <span className="mt-2 text-sm font-semibold" style={{ color: c }}>
          {band}
        </span>
      )}
      {stars && (
        <div className="mt-0.5 text-sm tracking-widest" style={{ color: "#C98A00" }}>
          {"★".repeat(Math.round((score / max) * 5)).padEnd(5, "☆")}
        </div>
      )}
      {label && <span className="mt-0.5 text-xs text-muted">{label}</span>}
    </div>
  );
}
