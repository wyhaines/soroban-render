import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { GaugeChart } from "./GaugeChart";

describe("GaugeChart", () => {
  describe("value display", () => {
    it("should display percentage value", () => {
      render(<GaugeChart value={75} max={100} />);

      expect(screen.getByText("75%")).toBeInTheDocument();
    });

    it("should display value / max", () => {
      render(<GaugeChart value={75} max={100} />);

      expect(screen.getByText("75 / 100")).toBeInTheDocument();
    });

    it("should handle zero value", () => {
      render(<GaugeChart value={0} max={100} />);

      expect(screen.getByText("0%")).toBeInTheDocument();
      expect(screen.getByText("0 / 100")).toBeInTheDocument();
    });

    it("should handle max value", () => {
      render(<GaugeChart value={100} max={100} />);

      expect(screen.getByText("100%")).toBeInTheDocument();
    });
  });

  describe("value clamping", () => {
    it("should clamp value above max", () => {
      render(<GaugeChart value={150} max={100} />);

      // Value should be clamped to 100
      expect(screen.getByText("100%")).toBeInTheDocument();
      expect(screen.getByText("100 / 100")).toBeInTheDocument();
    });

    it("should clamp negative value to 0", () => {
      render(<GaugeChart value={-50} max={100} />);

      expect(screen.getByText("0%")).toBeInTheDocument();
      expect(screen.getByText("0 / 100")).toBeInTheDocument();
    });
  });

  describe("label", () => {
    it("should display label when provided", () => {
      render(<GaugeChart value={50} max={100} label="Progress" />);

      expect(screen.getByText("Progress")).toBeInTheDocument();
    });

    it("should not display label when not provided", () => {
      const { container } = render(<GaugeChart value={50} max={100} />);

      // No label div should be present
      const labelDivs = container.querySelectorAll(".soroban-chart-gauge > div");
      expect(labelDivs).toHaveLength(0);
    });
  });

  describe("rendering", () => {
    it("should render SVG with arcs", () => {
      const { container } = render(<GaugeChart value={50} max={100} />);

      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();

      // Should have background arc and value arc
      const paths = container.querySelectorAll("path");
      expect(paths).toHaveLength(2);
    });

    it("should not render value arc when value is 0", () => {
      const { container } = render(<GaugeChart value={0} max={100} />);

      // Should only have background arc
      const paths = container.querySelectorAll("path");
      expect(paths).toHaveLength(1);
    });
  });

  describe("colors", () => {
    it("should use custom color when provided", () => {
      const { container } = render(
        <GaugeChart value={50} max={100} color="#ff0000" />
      );

      const paths = container.querySelectorAll("path");
      const valueArc = paths[1]; // Second path is value arc
      expect(valueArc).toHaveAttribute("stroke", "#ff0000");
    });

    it("should use default blue color", () => {
      const { container } = render(<GaugeChart value={50} max={100} />);

      const paths = container.querySelectorAll("path");
      const valueArc = paths[1];
      expect(valueArc).toHaveAttribute("stroke", "#3b82f6");
    });
  });

  describe("size", () => {
    it("should use default size of 160", () => {
      const { container } = render(<GaugeChart value={50} max={100} />);

      const svg = container.querySelector("svg");
      expect(svg).toHaveAttribute("width", "160");
    });

    it("should use custom size when provided", () => {
      const { container } = render(
        <GaugeChart value={50} max={100} size={200} />
      );

      const svg = container.querySelector("svg");
      expect(svg).toHaveAttribute("width", "200");
    });
  });

  describe("edge cases", () => {
    it("should handle max of 0", () => {
      render(<GaugeChart value={50} max={0} />);

      // When max is 0, percentage should be 0
      expect(screen.getByText("0%")).toBeInTheDocument();
    });

    it("should render fractional percentages", () => {
      render(<GaugeChart value={33} max={100} />);

      expect(screen.getByText("33%")).toBeInTheDocument();
    });

    it("should round percentage display", () => {
      render(<GaugeChart value={33.7} max={100} />);

      // Should round to nearest integer
      expect(screen.getByText("34%")).toBeInTheDocument();
    });
  });

  describe("chart container", () => {
    it("should have chart class", () => {
      const { container } = render(<GaugeChart value={50} max={100} />);

      expect(container.querySelector(".soroban-chart")).toBeInTheDocument();
      expect(container.querySelector(".soroban-chart-gauge")).toBeInTheDocument();
    });

    it("should center content", () => {
      const { container } = render(<GaugeChart value={50} max={100} />);

      const chartDiv = container.querySelector(".soroban-chart-gauge") as HTMLElement;
      expect(chartDiv.style.textAlign).toBe("center");
    });
  });

  describe("arc rendering", () => {
    it("should render background arc", () => {
      const { container } = render(<GaugeChart value={50} max={100} />);

      const paths = container.querySelectorAll("path");
      const backgroundArc = paths[0];
      expect(backgroundArc).toHaveAttribute("stroke", "#e5e7eb");
    });

    it("should have round stroke linecap", () => {
      const { container } = render(<GaugeChart value={50} max={100} />);

      const paths = container.querySelectorAll("path");
      paths.forEach((path) => {
        expect(path).toHaveAttribute("stroke-linecap", "round");
      });
    });
  });
});
