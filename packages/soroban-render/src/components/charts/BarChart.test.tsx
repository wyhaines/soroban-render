import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BarChart } from "./BarChart";
import type { ChartDataPoint } from "../../parsers/json";

describe("BarChart", () => {
  describe("empty state", () => {
    it("should show message when data is empty", () => {
      render(<BarChart data={[]} />);

      expect(screen.getByText("No data available")).toBeInTheDocument();
    });

    it("should show message when data is undefined", () => {
      // @ts-expect-error - testing undefined data
      render(<BarChart data={undefined} />);

      expect(screen.getByText("No data available")).toBeInTheDocument();
    });

    it("should show message when all values are zero", () => {
      const data: ChartDataPoint[] = [
        { label: "A", value: 0 },
        { label: "B", value: 0 },
      ];

      render(<BarChart data={data} />);

      expect(screen.getByText("No data to display")).toBeInTheDocument();
    });
  });

  describe("rendering", () => {
    it("should render SVG with bars", () => {
      const data: ChartDataPoint[] = [
        { label: "Jan", value: 100 },
        { label: "Feb", value: 200 },
      ];

      const { container } = render(<BarChart data={data} />);

      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();

      const rects = container.querySelectorAll("rect");
      expect(rects).toHaveLength(2);
    });

    it("should render title when provided", () => {
      const data: ChartDataPoint[] = [{ label: "Jan", value: 100 }];

      render(<BarChart data={data} title="Monthly Sales" />);

      expect(screen.getByText("Monthly Sales")).toBeInTheDocument();
    });

    it("should not render title when not provided", () => {
      const data: ChartDataPoint[] = [{ label: "Jan", value: 100 }];

      const { container } = render(<BarChart data={data} />);

      expect(container.querySelector("h4")).not.toBeInTheDocument();
    });
  });

  describe("axes", () => {
    it("should render Y-axis", () => {
      const data: ChartDataPoint[] = [{ label: "A", value: 100 }];

      const { container } = render(<BarChart data={data} />);

      // Y-axis is a vertical line
      const lines = container.querySelectorAll("line");
      expect(lines.length).toBeGreaterThan(0);
    });

    it("should render X-axis", () => {
      const data: ChartDataPoint[] = [{ label: "A", value: 100 }];

      const { container } = render(<BarChart data={data} />);

      // X-axis is a horizontal line
      const lines = container.querySelectorAll("line");
      expect(lines.length).toBeGreaterThan(0);
    });

    it("should render Y-axis labels", () => {
      const data: ChartDataPoint[] = [{ label: "A", value: 100 }];

      render(<BarChart data={data} />);

      // Should have labels for 0, 25, 50, 75, 100
      // Use getAllByText since values may appear multiple times
      expect(screen.getAllByText("0").length).toBeGreaterThanOrEqual(1);
      // 100 appears in Y-axis and potentially on bar
      expect(screen.getAllByText("100").length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("labels", () => {
    it("should render X-axis labels", () => {
      const data: ChartDataPoint[] = [
        { label: "Jan", value: 100 },
        { label: "Feb", value: 200 },
      ];

      render(<BarChart data={data} />);

      expect(screen.getByText("Jan")).toBeInTheDocument();
      expect(screen.getByText("Feb")).toBeInTheDocument();
    });

    it("should truncate long labels", () => {
      const data: ChartDataPoint[] = [
        { label: "VeryLongLabel", value: 100 },
      ];

      render(<BarChart data={data} />);

      // Labels longer than 8 chars should be truncated
      expect(screen.getByText("VeryLong...")).toBeInTheDocument();
    });

    it("should not truncate short labels", () => {
      const data: ChartDataPoint[] = [
        { label: "Short", value: 100 },
      ];

      render(<BarChart data={data} />);

      expect(screen.getByText("Short")).toBeInTheDocument();
    });
  });

  describe("value labels", () => {
    it("should render value labels on top of bars", () => {
      const data: ChartDataPoint[] = [
        { label: "A", value: 150 },
      ];

      render(<BarChart data={data} />);

      // Value label should show the value - use getAllByText since it may appear multiple times
      // (once on bar, possibly in Y-axis if it's a round number)
      expect(screen.getAllByText("150").length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("colors", () => {
    it("should use custom colors when provided", () => {
      const data: ChartDataPoint[] = [
        { label: "Custom", value: 100, color: "#ff0000" },
      ];

      const { container } = render(<BarChart data={data} />);

      const rect = container.querySelector("rect");
      expect(rect).toHaveAttribute("fill", "#ff0000");
    });

    it("should use default colors when not provided", () => {
      const data: ChartDataPoint[] = [
        { label: "Default", value: 100 },
      ];

      const { container } = render(<BarChart data={data} />);

      const rect = container.querySelector("rect");
      // First default color is blue
      expect(rect).toHaveAttribute("fill", "#3b82f6");
    });

    it("should cycle through default colors", () => {
      const data: ChartDataPoint[] = Array(10).fill(null).map((_, i) => ({
        label: `Item ${i}`,
        value: 100,
      }));

      const { container } = render(<BarChart data={data} />);

      const rects = container.querySelectorAll("rect");
      expect(rects).toHaveLength(10);
    });
  });

  describe("height", () => {
    it("should use default height of 200", () => {
      const data: ChartDataPoint[] = [{ label: "A", value: 100 }];

      const { container } = render(<BarChart data={data} />);

      const svg = container.querySelector("svg");
      // Height = 200 (chart) + 30 (bottom padding) + 20 (top padding) = 250
      expect(svg).toHaveAttribute("height", "250");
    });

    it("should use custom height when provided", () => {
      const data: ChartDataPoint[] = [{ label: "A", value: 100 }];

      const { container } = render(<BarChart data={data} height={300} />);

      const svg = container.querySelector("svg");
      // Height = 300 + 30 + 20 = 350
      expect(svg).toHaveAttribute("height", "350");
    });
  });

  describe("tooltips", () => {
    it("should render tooltips on bars", () => {
      const data: ChartDataPoint[] = [
        { label: "Item", value: 50 },
      ];

      const { container } = render(<BarChart data={data} />);

      const title = container.querySelector("rect title");
      expect(title).toBeInTheDocument();
      expect(title?.textContent).toBe("Item: 50");
    });
  });

  describe("bar dimensions", () => {
    it("should render bars with rounded corners", () => {
      const data: ChartDataPoint[] = [{ label: "A", value: 100 }];

      const { container } = render(<BarChart data={data} />);

      const rect = container.querySelector("rect");
      expect(rect).toHaveAttribute("rx", "2");
    });
  });

  describe("chart container", () => {
    it("should have chart class", () => {
      const data: ChartDataPoint[] = [{ label: "A", value: 100 }];

      const { container } = render(<BarChart data={data} />);

      expect(container.querySelector(".soroban-chart")).toBeInTheDocument();
      expect(container.querySelector(".soroban-chart-bar")).toBeInTheDocument();
    });

    it("should have overflow-x auto for scrollable charts", () => {
      const data: ChartDataPoint[] = [{ label: "A", value: 100 }];

      const { container } = render(<BarChart data={data} />);

      const scrollContainer = container.querySelector(".soroban-chart-bar > div") as HTMLElement;
      expect(scrollContainer.style.overflowX).toBe("auto");
    });
  });

  describe("multiple bars", () => {
    it("should handle many data points", () => {
      const data: ChartDataPoint[] = Array(20).fill(null).map((_, i) => ({
        label: `Item ${i}`,
        value: Math.random() * 100,
      }));

      const { container } = render(<BarChart data={data} />);

      const rects = container.querySelectorAll("rect");
      expect(rects).toHaveLength(20);
    });

    it("should scale bar heights relative to max value", () => {
      const data: ChartDataPoint[] = [
        { label: "A", value: 50 },
        { label: "B", value: 100 },
      ];

      const { container } = render(<BarChart data={data} height={200} />);

      const rects = container.querySelectorAll("rect");
      const heightA = parseFloat(rects[0].getAttribute("height") || "0");
      const heightB = parseFloat(rects[1].getAttribute("height") || "0");

      // B should be twice as tall as A
      expect(heightB).toBeCloseTo(heightA * 2, 0);
    });
  });
});
