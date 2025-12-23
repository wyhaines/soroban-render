/**
 * Style resolver for fetching and caching CSS from contracts.
 *
 * Features:
 * - Theme contract style fetching (via metadata)
 * - Contract's own styles() function
 * - {{style ...}} tag resolution
 * - Inline ```css block extraction
 * - Style caching with TTL
 * - CSS scoping to prevent conflicts
 *
 * Resolution order (cascade):
 * 1. Theme contract styles (base layer)
 * 2. Contract's own styles() function
 * 3. {{style ...}} includes in content
 * 4. Inline ```css blocks in content
 */

import { SorobanClient, callRender } from "./client";
import {
  parseStyles,
  createStyleKey,
  extractInlineCss,
  removeCssBlocks,
} from "../parsers/style";
import {
  sanitizeCss,
  scopeCss,
  combineCss,
  createScopeClassName,
} from "./cssSanitizer";

export interface StyleCacheEntry {
  css: string;
  timestamp: number;
}

export interface StyleResolveOptions {
  /** The current contract ID (for SELF keyword and scoping) */
  contractId: string;
  /** Optional viewer address */
  viewer?: string;
  /** Theme contract ID (from metadata or explicit) */
  themeContractId?: string;
  /** Cache for resolved styles */
  cache?: Map<string, StyleCacheEntry>;
  /** Cache TTL in milliseconds (default: 60000 = 60s) */
  cacheTtl?: number;
  /** Whether to scope CSS to prevent conflicts (default: true) */
  scopeStyles?: boolean;
  /** Whether to remove CSS blocks from content (default: true) */
  removeCssBlocksFromContent?: boolean;
}

export interface StyleResolveResult {
  /** Combined CSS from all sources */
  css: string;
  /** Content with style tags removed (and optionally CSS blocks) */
  content: string;
  /** Scope class name to apply to container */
  scopeClassName: string;
  /** CSS broken down by source for debugging */
  sources: {
    theme?: string;
    contract?: string;
    includes: string[];
    inline: string[];
  };
}

const DEFAULT_CACHE_TTL = 60000; // 60 seconds for styles (longer than includes)

/**
 * Resolve all styles for a contract's render output.
 *
 * Resolution order (cascade):
 * 1. Theme contract styles (base layer)
 * 2. Contract's own styles() function
 * 3. {{style ...}} includes in content
 * 4. Inline ```css blocks in content
 */
export async function resolveStyles(
  client: SorobanClient,
  content: string,
  options: StyleResolveOptions
): Promise<StyleResolveResult> {
  const cache = options.cache ?? new Map<string, StyleCacheEntry>();
  const cacheTtl = options.cacheTtl ?? DEFAULT_CACHE_TTL;
  const shouldScope = options.scopeStyles ?? true;
  const shouldRemoveCssBlocks = options.removeCssBlocksFromContent ?? true;

  const sources: StyleResolveResult["sources"] = {
    includes: [],
    inline: [],
  };
  const cssLayers: string[] = [];
  const scopeClassName = createScopeClassName(options.contractId);

  // 1. Fetch theme styles if theme contract specified
  if (options.themeContractId) {
    const themeCss = await fetchContractStyles(
      client,
      options.themeContractId,
      undefined,
      cache,
      cacheTtl
    );
    if (themeCss) {
      const sanitized = sanitizeCss(themeCss);
      const scoped = shouldScope
        ? scopeCss(sanitized, options.themeContractId)
        : sanitized;
      cssLayers.push(`/* Theme: ${options.themeContractId.slice(0, 8)}... */\n${scoped}`);
      sources.theme = scoped;
    }
  }

  // 2. Fetch contract's own styles
  const contractCss = await fetchContractStyles(
    client,
    options.contractId,
    undefined,
    cache,
    cacheTtl
  );
  if (contractCss) {
    const sanitized = sanitizeCss(contractCss);
    const scoped = shouldScope
      ? scopeCss(sanitized, options.contractId)
      : sanitized;
    cssLayers.push(`/* Contract: ${options.contractId.slice(0, 8)}... */\n${scoped}`);
    sources.contract = scoped;
  }

  // 3. Parse and resolve {{style ...}} tags
  const parsed = parseStyles(content);

  for (const tag of parsed.styleTags) {
    const resolvedContractId =
      tag.contract === "SELF" ? options.contractId : tag.contract;

    const styleCss = await fetchContractStyles(
      client,
      resolvedContractId,
      tag.func,
      cache,
      cacheTtl
    );

    if (styleCss) {
      const sanitized = sanitizeCss(styleCss);
      const scoped = shouldScope
        ? scopeCss(sanitized, resolvedContractId)
        : sanitized;
      const funcName = tag.func || "styles";
      cssLayers.push(`/* Include: ${resolvedContractId.slice(0, 8)}...:${funcName} */\n${scoped}`);
      sources.includes.push(scoped);
    }
  }

  // 4. Extract and sanitize inline CSS blocks
  const inlineCss = extractInlineCss(content);
  if (inlineCss) {
    const sanitized = sanitizeCss(inlineCss);
    const scoped = shouldScope
      ? scopeCss(sanitized, options.contractId)
      : sanitized;
    cssLayers.push(`/* Inline CSS */\n${scoped}`);
    sources.inline.push(scoped);
  }

  // Process content
  let processedContent = parsed.content; // Style tags already removed
  if (shouldRemoveCssBlocks) {
    processedContent = removeCssBlocks(processedContent);
  }

  return {
    css: combineCss(cssLayers),
    content: processedContent,
    scopeClassName,
    sources,
  };
}

/**
 * Fetch styles from a contract's styles() or styles_func() function.
 */
async function fetchContractStyles(
  client: SorobanClient,
  contractId: string,
  func: string | undefined,
  cache: Map<string, StyleCacheEntry>,
  cacheTtl: number
): Promise<string | null> {
  const cacheKey = createStyleKey(contractId, func);

  // Check cache
  const cached = cache.get(cacheKey);
  const now = Date.now();
  if (cached && now - cached.timestamp < cacheTtl) {
    return cached.css;
  }

  try {
    // Call render_styles() or render_styles_{func}()
    // callRender prepends "render_" so we pass "styles" or "styles_{func}"
    const functionName = func ? `styles_${func}` : "styles";

    const css = await callRender(client, contractId, { functionName });

    // Cache the result
    cache.set(cacheKey, { css, timestamp: now });

    return css;
  } catch {
    // Contract may not have a render_styles function - that's OK
    return null;
  }
}

/**
 * Create a style resolver instance with shared cache.
 */
export function createStyleResolver(
  client: SorobanClient,
  cacheTtl: number = DEFAULT_CACHE_TTL
) {
  const cache = new Map<string, StyleCacheEntry>();

  return {
    /**
     * Resolve all styles for content.
     */
    resolve: (
      content: string,
      options: Omit<StyleResolveOptions, "cache" | "cacheTtl">
    ): Promise<StyleResolveResult> => {
      return resolveStyles(client, content, { ...options, cache, cacheTtl });
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
