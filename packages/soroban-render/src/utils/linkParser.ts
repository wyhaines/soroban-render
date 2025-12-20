export type LinkProtocol = "render" | "tx" | "form" | "standard";

export interface ParsedLink {
  protocol: LinkProtocol;
  href: string;
  method?: string;
  args?: Record<string, unknown>;
  path?: string;
  /**
   * For render: protocol, the function name if using render_* convention.
   * Example: `render:header` sets functionName="header"
   * Example: `render:header/path` sets functionName="header", path="/path"
   * Example: `render:/path` sets functionName=undefined, path="/path"
   */
  functionName?: string;
}

export function parseLink(href: string): ParsedLink {
  if (href.startsWith("render:")) {
    const content = href.slice(7); // Remove "render:"

    // If starts with / or ?, it's a path for the default render() function
    if (content.startsWith("/") || content.startsWith("?") || content === "") {
      return {
        protocol: "render",
        href,
        path: content || undefined,
      };
    }

    // Otherwise, it's a function name (render_* convention)
    // Format: render:name or render:name/path or render:name?query
    const pathStart = content.search(/[/?]/);

    if (pathStart === -1) {
      // Just a function name, no path
      return {
        protocol: "render",
        href,
        functionName: content,
      };
    }

    // Function name followed by path
    const functionName = content.slice(0, pathStart);
    const path = content.slice(pathStart);

    return {
      protocol: "render",
      href,
      functionName,
      path,
    };
  }

  if (href.startsWith("tx:")) {
    const content = href.slice(3);
    const spaceIndex = content.indexOf(" ");

    if (spaceIndex === -1) {
      return {
        protocol: "tx",
        href,
        method: content.trim(),
        args: {},
      };
    }

    const method = content.slice(0, spaceIndex).trim();
    const argsJson = content.slice(spaceIndex).trim();

    try {
      const args = JSON.parse(argsJson);
      return {
        protocol: "tx",
        href,
        method,
        args,
      };
    } catch {
      return {
        protocol: "tx",
        href,
        method,
        args: {},
      };
    }
  }

  if (href.startsWith("form:")) {
    return {
      protocol: "form",
      href,
      method: href.slice(5).trim(),
    };
  }

  return {
    protocol: "standard",
    href,
  };
}

export function collectFormInputs(
  container: HTMLElement,
  beforeElement?: HTMLElement
): Record<string, string> {
  const inputs: Record<string, string> = {};
  const elements = container.querySelectorAll("input, select, textarea");

  for (const element of elements) {
    if (beforeElement && !comesBefore(element, beforeElement)) {
      continue;
    }

    const name = element.getAttribute("name");
    if (!name) continue;

    if (element instanceof HTMLInputElement) {
      if (element.type === "checkbox" || element.type === "radio") {
        if (element.checked) {
          inputs[name] = element.value || "on";
        }
      } else {
        inputs[name] = element.value;
      }
    } else if (element instanceof HTMLSelectElement) {
      inputs[name] = element.value;
    } else if (element instanceof HTMLTextAreaElement) {
      inputs[name] = element.value;
    }
  }

  return inputs;
}

function comesBefore(a: Element, b: Element): boolean {
  const position = a.compareDocumentPosition(b);
  return (position & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}

export function buildPathWithParams(
  basePath: string,
  params: Record<string, string>
): string {
  const entries = Object.entries(params).filter(([, v]) => v !== "");
  if (entries.length === 0) {
    return basePath;
  }

  const queryString = entries
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  const separator = basePath.includes("?") ? "&" : "?";
  return `${basePath}${separator}${queryString}`;
}
