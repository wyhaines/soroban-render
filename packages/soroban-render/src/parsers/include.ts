/**
 * Include parser for resolving {{include ...}} tags in rendered content.
 *
 * ## Basic Syntax
 *
 *   {{include contract=CA... func="header" path="?args"}}
 *   {{include contract=SELF func="chunk2" path="?page=2"}}
 *
 * ## Parameterized Includes (for custom function signatures)
 *
 *   {{include contract=@main func="render_nav_include" viewer return_path="@main:/b/1"}}
 *   {{include contract=@main func="render_footer_include"}}
 *
 * ## Attributes
 *
 *   - contract: Contract ID, "SELF", or alias (e.g., "@main")
 *   - func: Optional function name (calls render_{func} instead of render)
 *   - path: Optional path argument (legacy mode only)
 *   - viewer: Flag (no value) - passes current viewer address as parameter
 *   - Any other attributes become named parameters passed to the function
 *
 * ## Resolution Modes
 *
 * The resolver operates in two modes based on the include tag:
 *
 * ### Legacy Mode (path, viewer)
 * Used when: No custom params AND func does not end with "_include"
 * Calls: render_{func}(path, viewer) or render(path, viewer)
 * Example: {{include contract=@config func="meta"}}
 *   → calls render_meta(path, viewer)
 *
 * ### Parameterized Mode (custom args)
 * Used when: Has custom params OR func ends with "_include"
 * Calls: render_{func}(...params) with args built from params
 * Example: {{include contract=@main func="render_nav_include" viewer return_path="@main:/b/1"}}
 *   → calls render_nav_include(viewer_address, "@main:/b/1")
 *
 * ## Naming Convention for Include Functions
 *
 * Functions designed for inclusion with custom parameter signatures should
 * follow the naming convention: render_{name}_include
 *
 * This signals to the resolver that the function has a custom signature
 * and should not receive the default (path, viewer) arguments.
 *
 * Example contract function:
 *   pub fn render_nav_include(env: Env, viewer: Option<Address>, return_path: Option<String>) -> Bytes
 *   pub fn render_footer_include(env: Env) -> Bytes
 *
 * ## Parameter Type Inference
 *
 * Parameters are converted to Soroban types based on naming conventions:
 *   - "viewer" flag → Address (current viewer) or void if not connected
 *   - *_id suffix → u64 (e.g., board_id="5" → 5u64)
 *   - count/depth/index/limit/offset → u32
 *   - Everything else → String
 *
 * ## Alias Resolution in Values
 *
 * Values containing @alias patterns are resolved:
 *   return_path="@main:/b/1" → "CDZPTPO5...:/b/1"
 */

export interface IncludeTag {
  /** Original matched string */
  original: string;
  /** Start index in the content string */
  startIndex: number;
  /** End index in the content string */
  endIndex: number;
  /** Contract ID, "SELF", or alias */
  contract: string;
  /** Optional function name (without render_ prefix) */
  func?: string;
  /** Optional path argument */
  path?: string;
  /** Additional parameters: flags (true) or key-value pairs (string) */
  params: Record<string, string | true>;
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
// Handles: key=value, key="value", key='value', or standalone key (flag)
// Group 1: key name
// Group 2: double-quoted value
// Group 3: single-quoted value
// Group 4: unquoted value
// If no =value part, it's a flag (handled separately)
const ATTR_REGEX = /(\w+)(?:=(?:"([^"]*)"|'([^']*)'|(\S+)))?/g;

// Standard attributes that are not passed as params
const STANDARD_ATTRS = new Set(["contract", "func", "path"]);

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
    const contractAttr = attrs.contract;
    if (!contractAttr || contractAttr === true) {
      continue;
    }

    // Extract standard attributes (must be strings, not flags)
    const funcAttr = attrs.func;
    const pathAttr = attrs.path;

    // Build params from non-standard attributes
    const params: Record<string, string | true> = {};
    for (const [key, value] of Object.entries(attrs)) {
      if (!STANDARD_ATTRS.has(key)) {
        params[key] = value;
      }
    }

    includes.push({
      original: fullMatch,
      startIndex,
      endIndex,
      contract: contractAttr,
      func: typeof funcAttr === "string" ? funcAttr : undefined,
      path: typeof pathAttr === "string" ? pathAttr : undefined,
      params,
    });
  }

  return { content, includes };
}

/**
 * Parse attribute string into key-value pairs.
 * Flags (keys without values) are set to `true`.
 */
function parseAttributes(attrsString: string): Record<string, string | true> {
  const attrs: Record<string, string | true> = {};

  // Reset regex state
  ATTR_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = ATTR_REGEX.exec(attrsString)) !== null) {
    const key = match[1];
    if (!key) continue;

    // Check if any value group matched
    const hasValue =
      match[2] !== undefined ||
      match[3] !== undefined ||
      match[4] !== undefined;

    if (hasValue) {
      // Value can be in match[2] (double quotes), match[3] (single quotes), or match[4] (unquoted)
      const value = match[2] ?? match[3] ?? match[4] ?? "";
      attrs[key] = value;
    } else {
      // No value - it's a flag
      attrs[key] = true;
    }
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
 * Create an include key for cycle detection and caching.
 * Format: "contractId:func|path|params"
 * Params are sorted alphabetically for consistent keys.
 */
export function createIncludeKey(
  contractId: string,
  func?: string,
  path?: string,
  params?: Record<string, string | true>
): string {
  const funcPart = func || "";
  const pathPart = path || "";

  // Sort params alphabetically for consistent key generation
  let paramsPart = "";
  if (params && Object.keys(params).length > 0) {
    const sortedKeys = Object.keys(params).sort();
    const paramStrings = sortedKeys.map((key) => {
      const value = params[key];
      return value === true ? key : `${key}=${value}`;
    });
    paramsPart = paramStrings.join(",");
  }

  return `${contractId}:${funcPart}|${pathPart}|${paramsPart}`;
}

/**
 * Check if an include has custom parameters (beyond standard contract/func/path).
 */
export function hasCustomParams(include: IncludeTag): boolean {
  return Object.keys(include.params).length > 0;
}
