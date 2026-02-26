interface Props {
  value: number;   // 0-100
  label: string;
  subtitle?: string;
  color: string;   // tailwind color class like "text-mg-primary"
}

export function SystemGauge({ value, label, subtitle, color }: Props) {
  const clamped = Math.min(100, Math.max(0, value));
  const radius = 60;
  const stroke = 10;
  const circumference = Math.PI * radius; // semicircle
  const offset = circumference - (clamped / 100) * circumference;

  // Dynamic color based on value
  const arcColor =
    clamped > 85 ? '#ef4444' :
    clamped > 65 ? '#f59e0b' :
    '#22c55e';

  return (
    <div className="flex flex-col items-center">
      <svg width="150" height="90" viewBox="0 0 150 90">
        {/* Background arc */}
        <path
          d="M 15 80 A 60 60 0 0 1 135 80"
          fill="none"
          stroke="#334155"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        {/* Value arc */}
        <path
          d="M 15 80 A 60 60 0 0 1 135 80"
          fill="none"
          stroke={arcColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-500"
        />
        {/* Center text */}
        <text
          x="75"
          y="70"
          textAnchor="middle"
          className={`text-2xl font-bold fill-current ${color}`}
          style={{ fill: arcColor }}
        >
          {Math.round(clamped)}%
        </text>
      </svg>
      <span className="text-sm font-medium text-mg-text mt-1">{label}</span>
      {subtitle && <span className="text-xs text-mg-muted">{subtitle}</span>}
    </div>
  );
}
