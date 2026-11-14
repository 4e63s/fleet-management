import { healthTone, toneClasses } from "../lib/health";

interface Props {
  score: number | null;
  size?: number;
}

export function HealthRing({ score, size = 72 }: Props) {
  const tone = healthTone(score);
  const stroke = Math.max(6, Math.round(size / 10));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = score === null ? 0 : Math.min(100, Math.max(0, score)) / 100;
  const label = score === null ? "No health data" : `Health score ${score} out of 100`;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#E6ECEE" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={toneClasses[tone].hex}
          strokeWidth={stroke}
          strokeLinecap="butt"
          strokeDasharray={`${circumference * fraction} ${circumference}`}
        />
      </svg>
      <span
        className={`absolute inset-0 flex items-center justify-center font-display font-semibold ${toneClasses[tone].text}`}
        style={{ fontSize: size * 0.36 }}
      >
        {score === null ? "–" : score}
      </span>
    </div>
  );
}
