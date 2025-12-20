import { useState, useEffect, useCallback } from "react";
import { SorobanClient, callRender, RenderOptions } from "../utils/client";
import { parseMarkdown, detectFormat } from "../parsers/markdown";

export interface UseRenderResult {
  html: string | null;
  raw: string | null;
  format: "markdown" | "json" | "unknown" | null;
  loading: boolean;
  error: string | null;
  path: string;
  setPath: (path: string) => void;
  refetch: () => Promise<void>;
}

export interface UseRenderOptions extends RenderOptions {
  enabled?: boolean;
}

export function useRender(
  client: SorobanClient | null,
  contractId: string | null,
  options: UseRenderOptions = {}
): UseRenderResult {
  const { path: initialPath = "/", viewer, enabled = true } = options;

  const [currentPath, setCurrentPath] = useState(initialPath);
  const [html, setHtml] = useState<string | null>(null);
  const [raw, setRaw] = useState<string | null>(null);
  const [format, setFormat] = useState<"markdown" | "json" | "unknown" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const content = await callRender(client, contractId, { path: currentPath, viewer });
      setRaw(content);

      const detectedFormat = detectFormat(content);
      setFormat(detectedFormat);

      if (detectedFormat === "markdown") {
        const renderedHtml = await parseMarkdown(content);
        setHtml(renderedHtml);
      } else if (detectedFormat === "json") {
        const jsonMd = "```json\n" + content + "\n```";
        const renderedHtml = await parseMarkdown(jsonMd);
        setHtml(renderedHtml);
      } else {
        setHtml(`<pre>${content}</pre>`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to render contract";
      setError(message);
      setHtml(null);
      setRaw(null);
      setFormat(null);
    } finally {
      setLoading(false);
    }
  }, [client, contractId, currentPath, viewer]);

  useEffect(() => {
    if (enabled) {
      fetchRender();
    }
  }, [enabled, fetchRender]);

  return {
    html,
    raw,
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
