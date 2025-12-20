/**
 * Include parser for resolving {{include ...}} tags in rendered content.
 *
 * Syntax:
 *   {{include contract=CA... func="header" path="?args"}}
 *   {{include contract=SELF func="chunk2" path="?page=2"}}
 *
 * Attributes:
 *   - contract: Contract ID or "SELF" to refer to current contract
 *   - func: Optional function name (calls render_func instead of render)
 *   - path: Optional path argument to pass to the render function
 */

export interface IncludeTag {
  /** Original matched string */
  original: string;
  /** Start index in the content string */
  startIndex: number;
  /** End index in the content string */
  endIndex: number;
  /** Contract ID or "SELF" */
  contract: string;
  /** Optional function name (without render_ prefix) */
  func?: string;
  /** Optional path argument */
  path?: string;
}

export interface ParsedIncludes {
  /** The original content */
  content: string;
  /** All include tags found */
  includes: IncludeTag[];
}

// Regex to match {{include ...}} tags
// Captures the full match and allows for various attribute formats
const INCLUDE_REGEX = /\{\{include\s+([^}]+)\}\}/g;

// Regex to parse individual attributes
// Handles: key=value, key="value", key='value'
const ATTR_REGEX = /(\w+)=(?:"([^"]*)"|'([^']*)'|(\S+))/g;

/**
 * Parse a content string to find all {{include ...}} tags.
 */
export function parseIncludes(content: string): ParsedIncludes {
  const includes: IncludeTag[] = [];

  // Reset regex state
  INCLUDE_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = INCLUDE_REGEX.exec(content)) !== null) {
    const fullMatch = match[0];
    const attrsString = match[1] ?? "";
    const startIndex = match.index;
    const endIndex = startIndex + fullMatch.length;

    const attrs = parseAttributes(attrsString);

    // contract is required
    if (!attrs.contract) {
      continue;
    }

    includes.push({
      original: fullMatch,
      startIndex,
      endIndex,
      contract: attrs.contract,
      func: attrs.func,
      path: attrs.path,
    });
  }

  return { content, includes };
}

/**
 * Parse attribute string into key-value pairs.
 */
function parseAttributes(attrsString: string): Record<string, string> {
  const attrs: Record<string, string> = {};

  // Reset regex state
  ATTR_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = ATTR_REGEX.exec(attrsString)) !== null) {
    const key = match[1];
    if (!key) continue;
    // Value can be in match[2] (double quotes), match[3] (single quotes), or match[4] (unquoted)
    const value = match[2] ?? match[3] ?? match[4] ?? "";
    attrs[key] = value;
  }

  return attrs;
}

/**
 * Replace all include tags in content with resolved content.
 * This is a simple string replacement - the resolver handles the actual fetching.
 */
export function replaceInclude(
  content: string,
  include: IncludeTag,
  replacement: string
): string {
  return (
    content.slice(0, include.startIndex) +
    replacement +
    content.slice(include.endIndex)
  );
}

/**
 * Check if content contains any include tags.
 */
export function hasIncludes(content: string): boolean {
  INCLUDE_REGEX.lastIndex = 0;
  return INCLUDE_REGEX.test(content);
}

/**
 * Create an include key for cycle detection.
 * Format: "contractId:func|path"
 */
export function createIncludeKey(
  contractId: string,
  func?: string,
  path?: string
): string {
  const funcPart = func || "";
  const pathPart = path || "";
  return `${contractId}:${funcPart}|${pathPart}`;
}
