interface Props {
  values: number[];
  min?: number;
  max?: number;
  stroke?: string;
  label: string;
}

export function Sparkline({ values, min = 0, max = 100, stroke = "#0B5CAD", label }: Props) {
  const width = 320;
  const height = 72;
  if (values.length < 2) {
    return (
      <p className="text-sm text-petrol-500" role="img" aria-label={label}>
        Not enough readings to draw a trend yet.
      </p>
    );
  }
  const step = width / (values.length - 1);
  const span = max - min || 1;
  const points = values
    .map((v, i) => `${(i * step).toFixed(1)},${(height - ((Math.min(max, Math.max(min, v)) - min) / span) * height).toFixed(1)}`)
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-20 w-full" preserveAspectRatio="none" role="img" aria-label={label}>
      <line x1="0" x2={width} y1={height / 2} y2={height / 2} stroke="#E6ECEE" strokeWidth="1" />
      <polyline points={points} fill="none" stroke={stroke} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
