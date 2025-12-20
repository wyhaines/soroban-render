import React from "react";
import { ChartDataPoint } from "../../parsers/json";

interface PieChartProps {
  data: ChartDataPoint[];
  title?: string;
  size?: number;
}

// Default colors for pie slices
const DEFAULT_COLORS = [
  "#3b82f6", // blue
  "#22c55e", // green
  "#eab308", // yellow
  "#ef4444", // red
  "#8b5cf6", // purple
  "#06b6d4", // cyan
  "#f97316", // orange
  "#ec4899", // pink
];

export function PieChart({ data, title, size = 200 }: PieChartProps): React.ReactElement {
  if (!data || data.length === 0) {
    return (
      <div className="soroban-chart soroban-chart-pie" style={{ textAlign: "center", padding: "1rem" }}>
        <p style={{ color: "#666" }}>No data available</p>
      </div>
    );
  }

  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) {
    return (
      <div className="soroban-chart soroban-chart-pie" style={{ textAlign: "center", padding: "1rem" }}>
        <p style={{ color: "#666" }}>No data to display</p>
      </div>
    );
  }

  const radius = size / 2;
  const center = radius;

  // Calculate pie slices
  let currentAngle = -90; // Start from top
  const slices = data.map((point, index) => {
    const percentage = point.value / total;
    const angle = percentage * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    const color = point.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length];

    return {
      ...point,
      startAngle,
      endAngle,
      percentage,
      color,
    };
  });

  // Convert angle to SVG arc coordinates
  const polarToCartesian = (cx: number, cy: number, r: number, angleDeg: number) => {
    const angleRad = (angleDeg * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(angleRad),
      y: cy + r * Math.sin(angleRad),
    };
  };

  const createArcPath = (
    cx: number,
    cy: number,
    r: number,
    startAngle: number,
    endAngle: number
  ): string => {
    const start = polarToCartesian(cx, cy, r, startAngle);
    const end = polarToCartesian(cx, cy, r, endAngle);
    const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;

    return [
      "M", cx, cy,
      "L", start.x, start.y,
      "A", r, r, 0, largeArcFlag, 1, end.x, end.y,
      "Z",
    ].join(" ");
  };

  return (
    <div className="soroban-chart soroban-chart-pie">
      {title && (
        <h4 style={{ margin: "0 0 0.75rem 0", fontSize: "1rem", fontWeight: 600, textAlign: "center" }}>
          {title}
        </h4>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", justifyContent: "center", flexWrap: "wrap" }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {slices.map((slice, index) => (
            <path
              key={index}
              d={createArcPath(center, center, radius - 2, slice.startAngle, slice.endAngle)}
              fill={slice.color}
              stroke="white"
              strokeWidth="2"
            >
              <title>{`${slice.label}: ${slice.value} (${(slice.percentage * 100).toFixed(1)}%)`}</title>
            </path>
          ))}
        </svg>
        <div className="soroban-chart-legend" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {slices.map((slice, index) => (
            <div key={index} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem" }}>
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "2px",
                  backgroundColor: slice.color,
                  flexShrink: 0,
                }}
              />
              <span style={{ color: "#374151" }}>
                {slice.label}: {slice.value} ({(slice.percentage * 100).toFixed(1)}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
