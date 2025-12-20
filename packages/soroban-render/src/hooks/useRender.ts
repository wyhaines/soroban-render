import { useState, useEffect, useCallback, useRef } from "react";
import { SorobanClient, callRender, RenderOptions } from "../utils/client";
import { parseMarkdown, detectFormat } from "../parsers/markdown";
import { parseJsonUI, JsonUIDocument } from "../parsers/json";
import { resolveIncludes } from "../utils/includeResolver";

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
  } = options;

  const [currentPath, setCurrentPath] = useState(initialPath);
  const [html, setHtml] = useState<string | null>(null);
  const [raw, setRaw] = useState<string | null>(null);
  const [jsonDocument, setJsonDocument] = useState<JsonUIDocument | null>(null);
  const [format, setFormat] = useState<"markdown" | "json" | "unknown" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cache for include resolution (persists across renders)
  const includeCacheRef = useRef<Map<string, { content: string; timestamp: number }>>(new Map());

  useEffect(() => {
    setCurrentPath(initialPath);
  }, [initialPath]);

  const fetchRender = useCallback(async () => {
    if (!client || !contractId) {
      return;
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

      setRaw(content);

      const detectedFormat = detectFormat(content);
      setFormat(detectedFormat);

      if (detectedFormat === "markdown") {
        const renderedHtml = await parseMarkdown(content);
        setHtml(renderedHtml);
        setJsonDocument(null);
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
    } finally {
      setLoading(false);
    }
  }, [client, contractId, currentPath, viewer, shouldResolveIncludes, includeCacheTtl]);

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
