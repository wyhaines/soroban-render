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
import { ParsedError, parseSimulationError } from "./errorParser";

export interface TransactionParams {
  method: string;
  args: Record<string, unknown>;
}

export interface TransactionResult {
  success: boolean;
  hash?: string;
  error?: ParsedError;
}

function convertArgToScVal(value: unknown, key?: string): xdr.ScVal {
  if (typeof value === "string") {
    // Check for Stellar address (starts with G, 56 chars)
    if (value.startsWith("G") && value.length === 56) {
      return nativeToScVal(value, { type: "address" });
    }

    // For form fields that look like IDs (e.g., entity_id, item_id, record_id),
    // convert to u64 to match typical Soroban contract signatures
    const isIdField = key && /_id$/i.test(key);
    const isPureInteger = /^[0-9]+$/.test(value);

    if (isIdField && isPureInteger) {
      return nativeToScVal(BigInt(value), { type: "u64" });
    }

    // Handle known numeric fields that should be u32
    const isU32Field = key && /^(depth|count|index|limit|offset)$/i.test(key);
    if (isU32Field && isPureInteger) {
      return nativeToScVal(parseInt(value, 10), { type: "u32" });
    }

    // Convert "field" parameter to Symbol (used for field names in profile, etc.)
    // Symbols are short identifiers (up to 32 chars, alphanumeric + underscore)
    if (key === "field" && value.length <= 32 && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
      return xdr.ScVal.scvSymbol(value);
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
    console.log("[soroban-render] submitTransaction called:", { method: params.method, args: params.args, contractId, userAddress });

    const networkDetails = await getNetworkDetails();
    console.log("[soroban-render] Network details from Freighter:", networkDetails);
    if (!networkDetails.networkPassphrase) {
      throw new Error("Could not get network details from Freighter");
    }

    let sourceAccount;
    try {
      sourceAccount = await client.server.getAccount(userAddress);
      console.log("[soroban-render] Source account:", sourceAccount.accountId());
    } catch (accountError) {
      // Check if this is an account not found error (unfunded account)
      const errorMessage = accountError instanceof Error ? accountError.message : String(accountError);
      if (errorMessage.includes("not found") || errorMessage.includes("404")) {
        throw new Error(
          `Account not funded on this network. Please fund your wallet address (${userAddress.slice(0, 8)}...${userAddress.slice(-4)}) using the network's friendbot or by receiving a payment.`
        );
      }
      throw accountError;
    }
    const contract = new Contract(contractId);

    // Convert args to ScVal array, filtering out:
    // - underscore-prefixed metadata fields (e.g., _redirect, _csrf)
    // - empty string values (from unfilled form inputs on the same page)
    const argsEntries = Object.entries(params.args).filter(([key, value]) => {
      if (key.startsWith("_")) return false;
      if (typeof value === "string" && value.trim() === "") return false;
      return true;
    });
    console.log("[soroban-render] Args entries (after filtering):", argsEntries);
    const args = argsEntries.map(([key, value]) => convertArgToScVal(value, key));
    console.log("[soroban-render] Args converted to ScVal:", args.length, "args");
    const operation = contract.call(params.method, ...args);

    const transaction = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
      networkPassphrase: client.networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

    console.log("[soroban-render] Simulating transaction...");
    const simResult = await client.server.simulateTransaction(transaction);
    console.log("[soroban-render] Simulation result:", rpc.Api.isSimulationError(simResult) ? "ERROR" : rpc.Api.isSimulationSuccess(simResult) ? "SUCCESS" : "UNKNOWN");

    if (rpc.Api.isSimulationError(simResult)) {
      console.error("[soroban-render] Simulation error:", simResult.error);
      // Parse the simulation error and return structured error
      const parsed = parseSimulationError(simResult.error);
      return { success: false, error: parsed };
    }

    if (!rpc.Api.isSimulationSuccess(simResult)) {
      throw new Error("Transaction simulation did not succeed");
    }

    const preparedTx = rpc.assembleTransaction(transaction, simResult).build();
    const txXdr = preparedTx.toXDR();

    console.log("[soroban-render] Requesting Freighter signature...");
    const signResult = await signTransaction(txXdr, {
      networkPassphrase: client.networkPassphrase,
      address: userAddress,
    });
    console.log("[soroban-render] Sign result:", signResult.error ? `ERROR: ${signResult.error}` : "SUCCESS");

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
            // Extract detailed error information from failed transaction
            console.error("[soroban-render] Transaction failed:", getResult);
            let errorDetail = `Transaction failed: ${getResult.status}`;

            // Try to get result XDR for more details
            if ('resultXdr' in getResult && getResult.resultXdr) {
              try {
                const resultXdr = getResult.resultXdr;
                console.error("[soroban-render] Result XDR:", resultXdr.toXDR('base64'));
              } catch (e) {
                // Ignore XDR parsing errors
              }
            }

            // Try to get result meta for diagnostic events
            if ('resultMetaXdr' in getResult && getResult.resultMetaXdr) {
              try {
                console.error("[soroban-render] Result Meta available - check for diagnostic events");
              } catch (e) {
                // Ignore
              }
            }

            throw new Error(errorDetail);
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
    const errorMessage = err instanceof Error ? err.message : "Transaction failed";
    return {
      success: false,
      error: parseSimulationError(errorMessage),
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
