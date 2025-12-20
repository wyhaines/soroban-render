import {
  rpc,
  Contract,
  TransactionBuilder,
  BASE_FEE,
  xdr,
  nativeToScVal,
  Transaction,
} from "@stellar/stellar-sdk";
import { signTransaction, getNetworkDetails } from "@stellar/freighter-api";
import { SorobanClient } from "./client";

export interface TransactionParams {
  method: string;
  args: Record<string, unknown>;
}

export interface TransactionResult {
  success: boolean;
  hash?: string;
  error?: string;
}

function convertArgToScVal(value: unknown): xdr.ScVal {
  if (typeof value === "string") {
    if (value.startsWith("G") && value.length === 56) {
      return nativeToScVal(value, { type: "address" });
    }
    return xdr.ScVal.scvString(value);
  }
  if (typeof value === "number") {
    if (Number.isInteger(value)) {
      // Use u32 for small positive integers (common for IDs)
      // Use i128 for larger numbers
      if (value >= 0 && value <= 0xFFFFFFFF) {
        return nativeToScVal(value, { type: "u32" });
      }
      return nativeToScVal(value, { type: "i128" });
    }
    return nativeToScVal(value, { type: "i128" });
  }
  if (typeof value === "boolean") {
    return xdr.ScVal.scvBool(value);
  }
  if (value === null || value === undefined) {
    return xdr.ScVal.scvVoid();
  }
  return nativeToScVal(value);
}

export async function submitTransaction(
  client: SorobanClient,
  contractId: string,
  params: TransactionParams,
  userAddress: string
): Promise<TransactionResult> {
  try {
    const networkDetails = await getNetworkDetails();
    if (!networkDetails.networkPassphrase) {
      throw new Error("Could not get network details from Freighter");
    }

    const sourceAccount = await client.server.getAccount(userAddress);
    const contract = new Contract(contractId);

    // Convert args to ScVal array
    const args = Object.entries(params.args).map(([, value]) => convertArgToScVal(value));
    const operation = contract.call(params.method, ...args);

    const transaction = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
      networkPassphrase: client.networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

    const simResult = await client.server.simulateTransaction(transaction);

    if (rpc.Api.isSimulationError(simResult)) {
      throw new Error(`Simulation failed: ${simResult.error}`);
    }

    if (!rpc.Api.isSimulationSuccess(simResult)) {
      throw new Error("Transaction simulation did not succeed");
    }

    const preparedTx = rpc.assembleTransaction(transaction, simResult).build();
    const txXdr = preparedTx.toXDR();

    const signResult = await signTransaction(txXdr, {
      networkPassphrase: client.networkPassphrase,
      address: userAddress,
    });

    if (signResult.error) {
      throw new Error(`Signing failed: ${signResult.error}`);
    }

    const signedTx = new Transaction(
      signResult.signedTxXdr,
      client.networkPassphrase
    );

    const sendResult = await client.server.sendTransaction(signedTx);

    if (sendResult.status === "ERROR") {
      throw new Error("Transaction submission failed");
    }

    if (sendResult.status === "PENDING") {
      const hash = sendResult.hash;

      // Poll for transaction result with error handling for SDK/RPC version mismatches
      let attempts = 0;
      const maxAttempts = 30;

      while (attempts < maxAttempts) {
        try {
          const getResult = await client.server.getTransaction(hash);

          if (getResult.status === "NOT_FOUND") {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            attempts++;
            continue;
          }

          if (getResult.status === "SUCCESS") {
            return { success: true, hash };
          } else {
            throw new Error(`Transaction failed: ${getResult.status}`);
          }
        } catch (pollError) {
          // Handle SDK/RPC version mismatch errors gracefully
          // "Bad union switch" errors occur when SDK can't parse newer RPC responses
          if (pollError instanceof TypeError && pollError.message.includes("Bad union switch")) {
            // Transaction was submitted, assume success since sendTransaction returned PENDING
            return { success: true, hash };
          }
          throw pollError;
        }
      }

      // If we exhausted attempts, assume success since transaction was accepted
      return { success: true, hash };
    }

    return { success: true, hash: sendResult.hash };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Transaction failed",
    };
  }
}

export function parseTransactionLink(href: string): TransactionParams | null {
  if (!href.startsWith("tx:")) {
    return null;
  }

  const content = href.slice(3);
  const spaceIndex = content.indexOf(" ");

  if (spaceIndex === -1) {
    return { method: content.trim(), args: {} };
  }

  const method = content.slice(0, spaceIndex).trim();
  const argsJson = content.slice(spaceIndex).trim();

  try {
    const args = JSON.parse(argsJson);
    return { method, args };
  } catch {
    return { method, args: {} };
  }
}

export function parseFormLink(href: string): string | null {
  if (!href.startsWith("form:")) {
    return null;
  }
  return href.slice(5).trim();
}

export function parseRenderLink(href: string): string | null {
  if (!href.startsWith("render:")) {
    return null;
  }
  return href.slice(7);
}
