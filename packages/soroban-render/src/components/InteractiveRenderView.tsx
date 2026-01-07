import React, { useRef, useEffect, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { parseLink, collectFormInputs, ParsedLink } from "../utils/linkParser";
import { submitTransaction, TransactionResult } from "../utils/transaction";
import { SorobanClient } from "../utils/client";
import { resolveTargetContract } from "../utils/contractResolver";
import { MarkdownEditorWrapper } from "./MarkdownEditorWrapper";
import { ParsedError, lookupErrorMessage } from "../utils/errorParser";

// Info needed to render a markdown editor via portal
interface MarkdownEditorInfo {
  container: HTMLElement;
  name: string;
  placeholder: string;
  rows: number;
  initialValue: string;
  onValueChange: (value: string) => void;
}

// Modal for user-settable parameters
interface ParamModalProps {
  params: string[];
  method: string;
  onSubmit: (values: Record<string, string>) => void;
  onCancel: () => void;
}

function ParamInputModal({ params, method, onSubmit, onCancel }: ParamModalProps): React.ReactElement {
  const [values, setValues] = useState<Record<string, string>>(() =>
    params.reduce((acc, p) => ({ ...acc, [p]: "" }), {})
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Validate all fields have values
    const allFilled = params.every(p => values[p]?.trim() !== "");
    if (!allFilled) return;
    onSubmit(values);
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "8px",
          padding: "1.5rem",
          minWidth: "320px",
          maxWidth: "480px",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
        }}
      >
        <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.125rem", fontWeight: 600 }}>
          Enter Parameters for {method}
        </h3>
        <form onSubmit={handleSubmit}>
          {params.map((param) => (
            <div key={param} style={{ marginBottom: "1rem" }}>
              <label
                htmlFor={`param-${param}`}
                style={{
                  display: "block",
                  marginBottom: "0.25rem",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: "#374151",
                }}
              >
                {param}
              </label>
              <input
                id={`param-${param}`}
                type="text"
                value={values[param]}
                onChange={(e) => setValues((prev) => ({ ...prev, [param]: e.target.value }))}
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  fontSize: "1rem",
                  boxSizing: "border-box",
                }}
                autoFocus={params.indexOf(param) === 0}
              />
            </div>
          ))}
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "1.5rem" }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: "0.5rem 1rem",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                backgroundColor: "white",
                cursor: "pointer",
                fontSize: "0.875rem",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                padding: "0.5rem 1rem",
                border: "none",
                borderRadius: "6px",
                backgroundColor: "#2563eb",
                color: "white",
                cursor: "pointer",
                fontSize: "0.875rem",
                fontWeight: 500,
              }}
            >
              Submit Transaction
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

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
  /**
   * Registry contract ID for alias resolution.
   * When provided, enables `form:@alias:method`, `tx:@alias:method`, and
   * `render:@alias:/path` links to target contracts registered in the registry.
   */
  registryId?: string | null;
  onPathChange?: (path: string) => void;
  /**
   * Callback for cross-contract navigation via render:@alias:/path or render:CONTRACT_ID:/path.
   * When provided, enables navigating to a different contract's render output.
   * @param contractId - The resolved contract ID to navigate to
   * @param path - The path to render on that contract
   * @param contractRef - Optional original reference (e.g., "@profile" or contract ID) for URL persistence
   */
  onContractNavigate?: (contractId: string, path: string, contractRef?: string) => void;
  onTransactionStart?: () => void;
  onTransactionComplete?: (result: TransactionResult) => void;
  /**
   * Called when an error occurs. Receives either a string for simple errors
   * or a ParsedError for transaction failures with structured error info.
   */
  onError?: (error: string | ParsedError) => void;
  /** CSS from contract styles() function and {{style}} tags */
  css?: string | null;
  /** Scope class name for CSS isolation */
  scopeClassName?: string | null;
  /**
   * Contract-defined error code to message mappings from {{errors ...}} tags.
   * Used to provide custom user-friendly error messages for specific error codes.
   */
  errorMappings?: Record<string, string> | null;
}

