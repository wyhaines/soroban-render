/**
 * Parser for continuation and chunk tags used in progressive content loading.
 *
 * These tags are emitted by contracts using soroban-render-sdk's continuation
 * helpers to enable the viewer to load content progressively.
 */

/**
 * A continuation tag indicates there is more content to load.
 * The viewer should fetch chunks starting from the `from` index.
 */
export interface ContinuationTag {
  type: "continue";
  /** Name of the chunk collection */
  collection: string;
  /** Starting index for remaining chunks (chunk-based) */
  from?: number;
  /** Page number for paginated loading */
  page?: number;
  /** Items per page for paginated loading */
  perPage?: number;
  /** Total number of chunks/items */
  total?: number;
  /** Position in the original content string */
  position: number;
  /** Length of the original tag in the content */
  length: number;
}

/**
 * A chunk tag is a placeholder for a specific chunk that should be loaded.
 */
export interface ChunkTag {
  type: "chunk";
  /** Name of the chunk collection */
  collection: string;
  /** Index of the chunk to load */
  index: number;
  /** Optional placeholder text to display while loading */
  placeholder?: string;
  /** Position in the original content string */
  position: number;
  /** Length of the original tag in the content */
  length: number;
}

export type ProgressiveTag = ContinuationTag | ChunkTag;

export interface ParsedProgressiveContent {
  /** Content with tags replaced by placeholder divs */
  content: string;
  /** All progressive loading tags found */
  tags: ProgressiveTag[];
  /** Whether any progressive tags were found */
  hasProgressive: boolean;
}

// Regex patterns for parsing tags
// {{continue collection="name" from=N total=T}}
// {{continue collection="name" page=N per_page=M total=T}}
const CONTINUE_PATTERN =
  /\{\{continue\s+collection="([^"]+)"(?:\s+from=(\d+))?(?:\s+page=(\d+))?(?:\s+per_page=(\d+))?(?:\s+total=(\d+))?\s*\}\}/g;

// {{chunk collection="name" index=N}}
// {{chunk collection="name" index=N placeholder="..."}}
const CHUNK_PATTERN =
  /\{\{chunk\s+collection="([^"]+)"\s+index=(\d+)(?:\s+placeholder="([^"]*)")?\s*\}\}/g;

/**
 * Parse content for continuation and chunk tags.
 *
 * @param content - The markdown content to parse
 * @returns Parsed content with tags extracted and placeholders inserted
 */
export function parseProgressiveTags(content: string): ParsedProgressiveContent {
  const tags: ProgressiveTag[] = [];
  let resultContent = content;

  // Find all continuation tags
  let match: RegExpExecArray | null;
  CONTINUE_PATTERN.lastIndex = 0;
  while ((match = CONTINUE_PATTERN.exec(content)) !== null) {
    const collection = match[1];
    if (!collection) continue;
    tags.push({
      type: "continue",
      collection,
      from: match[2] ? parseInt(match[2], 10) : undefined,
      page: match[3] ? parseInt(match[3], 10) : undefined,
      perPage: match[4] ? parseInt(match[4], 10) : undefined,
      total: match[5] ? parseInt(match[5], 10) : undefined,
      position: match.index,
      length: match[0].length,
    });
  }

  // Find all chunk tags
  CHUNK_PATTERN.lastIndex = 0;
  while ((match = CHUNK_PATTERN.exec(content)) !== null) {
    const collection = match[1];
    const indexStr = match[2];
    if (!collection || !indexStr) continue;
    tags.push({
      type: "chunk",
      collection,
      index: parseInt(indexStr, 10),
      placeholder: match[3],
      position: match.index,
      length: match[0].length,
    });
  }

  // Sort by position (descending) for replacement
  tags.sort((a, b) => b.position - a.position);

  // Replace tags with placeholder divs (in reverse order to preserve positions)
  for (const tag of tags) {
    const id = createTagId(tag);
    let placeholder: string;

    if (tag.type === "chunk" && tag.placeholder) {
      placeholder = `<div class="soroban-progressive-placeholder" data-progressive-id="${id}" data-type="chunk" data-collection="${tag.collection}" data-index="${tag.index}">${tag.placeholder}</div>`;
    } else if (tag.type === "chunk") {
      placeholder = `<div class="soroban-progressive-placeholder" data-progressive-id="${id}" data-type="chunk" data-collection="${tag.collection}" data-index="${tag.index}"></div>`;
    } else {
      // continuation tag
      placeholder = `<div class="soroban-progressive-placeholder" data-progressive-id="${id}" data-type="continue" data-collection="${tag.collection}" data-from="${(tag as ContinuationTag).from ?? 0}"></div>`;
    }

    resultContent =
      resultContent.slice(0, tag.position) +
      placeholder +
      resultContent.slice(tag.position + tag.length);
  }

  // Re-sort by position (ascending) for return
  tags.sort((a, b) => a.position - b.position);

  return {
    content: resultContent,
    tags,
    hasProgressive: tags.length > 0,
  };
}

/**
 * Check if content has any progressive loading tags without full parsing.
 */
export function hasProgressiveTags(content: string): boolean {
  CONTINUE_PATTERN.lastIndex = 0;
  CHUNK_PATTERN.lastIndex = 0;
  return CONTINUE_PATTERN.test(content) || CHUNK_PATTERN.test(content);
}

/**
 * Create a unique ID for a progressive tag placeholder.
 */
export function createTagId(tag: ProgressiveTag): string {
  if (tag.type === "chunk") {
    return `chunk-${tag.collection}-${tag.index}`;
  }
  return `continue-${tag.collection}-${(tag as ContinuationTag).from ?? 0}`;
}

/**
 * Create a cache key for a chunk.
 */
export function createChunkKey(collection: string, index: number): string {
  return `${collection}:${index}`;
}
