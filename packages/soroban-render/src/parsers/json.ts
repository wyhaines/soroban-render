/**
 * Soroban Render JSON Format Parser
 *
 * JSON UI Format v1 Specification:
 *
 * {
 *   "format": "soroban-render-json-v1",
 *   "title": "Optional page title",
 *   "components": [Component, ...]
 * }
 *
 * Component Types:
 * - heading: { type: "heading", level: 1-6, text: "string" }
 * - text: { type: "text", content: "string" }
 * - markdown: { type: "markdown", content: "markdown string" }
 * - divider: { type: "divider" }
 * - form: { type: "form", action: "method_name", fields: [Field, ...], submitLabel: "string" }
 * - button: { type: "button", action: "tx" | "render", method?: "string", path?: "string", args?: {}, label: "string" }
 * - list: { type: "list", ordered?: boolean, items: [ListItem | Component, ...] }
 * - task: { type: "task", id: number, text: "string", completed: boolean, actions?: [Button, ...] }
 * - navigation: { type: "navigation", items: [{ label: "string", path: "string" }, ...] }
 * - container: { type: "container", className?: "string", components: [Component, ...] }
 * - include: { type: "include", contract: "string", path?: "string" } (Phase 4)
 *
 * Field Types:
 * - { name: "string", type: "text" | "number" | "email" | "password" | "textarea", placeholder?: "string", required?: boolean, value?: "string" }
 * - { name: "string", type: "select", options: [{ value: "string", label: "string" }, ...], required?: boolean }
 * - { name: "string", type: "checkbox", label?: "string", checked?: boolean }
 */

export interface JsonUIDocument {
  format: "soroban-render-json-v1";
  title?: string;
  components: JsonComponent[];
}

export type JsonComponent =
  | HeadingComponent
  | TextComponent
  | MarkdownComponent
  | DividerComponent
  | FormComponent
  | ButtonComponent
  | ListComponent
  | TaskComponent
  | NavigationComponent
  | ContainerComponent
  | IncludeComponent;

export interface HeadingComponent {
  type: "heading";
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
}

export interface TextComponent {
  type: "text";
  content: string;
}

export interface MarkdownComponent {
  type: "markdown";
  content: string;
}

export interface DividerComponent {
  type: "divider";
}

export interface FormField {
  name: string;
  type: "text" | "number" | "email" | "password" | "textarea" | "select" | "checkbox";
  label?: string;
  placeholder?: string;
  required?: boolean;
  value?: string;
  checked?: boolean;
  options?: { value: string; label: string }[];
}

export interface FormComponent {
  type: "form";
  action: string; // method name to call
  fields: FormField[];
  submitLabel?: string;
}

export interface ButtonComponent {
  type: "button";
  action: "tx" | "render";
  method?: string; // for tx actions
  path?: string; // for render actions
  args?: Record<string, unknown>; // for tx actions
  label: string;
  variant?: "primary" | "secondary" | "danger";
}

export interface ListItem {
  type: "item";
  content: string | JsonComponent;
}

export interface ListComponent {
  type: "list";
  ordered?: boolean;
  items: (ListItem | JsonComponent)[];
}

export interface TaskAction {
  type: "tx" | "render";
  method?: string;
  path?: string;
  args?: Record<string, unknown>;
  label: string;
}

export interface TaskComponent {
  type: "task";
  id: number | string;
  text: string;
  completed: boolean;
  actions?: TaskAction[];
}

export interface NavigationItem {
  label: string;
  path: string;
  active?: boolean;
}

export interface NavigationComponent {
  type: "navigation";
  items: NavigationItem[];
}

export interface ContainerComponent {
  type: "container";
  className?: string;
  components: JsonComponent[];
}

export interface IncludeComponent {
  type: "include";
  contract: string;
  path?: string;
}

export interface ParseJsonResult {
  success: boolean;
  document?: JsonUIDocument;
  error?: string;
}

