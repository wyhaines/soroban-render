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
  /**
   * For tx: protocol, the amount of stroops to attach to the transaction.
   * Syntax: `tx:method {"args":...} .send=1000000`
   * 1 XLM = 10,000,000 stroops
   */
  sendAmount?: string;
  /**
   * For tx: protocol, parameters with empty string values that should be
   * prompted for user input before submitting the transaction.
   */
  userSettableParams?: string[];
  /**
   * For form: and tx: protocols, the contract alias to look up via registry.
   * Syntax: `form:@admin:method` or `tx:@content:method {...}`
   */
  alias?: string;
  /**
   * For form: and tx: protocols, an explicit contract ID to target.
   * Syntax: `form:CXYZ...:method` or `tx:CXYZ...:method {...}`
   */
  contractId?: string;
}

/**
 * Parse contract target from the beginning of a protocol content string.
 * Returns the alias, contractId (if any), and the remaining content.
 */
function parseContractTarget(content: string): {
  alias?: string;
  contractId?: string;
  remainder: string;
} {
  // Check for @alias:remainder format
  if (content.startsWith("@")) {
    const colonIndex = content.indexOf(":", 1);
    if (colonIndex > 1) {
      return {
        alias: content.slice(1, colonIndex),
        remainder: content.slice(colonIndex + 1),
      };
    }
  }

  // Check for CONTRACT_ID:remainder format (C + 55 chars + :)
  // Stellar contract IDs are 56 characters starting with 'C'
  if (content.startsWith("C") && content.length > 56 && content[56] === ":") {
    return {
      contractId: content.slice(0, 56),
      remainder: content.slice(57),
    };
  }

  // No contract target - return content as remainder
  return { remainder: content };
}

export function parseLink(href: string): ParsedLink {
  if (href.startsWith("render:")) {
    const content = href.slice(7); // Remove "render:"

    // Check for @alias: or CONTRACT_ID: prefix first
    const { alias, contractId, remainder } = parseContractTarget(content);

    // If we have an alias or contractId, the remainder is the path
    if (alias || contractId) {
      return {
        protocol: "render",
        href,
        path: remainder || "/",
        alias,
        contractId,
      };
    }

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
    const content = href.slice(3).trim();

    // Parse optional contract target (@alias or CONTRACT_ID)
    const { alias, contractId, remainder } = parseContractTarget(content);

    // Check for .send= parameter at the end
    const sendMatch = remainder.match(/\s+\.send=(\d+)$/);
    const sendAmount = sendMatch ? sendMatch[1] : undefined;
    const contentWithoutSend = sendMatch
      ? remainder.slice(0, remainder.length - sendMatch[0].length).trim()
      : remainder;

    const spaceIndex = contentWithoutSend.indexOf(" ");

    if (spaceIndex === -1) {
      return {
        protocol: "tx",
        href,
        method: contentWithoutSend,
        args: {},
        sendAmount,
        alias,
        contractId,
      };
    }

    const method = contentWithoutSend.slice(0, spaceIndex);
    const argsJson = contentWithoutSend.slice(spaceIndex).trim();

    try {
      const args = JSON.parse(argsJson) as Record<string, unknown>;

      // Detect user-settable parameters (empty string values)
      const userSettableParams = Object.entries(args)
        .filter(([, v]) => v === "")
        .map(([k]) => k);

      return {
        protocol: "tx",
        href,
        method,
        args,
        sendAmount,
        userSettableParams: userSettableParams.length > 0 ? userSettableParams : undefined,
        alias,
        contractId,
      };
    } catch {
      return {
        protocol: "tx",
        href,
        method,
        args: {},
        sendAmount,
        alias,
        contractId,
      };
    }
  }

  if (href.startsWith("form:")) {
    const content = href.slice(5).trim();

    // Parse optional contract target (@alias or CONTRACT_ID)
    const { alias, contractId, remainder } = parseContractTarget(content);

    return {
      protocol: "form",
      href,
      method: remainder,
      alias,
      contractId,
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

  console.log("[soroban-render] collectFormInputs: found", elements.length, "form elements");

  for (const element of elements) {
    const name = element.getAttribute("name");
    const type = element.getAttribute("type");

    if (beforeElement && !comesBefore(element, beforeElement)) {
      console.log("[soroban-render] Skipping element (after link):", { name, type });
      continue;
    }

    if (!name) {
      console.log("[soroban-render] Skipping element (no name):", { type, element: element.outerHTML.slice(0, 100) });
      continue;
    }

    if (element instanceof HTMLInputElement) {
      if (element.type === "checkbox" || element.type === "radio") {
        if (element.checked) {
          inputs[name] = element.value || "on";
        }
      } else {
        inputs[name] = element.value;
        console.log("[soroban-render] Collected input:", { name, type: element.type, value: element.value });
      }
    } else if (element instanceof HTMLSelectElement) {
      inputs[name] = element.value;
    } else if (element instanceof HTMLTextAreaElement) {
      inputs[name] = element.value;
      console.log("[soroban-render] Collected textarea:", { name, value: element.value.slice(0, 50) + "..." });
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
