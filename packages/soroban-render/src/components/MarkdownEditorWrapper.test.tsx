import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MarkdownEditorWrapper } from "./MarkdownEditorWrapper";

// Mock MDEditor
vi.mock("@uiw/react-md-editor", () => ({
  default: ({ value, onChange, preview, height, textareaProps }: {
    value: string;
    onChange: (value: string | undefined) => void;
    preview: string;
    height: number;
    textareaProps?: { placeholder?: string };
  }) => (
    <div data-testid="mock-md-editor">
      <textarea
        data-testid="md-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={textareaProps?.placeholder}
        style={{ height: `${height}px` }}
        data-preview={preview}
      />
    </div>
  ),
}));

describe("MarkdownEditorWrapper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("initial rendering", () => {
    it("should render with initial value", () => {
      render(
        <MarkdownEditorWrapper
          name="content"
          initialValue="Initial text"
        />
      );

      expect(screen.getByTestId("md-textarea")).toHaveValue("Initial text");
    });

    it("should render hidden input with name", () => {
      const { container } = render(
        <MarkdownEditorWrapper
          name="body"
          initialValue=""
        />
      );

      const hiddenInput = container.querySelector('input[type="hidden"]');
      expect(hiddenInput).toHaveAttribute("name", "body");
    });

    it("should have data-color-mode=dark", () => {
      const { container } = render(
        <MarkdownEditorWrapper
          name="content"
          initialValue=""
        />
      );

      const wrapper = container.querySelector(".md-editor-wrapper");
      expect(wrapper).toHaveAttribute("data-color-mode", "dark");
    });

    it("should inject style overrides", () => {
      const { container } = render(
        <MarkdownEditorWrapper
          name="content"
          initialValue=""
        />
      );

      const style = container.querySelector("style");
      expect(style).toBeInTheDocument();
      expect(style?.textContent).toContain("--color-fg-default");
    });
  });

  describe("placeholder", () => {
    it("should render with placeholder", () => {
      render(
        <MarkdownEditorWrapper
          name="content"
          initialValue=""
          placeholder="Enter markdown here..."
        />
      );

      expect(screen.getByTestId("md-textarea")).toHaveAttribute(
        "placeholder",
        "Enter markdown here..."
      );
    });

    it("should work without placeholder", () => {
      render(
        <MarkdownEditorWrapper
          name="content"
          initialValue=""
        />
      );

      expect(screen.getByTestId("md-textarea")).not.toHaveAttribute("placeholder");
    });
  });

  describe("rows/height calculation", () => {
    it("should calculate height from default rows (10)", () => {
      render(
        <MarkdownEditorWrapper
          name="content"
          initialValue=""
        />
      );

      // Default 10 rows * 24px = 240px
      expect(screen.getByTestId("md-textarea")).toHaveStyle({ height: "240px" });
    });

    it("should calculate height from custom rows", () => {
      render(
        <MarkdownEditorWrapper
          name="content"
          initialValue=""
          rows={15}
        />
      );

      // 15 rows * 24px = 360px
      expect(screen.getByTestId("md-textarea")).toHaveStyle({ height: "360px" });
    });

    it("should use minimum height of 200px for small rows", () => {
      render(
        <MarkdownEditorWrapper
          name="content"
          initialValue=""
          rows={5}
        />
      );

      // 5 rows * 24 = 120px, but min is 200px
      expect(screen.getByTestId("md-textarea")).toHaveStyle({ height: "200px" });
    });
  });

  describe("value changes", () => {
    it("should update hidden input when value changes", () => {
      const { container } = render(
        <MarkdownEditorWrapper
          name="content"
          initialValue=""
        />
      );

      const hiddenInput = container.querySelector('input[type="hidden"]') as HTMLInputElement;
      expect(hiddenInput.value).toBe("");

      fireEvent.change(screen.getByTestId("md-textarea"), {
        target: { value: "New content" },
      });

      expect(hiddenInput.value).toBe("New content");
    });

    it("should call onChange callback when value changes", () => {
      const onChange = vi.fn();

      render(
        <MarkdownEditorWrapper
          name="content"
          initialValue=""
          onChange={onChange}
        />
      );

      // onChange is called with initial value on mount
      expect(onChange).toHaveBeenCalledWith("");

      fireEvent.change(screen.getByTestId("md-textarea"), {
        target: { value: "Updated" },
      });

      expect(onChange).toHaveBeenCalledWith("Updated");
    });

    it("should handle empty string from editor", () => {
      const { container } = render(
        <MarkdownEditorWrapper
          name="content"
          initialValue="Initial"
        />
      );

      fireEvent.change(screen.getByTestId("md-textarea"), {
        target: { value: "" },
      });

      const hiddenInput = container.querySelector('input[type="hidden"]') as HTMLInputElement;
      expect(hiddenInput.value).toBe("");
    });
  });

  describe("editor configuration", () => {
    it("should use edit preview mode", () => {
      render(
        <MarkdownEditorWrapper
          name="content"
          initialValue=""
        />
      );

      expect(screen.getByTestId("md-textarea")).toHaveAttribute("data-preview", "edit");
    });
  });

  describe("form integration", () => {
    it("should work within a form", () => {
      const onSubmit = vi.fn((e: React.FormEvent) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const data = new FormData(form);
        onSubmit.mock.results = [{ value: Object.fromEntries(data.entries()) }];
      });

      const { container } = render(
        <form onSubmit={onSubmit}>
          <MarkdownEditorWrapper
            name="content"
            initialValue="Form content"
          />
          <button type="submit">Submit</button>
        </form>
      );

      const hiddenInput = container.querySelector('input[type="hidden"]') as HTMLInputElement;
      expect(hiddenInput.value).toBe("Form content");
    });

    it("should have current value in hidden input for form submission", () => {
      const { container } = render(
        <form>
          <MarkdownEditorWrapper
            name="markdown"
            initialValue="# Heading"
          />
        </form>
      );

      fireEvent.change(screen.getByTestId("md-textarea"), {
        target: { value: "# Updated Heading\n\nParagraph" },
      });

      const hiddenInput = container.querySelector('input[type="hidden"]') as HTMLInputElement;
      expect(hiddenInput.value).toBe("# Updated Heading\n\nParagraph");
    });
  });
});
