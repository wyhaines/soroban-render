import { describe, it, expect } from "vitest";
import { parseJsonUI, isJsonFormat } from "./json";

describe("parseJsonUI", () => {
  describe("valid documents", () => {
    it("should parse a minimal valid document", () => {
      const result = parseJsonUI(
        JSON.stringify({
          format: "soroban-render-json-v1",
          components: [],
        })
      );

      expect(result.success).toBe(true);
      expect(result.document).toBeDefined();
      expect(result.document?.components).toEqual([]);
    });

    it("should parse document with title", () => {
      const result = parseJsonUI(
        JSON.stringify({
          format: "soroban-render-json-v1",
          title: "My App",
          components: [],
        })
      );

      expect(result.success).toBe(true);
      expect(result.document?.title).toBe("My App");
    });

    it("should parse heading component", () => {
      const result = parseJsonUI(
        JSON.stringify({
          format: "soroban-render-json-v1",
          components: [{ type: "heading", level: 1, text: "Hello" }],
        })
      );

      expect(result.success).toBe(true);
      expect(result.document?.components[0]).toEqual({
        type: "heading",
        level: 1,
        text: "Hello",
      });
    });

    it("should parse text component", () => {
      const result = parseJsonUI(
        JSON.stringify({
          format: "soroban-render-json-v1",
          components: [{ type: "text", content: "Some text" }],
        })
      );

      expect(result.success).toBe(true);
      expect(result.document?.components[0]).toEqual({
        type: "text",
        content: "Some text",
      });
    });

    it("should parse markdown component", () => {
      const result = parseJsonUI(
        JSON.stringify({
          format: "soroban-render-json-v1",
          components: [{ type: "markdown", content: "**bold**" }],
        })
      );

      expect(result.success).toBe(true);
    });

    it("should parse divider component", () => {
      const result = parseJsonUI(
        JSON.stringify({
          format: "soroban-render-json-v1",
          components: [{ type: "divider" }],
        })
      );

      expect(result.success).toBe(true);
    });

    it("should parse form component", () => {
      const result = parseJsonUI(
        JSON.stringify({
          format: "soroban-render-json-v1",
          components: [
            {
              type: "form",
              action: "add_task",
              fields: [{ name: "description", type: "text" }],
              submitLabel: "Add",
            },
          ],
        })
      );

      expect(result.success).toBe(true);
    });

    it("should parse button component", () => {
      const result = parseJsonUI(
        JSON.stringify({
          format: "soroban-render-json-v1",
          components: [
            { type: "button", action: "tx", method: "submit", label: "Submit" },
            { type: "button", action: "render", path: "/home", label: "Home" },
          ],
        })
      );

      expect(result.success).toBe(true);
    });

    it("should parse list component", () => {
      const result = parseJsonUI(
        JSON.stringify({
          format: "soroban-render-json-v1",
          components: [
            {
              type: "list",
              ordered: true,
              items: [{ type: "text", content: "Item 1" }],
            },
          ],
        })
      );

      expect(result.success).toBe(true);
    });

    it("should parse task component", () => {
      const result = parseJsonUI(
        JSON.stringify({
          format: "soroban-render-json-v1",
          components: [
            {
              type: "task",
              id: 1,
              text: "Buy groceries",
              completed: false,
              actions: [
                {
                  type: "tx",
                  method: "complete_task",
                  args: { id: 1 },
                  label: "Done",
                },
              ],
            },
          ],
        })
      );

      expect(result.success).toBe(true);
    });

    it("should parse navigation component", () => {
      const result = parseJsonUI(
        JSON.stringify({
          format: "soroban-render-json-v1",
          components: [
            {
              type: "navigation",
              items: [
                { label: "Home", path: "/", active: true },
                { label: "About", path: "/about" },
              ],
            },
          ],
        })
      );

      expect(result.success).toBe(true);
    });

    it("should parse container component with nested components", () => {
      const result = parseJsonUI(
        JSON.stringify({
          format: "soroban-render-json-v1",
          components: [
            {
              type: "container",
              className: "task-list",
              components: [
                { type: "heading", level: 2, text: "Tasks" },
                { type: "text", content: "No tasks" },
              ],
            },
          ],
        })
      );

      expect(result.success).toBe(true);
    });

    it("should parse include component", () => {
      const result = parseJsonUI(
        JSON.stringify({
          format: "soroban-render-json-v1",
          components: [
            {
              type: "include",
              contract: "CABC123",
              path: "/header",
            },
          ],
        })
      );

      expect(result.success).toBe(true);
    });
  });

  describe("invalid documents", () => {
    it("should reject invalid JSON", () => {
      const result = parseJsonUI("{not valid json}");

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should reject missing format field", () => {
      const result = parseJsonUI(JSON.stringify({ components: [] }));

      expect(result.success).toBe(false);
      expect(result.error).toContain("format");
    });

    it("should reject invalid format version", () => {
      const result = parseJsonUI(
        JSON.stringify({
          format: "soroban-render-json-v99",
          components: [],
        })
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unsupported format version");
    });

    it("should reject missing components array", () => {
      const result = parseJsonUI(
        JSON.stringify({
          format: "soroban-render-json-v1",
        })
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("components");
    });

    it("should reject component without type", () => {
      const result = parseJsonUI(
        JSON.stringify({
          format: "soroban-render-json-v1",
          components: [{ text: "missing type" }],
        })
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("type");
    });

    it("should reject invalid component type", () => {
      const result = parseJsonUI(
        JSON.stringify({
          format: "soroban-render-json-v1",
          components: [{ type: "invalid-type" }],
        })
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("invalid type");
    });

    it("should reject heading without text", () => {
      const result = parseJsonUI(
        JSON.stringify({
          format: "soroban-render-json-v1",
          components: [{ type: "heading", level: 1 }],
        })
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("text");
    });

    it("should reject heading with invalid level", () => {
      const result = parseJsonUI(
        JSON.stringify({
          format: "soroban-render-json-v1",
          components: [{ type: "heading", level: 7, text: "Invalid" }],
        })
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("level");
    });

    it("should reject text without content", () => {
      const result = parseJsonUI(
        JSON.stringify({
          format: "soroban-render-json-v1",
          components: [{ type: "text" }],
        })
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("content");
    });

    it("should reject form without action", () => {
      const result = parseJsonUI(
        JSON.stringify({
          format: "soroban-render-json-v1",
          components: [{ type: "form", fields: [] }],
        })
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("action");
    });

    it("should reject form without fields", () => {
      const result = parseJsonUI(
        JSON.stringify({
          format: "soroban-render-json-v1",
          components: [{ type: "form", action: "submit" }],
        })
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("fields");
    });

    it("should reject button without label", () => {
      const result = parseJsonUI(
        JSON.stringify({
          format: "soroban-render-json-v1",
          components: [{ type: "button", action: "tx" }],
        })
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("label");
    });

    it("should reject button with invalid action", () => {
      const result = parseJsonUI(
        JSON.stringify({
          format: "soroban-render-json-v1",
          components: [{ type: "button", action: "invalid", label: "Click" }],
        })
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("action");
    });

    it("should reject task without completed field", () => {
      const result = parseJsonUI(
        JSON.stringify({
          format: "soroban-render-json-v1",
          components: [{ type: "task", id: 1, text: "Task" }],
        })
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("completed");
    });

    it("should reject include without contract", () => {
      const result = parseJsonUI(
        JSON.stringify({
          format: "soroban-render-json-v1",
          components: [{ type: "include", path: "/header" }],
        })
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("contract");
    });

    it("should validate nested container components", () => {
      const result = parseJsonUI(
        JSON.stringify({
          format: "soroban-render-json-v1",
          components: [
            {
              type: "container",
              components: [{ type: "heading" }], // Missing text and level
            },
          ],
        })
      );

      expect(result.success).toBe(false);
    });
  });
});

describe("isJsonFormat", () => {
  it("should return true for valid soroban-render JSON", () => {
    const json = JSON.stringify({
      format: "soroban-render-json-v1",
      components: [],
    });
    expect(isJsonFormat(json)).toBe(true);
  });

  it("should return true for any soroban-render-json prefix", () => {
    const json = JSON.stringify({
      format: "soroban-render-json-v2",
      components: [],
    });
    expect(isJsonFormat(json)).toBe(true);
  });

  it("should return false for non-soroban JSON", () => {
    expect(isJsonFormat(JSON.stringify({ foo: "bar" }))).toBe(false);
  });

  it("should return false for markdown content", () => {
    expect(isJsonFormat("# Hello World")).toBe(false);
  });

  it("should return false for empty string", () => {
    expect(isJsonFormat("")).toBe(false);
  });

  it("should return false for malformed JSON starting with {", () => {
    expect(isJsonFormat("{not valid")).toBe(false);
  });

  it("should return false for JSON arrays", () => {
    expect(isJsonFormat("[1, 2, 3]")).toBe(false);
  });

  it("should handle whitespace around JSON", () => {
    const json = `
      ${JSON.stringify({ format: "soroban-render-json-v1", components: [] })}
    `;
    expect(isJsonFormat(json)).toBe(true);
  });
});
