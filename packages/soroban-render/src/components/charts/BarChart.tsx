import React from "react";
import { ChartDataPoint } from "../../parsers/json";

interface BarChartProps {
  data: ChartDataPoint[];
  title?: string;
  height?: number;
}

// Default colors for bars
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

export function BarChart({ data, title, height = 200 }: BarChartProps): React.ReactElement {
  if (!data || data.length === 0) {
    return (
      <div className="soroban-chart soroban-chart-bar" style={{ textAlign: "center", padding: "1rem" }}>
        <p style={{ color: "#666" }}>No data available</p>
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.value));
  if (maxValue === 0) {
    return (
      <div className="soroban-chart soroban-chart-bar" style={{ textAlign: "center", padding: "1rem" }}>
        <p style={{ color: "#666" }}>No data to display</p>
      </div>
    );
  }

  const barWidth = Math.min(60, Math.max(20, 300 / data.length));
  const gap = 8;
  const chartWidth = data.length * (barWidth + gap) - gap;
  const paddingLeft = 40;
  const paddingBottom = 30;
  const paddingTop = 20;

  return (
    <div className="soroban-chart soroban-chart-bar">
      {title && (
        <h4 style={{ margin: "0 0 0.75rem 0", fontSize: "1rem", fontWeight: 600, textAlign: "center" }}>
          {title}
        </h4>
      )}
      <div style={{ overflowX: "auto" }}>
        <svg
          width={chartWidth + paddingLeft + 20}
          height={height + paddingBottom + paddingTop}
          viewBox={`0 0 ${chartWidth + paddingLeft + 20} ${height + paddingBottom + paddingTop}`}
        >
          {/* Y-axis */}
          <line
            x1={paddingLeft}
            y1={paddingTop}
            x2={paddingLeft}
            y2={height + paddingTop}
            stroke="#e5e7eb"
            strokeWidth="1"
          />

          {/* X-axis */}
          <line
            x1={paddingLeft}
            y1={height + paddingTop}
            x2={chartWidth + paddingLeft}
            y2={height + paddingTop}
            stroke="#e5e7eb"
            strokeWidth="1"
          />

          {/* Y-axis labels */}
          {[0, 0.25, 0.5, 0.75, 1].map((fraction, index) => {
            const y = paddingTop + height * (1 - fraction);
            const value = Math.round(maxValue * fraction);
            return (
              <g key={index}>
                <line x1={paddingLeft - 5} y1={y} x2={paddingLeft} y2={y} stroke="#e5e7eb" />
                <text x={paddingLeft - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#6b7280">
                  {value}
                </text>
              </g>
            );
          })}

          {/* Bars */}
          {data.map((point, index) => {
            const barHeight = (point.value / maxValue) * height;
            const x = paddingLeft + index * (barWidth + gap) + gap / 2;
            const y = paddingTop + height - barHeight;
            const color = point.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length];

            return (
              <g key={index}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  fill={color}
                  rx="2"
                >
                  <title>{`${point.label}: ${point.value}`}</title>
                </rect>

                {/* X-axis label */}
                <text
                  x={x + barWidth / 2}
                  y={height + paddingTop + 15}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#6b7280"
                >
                  {point.label.length > 8 ? point.label.slice(0, 8) + "..." : point.label}
                </text>

                {/* Value label on top of bar */}
                {barHeight > 15 && (
                  <text
                    x={x + barWidth / 2}
                    y={y + 12}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="bold"
                    fill="white"
                  >
                    {point.value}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
