import React, { useRef, useEffect, useCallback } from "react";
import { parseLink, collectFormInputs, buildPathWithParams } from "../utils/linkParser";
import { submitTransaction, TransactionResult } from "../utils/transaction";
import { SorobanClient } from "../utils/client";

export interface InteractiveRenderViewProps {
  html: string | null;
  loading?: boolean;
  error?: string | null;
  className?: string;
  style?: React.CSSProperties;
  loadingComponent?: React.ReactNode;
  errorComponent?: React.ReactNode;
  client?: SorobanClient | null;
  contractId?: string | null;
  walletAddress?: string | null;
  onPathChange?: (path: string) => void;
  onTransactionStart?: () => void;
  onTransactionComplete?: (result: TransactionResult) => void;
  onError?: (error: string) => void;
}

export function InteractiveRenderView({
  html,
  loading = false,
  error = null,
  className = "",
  style,
  loadingComponent,
  errorComponent,
  client,
  contractId,
  walletAddress,
  onPathChange,
  onTransactionStart,
  onTransactionComplete,
  onError,
}: InteractiveRenderViewProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleClick = useCallback(
    async (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const link = target.closest("a");

      if (!link) return;

      // Check for data-action first (custom protocols), then fall back to href
      const action = link.getAttribute("data-action");
      const href = action || link.getAttribute("href");
      if (!href) return;

      const parsed = parseLink(href);

      if (parsed.protocol === "standard") {
        return;
      }

      // Prevent browser from handling the link
      event.preventDefault();
      event.stopPropagation();

      if (parsed.protocol === "render") {
        if (!onPathChange) return;

        const container = containerRef.current;
        if (!container) return;

        const formInputs = collectFormInputs(container, link);
        const fullPath = buildPathWithParams(parsed.path || "/", formInputs);
        onPathChange(fullPath);
        return;
      }

      if (parsed.protocol === "tx") {
        if (!client || !contractId || !walletAddress) {
          onError?.("Wallet not connected");
          return;
        }

        if (!parsed.method) {
          onError?.("Invalid transaction link");
          return;
        }

        // Automatically add caller for contract methods that require auth
        const txArgs: Record<string, unknown> = {
          ...(parsed.args || {}),
          caller: walletAddress,
        };

        onTransactionStart?.();

        const result = await submitTransaction(client, contractId, {
          method: parsed.method,
          args: txArgs,
        }, walletAddress);

        onTransactionComplete?.(result);

        if (!result.success && result.error) {
          onError?.(result.error);
        }
        return;
      }

      if (parsed.protocol === "form") {
        if (!client || !contractId || !walletAddress) {
          onError?.("Wallet not connected");
          return;
        }

        if (!parsed.method) {
          onError?.("Invalid form link");
          return;
        }

        const container = containerRef.current;
        if (!container) return;

        const formInputs = collectFormInputs(container, link);

        // Check if required inputs are filled
        if (Object.keys(formInputs).length === 0 ||
            Object.values(formInputs).every(v => !v || v.trim() === "")) {
          onError?.("Please fill in the form fields");
          return;
        }

        // Automatically add caller for contract methods that require auth
        // Note: caller is added last to match typical contract function signatures
        const args: Record<string, unknown> = {
          ...formInputs,
          caller: walletAddress,
        };

        onTransactionStart?.();

        const result = await submitTransaction(client, contractId, {
          method: parsed.method,
          args,
        }, walletAddress);

        onTransactionComplete?.(result);

        if (!result.success && result.error) {
          onError?.(result.error);
        }
        return;
      }
    },
    [client, contractId, walletAddress, onPathChange, onTransactionStart, onTransactionComplete, onError]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Use capture phase to intercept clicks before the browser can handle the protocol
    container.addEventListener("click", handleClick, true);
    return () => {
      container.removeEventListener("click", handleClick, true);
    };
    // Include html in dependencies so effect re-runs when content renders
  }, [handleClick, html]);

  if (loading) {
    if (loadingComponent) {
      return <>{loadingComponent}</>;
    }
    return (
      <div className={`soroban-render-loading ${className}`} style={style}>
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <div
            style={{
              display: "inline-block",
              width: "2rem",
              height: "2rem",
              border: "3px solid #e0e0e0",
              borderTopColor: "#333",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }}
          />
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
          <p style={{ marginTop: "1rem", color: "#666" }}>Loading contract UI...</p>
        </div>
      </div>
    );
  }

  if (error) {
    if (errorComponent) {
      return <>{errorComponent}</>;
    }
    return (
      <div className={`soroban-render-error ${className}`} style={style}>
        <div
          style={{
            padding: "1rem",
            backgroundColor: "#fee",
            border: "1px solid #fcc",
            borderRadius: "4px",
            color: "#c00",
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      </div>
    );
  }

  if (!html) {
    return (
      <div className={`soroban-render-empty ${className}`} style={style}>
        <div style={{ textAlign: "center", padding: "2rem", color: "#666" }}>
          <p>No content to display</p>
          <p style={{ fontSize: "0.875rem" }}>
            Enter a contract ID that implements the render convention.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`soroban-render-view ${className}`}
      style={style}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
