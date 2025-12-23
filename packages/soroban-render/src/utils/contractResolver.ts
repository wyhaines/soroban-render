/**
 * Contract alias resolution with caching.
 *
 * Enables the `form:@alias:method` and `tx:@alias:method` protocols
 * by looking up contract addresses from a registry contract.
 */

import {
  rpc,
  scValToNative,
  nativeToScVal,
  Contract,
  TransactionBuilder,
  BASE_FEE,
  Account,
  StrKey,
} from "@stellar/stellar-sdk";
import type { SorobanClient } from "./client";

// Cache: registryId -> (alias -> contractId)
const aliasCache = new Map<string, Map<string, string>>();

// Simulation source account (any valid public key works for read-only calls)
const SIMULATION_SOURCE = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

/**
 * Resolve a contract alias to a contract ID via the registry contract.
 *
 * Results are cached per-registry to avoid repeated RPC calls.
 *
 * @param client - The Soroban client instance
 * @param registryId - The registry contract ID
 * @param alias - The alias to look up (e.g., "admin", "content", "theme")
 * @returns The resolved contract ID, or null if not found
 */
export async function resolveContractAlias(
  client: SorobanClient,
  registryId: string,
  alias: string
): Promise<string | null> {
  // Check cache first
  const registryCache = aliasCache.get(registryId);
  if (registryCache?.has(alias)) {
    const cached = registryCache.get(alias)!;
    console.log(`[soroban-render] Resolved @${alias} from cache:`, cached);
    return cached;
  }

  try {
    console.log(`[soroban-render] Resolving @${alias} from registry ${registryId.slice(0, 8)}...`);

    const contract = new Contract(registryId);
    const aliasArg = nativeToScVal(alias, { type: "symbol" });

    const operation = contract.call("get_contract_by_alias", aliasArg);
    const mockAccount = new Account(SIMULATION_SOURCE, "0");

    const tx = new TransactionBuilder(mockAccount, {
      fee: BASE_FEE,
      networkPassphrase: client.networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(30)
      .build();

    const simResult = await client.server.simulateTransaction(tx);

    if (rpc.Api.isSimulationError(simResult)) {
      console.error(`[soroban-render] Failed to resolve @${alias}: simulation error`, simResult.error);
      return null;
    }

    if (!rpc.Api.isSimulationSuccess(simResult)) {
      console.error(`[soroban-render] Failed to resolve @${alias}: simulation did not succeed`);
      return null;
    }

    const result = simResult.result;
    if (!result) {
      console.error(`[soroban-render] Failed to resolve @${alias}: no result from simulation`);
      return null;
    }

    // The result is Option<Address>, which in Soroban is either:
    // - scvVoid for None
    // - scvAddress for Some(address)
    const retval = result.retval;

    if (retval.switch().name === "scvVoid") {
      console.log(`[soroban-render] Alias @${alias} not found in registry`);
      return null;
    }

    // Extract the address
    const native = scValToNative(retval);

    if (!native) {
      console.log(`[soroban-render] Alias @${alias} not found (null result)`);
      return null;
    }

    // The native value should be a string representation of the contract address
    let contractId: string;
    if (typeof native === "string") {
      contractId = native;
    } else if (native instanceof Uint8Array) {
      // If we got raw bytes, encode them as a contract ID
      contractId = StrKey.encodeContract(Buffer.from(native));
    } else {
      console.error(`[soroban-render] Unexpected type for alias resolution:`, typeof native, native);
      return null;
    }

    // Cache the result
    if (!aliasCache.has(registryId)) {
      aliasCache.set(registryId, new Map());
    }
    aliasCache.get(registryId)!.set(alias, contractId);

    console.log(`[soroban-render] Resolved @${alias} to:`, contractId);
    return contractId;
  } catch (error) {
    console.error(`[soroban-render] Failed to resolve alias @${alias}:`, error);
    return null;
  }
}

/**
 * Clear the alias cache.
 *
 * @param registryId - Optional: clear only the cache for this registry.
 *                     If not provided, clears all caches.
 */
export function clearAliasCache(registryId?: string): void {
  if (registryId) {
    aliasCache.delete(registryId);
    console.log(`[soroban-render] Cleared alias cache for registry ${registryId.slice(0, 8)}...`);
  } else {
    aliasCache.clear();
    console.log("[soroban-render] Cleared all alias caches");
  }
}

/**
 * Get the current cache size for debugging/monitoring.
 */
export function getAliasCacheSize(): number {
  let total = 0;
  for (const cache of aliasCache.values()) {
    total += cache.size;
  }
  return total;
}

/**
 * Resolve the target contract ID for a parsed link.
 *
 * Priority:
 * 1. If link has an alias, resolve it via registry
 * 2. If link has an explicit contractId, use it
 * 3. Otherwise, use the default contractId
 *
 * @param alias - Contract alias from parsed link (e.g., "admin")
 * @param explicitContractId - Explicit contract ID from parsed link
 * @param defaultContractId - Default contract ID (the rendering contract)
 * @param registryId - Registry contract ID for alias resolution
 * @param client - Soroban client for RPC calls
 * @returns The resolved contract ID, or null if resolution failed
 */
export async function resolveTargetContract(
  alias: string | undefined,
  explicitContractId: string | undefined,
  defaultContractId: string,
  registryId: string | undefined,
  client: SorobanClient | null
): Promise<string | null> {
  // If there's an alias, try to resolve it
  if (alias && registryId && client) {
    const resolved = await resolveContractAlias(client, registryId, alias);
    if (!resolved) {
      // Resolution failed - return null to signal error
      return null;
    }
    return resolved;
  }

  // If there's an explicit contract ID, use it
  if (explicitContractId) {
    return explicitContractId;
  }

  // Otherwise, use the default
  return defaultContractId;
}
