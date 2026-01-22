import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PieChart } from "./PieChart";
import type { ChartDataPoint } from "../../parsers/json";

describe("PieChart", () => {
  describe("empty state", () => {
    it("should show message when data is empty", () => {
      render(<PieChart data={[]} />);

      expect(screen.getByText("No data available")).toBeInTheDocument();
    });

    it("should show message when data is undefined", () => {
      // @ts-expect-error - testing undefined data
      render(<PieChart data={undefined} />);

      expect(screen.getByText("No data available")).toBeInTheDocument();
    });

    it("should show message when all values are zero", () => {
      const data: ChartDataPoint[] = [
        { label: "A", value: 0 },
        { label: "B", value: 0 },
      ];

      render(<PieChart data={data} />);

      expect(screen.getByText("No data to display")).toBeInTheDocument();
    });
  });

  describe("rendering", () => {
    it("should render SVG with slices", () => {
      const data: ChartDataPoint[] = [
        { label: "Apples", value: 30 },
        { label: "Oranges", value: 70 },
      ];

      const { container } = render(<PieChart data={data} />);

      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();

      const paths = container.querySelectorAll("path");
      expect(paths).toHaveLength(2);
    });

    it("should render title when provided", () => {
      const data: ChartDataPoint[] = [
        { label: "A", value: 50 },
        { label: "B", value: 50 },
      ];

      render(<PieChart data={data} title="Fruit Distribution" />);

      expect(screen.getByText("Fruit Distribution")).toBeInTheDocument();
    });

    it("should not render title when not provided", () => {
      const data: ChartDataPoint[] = [
        { label: "A", value: 100 },
      ];

      const { container } = render(<PieChart data={data} />);

      expect(container.querySelector("h4")).not.toBeInTheDocument();
    });
  });

  describe("legend", () => {
    it("should render legend with labels", () => {
      const data: ChartDataPoint[] = [
        { label: "Red", value: 25 },
        { label: "Blue", value: 75 },
      ];

      render(<PieChart data={data} />);

      // Legend shows "label: value (percentage%)" - use getAllByText since labels appear
      // in both tooltip and legend
      expect(screen.getAllByText(/Red/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Blue/).length).toBeGreaterThanOrEqual(1);
    });

    it("should calculate correct percentages", () => {
      const data: ChartDataPoint[] = [
        { label: "A", value: 25 },
        { label: "B", value: 75 },
      ];

      render(<PieChart data={data} />);

      // 25% for A, 75% for B - both appear in legend and tooltip
      // Use getAllByText since each percentage appears twice (legend + tooltip)
      expect(screen.getAllByText(/25\.0%/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/75\.0%/).length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("colors", () => {
    it("should use custom colors when provided", () => {
      const data: ChartDataPoint[] = [
        { label: "Custom", value: 100, color: "#ff0000" },
      ];

      const { container } = render(<PieChart data={data} />);

      const path = container.querySelector("path");
      expect(path).toHaveAttribute("fill", "#ff0000");
    });

    it("should use default colors when not provided", () => {
      const data: ChartDataPoint[] = [
        { label: "Default", value: 100 },
      ];

      const { container } = render(<PieChart data={data} />);

      const path = container.querySelector("path");
      // First default color is blue
      expect(path).toHaveAttribute("fill", "#3b82f6");
    });
  });

  describe("size", () => {
    it("should use default size of 200", () => {
      const data: ChartDataPoint[] = [{ label: "A", value: 100 }];

      const { container } = render(<PieChart data={data} />);

      const svg = container.querySelector("svg");
      expect(svg).toHaveAttribute("width", "200");
      expect(svg).toHaveAttribute("height", "200");
    });

    it("should use custom size when provided", () => {
      const data: ChartDataPoint[] = [{ label: "A", value: 100 }];

      const { container } = render(<PieChart data={data} size={300} />);

      const svg = container.querySelector("svg");
      expect(svg).toHaveAttribute("width", "300");
      expect(svg).toHaveAttribute("height", "300");
    });
  });

  describe("tooltips", () => {
    it("should render tooltips on slices", () => {
      const data: ChartDataPoint[] = [
        { label: "Item", value: 50 },
      ];

      const { container } = render(<PieChart data={data} />);

      const title = container.querySelector("path title");
      expect(title).toBeInTheDocument();
      expect(title?.textContent).toContain("Item: 50");
      expect(title?.textContent).toContain("100.0%");
    });
  });

  describe("chart container", () => {
    it("should have chart class", () => {
      const data: ChartDataPoint[] = [{ label: "A", value: 100 }];

      const { container } = render(<PieChart data={data} />);

      expect(container.querySelector(".soroban-chart")).toBeInTheDocument();
      expect(container.querySelector(".soroban-chart-pie")).toBeInTheDocument();
    });
  });
});
