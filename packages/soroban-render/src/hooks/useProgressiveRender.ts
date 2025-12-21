/**
 * React hook for progressive content loading.
 *
 * This hook integrates with useRender to automatically handle
 * progressive loading of chunked content.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { SorobanClient } from "../utils/client";
import {
  parseProgressiveTags,
  type ParsedProgressiveContent,
  type ProgressiveTag,
} from "../parsers/continuation";
import { ProgressiveLoader } from "../utils/progressiveLoader";

export interface UseProgressiveRenderOptions {
  /** Contract ID for fetching chunks */
  contractId: string;
  /** Soroban client instance */
  client: SorobanClient;
  /** Initial content containing progressive tags */
  initialContent: string;
  /** Whether to automatically load progressive content (default: true) */
  autoLoad?: boolean;
  /** Number of chunks per batch (default: 3) */
  batchSize?: number;
  /** Maximum concurrent requests (default: 2) */
  maxConcurrent?: number;
}

export interface UseProgressiveRenderResult {
  /** Content with loaded chunks inserted */
  content: string;
  /** Initial content before progressive loading */
  initialContent: string;
  /** Whether progressive content is loading */
  isLoading: boolean;
  /** Number of loaded chunks */
  loadedChunks: number;
  /** Total chunks to load (if known) */
  totalChunks: number | null;
  /** Progress 0-1 */
  progress: number;
  /** Any errors that occurred */
  errors: Error[];
  /** Progressive tags found in content */
  tags: ProgressiveTag[];
  /** Whether content has progressive tags */
  hasProgressive: boolean;
  /** Manually trigger loading */
  load: () => Promise<void>;
  /** Cancel pending loads */
  cancel: () => void;
  /** Reset to initial state */
  reset: () => void;
}

/**
 * Hook for progressive content loading.
 *
 * Parses content for continuation and chunk tags, then loads
 * the remaining content progressively from the contract.
 *
 * @example
 * ```tsx
 * const { content, isLoading, progress } = useProgressiveRender({
 *   contractId: "CABC...",
 *   client: sorobanClient,
 *   initialContent: renderResult,
 * });
 *
 * return (
 *   <div>
 *     <RenderView content={content} />
 *     {isLoading && <p>Loading... {Math.round(progress * 100)}%</p>}
 *   </div>
 * );
 * ```
 */
export function useProgressiveRender(
  options: UseProgressiveRenderOptions
): UseProgressiveRenderResult {
  const {
    contractId,
    client,
    initialContent,
    autoLoad = true,
    batchSize = 3,
    maxConcurrent = 2,
  } = options;

  const [content, setContent] = useState(initialContent);
  const [isLoading, setIsLoading] = useState(false);
  const [loadedChunks, setLoadedChunks] = useState(0);
  const [totalChunks, setTotalChunks] = useState<number | null>(null);
  const [errors, setErrors] = useState<Error[]>([]);

  const loaderRef = useRef<ProgressiveLoader | null>(null);
  const parsedRef = useRef<ParsedProgressiveContent | null>(null);

  // Parse content for progressive tags on initial content change
  useEffect(() => {
    parsedRef.current = parseProgressiveTags(initialContent);
    setContent(parsedRef.current.content);
    setLoadedChunks(0);
    setErrors([]);

    if (parsedRef.current.hasProgressive) {
      // Estimate total chunks from tags
      const tags = parsedRef.current.tags;
      let estimated = 0;
      for (const tag of tags) {
        if (tag.type === "chunk") {
          estimated++;
        } else if (tag.total !== undefined) {
          estimated += tag.total - (tag.from ?? 0);
        }
      }
      setTotalChunks(estimated > 0 ? estimated : null);
    } else {
      setTotalChunks(null);
    }
  }, [initialContent]);

  // Create loader when dependencies change
  useEffect(() => {
    loaderRef.current = new ProgressiveLoader({
      contractId,
      client,
      batchSize,
      maxConcurrent,
      onChunkLoaded: (collection, index, chunkContent) => {
        // Update content by replacing placeholder
        const tagId = `chunk-${collection}-${index}`;
        setContent((prev) => {
          // Find and replace placeholder div
          const placeholderRegex = new RegExp(
            `<div[^>]*data-progressive-id="${tagId}"[^>]*>.*?</div>`,
            "s"
          );
          return prev.replace(placeholderRegex, chunkContent);
        });
        setLoadedChunks((prev) => prev + 1);
      },
      onProgress: (loaded, total) => {
        setLoadedChunks(loaded);
        if (total > 0) {
          setTotalChunks(total);
        }
      },
      onError: (error) => {
        setErrors((prev) => [...prev, error]);
      },
    });

    return () => {
      loaderRef.current?.abort();
    };
  }, [contractId, client, batchSize, maxConcurrent]);

  // Auto-load when enabled and content has progressive tags
  useEffect(() => {
    if (autoLoad && parsedRef.current?.hasProgressive && loaderRef.current) {
      setIsLoading(true);
      loaderRef.current.loadTags(parsedRef.current.tags).finally(() => {
        setIsLoading(false);
      });
    }
  }, [autoLoad, initialContent]);

  const load = useCallback(async () => {
    if (!loaderRef.current || !parsedRef.current?.hasProgressive) return;
    setIsLoading(true);
    try {
      await loaderRef.current.loadTags(parsedRef.current.tags);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const cancel = useCallback(() => {
    loaderRef.current?.abort();
    setIsLoading(false);
  }, []);

  const reset = useCallback(() => {
    loaderRef.current?.reset();
    setContent(parsedRef.current?.content ?? initialContent);
    setLoadedChunks(0);
    setErrors([]);
    setIsLoading(false);
  }, [initialContent]);

  const progress = totalChunks && totalChunks > 0 ? loadedChunks / totalChunks : 0;

  return {
    content,
    initialContent,
    isLoading,
    loadedChunks,
    totalChunks,
    progress,
    errors,
    tags: parsedRef.current?.tags ?? [],
    hasProgressive: parsedRef.current?.hasProgressive ?? false,
    load,
    cancel,
    reset,
  };
}