// State for pending transaction with user-settable parameters
interface PendingUserParams {
  parsed: ParsedLink;
  params: string[];
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
  registryId,
  onPathChange,
  onContractNavigate,
  onTransactionStart,
  onTransactionComplete,
  onError,
  css,
  scopeClassName,
  errorMappings,
}: InteractiveRenderViewProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pendingUserParams, setPendingUserParams] = useState<PendingUserParams | null>(null);
  const [markdownEditors, setMarkdownEditors] = useState<MarkdownEditorInfo[]>([]);

  // Preserve markdown editor values across html changes (e.g., from waterfall loading)
  const editorValuesRef = useRef<Map<string, string>>(new Map());

  // Preserve all form field values across loading state changes
  const formValuesRef = useRef<Map<string, string>>(new Map());

  // Handle modal submission
  const handleParamSubmit = useCallback(
    async (values: Record<string, string>) => {
      if (!pendingUserParams || !client || !contractId || !walletAddress) return;

      const parsed = pendingUserParams.parsed;
      setPendingUserParams(null);

      // Resolve target contract (supports @alias and explicit contract IDs)
      const targetContractId = await resolveTargetContract(
        parsed.alias,
        parsed.contractId,
        contractId,
        registryId ?? undefined,
        client
      );

      if (!targetContractId) {
        onError?.(`Unknown contract alias: @${parsed.alias}`);
        return;
      }

      // Merge user-provided values with original args
      const mergedArgs: Record<string, unknown> = {
        ...(parsed.args || {}),
        ...values,
        caller: walletAddress,
      };

      onTransactionStart?.();

      const result = await submitTransaction(client, targetContractId, {
        method: parsed.method!,
        args: mergedArgs,
      }, walletAddress);

      onTransactionComplete?.(result);

      if (!result.success && result.error) {
        // Enrich error with custom message from mappings if available
        const enrichedError: ParsedError = {
          ...result.error,
          userMessage: lookupErrorMessage(result.error, errorMappings ?? undefined),
        };
        onError?.(enrichedError);
      }
    },
    [pendingUserParams, client, contractId, walletAddress, registryId, onTransactionStart, onTransactionComplete, onError, errorMappings]
  );

  const handleParamCancel = useCallback(() => {
    setPendingUserParams(null);
  }, []);

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

      // Prevent browser from handling the link BEFORE any async operations
      // This is critical to prevent navigation on any errors in async code
      event.preventDefault();
      event.stopPropagation();

      // Wrap all async operations in try-catch to prevent silent failures
      try {

      console.log("[soroban-render] Link clicked, parseLink result:", parsed);

      if (parsed.protocol === "render") {
        // Check if this is a cross-contract navigation (has alias or explicit contractId)
        if (parsed.alias || parsed.contractId) {
          if (!onContractNavigate) {
            // Fall back to onPathChange if no cross-contract handler
            if (onPathChange) {
              onPathChange(parsed.path || "/");
            }
            return;
          }

          // Resolve the target contract
          const targetContractId = await resolveTargetContract(
            parsed.alias,
            parsed.contractId,
            contractId || "",
            registryId ?? undefined,
            client ?? null
          );

          if (!targetContractId) {
            onError?.(`Unknown contract alias: @${parsed.alias}`);
            return;
          }

          // Pass the original reference (alias or contract ID) for URL persistence
          const contractRef = parsed.alias ? `@${parsed.alias}` : parsed.contractId;
          onContractNavigate(targetContractId, parsed.path || "/", contractRef);
          return;
        }

        // Standard same-contract navigation
        if (!onPathChange) return;
        onPathChange(parsed.path || "/");
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

        // Check if there are user-settable parameters (empty string values)
        if (parsed.userSettableParams && parsed.userSettableParams.length > 0) {
          // Show modal to collect parameter values
          setPendingUserParams({
            parsed,
            params: parsed.userSettableParams,
          });
          return;
        }

        // Resolve target contract (supports @alias and explicit contract IDs)
        const targetContractId = await resolveTargetContract(
          parsed.alias,
          parsed.contractId,
          contractId,
          registryId ?? undefined,
          client
        );

        if (!targetContractId) {
          onError?.(`Unknown contract alias: @${parsed.alias}`);
          return;
        }

        // Automatically add caller for contract methods that require auth
        const txArgs: Record<string, unknown> = {
          ...(parsed.args || {}),
          caller: walletAddress,
        };

        onTransactionStart?.();

        const result = await submitTransaction(client, targetContractId, {
          method: parsed.method,
          args: txArgs,
        }, walletAddress);

        onTransactionComplete?.(result);

        if (!result.success && result.error) {
          // Enrich error with custom message from mappings if available
          const enrichedError: ParsedError = {
            ...result.error,
            userMessage: lookupErrorMessage(result.error, errorMappings ?? undefined),
          };
          onError?.(enrichedError);
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

        // Debug: log collected form inputs
        console.log("[soroban-render] Form inputs collected:", formInputs);

        // Extract redirect path if present (for navigation after success)
        const redirectPath = formInputs._redirect;
        delete formInputs._redirect;

        console.log("[soroban-render] Redirect path:", redirectPath);

        // Check if required inputs are filled (excluding underscore-prefixed metadata fields)
        const visibleInputs = Object.entries(formInputs)
          .filter(([key]) => !key.startsWith("_"));
        if (visibleInputs.length === 0 ||
            visibleInputs.every(([, v]) => !v || v.trim() === "")) {
          onError?.("Please fill in the form fields");
          return;
        }

        // Resolve target contract (supports @alias and explicit contract IDs)
        const targetContractId = await resolveTargetContract(
          parsed.alias,
          parsed.contractId,
          contractId,
          registryId ?? undefined,
          client
        );

        if (!targetContractId) {
          onError?.(`Unknown contract alias: @${parsed.alias}`);
          return;
        }

        // Automatically add caller for contract methods that require auth
        // Note: caller is added last to match typical contract function signatures
        const args: Record<string, unknown> = {
          ...formInputs,
          caller: walletAddress,
        };

        onTransactionStart?.();

        const result = await submitTransaction(client, targetContractId, {
          method: parsed.method,
          args,
        }, walletAddress);

        onTransactionComplete?.(result);

        if (!result.success && result.error) {
          // Enrich error with custom message from mappings if available
          const enrichedError: ParsedError = {
            ...result.error,
            userMessage: lookupErrorMessage(result.error, errorMappings ?? undefined),
          };
          onError?.(enrichedError);
        } else if (result.success && redirectPath && onPathChange) {
          // Navigate to redirect path on success
          console.log("[soroban-render] Transaction successful, redirecting to:", redirectPath);
          onPathChange(redirectPath);
        } else if (result.success) {
          console.log("[soroban-render] Transaction successful, but no redirect:", {
            redirectPath,
            hasOnPathChange: !!onPathChange,
          });
        }
        return;
      }
      } catch (err) {
        // Log any errors but don't re-throw - we've already prevented default navigation
        console.error("[soroban-render] Error handling link click:", err);
        const message = err instanceof Error ? err.message : "An unexpected error occurred";
        onError?.(message);
      }
    },
    [client, contractId, walletAddress, registryId, onPathChange, onContractNavigate, onTransactionStart, onTransactionComplete, onError, errorMappings, setPendingUserParams]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Use capture phase to intercept clicks before the browser can handle the protocol
    container.addEventListener("click", handleClick, true);
    return () => {
      container.removeEventListener("click", handleClick, true);
    };
    // Include html and loading in dependencies so effect re-runs when content renders
    // or when loading state changes (container is recreated after loading spinner)
  }, [handleClick, html, loading]);

  // Clear markdown editors when loading starts to prevent stale state from overwriting preserved values
  useEffect(() => {
    if (loading) {
      setMarkdownEditors([]);
    }
  }, [loading]);

  // Capture and restore form field values across loading state changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Restore any previously saved form values
    const restoreFormValues = () => {
      formValuesRef.current.forEach((value, name) => {
        const element = container.querySelector(`[name="${name}"]`) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
        if (element && element.type !== "hidden") {
          element.value = value;
        }
      });
    };

    // Capture form values on input/change events
    const captureFormValue = (event: Event) => {
      const target = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
      if (target.name && target.type !== "hidden") {
        formValuesRef.current.set(target.name, target.value);
      }
    };

    // Restore values after DOM is ready
    restoreFormValues();

    // Listen for changes to capture values
    container.addEventListener("input", captureFormValue, true);
    container.addEventListener("change", captureFormValue, true);

    return () => {
      container.removeEventListener("input", captureFormValue, true);
      container.removeEventListener("change", captureFormValue, true);
    };
  }, [html, loading]);

  // Find and replace markdown textareas with rich editors
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const textareas = container.querySelectorAll(
      'textarea[data-editor="markdown"]'
    );

    if (textareas.length === 0) {
      setMarkdownEditors([]);
      return;
    }

    const editorInfos: MarkdownEditorInfo[] = [];

    const originalTextareas: { ta: HTMLTextAreaElement; name: string }[] = [];

    textareas.forEach((textarea) => {
      const ta = textarea as HTMLTextAreaElement;
      const originalName = ta.name;

      // Create container for React component
      const editorContainer = document.createElement("div");
      editorContainer.className = "md-editor-container";
      ta.parentNode?.insertBefore(editorContainer, ta);

      // Hide original textarea and remove its name so collectFormInputs doesn't find it
      // (the MarkdownEditorWrapper creates a hidden input with the same name)
      ta.style.display = "none";
      ta.removeAttribute("name");

      // Store original for cleanup
      originalTextareas.push({ ta, name: originalName });

      // Get initial value - prefer preserved value from previous render, then try DOM sources
      // This preserves user input across html changes (e.g., from waterfall loading)
      const preservedValue = editorValuesRef.current.get(originalName);
      const domValue = ta.value || ta.defaultValue || ta.textContent || "";
      const initialValue = preservedValue ?? domValue;

      console.log("[soroban-render] Markdown textarea found:", {
        name: originalName,
        preservedValue,
        domValue,
        initialValue,
      });

      editorInfos.push({
        container: editorContainer,
        name: originalName,
        placeholder: ta.placeholder || "",
        rows: ta.rows || 10,
        initialValue,
        onValueChange: (value: string) => {
          editorValuesRef.current.set(originalName, value);
        },
      });
    });

    setMarkdownEditors(editorInfos);

    // Cleanup on unmount or when html/loading changes
    return () => {
      editorInfos.forEach((info) => {
        // Container may already be removed if loading state changed
        if (info.container.parentNode) {
          info.container.remove();
        }
      });
      // Restore original textarea names (for graceful degradation)
      // Only if they're still in the DOM
      originalTextareas.forEach(({ ta, name }) => {
        if (ta.parentNode) {
          ta.setAttribute("name", name);
          ta.style.display = "";
        }
      });
    };
  }, [html, loading]);

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

  // Build class names including scope
  const classNames = ["soroban-render-view"];
  if (scopeClassName) {
    classNames.push(scopeClassName);
  }
  if (className) {
    classNames.push(className);
  }

  return (
    <>
      {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
      <div
        ref={containerRef}
        className={classNames.join(" ")}
        style={style}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {pendingUserParams && (
        <ParamInputModal
          params={pendingUserParams.params}
          method={pendingUserParams.parsed.method!}
          onSubmit={handleParamSubmit}
          onCancel={handleParamCancel}
        />
      )}
      {/* Render markdown editors via portals into their containers */}
      {markdownEditors.map((editor, index) =>
        createPortal(
          <MarkdownEditorWrapper
            key={index}
            name={editor.name}
            initialValue={editor.initialValue}
            placeholder={editor.placeholder}
            rows={editor.rows}
            onChange={editor.onValueChange}
          />,
          editor.container
        )
      )}
    </>
  );
}
