import { useState, useEffect, useCallback, useRef } from "react";
import { SorobanClient, callRender, RenderOptions } from "../utils/client";
import { parseMarkdown, detectFormat } from "../parsers/markdown";
import { parseJsonUI, JsonUIDocument } from "../parsers/json";
import { resolveIncludes } from "../utils/includeResolver";
import { resolveStyles, StyleCacheEntry } from "../utils/styleResolver";
import {
  parseProgressiveTags,
  hasProgressiveTags,
  type ProgressiveTag,
  type ContinuationTag,
} from "../parsers/continuation";
import { ProgressiveLoader } from "../utils/progressiveLoader";
import { loadRenderContinuations, hasRenderContinuations } from "../utils/renderContinuation";
import { parseMeta, applyMetaToDocument } from "../parsers/meta";
import { parseErrors } from "../parsers/errors";

export interface UseRenderResult {
  html: string | null;
  raw: string | null;
  jsonDocument: JsonUIDocument | null;
  format: "markdown" | "json" | "unknown" | null;
  loading: boolean;
  error: string | null;
  path: string;
  setPath: (path: string) => void;
  refetch: () => Promise<void>;
  /** CSS from styles() function and {{style}} tags */
  css: string | null;
  /** Scope class name to apply to container for CSS isolation */
  scopeClassName: string | null;
  /** Contract-defined error code to message mappings from {{errors ...}} tags */
  errorMappings: Record<string, string> | null;
}

export interface UseRenderOptions extends RenderOptions {
  enabled?: boolean;
  /**
   * Whether to resolve {{include ...}} tags in the content.
   * Default: true
   */
  resolveIncludes?: boolean;
  /**
   * Cache TTL for include resolution in milliseconds.
   * Default: 30000 (30 seconds)
   */
  includeCacheTtl?: number;
  /**
   * Whether to resolve styles from contracts.
   * Default: true
   */
  resolveStyles?: boolean;
  /**
   * Cache TTL for style resolution in milliseconds.
   * Default: 60000 (60 seconds)
   */
  styleCacheTtl?: number;
  /**
   * Theme contract ID to fetch base styles from.
   * Can also be set via contract metadata.
   */
  themeContractId?: string;
  /**
   * Whether to scope CSS to prevent conflicts between contracts.
   * Default: true
   */
  scopeStyles?: boolean;
  /**
   * Whether to resolve {{continue ...}} and {{chunk ...}} tags progressively.
   * Default: true
   */
  resolveProgressive?: boolean;
  /**
   * Batch size for progressive loading (chunks per request).
   * Default: 3
   */
  progressiveBatchSize?: number;
  /**
   * Maximum concurrent requests for progressive loading.
   * Default: 2
   */
  progressiveMaxConcurrent?: number;
  /**
   * Whether to resolve {{render path="..."}} tags for waterfall loading.
   * Default: true
   */
  resolveRenderContinuations?: boolean;
  /**
   * Maximum concurrent requests for render continuation loading.
   * Default: 2
   */
  renderContinuationMaxConcurrent?: number;
  /**
   * Maximum total render continuations to prevent infinite loops.
   * Default: 100
   */
  renderContinuationMaxTotal?: number;
  /**
   * Whether to extract and apply meta tags (favicon, title, etc.) to the document.
   * Default: true
   */
  applyMeta?: boolean;
}

