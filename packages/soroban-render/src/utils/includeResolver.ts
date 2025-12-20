/**
 * Include resolver for recursively resolving {{include ...}} tags.
 *
 * Features:
 * - Cycle detection using ancestor chain tracking
 * - SELF keyword support for self-referential includes
 * - Support for render_* function convention
 * - Caching of resolved content (optional)
 */

import { SorobanClient, callRender } from "./client";
import {
  parseIncludes,
  hasIncludes,
  createIncludeKey,
  IncludeTag,
} from "../parsers/include";

export interface CacheEntry {
  content: string;
  timestamp: number;
}

export interface ResolveOptions {
  /** The current contract ID (used for SELF keyword) */
  contractId: string;
  /** Optional viewer address */
  viewer?: string;
  /** Ancestor chain for cycle detection (internal use) */
  ancestors?: Set<string>;
  /** Optional cache for resolved content */
  cache?: Map<string, CacheEntry>;
  /** Cache TTL in milliseconds (default: 30000 = 30s) */
  cacheTtl?: number;
}

export interface ResolveResult {
  /** The resolved content with all includes replaced */
  content: string;
  /** Whether any cycles were detected and skipped */
  cycleDetected: boolean;
  /** List of resolved include keys (for debugging) */
  resolvedIncludes: string[];
}

const DEFAULT_CACHE_TTL = 30000; // 30 seconds

/**
 * Resolve all includes in content recursively.
 */
export async function resolveIncludes(
  client: SorobanClient,
  content: string,
  options: ResolveOptions
): Promise<ResolveResult> {
  const ancestors = options.ancestors ?? new Set<string>();
  const cache = options.cache ?? new Map<string, CacheEntry>();
  const cacheTtl = options.cacheTtl ?? DEFAULT_CACHE_TTL;
  const resolvedIncludes: string[] = [];
  let cycleDetected = false;

  // Quick check if there are any includes
  if (!hasIncludes(content)) {
    return { content, cycleDetected: false, resolvedIncludes: [] };
  }

  // Parse includes
  const parsed = parseIncludes(content);

  // Process includes in reverse order to maintain correct indices
  const sortedIncludes = [...parsed.includes].sort(
    (a, b) => b.startIndex - a.startIndex
  );

  for (const include of sortedIncludes) {
    const result = await resolveInclude(
      client,
      include,
      options.contractId,
      options.viewer,
      ancestors,
      cache,
      cacheTtl
    );

    if (result.cycleDetected) {
      cycleDetected = true;
      // Replace with empty string or a comment indicating cycle
      content = replaceIncludeTag(content, include, "<!-- cycle detected -->");
    } else {
      content = replaceIncludeTag(content, include, result.content);
      resolvedIncludes.push(result.key);
    }
  }

  return { content, cycleDetected, resolvedIncludes };
}

interface IncludeResult {
  content: string;
  key: string;
  cycleDetected: boolean;
}

/**
 * Resolve a single include tag.
 */
async function resolveInclude(
  client: SorobanClient,
  include: IncludeTag,
  currentContractId: string,
  viewer: string | undefined,
  ancestors: Set<string>,
  cache: Map<string, CacheEntry>,
  cacheTtl: number
): Promise<IncludeResult> {
  // Resolve SELF to current contract ID
  const contractId =
    include.contract === "SELF" ? currentContractId : include.contract;

  // Create key for cycle detection
  const key = createIncludeKey(contractId, include.func, include.path);

  // Check for cycle
  if (ancestors.has(key)) {
    return { content: "", key, cycleDetected: true };
  }

  // Check cache
  const cached = cache.get(key);
  const now = Date.now();
  if (cached && now - cached.timestamp < cacheTtl) {
    return { content: cached.content, key, cycleDetected: false };
  }

  // Add to ancestor chain before recursive call
  const newAncestors = new Set(ancestors);
  newAncestors.add(key);

  try {
    // Fetch content from contract
    const rawContent = await callRender(client, contractId, {
      path: include.path,
      viewer,
      functionName: include.func,
    });

    // Recursively resolve any nested includes
    const resolved = await resolveIncludes(client, rawContent, {
      contractId,
      viewer,
      ancestors: newAncestors,
      cache,
      cacheTtl,
    });

    // Cache the result
    cache.set(key, { content: resolved.content, timestamp: now });

    return {
      content: resolved.content,
      key,
      cycleDetected: resolved.cycleDetected,
    };
  } catch (error) {
    // On error, return an error comment
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return {
      content: `<!-- include error: ${errorMessage} -->`,
      key,
      cycleDetected: false,
    };
  }
}

/**
 * Replace an include tag in content with replacement text.
 */
function replaceIncludeTag(
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
 * Create a resolver instance with shared cache.
 */
export function createIncludeResolver(
  client: SorobanClient,
  cacheTtl: number = DEFAULT_CACHE_TTL
) {
  const cache = new Map<string, CacheEntry>();

  return {
    /**
     * Resolve all includes in content.
     */
    resolve: (
      content: string,
      contractId: string,
      viewer?: string
    ): Promise<ResolveResult> => {
      return resolveIncludes(client, content, {
        contractId,
        viewer,
        cache,
        cacheTtl,
      });
    },

    /**
     * Clear the cache.
     */
    clearCache: () => {
      cache.clear();
    },

    /**
     * Get cache size.
     */
    getCacheSize: () => {
      return cache.size;
    },
  };
}