/**
 * Parse a JSON string into a JsonUIDocument
 */
export function parseJsonUI(content: string): ParseJsonResult {
  try {
    const parsed = JSON.parse(content);

    if (!parsed.format || !parsed.format.startsWith("soroban-render-json")) {
      return {
        success: false,
        error: "Invalid format: missing or invalid 'format' field",
      };
    }

    if (parsed.format !== "soroban-render-json-v1") {
      return {
        success: false,
        error: `Unsupported format version: ${parsed.format}`,
      };
    }

    if (!Array.isArray(parsed.components)) {
      return {
        success: false,
        error: "Invalid document: 'components' must be an array",
      };
    }

    // Validate components
    const validationError = validateComponents(parsed.components);
    if (validationError) {
      return {
        success: false,
        error: validationError,
      };
    }

    return {
      success: true,
      document: parsed as JsonUIDocument,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to parse JSON",
    };
  }
}

const VALID_COMPONENT_TYPES = [
  "heading",
  "text",
  "markdown",
  "divider",
  "form",
  "button",
  "list",
  "task",
  "navigation",
  "container",
  "include",
];

function validateComponents(components: unknown[]): string | null {
  for (let i = 0; i < components.length; i++) {
    const component = components[i] as Record<string, unknown>;

    if (!component || typeof component !== "object") {
      return `Component at index ${i} is not an object`;
    }

    if (!component.type || typeof component.type !== "string") {
      return `Component at index ${i} is missing 'type' field`;
    }

    if (!VALID_COMPONENT_TYPES.includes(component.type)) {
      return `Component at index ${i} has invalid type: ${component.type}`;
    }

    // Validate specific component types
    switch (component.type) {
      case "heading":
        if (typeof component.text !== "string") {
          return `Heading at index ${i} is missing 'text' field`;
        }
        if (
          typeof component.level !== "number" ||
          component.level < 1 ||
          component.level > 6
        ) {
          return `Heading at index ${i} has invalid 'level' (must be 1-6)`;
        }
        break;

      case "text":
      case "markdown":
        if (typeof component.content !== "string") {
          return `${component.type} at index ${i} is missing 'content' field`;
        }
        break;

      case "form":
        if (typeof component.action !== "string") {
          return `Form at index ${i} is missing 'action' field`;
        }
        if (!Array.isArray(component.fields)) {
          return `Form at index ${i} is missing 'fields' array`;
        }
        break;

      case "button":
        if (typeof component.label !== "string") {
          return `Button at index ${i} is missing 'label' field`;
        }
        if (component.action !== "tx" && component.action !== "render") {
          return `Button at index ${i} has invalid 'action' (must be 'tx' or 'render')`;
        }
        break;

      case "list":
        if (!Array.isArray(component.items)) {
          return `List at index ${i} is missing 'items' array`;
        }
        break;

      case "task":
        if (typeof component.text !== "string") {
          return `Task at index ${i} is missing 'text' field`;
        }
        if (typeof component.completed !== "boolean") {
          return `Task at index ${i} is missing 'completed' field`;
        }
        break;

      case "navigation":
        if (!Array.isArray(component.items)) {
          return `Navigation at index ${i} is missing 'items' array`;
        }
        break;

      case "container":
        if (!Array.isArray(component.components)) {
          return `Container at index ${i} is missing 'components' array`;
        }
        // Recursively validate nested components
        const nestedError = validateComponents(component.components as unknown[]);
        if (nestedError) {
          return nestedError;
        }
        break;

      case "include":
        if (typeof component.contract !== "string") {
          return `Include at index ${i} is missing 'contract' field`;
        }
        break;
    }
  }

  return null;
}

/**
 * Check if content is JSON format
 */
export function isJsonFormat(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed.startsWith("{")) {
    return false;
  }

  try {
    const parsed = JSON.parse(trimmed);
    return Boolean(parsed.format && parsed.format.startsWith("soroban-render-json"));
  } catch {
    return false;
  }
}
