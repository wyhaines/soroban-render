import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  createClient,
  useRender,
  useWallet,
  InteractiveRenderView,
  InteractiveJsonRenderView,
  jsonStyles,
  Networks,
  resolveTargetContract,
  type NetworkName,
  type SorobanClient,
  type TransactionResult,
} from "@soroban-render/core";

type Network = NetworkName | "custom";

// Toast notification component
interface ToastProps {
  message: string;
  type: "info" | "error" | "warning";
  onClose: () => void;
  autoClose?: number; // ms, 0 to disable
}

function Toast({ message, type, onClose, autoClose = 5000 }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (autoClose > 0) {
      timerRef.current = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onClose, 300); // Wait for fade animation
      }, autoClose);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [autoClose, onClose]);

  const bgColor = {
    info: "bg-blue-50 border-blue-200",
    error: "bg-red-50 border-red-200",
    warning: "bg-yellow-50 border-yellow-200",
  }[type];

  const textColor = {
    info: "text-blue-700",
    error: "text-red-700",
    warning: "text-yellow-700",
  }[type];

  const iconColor = {
    info: "text-blue-400 hover:text-blue-600",
    error: "text-red-400 hover:text-red-600",
    warning: "text-yellow-400 hover:text-yellow-600",
  }[type];

  return (
    <div
      className={`${bgColor} border rounded-lg p-3 shadow-lg flex items-start gap-2 transition-all duration-300 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
      }`}
    >
      <p className={`${textColor} text-sm flex-1`}>{message}</p>
      <button
        onClick={() => {
          setIsVisible(false);
          setTimeout(onClose, 300);
        }}
        className={`${iconColor} transition-colors flex-shrink-0`}
        aria-label="Dismiss"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

/**
 * Parse the URL hash to extract contract context and path.
 * Supports formats:
 * - #/path - just a path (uses default contract)
 * - #@alias:/path - contract alias with path (e.g., #@profile:/u/wyhaines001)
 * - #CONTRACTID:/path - explicit contract ID with path
 */
function parseHashRoute(): { contractRef?: string; path: string } {
  const hash = window.location.hash ? window.location.hash.slice(1) : "";

  if (!hash || hash === "/") {
    return { path: "/" };
  }

  // Check for @alias:/path format
  if (hash.startsWith("@")) {
    const colonIndex = hash.indexOf(":/");
    if (colonIndex > 0) {
      return {
        contractRef: hash.slice(0, colonIndex), // @alias
        path: hash.slice(colonIndex + 1), // /path
      };
    }
    // @alias without path means root
    return {
      contractRef: hash,
      path: "/",
    };
  }

  // Check for CONTRACT_ID:/path format (contract IDs start with C)
  if (hash.startsWith("C") && hash.length > 56) {
    const colonIndex = hash.indexOf(":/");
    if (colonIndex === 56) { // Contract IDs are 56 chars
      return {
        contractRef: hash.slice(0, colonIndex),
        path: hash.slice(colonIndex + 1),
      };
    }
  }

  // Just a path
  return { path: hash.startsWith("/") ? hash : `/${hash}` };
}

function getConfigFromUrl(): { contract?: string; network?: Network; path?: string; contractRef?: string } {
  const params = new URLSearchParams(window.location.search);
  const hashRoute = parseHashRoute();

  return {
    contract: params.get("contract") || undefined,
    network: (params.get("network") as Network) || undefined,
    path: hashRoute.path || params.get("path") || undefined,
    contractRef: hashRoute.contractRef,
  };
}

function updateHashPath(path: string, contractRef?: string | null) {
  // Update URL hash without triggering a page reload
  // Format: #@alias:/path or #CONTRACTID:/path or just #/path
  let newHash: string;
  if (contractRef) {
    newHash = `#${contractRef}:${path}`;
  } else if (path === "/") {
    newHash = "";
  } else {
    newHash = `#${path}`;
  }

  if (window.location.hash !== newHash) {
    window.history.pushState(null, "", newHash || window.location.pathname + window.location.search);
  }
}

function getConfigFromEnv(): { contract?: string; registryContract?: string; network?: Network } {
  return {
    contract: import.meta.env.VITE_CONTRACT_ID || undefined,
    registryContract: import.meta.env.VITE_REGISTRY_ID || undefined,
    network: (import.meta.env.VITE_NETWORK as Network) || undefined,
  };
}

export default function App() {
  const urlConfig = getConfigFromUrl();
  const envConfig = getConfigFromEnv();

  const preConfiguredContract = urlConfig.contract || envConfig.contract;
  const preConfiguredRegistryContract = envConfig.registryContract;
  const preConfiguredNetwork = urlConfig.network || envConfig.network || "local";
  const preConfiguredPath = urlConfig.path || "/";
  const preConfiguredContractRef = urlConfig.contractRef;

  const isEmbedded = !!preConfiguredContract;

  const [contractId, setContractId] = useState(preConfiguredContract || "");
  const [inputContractId, setInputContractId] = useState(preConfiguredContract || "");
  const [registryId] = useState(preConfiguredRegistryContract || "");
  // Cross-contract navigation: when navigating to a different contract via render:@alias:/path
  const [navigatedContractId, setNavigatedContractId] = useState<string | null>(null);
  // Track the contract reference (alias or ID) for URL persistence
  const [navigatedContractRef, setNavigatedContractRef] = useState<string | null>(preConfiguredContractRef || null);
  const [network, setNetwork] = useState<Network>(preConfiguredNetwork);
  const [customRpcUrl, setCustomRpcUrl] = useState("");
  const [inputPath, setInputPath] = useState(preConfiguredPath);
  const [txPending, setTxPending] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const [dismissedWalletError, setDismissedWalletError] = useState<string | null>(null);
  // Flag to indicate we need to resolve contract ref on first render
  const [needsContractResolution, setNeedsContractResolution] = useState(!!preConfiguredContractRef);

  const wallet = useWallet();

  // Determine effective contract based on cross-contract navigation
  let effectiveContractId = contractId;
  const effectivePath = inputPath;

  if (navigatedContractId) {
    // Cross-contract navigation takes priority
    effectiveContractId = navigatedContractId;
  }

  // Reset dismissed wallet error when a new error occurs
  useEffect(() => {
    if (wallet.error && wallet.error !== dismissedWalletError) {
      setDismissedWalletError(null);
    }
  }, [wallet.error, dismissedWalletError]);

  const showWalletError = wallet.error && wallet.error !== dismissedWalletError;

  const client = useMemo((): SorobanClient | null => {
    if (network === "custom") {
      if (!customRpcUrl) return null;
      return createClient(customRpcUrl, "Custom Network");
    }
    const config = Networks[network];
    return createClient(config.rpcUrl, config.networkPassphrase);
  }, [network, customRpcUrl]);

  // Resolve contract reference from URL on initial load
  useEffect(() => {
    if (!needsContractResolution || !navigatedContractRef || !client) return;

    const resolveContract = async () => {
      // Parse the contract ref - could be @alias or a contract ID
      const isAlias = navigatedContractRef.startsWith("@");
      const alias = isAlias ? navigatedContractRef.slice(1) : undefined;
      const explicitContractId = isAlias ? undefined : navigatedContractRef;

      const resolved = await resolveTargetContract(
        alias,
        explicitContractId,
        contractId,
        registryId || undefined,
        client
      );

      if (resolved) {
        // If resolved contract is the base contract, clear navigation state
        if (resolved === contractId) {
          setNavigatedContractRef(null);
          setNavigatedContractId(null);
        } else {
          setNavigatedContractId(resolved);
        }
      }
      setNeedsContractResolution(false);
    };

    resolveContract();
  }, [needsContractResolution, navigatedContractRef, client, contractId, registryId]);

  const { html, jsonDocument, format, loading, error, path, setPath, refetch, css, scopeClassName } = useRender(
    client,
    effectiveContractId || null,
    { path: effectivePath || "/", viewer: wallet.address || undefined }
  );

  useEffect(() => {
    if (preConfiguredContract && !contractId) {
      setContractId(preConfiguredContract);
    }
  }, [preConfiguredContract, contractId]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setContractId(inputContractId.trim());
    },
    [inputContractId]
  );

  const handlePathChange = useCallback(
    (newPath: string) => {
      // DON'T clear cross-contract navigation - maintain context for internal links
      // If we're currently viewing a cross-contract target, internal links should
      // stay on that contract
      setPath(newPath);
      setInputPath(newPath);
      // Update URL hash for shareable links, preserving contract context
      if (isEmbedded) {
        updateHashPath(newPath, navigatedContractRef);
      }
    },
    [setPath, isEmbedded, navigatedContractRef]
  );

  // Handle cross-contract navigation (render:@alias:/path or render:CONTRACT_ID:/path)
  const handleContractNavigate = useCallback(
    (targetContractId: string, newPath: string, contractRef?: string) => {
      // Check if we're navigating back to the base contract
      // If so, clear cross-contract state to return to "home" mode
      if (targetContractId === contractId) {
        setNavigatedContractId(null);
        setNavigatedContractRef(null);
        setPath(newPath);
        setInputPath(newPath);
        if (isEmbedded) {
          updateHashPath(newPath, null);
        }
        return;
      }

      setNavigatedContractId(targetContractId);
      // Store the contract reference (alias or ID) for URL persistence
      // If contractRef is provided (e.g., "@profile"), use it; otherwise use the contract ID
      const ref = contractRef || targetContractId;
      setNavigatedContractRef(ref);
      setPath(newPath);
      setInputPath(newPath);
      // Update URL hash - include contract info for shareability
      if (isEmbedded) {
        updateHashPath(newPath, ref);
      }
    },
    [setPath, isEmbedded, contractId]
  );

  // Listen for browser back/forward navigation
  useEffect(() => {
    if (!isEmbedded) return;

    const handlePopState = async () => {
      const hashRoute = parseHashRoute();
      setPath(hashRoute.path);
      setInputPath(hashRoute.path);

      // Handle contract context from URL
      if (hashRoute.contractRef) {
        // Need to resolve the contract reference to an ID
        if (client) {
          const isAlias = hashRoute.contractRef.startsWith("@");
          const alias = isAlias ? hashRoute.contractRef.slice(1) : undefined;
          const explicitContractId = isAlias ? undefined : hashRoute.contractRef;

          const resolved = await resolveTargetContract(
            alias,
            explicitContractId,
            contractId,
            registryId || undefined,
            client
          );

          if (resolved) {
            // If resolved contract is the base contract, clear navigation state
            if (resolved === contractId) {
              setNavigatedContractRef(null);
              setNavigatedContractId(null);
            } else {
              setNavigatedContractRef(hashRoute.contractRef);
              setNavigatedContractId(resolved);
            }
          }
        }
      } else {
        // No contract context in URL - clear cross-contract state
        setNavigatedContractRef(null);
        setNavigatedContractId(null);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [isEmbedded, setPath, client, contractId, registryId]);

  const handleTransactionStart = useCallback(() => {
    setTxPending(true);
    setTxError(null);
  }, []);

  const handleTransactionComplete = useCallback(
    (result: TransactionResult) => {
      setTxPending(false);
      if (result.success) {
        refetch();
      }
    },
    [refetch]
  );

  const handleError = useCallback((err: string) => {
    setTxError(err);
    setTxPending(false);
  }, []);

  if (isEmbedded) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0f0f0f]">
        {/* Minimal header with wallet only */}
        <header className="fixed top-0 right-0 p-4 z-10">
          <div className="flex items-center gap-2">
            {wallet.connected ? (
              <>
                <span className="text-sm text-gray-600 dark:text-gray-300 font-mono bg-white/80 dark:bg-gray-800/80 px-2 py-1 rounded">
                  {wallet.address?.slice(0, 4)}...{wallet.address?.slice(-4)}
                </span>
                <button
                  onClick={wallet.disconnect}
                  className="px-3 py-1.5 text-sm bg-white/80 dark:bg-gray-800/80 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <button
                onClick={wallet.connect}
                disabled={wallet.connecting}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 shadow-sm"
              >
                {wallet.connecting ? "Connecting..." : "Connect Wallet"}
              </button>
            )}
          </div>
        </header>

        {/* Status messages - positioned in top-left, doesn't overlap wallet button */}
        {(txPending || txError || showWalletError) && (
          <div className="fixed top-4 left-4 z-10 space-y-2 max-w-sm">
            {txPending && (
              <Toast
                message="Transaction pending..."
                type="info"
                onClose={() => {}} // Don't allow closing pending state
                autoClose={0}
              />
            )}
            {txError && (
              <Toast
                message={txError}
                type="error"
                onClose={() => setTxError(null)}
                autoClose={8000}
              />
            )}
            {showWalletError && (
              <Toast
                message={wallet.error!}
                type="warning"
                onClose={() => setDismissedWalletError(wallet.error)}
                autoClose={5000}
              />
            )}
          </div>
        )}

        {/* JSON styles */}
        <style>{jsonStyles}</style>

        {/* Full-page content */}
        <main className="p-8 pt-16">
          {format === "json" && jsonDocument ? (
            <InteractiveJsonRenderView
              document={jsonDocument}
              className="prose prose-slate max-w-none"
              client={client}
              contractId={effectiveContractId || null}
              walletAddress={wallet.address}
              onPathChange={handlePathChange}
              onTransactionStart={handleTransactionStart}
              onTransactionComplete={handleTransactionComplete}
              onError={handleError}
            />
          ) : (
            <InteractiveRenderView
              html={html}
              loading={loading || txPending}
              error={error}
              className="prose prose-slate max-w-none"
              client={client}
              contractId={effectiveContractId || null}
              registryId={registryId || null}
              walletAddress={wallet.address}
              onPathChange={handlePathChange}
              onContractNavigate={handleContractNavigate}
              onTransactionStart={handleTransactionStart}
              onTransactionComplete={handleTransactionComplete}
              onError={handleError}
              css={css}
              scopeClassName={scopeClassName}
            />
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f0f0f]">
      {/* Header */}
      <header className="bg-white dark:bg-[#1c1c1c] shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Soroban Render Viewer
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Universal viewer for any contract with render()
              </p>
            </div>
            <div className="flex items-center gap-4">
              {wallet.connected ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 dark:text-gray-300 font-mono">
                    {wallet.address?.slice(0, 4)}...{wallet.address?.slice(-4)}
                  </span>
                  <button
                    onClick={wallet.disconnect}
                    className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  onClick={wallet.connect}
                  disabled={wallet.connecting}
                  className="px-3 py-1.5 text-sm bg-[#7857e1] text-white rounded-md hover:bg-[#6b4ad1] disabled:opacity-50"
                >
                  {wallet.connecting ? "Connecting..." : "Connect Wallet"}
                </button>
              )}
              <a
                href="https://github.com/wyhaines/soroban-render"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              >
                <svg
                  className="w-6 h-6"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    fillRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                    clipRule="evenodd"
                  />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Controls */}
        <div className="bg-white dark:bg-[#1c1c1c] rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Contract ID Input */}
              <div>
                <label
                  htmlFor="contractId"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Contract ID
                </label>
                <input
                  type="text"
                  id="contractId"
                  value={inputContractId}
                  onChange={(e) => setInputContractId(e.target.value)}
                  placeholder="CA... or CB..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#7857e1] focus:border-[#7857e1] font-mono text-sm bg-white dark:bg-[#232323] text-gray-900 dark:text-gray-100"
                />
              </div>

              {/* Network Selector */}
              <div>
                <label
                  htmlFor="network"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Network
                </label>
                <select
                  id="network"
                  value={network}
                  onChange={(e) => setNetwork(e.target.value as Network)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#7857e1] focus:border-[#7857e1] bg-white dark:bg-[#232323] text-gray-900 dark:text-gray-100"
                >
                  <option value="local">Local (Quickstart)</option>
                  <option value="testnet">Testnet</option>
                  <option value="mainnet">Mainnet</option>
                  <option value="custom">Custom RPC</option>
                </select>
              </div>
            </div>

            {/* Custom RPC URL */}
            {network === "custom" && (
              <div>
                <label
                  htmlFor="rpcUrl"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Custom RPC URL
                </label>
                <input
                  type="url"
                  id="rpcUrl"
                  value={customRpcUrl}
                  onChange={(e) => setCustomRpcUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#7857e1] focus:border-[#7857e1] bg-white dark:bg-[#232323] text-gray-900 dark:text-gray-100"
                />
              </div>
            )}

            {/* Path Input (optional) */}
            <div>
              <label
                htmlFor="path"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Path {path !== inputPath && <span className="text-gray-400">(current: {path})</span>}
              </label>
              <input
                type="text"
                id="path"
                value={inputPath}
                onChange={(e) => setInputPath(e.target.value)}
                placeholder="/task/123"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#7857e1] focus:border-[#7857e1] font-mono text-sm bg-white dark:bg-[#232323] text-gray-900 dark:text-gray-100"
              />
            </div>

            {/* Submit Button */}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={!inputContractId.trim()}
                className="px-4 py-2 bg-[#7857e1] text-white rounded-md hover:bg-[#6b4ad1] focus:outline-none focus:ring-2 focus:ring-[#7857e1] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Load Contract
              </button>
              {contractId && (
                <button
                  type="button"
                  onClick={refetch}
                  disabled={loading}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  Refresh
                </button>
              )}
            </div>
          </form>

          {/* Network Info */}
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {network === "local" && (
                <>
                  Connected to local Stellar Quickstart at{" "}
                  <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded text-gray-800 dark:text-gray-200">
                    http://localhost:8000
                  </code>
                </>
              )}
              {network === "testnet" && (
                <>
                  Connected to Stellar Testnet at{" "}
                  <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded text-gray-800 dark:text-gray-200">
                    soroban-testnet.stellar.org
                  </code>
                </>
              )}
              {network === "mainnet" && (
                <>
                  Connected to Stellar Mainnet at{" "}
                  <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded text-gray-800 dark:text-gray-200">
                    soroban.stellar.org
                  </code>
                </>
              )}
              {network === "custom" && customRpcUrl && (
                <>
                  Connected to{" "}
                  <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded text-gray-800 dark:text-gray-200">
                    {customRpcUrl}
                  </code>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Transaction Status - compact toasts */}
        {(txPending || txError || showWalletError) && (
          <div className="mb-4 space-y-2 max-w-md">
            {txPending && (
              <Toast
                message="Transaction pending..."
                type="info"
                onClose={() => {}}
                autoClose={0}
              />
            )}
            {txError && (
              <Toast
                message={txError}
                type="error"
                onClose={() => setTxError(null)}
                autoClose={8000}
              />
            )}
            {showWalletError && (
              <Toast
                message={wallet.error!}
                type="warning"
                onClose={() => setDismissedWalletError(wallet.error)}
                autoClose={5000}
              />
            )}
          </div>
        )}

        {/* JSON styles */}
        <style>{jsonStyles}</style>

        {/* Rendered Content */}
        <div className="bg-white dark:bg-[#1c1c1c] rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          {format === "json" && jsonDocument ? (
            <InteractiveJsonRenderView
              document={jsonDocument}
              className="prose prose-slate max-w-none"
              client={client}
              contractId={effectiveContractId || null}
              walletAddress={wallet.address}
              onPathChange={handlePathChange}
              onTransactionStart={handleTransactionStart}
              onTransactionComplete={handleTransactionComplete}
              onError={handleError}
            />
          ) : (
            <InteractiveRenderView
              html={html}
              loading={loading || txPending}
              error={error}
              className="prose prose-slate max-w-none"
              client={client}
              contractId={effectiveContractId || null}
              registryId={registryId || null}
              walletAddress={wallet.address}
              onPathChange={handlePathChange}
              onContractNavigate={handleContractNavigate}
              onTransactionStart={handleTransactionStart}
              onTransactionComplete={handleTransactionComplete}
              onError={handleError}
              css={css}
              scopeClassName={scopeClassName}
            />
          )}

          {/* Empty State */}
          {!contractId && !loading && !error && (
            <div className="text-center py-12">
              <div className="text-gray-400 dark:text-gray-500 mb-4">
                <svg
                  className="w-16 h-16 mx-auto"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                No Contract Loaded
              </h3>
              <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                Enter any Soroban contract ID to render its UI. The contract
                must implement the <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded text-gray-800 dark:text-gray-200">render()</code> convention.
              </p>
              <div className="mt-6 text-sm text-gray-500 dark:text-gray-400">
                <p className="font-medium mb-2">How it works:</p>
                <p className="text-left max-w-md mx-auto mb-4">
                  Contracts define their own UI by returning markdown or JSON from a{" "}
                  <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded text-gray-800 dark:text-gray-200">render(path, viewer)</code> function.
                  This viewer fetches and displays that UI, handling navigation and transactions.
                </p>
                <p className="font-medium mb-2">Try an example:</p>
                <p className="text-left max-w-md mx-auto">
                  Select <strong>Testnet</strong> above and enter a contract ID that implements render().
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-700 mt-12 py-6">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>
            Soroban Render Viewer - Works with any contract implementing the render() convention
          </p>
          <p className="mt-1">
            <a
              href="https://github.com/wyhaines/soroban-render"
              className="text-[#7857e1] hover:underline"
            >
              View on GitHub
            </a>
            {" · "}
            <a
              href="https://stellar.org/soroban"
              className="text-[#7857e1] hover:underline"
            >
              Learn about Soroban
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
