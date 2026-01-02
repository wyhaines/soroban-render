import React, { useCallback } from "react";
import { JsonRenderView, JsonRenderViewProps } from "./JsonRenderView";
import { JsonUIDocument } from "../parsers/json";
import { submitTransaction, TransactionResult } from "../utils/transaction";
import { SorobanClient } from "../utils/client";
import { ParsedError } from "../utils/errorParser";

export interface InteractiveJsonRenderViewProps
  extends Omit<JsonRenderViewProps, "onPathChange" | "onTransaction" | "onFormSubmit"> {
  document: JsonUIDocument;
  client?: SorobanClient | null;
  contractId?: string | null;
  walletAddress?: string | null;
  onPathChange?: (path: string) => void;
  onTransactionStart?: () => void;
  onTransactionComplete?: (result: TransactionResult) => void;
  onError?: (error: string | ParsedError) => void;
}

export function InteractiveJsonRenderView({
  document,
  className = "",
  style,
  client,
  contractId,
  walletAddress,
  onPathChange,
  onTransactionStart,
  onTransactionComplete,
  onError,
  onInclude,
}: InteractiveJsonRenderViewProps): React.ReactElement {
  const handleTransaction = useCallback(
    async (method: string, args: Record<string, unknown>) => {
      if (!client || !contractId || !walletAddress) {
        onError?.("Wallet not connected");
        return;
      }

      // Automatically add caller for contract methods that require auth
      const txArgs: Record<string, unknown> = {
        ...args,
        caller: walletAddress,
      };

      onTransactionStart?.();

      const result = await submitTransaction(
        client,
        contractId,
        { method, args: txArgs },
        walletAddress
      );

      onTransactionComplete?.(result);

      if (!result.success && result.error) {
        // Pass the full ParsedError to onError
        onError?.(result.error);
      }
    },
    [client, contractId, walletAddress, onTransactionStart, onTransactionComplete, onError]
  );

  const handleFormSubmit = useCallback(
    async (method: string, formData: Record<string, unknown>) => {
      if (!client || !contractId || !walletAddress) {
        onError?.("Wallet not connected");
        return;
      }

      // Check if required inputs are filled
      const hasValues = Object.values(formData).some(
        (v) => v !== "" && v !== null && v !== undefined
      );
      if (!hasValues) {
        onError?.("Please fill in the form fields");
        return;
      }

      // Automatically add caller for contract methods that require auth
      const args: Record<string, unknown> = {
        ...formData,
        caller: walletAddress,
      };

      onTransactionStart?.();

      const result = await submitTransaction(
        client,
        contractId,
        { method, args },
        walletAddress
      );

      onTransactionComplete?.(result);

      if (!result.success && result.error) {
        onError?.(result.error);
      }
    },
    [client, contractId, walletAddress, onTransactionStart, onTransactionComplete, onError]
  );

  return (
    <JsonRenderView
      document={document}
      className={className}
      style={style}
      onPathChange={onPathChange}
      onTransaction={handleTransaction}
      onFormSubmit={handleFormSubmit}
      onInclude={onInclude}
    />
  );
}