export function useRender(
  client: SorobanClient | null,
  contractId: string | null,
  options: UseRenderOptions = {}
): UseRenderResult {
  const {
    path: initialPath = "/",
    viewer,
    enabled = true,
    resolveIncludes: shouldResolveIncludes = true,
    includeCacheTtl = 30000,
    resolveStyles: shouldResolveStyles = true,
    styleCacheTtl = 60000,
    themeContractId,
    scopeStyles = true,
    resolveProgressive: shouldResolveProgressive = true,
    progressiveBatchSize = 3,
    progressiveMaxConcurrent = 2,
    resolveRenderContinuations: shouldResolveRenderContinuations = true,
    renderContinuationMaxConcurrent = 2,
    renderContinuationMaxTotal = 100,
    applyMeta: shouldApplyMeta = true,
  } = options;

  const [currentPath, setCurrentPath] = useState(initialPath);
  const [html, setHtml] = useState<string | null>(null);
  const [raw, setRaw] = useState<string | null>(null);
  const [jsonDocument, setJsonDocument] = useState<JsonUIDocument | null>(null);
  const [format, setFormat] = useState<"markdown" | "json" | "unknown" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [css, setCss] = useState<string | null>(null);
  const [scopeClassName, setScopeClassName] = useState<string | null>(null);
  const [errorMappings, setErrorMappings] = useState<Record<string, string> | null>(null);

  // Cache for include resolution (persists across renders)
  const includeCacheRef = useRef<Map<string, { content: string; timestamp: number }>>(new Map());

  // Cache for style resolution (persists across renders)
  const styleCacheRef = useRef<Map<string, StyleCacheEntry>>(new Map());

  // Progressive loader ref (for cleanup)
  const progressiveLoaderRef = useRef<ProgressiveLoader | null>(null);

  // Store progressive tags for chunk loading
  const progressiveTagsRef = useRef<ProgressiveTag[]>([]);

  useEffect(() => {
    setCurrentPath(initialPath);
  }, [initialPath]);

  const fetchRender = useCallback(async () => {
    if (!client || !contractId) {
      return;
    }

    // Abort any existing progressive loader
    if (progressiveLoaderRef.current) {
      progressiveLoaderRef.current.abort();
      progressiveLoaderRef.current = null;
    }

    setLoading(true);
    setError(null);

    try {
      let content = await callRender(client, contractId, { path: currentPath, viewer });

      // Resolve includes if enabled
      if (shouldResolveIncludes) {
        const resolved = await resolveIncludes(client, content, {
          contractId,
          viewer,
          cache: includeCacheRef.current,
          cacheTtl: includeCacheTtl,
        });
        content = resolved.content;
      }

      // Resolve styles if enabled
      if (shouldResolveStyles) {
        const styleResult = await resolveStyles(client, content, {
          contractId,
          viewer,
          themeContractId,
          cache: styleCacheRef.current,
          cacheTtl: styleCacheTtl,
          scopeStyles,
        });
        content = styleResult.content;
        setCss(styleResult.css || null);
        setScopeClassName(styleResult.scopeClassName);
      } else {
        setCss(null);
        setScopeClassName(null);
      }

      // Extract and apply meta tags if enabled
      if (shouldApplyMeta) {
        const metaResult = parseMeta(content);
        content = metaResult.content;
        // Apply meta to document (favicon, title, etc.)
        if (Object.keys(metaResult.meta).length > 0) {
          applyMetaToDocument(metaResult.meta);
        }
      }

      // Extract error mappings from {{errors ...}} tags
      const errorsResult = parseErrors(content);
      content = errorsResult.content;
      if (Object.keys(errorsResult.errorMappings).length > 0) {
        setErrorMappings(errorsResult.errorMappings);
      } else {
        setErrorMappings(null);
      }

      setRaw(content);

      const detectedFormat = detectFormat(content);
      setFormat(detectedFormat);

      if (detectedFormat === "markdown") {
        // Parse progressive tags before converting to HTML
        let processedContent = content;
        let progressiveTags: ProgressiveTag[] = [];

        if (shouldResolveProgressive && hasProgressiveTags(content)) {
          const parsed = parseProgressiveTags(content);
          processedContent = parsed.content;
          progressiveTags = parsed.tags;
          progressiveTagsRef.current = progressiveTags;
        } else {
          progressiveTagsRef.current = [];
        }

        const renderedHtml = await parseMarkdown(processedContent);
        setHtml(renderedHtml);
        setJsonDocument(null);

        // Start progressive loading in background
        if (shouldResolveProgressive && progressiveTags.length > 0) {
          // Track loaded chunks for continuation tags (accumulate content)
          const continuationContent: Map<string, string[]> = new Map();

          // Initialize continuation content arrays
          for (const tag of progressiveTags) {
            if (tag.type === "continue") {
              const contTag = tag as ContinuationTag;
              const key = `continue-${contTag.collection}-${contTag.from ?? 0}`;
              continuationContent.set(key, []);
            }
          }

          const loader = new ProgressiveLoader({
            contractId,
            client,
            batchSize: progressiveBatchSize,
            maxConcurrent: progressiveMaxConcurrent,
            onChunkLoaded: async (collection, index, chunkContent) => {
              // Skip empty chunks
              if (!chunkContent) return;

              // Parse the chunk as markdown
              const chunkHtml = await parseMarkdown(chunkContent);

              // Check if this belongs to a continuation tag
              let belongsToContinuation = false;
              let continuationKey = "";

              for (const tag of progressiveTags) {
                if (tag.type === "continue") {
                  const contTag = tag as ContinuationTag;
                  if (contTag.collection === collection) {
                    const from = contTag.from ?? 0;
                    const total = contTag.total;
                    if (index >= from && (total === undefined || index < total)) {
                      belongsToContinuation = true;
                      continuationKey = `continue-${collection}-${from}`;
                      break;
                    }
                  }
                }
              }

              if (belongsToContinuation && continuationKey) {
                // Accumulate content for continuation tag
                const chunks = continuationContent.get(continuationKey) || [];
                chunks[index] = chunkHtml; // Use index for ordering
                continuationContent.set(continuationKey, chunks);

                // Update HTML by replacing continuation wrapper with new content
                setHtml((prevHtml) => {
                  if (!prevHtml) return prevHtml;

                  // Join all loaded chunks in order
                  const orderedContent = chunks.filter(Boolean).join("\n");

                  // Build a wrapper that can be found again for subsequent updates
                  const newWrapper = `<div class="soroban-progressive-loaded" data-progressive-id="${continuationKey}">${orderedContent}</div>`;

                  // Replace the continuation placeholder or previously loaded wrapper
                  const placeholderRegex = new RegExp(
                    `<div[^>]*data-progressive-id="${continuationKey}"[^>]*>.*?</div>`,
                    "s"
                  );
                  return prevHtml.replace(placeholderRegex, newWrapper);
                });
              } else {
                // Regular chunk tag - replace placeholder directly
                setHtml((prevHtml) => {
                  if (!prevHtml) return prevHtml;

                  const tagId = `chunk-${collection}-${index}`;
                  const placeholderRegex = new RegExp(
                    `<div[^>]*data-progressive-id="${tagId}"[^>]*>.*?</div>`,
                    "s"
                  );
                  return prevHtml.replace(placeholderRegex, chunkHtml);
                });
              }
            },
            onError: (err) => {
              console.error("Progressive loading error:", err);
            },
          });

          progressiveLoaderRef.current = loader;

          // Just pass the original tags - the loader will expand continuation tags
          loader.loadTags(progressiveTags).catch((err) => {
            console.error("Progressive loading failed:", err);
          });
        }

        // Start render continuation loading in background (waterfall loading)
        // Note: Check against original content since parseProgressiveTags converts {{render...}} to placeholder divs
        if (shouldResolveRenderContinuations && hasRenderContinuations(content)) {
          // Load render continuations asynchronously
          (async () => {
            try {
              const result = await loadRenderContinuations(renderedHtml, {
                contractId,
                client,
                viewer,
                maxConcurrent: renderContinuationMaxConcurrent,
                maxContinuations: renderContinuationMaxTotal,
                onContinuationLoaded: async (_path, rawContent) => {
                  // Process raw markdown content:
                  // 1. Parse any {{render...}} tags to placeholder divs
                  let processedContent = rawContent;
                  if (hasProgressiveTags(rawContent)) {
                    const parsed = parseProgressiveTags(rawContent);
                    processedContent = parsed.content;
                  }
                  // 2. Parse markdown to HTML
                  const parsedHtml = await parseMarkdown(processedContent);
                  return parsedHtml;
                },
                onError: (err, path) => {
                  console.error(`Render continuation error for ${path}:`, err);
                },
              });

              // Update HTML state with final content (all continuations loaded)
              if (result.continuationsLoaded > 0) {
                setHtml(result.content);
              }

              if (result.errors.length > 0) {
                console.error("Some render continuations failed:", result.errors);
              }
            } catch (err) {
              console.error("Render continuation loading failed:", err);
            }
          })();
        }
      } else if (detectedFormat === "json") {
        const parseResult = parseJsonUI(content);
        if (parseResult.success && parseResult.document) {
          setJsonDocument(parseResult.document);
          setHtml(null);
        } else {
          // If JSON parsing fails, show as code block
          const jsonMd = "```json\n" + content + "\n```";
          const renderedHtml = await parseMarkdown(jsonMd);
          setHtml(renderedHtml);
          setJsonDocument(null);
          if (parseResult.error) {
            setError(`JSON parse error: ${parseResult.error}`);
          }
        }
      } else {
        setHtml(`<pre>${content}</pre>`);
        setJsonDocument(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to render contract";
      setError(message);
      setHtml(null);
      setRaw(null);
      setJsonDocument(null);
      setFormat(null);
      setCss(null);
      setScopeClassName(null);
      setErrorMappings(null);
    } finally {
      setLoading(false);
    }
  }, [client, contractId, currentPath, viewer, shouldResolveIncludes, includeCacheTtl, shouldResolveStyles, styleCacheTtl, themeContractId, scopeStyles, shouldResolveProgressive, progressiveBatchSize, progressiveMaxConcurrent, shouldResolveRenderContinuations, renderContinuationMaxConcurrent, renderContinuationMaxTotal, shouldApplyMeta]);

  useEffect(() => {
    if (enabled) {
      fetchRender();
    }
  }, [enabled, fetchRender]);

  return {
    html,
    raw,
    jsonDocument,
    format,
    loading,
    error,
    path: currentPath,
    setPath: setCurrentPath,
    refetch: fetchRender,
    css,
    scopeClassName,
    errorMappings,
  };
}

export function useRenderSupport(
  client: SorobanClient | null,
  contractId: string | null
): {
  supported: boolean | null;
  loading: boolean;
  error: string | null;
} {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!client || !contractId) {
      setSupported(null);
      return;
    }

    const check = async () => {
      setLoading(true);
      setError(null);

      try {
        await callRender(client, contractId);
        setSupported(true);
      } catch (err) {
        setSupported(false);
        const message = err instanceof Error ? err.message : "Contract does not support render";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    check();
  }, [client, contractId]);

  return { supported, loading, error };
}
