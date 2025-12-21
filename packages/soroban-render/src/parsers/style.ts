/**
 * Style parser for resolving {{style ...}} tags and extracting CSS from content.
 *
 * Syntax:
 *   {{style contract=CA... func="dark"}}
 *   {{style contract=SELF func="base"}}
 *
 * Also extracts ```css code blocks from markdown content.
 *
 * Attributes:
 *   - contract: Contract ID or "SELF" to refer to current contract
 *   - func: Optional function name (calls styles_func instead of styles)
 */

export interface StyleTag {
  /** Original matched string */
  original: string;
  /** Start index in the content string */
  startIndex: number;
  /** End index in the content string */
  endIndex: number;
  /** Contract ID or "SELF" */
  contract: string;
  /** Optional function name (without styles_ prefix) */
  func?: string;
}

export interface CssBlock {
  /** Original matched string including backticks */
  original: string;
  /** Start index in the content string */
  startIndex: number;
  /** End index in the content string */
  endIndex: number;
  /** CSS content without backticks */
  css: string;
}

export interface ParsedStyles {
  /** The content with style tags removed */
  content: string;
  /** All {{style ...}} tags found */
  styleTags: StyleTag[];
  /** All ```css blocks found */
  cssBlocks: CssBlock[];
}

// Regex to match {{style ...}} tags
const STYLE_TAG_REGEX = /\{\{style\s+([^}]+)\}\}/g;

// Regex to match ```css blocks
const CSS_BLOCK_REGEX = /```css\s*\n([\s\S]*?)```/g;

// Regex to parse individual attributes
const ATTR_REGEX = /(\w+)=(?:"([^"]*)"|'([^']*)'|(\S+))/g;

/**
 * Parse content to find all style tags and CSS blocks.
 */
export function parseStyles(content: string): ParsedStyles {
  const styleTags: StyleTag[] = [];
  const cssBlocks: CssBlock[] = [];

  // Extract {{style ...}} tags
  STYLE_TAG_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = STYLE_TAG_REGEX.exec(content)) !== null) {
    const fullMatch = match[0];
    const attrsString = match[1] ?? "";
    const startIndex = match.index;
    const endIndex = startIndex + fullMatch.length;

    const attrs = parseAttributes(attrsString);

    // contract is required
    if (!attrs.contract) {
      continue;
    }

    styleTags.push({
      original: fullMatch,
      startIndex,
      endIndex,
      contract: attrs.contract,
      func: attrs.func,
    });
  }

  // Extract ```css blocks
  CSS_BLOCK_REGEX.lastIndex = 0;
  while ((match = CSS_BLOCK_REGEX.exec(content)) !== null) {
    const fullMatch = match[0];
    const cssContent = match[1]?.trim() ?? "";
    const startIndex = match.index;
    const endIndex = startIndex + fullMatch.length;

    if (cssContent) {
      cssBlocks.push({
        original: fullMatch,
        startIndex,
        endIndex,
        css: cssContent,
      });
    }
  }

  // Remove style tags from content (but keep CSS blocks for optional display)
  let processedContent = content;

  // Sort by startIndex descending to remove from end first
  const sortedTags = [...styleTags].sort((a, b) => b.startIndex - a.startIndex);
  for (const tag of sortedTags) {
    processedContent =
      processedContent.slice(0, tag.startIndex) +
      processedContent.slice(tag.endIndex);
  }

  return { content: processedContent, styleTags, cssBlocks };
}

/**
 * Parse attribute string into key-value pairs.
 */
function parseAttributes(attrsString: string): Record<string, string> {
  const attrs: Record<string, string> = {};

  ATTR_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = ATTR_REGEX.exec(attrsString)) !== null) {
    const key = match[1];
    if (!key) continue;
    const value = match[2] ?? match[3] ?? match[4] ?? "";
    attrs[key] = value;
  }

  return attrs;
}

/**
 * Check if content contains any style tags.
 */
export function hasStyleTags(content: string): boolean {
  STYLE_TAG_REGEX.lastIndex = 0;
  return STYLE_TAG_REGEX.test(content);
}

/**
 * Check if content contains any CSS blocks.
 */
export function hasCssBlocks(content: string): boolean {
  CSS_BLOCK_REGEX.lastIndex = 0;
  return CSS_BLOCK_REGEX.test(content);
}

/**
 * Create a style cache key.
 * Format: "style:contractId:func"
 */
export function createStyleKey(contractId: string, func?: string): string {
  const funcPart = func || "styles";
  return `style:${contractId}:${funcPart}`;
}

/**
 * Remove CSS blocks from content (for display without embedded styles).
 */
export function removeCssBlocks(content: string): string {
  CSS_BLOCK_REGEX.lastIndex = 0;
  return content.replace(CSS_BLOCK_REGEX, "");
}

/**
 * Extract all CSS from CSS blocks as a combined string.
 */
export function extractInlineCss(content: string): string {
  const cssBlocks: string[] = [];

  CSS_BLOCK_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = CSS_BLOCK_REGEX.exec(content)) !== null) {
    const cssContent = match[1]?.trim();
    if (cssContent) {
      cssBlocks.push(cssContent);
    }
  }

  return cssBlocks.join("\n\n");
}
