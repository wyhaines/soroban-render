import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RenderView } from "./RenderView";

describe("RenderView", () => {
  describe("loading state", () => {
    it("should render default loading spinner", () => {
      render(<RenderView html={null} loading={true} />);

      expect(screen.getByText("Loading contract UI...")).toBeInTheDocument();
    });

    it("should render custom loading component", () => {
      render(
        <RenderView
          html={null}
          loading={true}
          loadingComponent={<div data-testid="custom-loader">Custom Loading</div>}
        />
      );

      expect(screen.getByTestId("custom-loader")).toBeInTheDocument();
      expect(screen.getByText("Custom Loading")).toBeInTheDocument();
    });

    it("should apply className to loading container", () => {
      const { container } = render(
        <RenderView html={null} loading={true} className="my-class" />
      );

      expect(container.querySelector(".soroban-render-loading")).toHaveClass(
        "my-class"
      );
    });
  });

  describe("error state", () => {
    it("should render default error message", () => {
      render(<RenderView html={null} error="Something went wrong" />);

      expect(screen.getByText("Error:")).toBeInTheDocument();
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });

    it("should render custom error component", () => {
      render(
        <RenderView
          html={null}
          error="Error"
          errorComponent={<div data-testid="custom-error">Custom Error</div>}
        />
      );

      expect(screen.getByTestId("custom-error")).toBeInTheDocument();
      expect(screen.getByText("Custom Error")).toBeInTheDocument();
    });

    it("should apply className to error container", () => {
      const { container } = render(
        <RenderView html={null} error="Error" className="my-class" />
      );

      expect(container.querySelector(".soroban-render-error")).toHaveClass(
        "my-class"
      );
    });
  });

  describe("empty state", () => {
    it("should render empty state when html is null", () => {
      render(<RenderView html={null} />);

      expect(screen.getByText("No content to display")).toBeInTheDocument();
      expect(
        screen.getByText(/Enter a contract ID that implements/)
      ).toBeInTheDocument();
    });

    it("should apply className to empty container", () => {
      const { container } = render(
        <RenderView html={null} className="my-class" />
      );

      expect(container.querySelector(".soroban-render-empty")).toHaveClass(
        "my-class"
      );
    });
  });

  describe("content rendering", () => {
    it("should render HTML content", () => {
      const { container } = render(
        <RenderView html="<p>Hello World</p>" />
      );

      expect(container.querySelector("p")).toHaveTextContent("Hello World");
    });

    it("should apply className to content container", () => {
      const { container } = render(
        <RenderView html="<p>Test</p>" className="my-class" />
      );

      expect(container.querySelector(".soroban-render-view")).toHaveClass(
        "my-class"
      );
    });

    it("should apply style to content container", () => {
      const { container } = render(
        <RenderView
          html="<p>Test</p>"
          style={{ backgroundColor: "red" }}
        />
      );

      const view = container.querySelector(".soroban-render-view") as HTMLElement;
      expect(view.style.backgroundColor).toBe("red");
    });

    it("should render complex HTML", () => {
      const html = `
        <h1>Title</h1>
        <p>Paragraph with <strong>bold</strong> text</p>
        <ul>
          <li>Item 1</li>
          <li>Item 2</li>
        </ul>
      `;

      const { container } = render(<RenderView html={html} />);

      expect(container.querySelector("h1")).toHaveTextContent("Title");
      expect(container.querySelector("strong")).toHaveTextContent("bold");
      expect(container.querySelectorAll("li")).toHaveLength(2);
    });

    it("should render links", () => {
      const html = '<a href="https://example.com">Click me</a>';

      const { container } = render(<RenderView html={html} />);

      const link = container.querySelector("a");
      expect(link).toHaveAttribute("href", "https://example.com");
      expect(link).toHaveTextContent("Click me");
    });
  });

  describe("state priority", () => {
    it("should show loading over error", () => {
      render(<RenderView html={null} loading={true} error="Error" />);

      expect(screen.getByText("Loading contract UI...")).toBeInTheDocument();
      expect(screen.queryByText("Error")).not.toBeInTheDocument();
    });

    it("should show error over empty", () => {
      render(<RenderView html={null} error="Error message" />);

      expect(screen.getByText("Error message")).toBeInTheDocument();
      expect(
        screen.queryByText("No content to display")
      ).not.toBeInTheDocument();
    });

    it("should show content when not loading and no error", () => {
      const { container } = render(
        <RenderView html="<p>Content</p>" loading={false} error={null} />
      );

      expect(container.querySelector("p")).toHaveTextContent("Content");
    });
  });
});
