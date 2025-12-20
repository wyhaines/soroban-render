import React from "react";

interface GaugeChartProps {
  value: number;
  max: number;
  label?: string;
  color?: string;
  size?: number;
}

export function GaugeChart({
  value,
  max,
  label,
  color = "#3b82f6",
  size = 160,
}: GaugeChartProps): React.ReactElement {
  // Clamp value between 0 and max
  const clampedValue = Math.max(0, Math.min(value, max));
  const percentage = max > 0 ? (clampedValue / max) * 100 : 0;

  const radius = size / 2;
  const strokeWidth = size / 10;
  const innerRadius = radius - strokeWidth / 2;
  const center = radius;

  // Gauge arc goes from 135 degrees to 405 degrees (270 degree arc)
  const startAngle = 135;
  const endAngle = 405;
  const totalAngle = endAngle - startAngle;
  const valueAngle = startAngle + (percentage / 100) * totalAngle;

  // Convert angle to SVG arc coordinates
  const polarToCartesian = (angleDeg: number) => {
    const angleRad = (angleDeg * Math.PI) / 180;
    return {
      x: center + innerRadius * Math.cos(angleRad),
      y: center + innerRadius * Math.sin(angleRad),
    };
  };

  const createArcPath = (startAngleDeg: number, endAngleDeg: number): string => {
    const start = polarToCartesian(startAngleDeg);
    const end = polarToCartesian(endAngleDeg);
    const largeArcFlag = endAngleDeg - startAngleDeg > 180 ? 1 : 0;

    return [
      "M", start.x, start.y,
      "A", innerRadius, innerRadius, 0, largeArcFlag, 1, end.x, end.y,
    ].join(" ");
  };

  // Determine color based on percentage if not provided
  const getAutoColor = () => {
    if (percentage < 33) return "#ef4444"; // red
    if (percentage < 66) return "#eab308"; // yellow
    return "#22c55e"; // green
  };

  const fillColor = color || getAutoColor();

  return (
    <div className="soroban-chart soroban-chart-gauge" style={{ textAlign: "center" }}>
      <svg width={size} height={size * 0.75} viewBox={`0 0 ${size} ${size * 0.85}`}>
        {/* Background arc */}
        <path
          d={createArcPath(startAngle, endAngle)}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Value arc */}
        {percentage > 0 && (
          <path
            d={createArcPath(startAngle, valueAngle)}
            fill="none"
            stroke={fillColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        )}

        {/* Center text */}
        <text
          x={center}
          y={center + 5}
          textAnchor="middle"
          fontSize={size / 5}
          fontWeight="bold"
          fill="#1f2937"
        >
          {percentage.toFixed(0)}%
        </text>

        {/* Value text */}
        <text
          x={center}
          y={center + size / 5 + 5}
          textAnchor="middle"
          fontSize={size / 10}
          fill="#6b7280"
        >
          {clampedValue} / {max}
        </text>
      </svg>
      {label && (
        <div style={{ marginTop: "0.25rem", fontSize: "0.875rem", color: "#374151", fontWeight: 500 }}>
          {label}
        </div>
      )}
    </div>
  );
}
