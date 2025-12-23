/**
 * Render Continuation Loader
 *
 * Handles waterfall loading of content by fetching render continuations.
 * Content contains placeholder divs with data-type="render" and data-path="..."
 * that were created by parseProgressiveTags from {{render path="..."}} tags.
 */

import type { SorobanClient } from "./client";
import { callRender } from "./client";

// Pattern to find render continuation placeholder divs
const PLACEHOLDER_PATTERN = /<div[^>]*data-type="render"[^>]*data-path="([^"]+)"[^>]*><\/div>/g;

export interface RenderContinuationOptions {
  /** Contract ID to render from */
  contractId: string;
  /** Soroban client instance */
  client: SorobanClient;
  /** Optional viewer address */
  viewer?: string;
  /**
   * Called when a continuation is loaded. Should process the raw content
   * (e.g., parse markdown) and return the processed HTML to insert.
   * The returned HTML may contain new placeholder divs for further loading.
   */
  onContinuationLoaded?: (path: string, rawContent: string) => Promise<string>;
  /** Called when an error occurs */
  onError?: (error: Error, path: string) => void;
  /** Maximum concurrent requests (default: 2) */
  maxConcurrent?: number;
  /** Maximum total continuations to prevent infinite loops (default: 100) */
  maxContinuations?: number;
}

export interface RenderContinuationResult {
  /** Final content with all continuations loaded */
  content: string;
  /** Number of continuations loaded */
  continuationsLoaded: number;
  /** Any errors that occurred */
  errors: Array<{ path: string; error: Error }>;
}

/**
 * Extract render continuation paths from HTML content.
 * Looks for placeholder divs with data-type="render" and data-path="..."
 */
function extractPlaceholderPaths(html: string): string[] {
  const paths: string[] = [];
  const regex = new RegExp(PLACEHOLDER_PATTERN.source, "g");
  let match;
  while ((match = regex.exec(html)) !== null) {
    if (match[1]) {
      paths.push(match[1]);
    }
  }
  return paths;
}

/**
 * Load all render continuations in content, recursively.
 *
 * This creates a waterfall effect where:
 * 1. Initial content has placeholder divs from parseProgressiveTags
 * 2. Each placeholder triggers a render() call to fetch more content
 * 3. New content may have more placeholder divs (after markdown parsing)
 * 4. Process repeats until no more placeholders or max limit reached
 */
export async function loadRenderContinuations(
  initialContent: string,
  options: RenderContinuationOptions
): Promise<RenderContinuationResult> {
  const {
    contractId,
    client,
    viewer,
    onContinuationLoaded = async (_path: string, content: string) => content,
    onError = () => {},
    maxConcurrent = 2,
    maxContinuations = 100,
  } = options;

  let content = initialContent;
  let continuationsLoaded = 0;
  const errors: Array<{ path: string; error: Error }> = [];
  const loadedPaths = new Set<string>();

  // Keep loading until no more render continuations
  while (continuationsLoaded < maxContinuations) {
    // Find all placeholder divs in current content
    const paths = extractPlaceholderPaths(content);

    if (paths.length === 0) {
      break; // No more continuations
    }

    // Filter out already-loaded paths to prevent infinite loops
    const newPaths = paths.filter((path) => !loadedPaths.has(path));

    if (newPaths.length === 0) {
      break; // All paths already loaded
    }

    // Load in batches with concurrency limit
    for (let i = 0; i < newPaths.length; i += maxConcurrent) {
      const batch = newPaths.slice(i, i + maxConcurrent);

      const results = await Promise.all(
        batch.map(async (path) => {
          try {
            loadedPaths.add(path);
            // Fetch raw content from contract
            const rawContent = await callRender(client, contractId, {
              path,
              viewer,
            });
            // Let callback process (e.g., parse markdown, convert tags to placeholders)
            // and return the processed HTML
            const processedContent = await onContinuationLoaded(path, rawContent);
            return { path, content: processedContent, error: null };
          } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            onError(err, path);
            errors.push({ path, error: err });
            return { path, content: "", error: err };
          }
        })
      );

      // Replace placeholders with processed content
      for (const result of results) {
        if (result.content) {
          // Find and replace the placeholder div
          const escapedPath = result.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const placeholderRegex = new RegExp(
            `<div[^>]*data-type="render"[^>]*data-path="${escapedPath}"[^>]*></div>`,
            "g"
          );
          content = content.replace(placeholderRegex, result.content);
          continuationsLoaded++;
        }
      }
    }

    // Loop continues to find any new placeholders in the loaded content
  }

  return {
    content,
    continuationsLoaded,
    errors,
  };
}

/**
 * Check if content has any render continuation tags ({{render path="..."}}).
 */
export function hasRenderContinuations(content: string): boolean {
  return /\{\{render\s+path="[^"]+"\s*\}\}/.test(content);
}

/**
 * Check if content has any render continuation placeholder divs.
 */
export function hasRenderPlaceholders(content: string): boolean {
  return /<div[^>]*data-type="render"[^>]*data-path="[^"]+"[^>]*><\/div>/.test(content);
}

/**
 * Extract render continuation paths from content.
 * Works with both raw {{render...}} tags and placeholder divs.
 */
export function extractRenderPaths(content: string): string[] {
  const paths: string[] = [];

  // Extract from raw tags
  const tagRegex = /\{\{render\s+path="([^"]+)"\s*\}\}/g;
  let match;
  while ((match = tagRegex.exec(content)) !== null) {
    if (match[1]) paths.push(match[1]);
  }

  // Extract from placeholder divs
  const divPaths = extractPlaceholderPaths(content);
  paths.push(...divPaths);

  // Remove duplicates
  return [...new Set(paths)];
}
