/**
 * Noparse parser for protecting content from include resolution.
 *
 * Content wrapped in {{noparse}}...{{/noparse}} blocks will be preserved
 * exactly as-is during include resolution. The noparse tags themselves
 * are stripped after processing.
 *
 * Use case: Form field values containing {{include ...}} tags that should
 * be displayed for editing rather than resolved.
 *
 * Example:
 *   {{noparse}}{{include contract=config func="logo"}}{{/noparse}}
 *   → Preserves the include tag as literal text for display/editing
 */

export interface NoparseBlock {
  /** Original full match including tags */
  original: string;
  /** Start index in the content string */
  startIndex: number;
  /** End index in the content string */
  endIndex: number;
  /** Content between the noparse tags (what to preserve) */
  innerContent: string;
  /** Placeholder ID */
  placeholderId: string;
}

export interface ParsedNoparse {
  /** Content with noparse blocks replaced by placeholders */
  content: string;
  /** The noparse blocks found */
  blocks: NoparseBlock[];
}

// Regex to match {{noparse}}...{{/noparse}} blocks
// Uses non-greedy match for content between tags
const NOPARSE_REGEX = /\{\{noparse\}\}([\s\S]*?)\{\{\/noparse\}\}/gi;

// Placeholder format - uses unlikely-to-appear string
const PLACEHOLDER_PREFIX = "___NOPARSE_BLOCK_";
const PLACEHOLDER_SUFFIX = "___";

/**
 * Extract noparse blocks and replace them with placeholders.
 * Call this BEFORE include resolution.
 */
export function extractNoparseBlocks(content: string): ParsedNoparse {
  const blocks: NoparseBlock[] = [];
  let processedContent = content;
  let blockIndex = 0;

  NOPARSE_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;

  // Collect all matches first (to avoid index shifting issues)
  const matches: Array<{ fullMatch: string; innerContent: string; startIndex: number }> = [];
  while ((match = NOPARSE_REGEX.exec(content)) !== null) {
    matches.push({
      fullMatch: match[0],
      innerContent: match[1] ?? "",
      startIndex: match.index,
    });
  }

  // Process in reverse order to maintain correct indices
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    if (!m) continue;

    const placeholderId = `${PLACEHOLDER_PREFIX}${blockIndex}${PLACEHOLDER_SUFFIX}`;

    blocks.unshift({
      original: m.fullMatch,
      startIndex: m.startIndex,
      endIndex: m.startIndex + m.fullMatch.length,
      innerContent: m.innerContent,
      placeholderId,
    });

    // Replace with placeholder
    processedContent =
      processedContent.slice(0, m.startIndex) +
      placeholderId +
      processedContent.slice(m.startIndex + m.fullMatch.length);

    blockIndex++;
  }

  return { content: processedContent, blocks };
}

/**
 * Restore noparse blocks by replacing placeholders with original inner content.
 * Call this AFTER include resolution.
 * The noparse tags themselves are stripped - only inner content is restored.
 */
export function restoreNoparseBlocks(content: string, blocks: NoparseBlock[]): string {
  let result = content;

  for (const block of blocks) {
    // Replace placeholder with the preserved inner content (no tags)
    result = result.replace(block.placeholderId, block.innerContent);
  }

  return result;
}

/**
 * Check if content contains any noparse blocks.
 */
export function hasNoparseBlocks(content: string): boolean {
  NOPARSE_REGEX.lastIndex = 0;
  return NOPARSE_REGEX.test(content);
}

/**
 * Wrap content in noparse tags to protect it from include resolution.
 * Utility for contract authors.
 */
export function wrapNoparse(content: string): string {
  return `{{noparse}}${content}{{/noparse}}`;
}
