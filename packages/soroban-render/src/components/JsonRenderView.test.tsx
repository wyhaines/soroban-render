import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { JsonRenderView } from "./JsonRenderView";
import type { JsonUIDocument } from "../parsers/json";

// Mock parseMarkdown for markdown component tests
vi.mock("../parsers/markdown", () => ({
  parseMarkdown: vi.fn().mockImplementation((content: string) =>
    Promise.resolve(`<p>${content}</p>`)
  ),
}));

describe("JsonRenderView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("basic rendering", () => {
    it("should render empty document", () => {
      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [],
      };

      const { container } = render(<JsonRenderView document={document} />);

      expect(container.querySelector(".soroban-render-json")).toBeInTheDocument();
    });

    it("should apply className prop", () => {
      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [],
      };

      const { container } = render(
        <JsonRenderView document={document} className="custom-class" />
      );

      expect(container.querySelector(".soroban-render-json")).toHaveClass("custom-class");
    });

    it("should apply style prop", () => {
      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [],
      };

      const { container } = render(
        <JsonRenderView document={document} style={{ backgroundColor: "blue" }} />
      );

      const element = container.querySelector(".soroban-render-json") as HTMLElement;
      expect(element.style.backgroundColor).toBe("blue");
    });

    it("should render document title", () => {
      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        title: "Test Page",
        components: [],
      };

      const { container } = render(<JsonRenderView document={document} />);

      expect(container.querySelector("title")).toHaveTextContent("Test Page");
    });
  });

  describe("heading component", () => {
    it("should render h1 heading", () => {
      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [{ type: "heading", level: 1, text: "Main Title" }],
      };

      render(<JsonRenderView document={document} />);

      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Main Title");
    });

    it("should render h2-h6 headings", () => {
      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [
          { type: "heading", level: 2, text: "Level 2" },
          { type: "heading", level: 3, text: "Level 3" },
          { type: "heading", level: 4, text: "Level 4" },
          { type: "heading", level: 5, text: "Level 5" },
          { type: "heading", level: 6, text: "Level 6" },
        ],
      };

      render(<JsonRenderView document={document} />);

      expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Level 2");
      expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("Level 3");
      expect(screen.getByRole("heading", { level: 4 })).toHaveTextContent("Level 4");
      expect(screen.getByRole("heading", { level: 5 })).toHaveTextContent("Level 5");
      expect(screen.getByRole("heading", { level: 6 })).toHaveTextContent("Level 6");
    });

    it("should clamp heading level between 1 and 6", () => {
      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [
          { type: "heading", level: 0, text: "Too Low" },
          { type: "heading", level: 7, text: "Too High" },
        ],
      };

      const { container } = render(<JsonRenderView document={document} />);

      // Level 0 should become h1, level 7 should become h6
      expect(container.querySelector("h1")).toHaveTextContent("Too Low");
      expect(container.querySelector("h6")).toHaveTextContent("Too High");
    });
  });

  describe("text component", () => {
    it("should render text content in paragraph", () => {
      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [{ type: "text", content: "Hello World" }],
      };

      render(<JsonRenderView document={document} />);

      expect(screen.getByText("Hello World")).toBeInTheDocument();
    });
  });

  describe("markdown component", () => {
    it("should render markdown content", async () => {
      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [{ type: "markdown", content: "# Markdown Title" }],
      };

      render(<JsonRenderView document={document} />);

      await waitFor(() => {
        expect(screen.getByText("# Markdown Title")).toBeInTheDocument();
      });
    });
  });

  describe("divider component", () => {
    it("should render horizontal rule", () => {
      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [{ type: "divider" }],
      };

      const { container } = render(<JsonRenderView document={document} />);

      expect(container.querySelector("hr")).toBeInTheDocument();
    });
  });

  describe("button component", () => {
    it("should render button with label", () => {
      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [{ type: "button", label: "Click Me", action: "render", path: "/home" }],
      };

      render(<JsonRenderView document={document} />);

      expect(screen.getByRole("button", { name: "Click Me" })).toBeInTheDocument();
    });

    it("should call onPathChange for render action", () => {
      const onPathChange = vi.fn();
      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [{ type: "button", label: "Go", action: "render", path: "/page" }],
      };

      render(<JsonRenderView document={document} onPathChange={onPathChange} />);

      fireEvent.click(screen.getByRole("button", { name: "Go" }));

      expect(onPathChange).toHaveBeenCalledWith("/page");
    });

    it("should call onTransaction for tx action", () => {
      const onTransaction = vi.fn();
      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [{
          type: "button",
          label: "Submit",
          action: "tx",
          method: "create_task",
          args: { name: "Test" },
        }],
      };

      render(<JsonRenderView document={document} onTransaction={onTransaction} />);

      fireEvent.click(screen.getByRole("button", { name: "Submit" }));

      expect(onTransaction).toHaveBeenCalledWith("create_task", { name: "Test" });
    });

    it("should apply variant class", () => {
      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [
          { type: "button", label: "Primary", action: "render", path: "/", variant: "primary" },
          { type: "button", label: "Danger", action: "render", path: "/", variant: "danger" },
        ],
      };

      render(<JsonRenderView document={document} />);

      expect(screen.getByRole("button", { name: "Primary" })).toHaveClass("soroban-render-button-primary");
      expect(screen.getByRole("button", { name: "Danger" })).toHaveClass("soroban-render-button-danger");
    });

    it("should use secondary variant as default", () => {
      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [{ type: "button", label: "Default", action: "render", path: "/" }],
      };

      render(<JsonRenderView document={document} />);

      expect(screen.getByRole("button", { name: "Default" })).toHaveClass("soroban-render-button-secondary");
    });
  });

  describe("form component", () => {
    it("should render form with fields", () => {
      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [{
          type: "form",
          action: "create_task",
          fields: [
            { name: "title", type: "text", label: "Title" },
            { name: "description", type: "textarea", label: "Description" },
          ],
        }],
      };

      render(<JsonRenderView document={document} />);

      expect(screen.getByLabelText("Title")).toBeInTheDocument();
      expect(screen.getByLabelText("Description")).toBeInTheDocument();
    });

    it("should render submit button with default label", () => {
      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [{
          type: "form",
          action: "create_task",
          fields: [{ name: "title", type: "text" }],
        }],
      };

      render(<JsonRenderView document={document} />);

      expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();
    });

    it("should render submit button with custom label", () => {
      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [{
          type: "form",
          action: "create_task",
          fields: [{ name: "title", type: "text" }],
          submitLabel: "Create Task",
        }],
      };

      render(<JsonRenderView document={document} />);

      expect(screen.getByRole("button", { name: "Create Task" })).toBeInTheDocument();
    });

    it("should call onFormSubmit with form data", () => {
      const onFormSubmit = vi.fn();
      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [{
          type: "form",
          action: "create_task",
          fields: [{ name: "title", type: "text" }],
        }],
      };

      render(<JsonRenderView document={document} onFormSubmit={onFormSubmit} />);

      fireEvent.change(screen.getByRole("textbox"), { target: { value: "My Task" } });
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));

      expect(onFormSubmit).toHaveBeenCalledWith("create_task", { title: "My Task" });
    });

    it("should render select field", () => {
      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [{
          type: "form",
          action: "select_option",
          fields: [{
            name: "priority",
            type: "select",
            label: "Priority",
            options: [
              { value: "low", label: "Low" },
              { value: "high", label: "High" },
            ],
          }],
        }],
      };

      render(<JsonRenderView document={document} />);

      expect(screen.getByLabelText("Priority")).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Low" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "High" })).toBeInTheDocument();
    });

    it("should render checkbox field", () => {
      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [{
          type: "form",
          action: "toggle",
          fields: [{ name: "active", type: "checkbox", label: "Active" }],
        }],
      };

      render(<JsonRenderView document={document} />);

      expect(screen.getByRole("checkbox")).toBeInTheDocument();
      expect(screen.getByLabelText("Active")).toBeInTheDocument();
    });

    it("should handle checkbox state", () => {
      const onFormSubmit = vi.fn();
      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [{
          type: "form",
          action: "toggle",
          fields: [{ name: "active", type: "checkbox", label: "Active" }],
        }],
      };

      render(<JsonRenderView document={document} onFormSubmit={onFormSubmit} />);

      fireEvent.click(screen.getByRole("checkbox"));
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));

      expect(onFormSubmit).toHaveBeenCalledWith("toggle", { active: true });
    });

    it("should use default values from fields", () => {
      const onFormSubmit = vi.fn();
      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [{
          type: "form",
          action: "update",
          fields: [{ name: "name", type: "text", value: "Default Name" }],
        }],
      };

      render(<JsonRenderView document={document} onFormSubmit={onFormSubmit} />);

      expect(screen.getByRole("textbox")).toHaveValue("Default Name");

      fireEvent.click(screen.getByRole("button", { name: "Submit" }));
      expect(onFormSubmit).toHaveBeenCalledWith("update", { name: "Default Name" });
    });

    it("should reset form after submission", () => {
      const onFormSubmit = vi.fn();
      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [{
          type: "form",
          action: "create",
          fields: [{ name: "title", type: "text" }],
        }],
      };

      render(<JsonRenderView document={document} onFormSubmit={onFormSubmit} />);

      fireEvent.change(screen.getByRole("textbox"), { target: { value: "Test" } });
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));

      expect(screen.getByRole("textbox")).toHaveValue("");
    });
  });

  describe("list component", () => {
    it("should render unordered list", () => {
      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [{
          type: "list",
          ordered: false,
          items: [
            { type: "item", content: "Item 1" },
            { type: "item", content: "Item 2" },
          ],
        }],
      };

      const { container } = render(<JsonRenderView document={document} />);

      expect(container.querySelector("ul")).toBeInTheDocument();
      expect(screen.getByText("Item 1")).toBeInTheDocument();
      expect(screen.getByText("Item 2")).toBeInTheDocument();
    });

    it("should render ordered list", () => {
      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [{
          type: "list",
          ordered: true,
          items: [
            { type: "item", content: "First" },
            { type: "item", content: "Second" },
          ],
        }],
      };

      const { container } = render(<JsonRenderView document={document} />);

      expect(container.querySelector("ol")).toBeInTheDocument();
    });

    it("should render nested components in list items", () => {
      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [{
          type: "list",
          ordered: false,
          items: [
            { type: "item", content: { type: "text", content: "Nested text" } },
          ],
        }],
      };

      render(<JsonRenderView document={document} />);

      expect(screen.getByText("Nested text")).toBeInTheDocument();
    });
  });

  describe("task component", () => {
    it("should render task with checkbox", () => {
      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [{
          type: "task",
          text: "Complete task",
          completed: false,
        }],
      };

      render(<JsonRenderView document={document} />);

      expect(screen.getByText("Complete task")).toBeInTheDocument();
      expect(screen.getByText("☐")).toBeInTheDocument();
    });

    it("should render completed task", () => {
      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [{
          type: "task",
          text: "Done task",
          completed: true,
        }],
      };

      const { container } = render(<JsonRenderView document={document} />);

      expect(screen.getByText("☑")).toBeInTheDocument();
      expect(container.querySelector(".soroban-render-task")).toHaveClass("completed");
    });

    it("should render task actions", () => {
      const onTransaction = vi.fn();
      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [{
          type: "task",
          text: "Task with action",
          completed: false,
          actions: [
            { type: "tx", label: "Complete", method: "complete_task", args: { id: 1 } },
          ],
        }],
      };

      render(<JsonRenderView document={document} onTransaction={onTransaction} />);

      fireEvent.click(screen.getByRole("button", { name: "Complete" }));

      expect(onTransaction).toHaveBeenCalledWith("complete_task", { id: 1 });
    });

    it("should handle render action in task", () => {
      const onPathChange = vi.fn();
      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [{
          type: "task",
          text: "Task",
          completed: false,
          actions: [
            { type: "render", label: "View", path: "/task/1" },
          ],
        }],
      };

      render(<JsonRenderView document={document} onPathChange={onPathChange} />);

      fireEvent.click(screen.getByRole("button", { name: "View" }));

      expect(onPathChange).toHaveBeenCalledWith("/task/1");
    });
  });

  describe("navigation component", () => {
    it("should render navigation links", () => {
      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [{
          type: "navigation",
          items: [
            { label: "Home", path: "/" },
            { label: "About", path: "/about" },
          ],
        }],
      };

      render(<JsonRenderView document={document} />);

      expect(screen.getByText("Home")).toBeInTheDocument();
      expect(screen.getByText("About")).toBeInTheDocument();
    });

    it("should render separators between links", () => {
      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [{
          type: "navigation",
          items: [
            { label: "Home", path: "/" },
            { label: "About", path: "/about" },
          ],
        }],
      };

      render(<JsonRenderView document={document} />);

      expect(screen.getByText("|")).toBeInTheDocument();
    });

    it("should highlight active link", () => {
      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [{
          type: "navigation",
          items: [
            { label: "Home", path: "/", active: true },
            { label: "About", path: "/about" },
          ],
        }],
      };

      render(<JsonRenderView document={document} />);

      expect(screen.getByText("Home")).toHaveClass("active");
      expect(screen.getByText("About")).not.toHaveClass("active");
    });

    it("should call onPathChange when link clicked", () => {
      const onPathChange = vi.fn();
      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [{
          type: "navigation",
          items: [
            { label: "Home", path: "/" },
          ],
        }],
      };

      render(<JsonRenderView document={document} onPathChange={onPathChange} />);

      fireEvent.click(screen.getByText("Home"));

      expect(onPathChange).toHaveBeenCalledWith("/");
    });
  });

  describe("container component", () => {
    it("should render container with children", () => {
      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [{
          type: "container",
          components: [
            { type: "text", content: "Child 1" },
            { type: "text", content: "Child 2" },
          ],
        }],
      };

      render(<JsonRenderView document={document} />);

      expect(screen.getByText("Child 1")).toBeInTheDocument();
      expect(screen.getByText("Child 2")).toBeInTheDocument();
    });

    it("should apply className to container", () => {
      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [{
          type: "container",
          className: "custom-container",
          components: [],
        }],
      };

      const { container } = render(<JsonRenderView document={document} />);

      expect(container.querySelector(".soroban-render-container")).toHaveClass("custom-container");
    });
  });

  describe("include component", () => {
    it("should render placeholder when no onInclude", () => {
      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [{
          type: "include",
          contract: "CONTRACT123",
        }],
      };

      render(<JsonRenderView document={document} />);

      expect(screen.getByText("[Include: CONTRACT123]")).toBeInTheDocument();
    });

    it("should call onInclude and render result", () => {
      const onInclude = vi.fn().mockReturnValue(<div>Included Content</div>);
      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [{
          type: "include",
          contract: "CONTRACT123",
          path: "/section",
        }],
      };

      render(<JsonRenderView document={document} onInclude={onInclude} />);

      expect(onInclude).toHaveBeenCalledWith("CONTRACT123", "/section");
      expect(screen.getByText("Included Content")).toBeInTheDocument();
    });
  });

  describe("chart component", () => {
    it("should render pie chart", () => {
      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [{
          type: "chart",
          chartType: "pie",
          data: [
            { label: "A", value: 30 },
            { label: "B", value: 70 },
          ],
          title: "Pie Chart",
        }],
      };

      render(<JsonRenderView document={document} />);

      expect(screen.getByText("Pie Chart")).toBeInTheDocument();
    });

    it("should render gauge chart", () => {
      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [{
          type: "chart",
          chartType: "gauge",
          value: 75,
          max: 100,
          label: "Progress",
        }],
      };

      render(<JsonRenderView document={document} />);

      expect(screen.getByText("Progress")).toBeInTheDocument();
      expect(screen.getByText("75%")).toBeInTheDocument();
    });

    it("should render bar chart", () => {
      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [{
          type: "chart",
          chartType: "bar",
          data: [
            { label: "Jan", value: 100 },
            { label: "Feb", value: 200 },
          ],
          title: "Monthly Data",
        }],
      };

      render(<JsonRenderView document={document} />);

      expect(screen.getByText("Monthly Data")).toBeInTheDocument();
    });
  });

  describe("multiple components", () => {
    it("should render multiple components in order", () => {
      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [
          { type: "heading", level: 1, text: "Title" },
          { type: "text", content: "Description" },
          { type: "divider" },
          { type: "button", label: "Action", action: "render", path: "/" },
        ],
      };

      const { container } = render(<JsonRenderView document={document} />);

      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Title");
      expect(screen.getByText("Description")).toBeInTheDocument();
      expect(container.querySelector("hr")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Action" })).toBeInTheDocument();
    });
  });
});
