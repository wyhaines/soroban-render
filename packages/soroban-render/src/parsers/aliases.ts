/**
 * Aliases tag parser for extracting contract alias mappings.
 *
 * Contracts can define alias-to-contract-ID mappings using:
 *   {{aliases config=CCOBK... registry=CCDBT... pages=CDJG...}}
 *   {{aliases {"config":"CCOBK...","registry":"CCDBT..."}}}
 *
 * These mappings allow includes to use friendly alias names instead of
 * full 56-character contract IDs:
 *   {{include contract=config func="logo"}}
 * Instead of:
 *   {{include contract=CCOBKFEZERN3SSZBFAZY5A6M2WPLVDLKPAWU7IEUQU35VMA6VKHXA62C func="logo"}}
 */

export interface AliasTag {
  /** Original matched string */
  original: string;
  /** Start index in the content string */
  startIndex: number;
  /** End index in the content string */
  endIndex: number;
  /** Alias to contract ID mappings */
  mappings: Record<string, string>;
}

export interface ParsedAliases {
  /** The content with alias tags removed */
  content: string;
  /** Combined alias mappings from all tags (later values override earlier ones) */
  aliases: Record<string, string>;
  /** Raw alias tag objects */
  aliasTags: AliasTag[];
}

// Regex to match {{aliases ...}} tags
// Captures everything between {{aliases and }}
const ALIASES_TAG_REGEX = /\{\{aliases\s+([^}]+)\}\}/gi;

// Regex to parse individual key=value attributes
// Handles: key=value, key="value", key='value'
const ATTR_REGEX = /(\w+)=(?:"([^"]*)"|'([^']*)'|(\S+))/g;

/**
 * Parse content to find all alias definition tags.
 * Returns extracted alias mappings and content with alias tags removed.
 */
export function parseAliases(content: string): ParsedAliases {
  const aliasTags: AliasTag[] = [];
  const aliases: Record<string, string> = {};

  ALIASES_TAG_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = ALIASES_TAG_REGEX.exec(content)) !== null) {
    const fullMatch = match[0];
    const attrsString = match[1];
    const startIndex = match.index;
    const endIndex = startIndex + fullMatch.length;

    if (!attrsString) continue;

    const trimmed = attrsString.trim();
    let mappings: Record<string, string> = {};

    // Try JSON format first: {{aliases {"config":"CCOBK..."}}}
    if (trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed) as Record<string, string>;
        if (typeof parsed === "object" && parsed !== null) {
          mappings = parsed;
        }
      } catch {
        // Not valid JSON, try key=value format
        mappings = parseKeyValueAttributes(attrsString);
      }
    } else {
      // Key=value format: {{aliases config=CCOBK... registry=CCDBT...}}
      mappings = parseKeyValueAttributes(attrsString);
    }

    // Only add if we got any mappings
    if (Object.keys(mappings).length > 0) {
      aliasTags.push({
        original: fullMatch,
        startIndex,
        endIndex,
        mappings,
      });

      // Merge into combined mappings (later values override earlier ones)
      Object.assign(aliases, mappings);
    }
  }

  // Remove alias tags from content
  let processedContent = content;

  // Sort by startIndex descending to remove from end first
  const sortedTags = [...aliasTags].sort((a, b) => b.startIndex - a.startIndex);
  for (const tag of sortedTags) {
    processedContent =
      processedContent.slice(0, tag.startIndex) +
      processedContent.slice(tag.endIndex);
  }

  return { content: processedContent, aliases, aliasTags };
}

/**
 * Parse key=value attribute string into key-value pairs.
 */
function parseKeyValueAttributes(attrsString: string): Record<string, string> {
  const attrs: Record<string, string> = {};

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
 * Check if content contains any alias definition tags.
 */
export function hasAliasTags(content: string): boolean {
  ALIASES_TAG_REGEX.lastIndex = 0;
  return ALIASES_TAG_REGEX.test(content);
}

/**
 * Resolve an alias to its contract ID.
 * Returns the original value if no alias mapping exists.
 */
export function resolveAlias(
  alias: string,
  aliases: Record<string, string>
): string {
  return aliases[alias] ?? alias;
}
