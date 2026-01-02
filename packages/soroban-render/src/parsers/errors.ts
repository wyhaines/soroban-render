/**
 * Error tag parser for extracting contract-defined error messages.
 *
 * Contracts can define custom error messages using:
 *   {{errors {"1": "Board is read-only", "7": "Flair required for posts"}}}
 *
 * These mappings allow the viewer to display user-friendly error messages
 * when contract errors occur, instead of showing raw error codes.
 */

export interface ErrorTag {
  /** Original matched string */
  original: string;
  /** Start index in the content string */
  startIndex: number;
  /** End index in the content string */
  endIndex: number;
  /** Error code to message mappings */
  mappings: Record<string, string>;
}

export interface ParsedErrors {
  /** The content with error tags removed */
  content: string;
  /** Combined error mappings from all tags (later values override earlier ones) */
  errorMappings: Record<string, string>;
  /** Raw error tag objects */
  errorTags: ErrorTag[];
}

// Regex to match {{errors {...}}}
// Captures the JSON object inside
const ERRORS_TAG_REGEX = /\{\{errors\s+(\{[^}]+\})\s*\}\}/gi;

/**
 * Parse content to find all error definition tags.
 * Returns extracted error mappings and content with error tags removed.
 */
export function parseErrors(content: string): ParsedErrors {
  const errorTags: ErrorTag[] = [];
  const errorMappings: Record<string, string> = {};

  ERRORS_TAG_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = ERRORS_TAG_REGEX.exec(content)) !== null) {
    const fullMatch = match[0];
    const jsonStr = match[1];
    const startIndex = match.index;
    const endIndex = startIndex + fullMatch.length;

    if (!jsonStr) continue;

    try {
      const mappings = JSON.parse(jsonStr) as Record<string, string>;

      if (typeof mappings === "object" && mappings !== null) {
        errorTags.push({
          original: fullMatch,
          startIndex,
          endIndex,
          mappings,
        });

        // Merge into combined mappings (later values override earlier ones)
        Object.assign(errorMappings, mappings);
      }
    } catch {
      // Invalid JSON, skip this tag
      console.warn("Invalid JSON in {{errors ...}} tag:", jsonStr);
    }
  }

  // Remove error tags from content
  let processedContent = content;

  // Sort by startIndex descending to remove from end first
  const sortedTags = [...errorTags].sort((a, b) => b.startIndex - a.startIndex);
  for (const tag of sortedTags) {
    processedContent =
      processedContent.slice(0, tag.startIndex) +
      processedContent.slice(tag.endIndex);
  }

  return { content: processedContent, errorMappings, errorTags };
}

/**
 * Check if content contains any error definition tags.
 */
export function hasErrorTags(content: string): boolean {
  ERRORS_TAG_REGEX.lastIndex = 0;
  return ERRORS_TAG_REGEX.test(content);
}
