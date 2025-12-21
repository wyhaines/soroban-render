/**
 * Progressive content loader for chunked content.
 *
 * This utility handles fetching chunk data from contracts that use
 * soroban-chonk for chunked storage.
 */

import {
  rpc,
  xdr,
  nativeToScVal,
  Contract,
  TransactionBuilder,
  BASE_FEE,
  Account,
  scValToNative,
} from "@stellar/stellar-sdk";
import type { SorobanClient } from "./client";
import type {
  ProgressiveTag,
  ChunkTag,
  ContinuationTag,
} from "../parsers/continuation";
import { createChunkKey } from "../parsers/continuation";

export interface ProgressiveLoaderOptions {
  /** Contract ID to fetch chunks from */
  contractId: string;
  /** Soroban client instance */
  client: SorobanClient;
  /** Number of chunks to fetch per batch (default: 3) */
  batchSize?: number;
  /** Maximum concurrent batch requests (default: 2) */
  maxConcurrent?: number;
  /** Called when a chunk is loaded */
  onChunkLoaded?: (collection: string, index: number, content: string) => void;
  /** Called with progress updates */
  onProgress?: (loaded: number, total: number) => void;
  /** Called when an error occurs */
  onError?: (error: Error, tag: ProgressiveTag) => void;
}

export interface ChunkResult {
  collection: string;
  index: number;
  content: string;
}

export interface ChunkMeta {
  count: number;
  total_bytes: number;
  version: number;
}

const SIMULATION_SOURCE = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

/**
 * Progressive content loader for fetching chunks from Soroban contracts.
 */
export class ProgressiveLoader {
  private options: Required<ProgressiveLoaderOptions>;
  private loadedChunks: Map<string, string> = new Map();
  private pendingLoads: Map<string, Promise<string>> = new Map();
  private aborted = false;

  constructor(options: ProgressiveLoaderOptions) {
    this.options = {
      batchSize: 3,
      maxConcurrent: 2,
      onChunkLoaded: () => {},
      onProgress: () => {},
      onError: () => {},
      ...options,
    };
  }

  /**
   * Load a single chunk from the contract.
   *
   * Calls the contract's `get_chunk(collection: Symbol, index: u32)` function.
   */
  async loadChunk(collection: string, index: number): Promise<string> {
    const key = createChunkKey(collection, index);

    // Return cached if available
    if (this.loadedChunks.has(key)) {
      return this.loadedChunks.get(key)!;
    }

    // Return pending if already loading
    if (this.pendingLoads.has(key)) {
      return this.pendingLoads.get(key)!;
    }

    // Start new load
    const loadPromise = (async () => {
      try {
        const { client, contractId } = this.options;
        const contract = new Contract(contractId);

        // Create args: collection as Symbol, index as u32
        const collectionArg = xdr.ScVal.scvSymbol(collection);
        const indexArg = nativeToScVal(index, { type: "u32" });

        const operation = contract.call("get_chunk", collectionArg, indexArg);
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
          throw new Error(`Simulation failed: ${simResult.error}`);
        }

        if (!rpc.Api.isSimulationSuccess(simResult)) {
          throw new Error("Simulation did not succeed");
        }

        const result = simResult.result;
        if (!result) {
          return ""; // No chunk found
        }

        const content = this.decodeResult(result.retval);
        this.loadedChunks.set(key, content);
        this.options.onChunkLoaded(collection, index, content);
        return content;
      } finally {
        this.pendingLoads.delete(key);
      }
    })();

    this.pendingLoads.set(key, loadPromise);
    return loadPromise;
  }

  /**
   * Get chunk metadata from the contract.
   *
   * Calls `get_chunk_meta(collection: Symbol)` to get count, total_bytes, version.
   */
  async getChunkMeta(collection: string): Promise<ChunkMeta | null> {
    try {
      const { client, contractId } = this.options;
      const contract = new Contract(contractId);

      const collectionArg = xdr.ScVal.scvSymbol(collection);
      const operation = contract.call("get_chunk_meta", collectionArg);
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
        return null;
      }

      if (!rpc.Api.isSimulationSuccess(simResult)) {
        return null;
      }

      const result = simResult.result;
      if (!result) {
        return null;
      }

      const native = scValToNative(result.retval);
      if (native && typeof native === "object") {
        return {
          count: Number(native.count ?? 0),
          total_bytes: Number(native.total_bytes ?? 0),
          version: Number(native.version ?? 0),
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Decode result from simulation.
   */
  private decodeResult(retval: xdr.ScVal): string {
    // Handle Option<Bytes> - could be void or bytes
    if (retval.switch().name === "scvVoid") {
      return "";
    }

    if (retval.switch().name === "scvBytes") {
      const bytes = retval.bytes();
      return new TextDecoder().decode(bytes);
    }

    const native = scValToNative(retval);
    if (native instanceof Uint8Array) {
      return new TextDecoder().decode(native);
    }

    if (typeof native === "string") {
      return native;
    }

    return "";
  }

  /**
   * Load all chunks for the given tags.
   */
  async loadTags(tags: ProgressiveTag[]): Promise<ChunkResult[]> {
    const results: ChunkResult[] = [];
    const { batchSize, maxConcurrent } = this.options;

    // Expand continuation tags into chunk tags
    const expandedTags = await this.expandContinuations(tags);

    // Load in batches with concurrency limit
    const totalTags = expandedTags.length;
    let loadedCount = 0;

    for (
      let i = 0;
      i < expandedTags.length && !this.aborted;
      i += batchSize * maxConcurrent
    ) {
      const batch = expandedTags.slice(i, i + batchSize * maxConcurrent);
      const batchPromises = batch.map(async (tag) => {
        if (this.aborted) return null;
        try {
          const content = await this.loadChunk(tag.collection, tag.index);
          return { collection: tag.collection, index: tag.index, content };
        } catch (error) {
          this.options.onError(error as Error, tag);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      for (const result of batchResults) {
        if (result !== null) {
          results.push(result);
          loadedCount++;
          this.options.onProgress(loadedCount, totalTags);
        }
      }
    }

    return results;
  }

  /**
   * Expand continuation tags into individual chunk tags.
   */
  private async expandContinuations(
    tags: ProgressiveTag[]
  ): Promise<ChunkTag[]> {
    const chunkTags: ChunkTag[] = [];

    for (const tag of tags) {
      if (tag.type === "chunk") {
        chunkTags.push(tag as ChunkTag);
      } else {
        // Continuation tag - need to get chunk count
        const cont = tag as ContinuationTag;
        let total = cont.total;

        if (total === undefined) {
          const meta = await this.getChunkMeta(cont.collection);
          total = meta?.count ?? 0;
        }

        const from = cont.from ?? 0;

        for (let i = from; i < total; i++) {
          chunkTags.push({
            type: "chunk",
            collection: cont.collection,
            index: i,
            position: cont.position,
            length: 0,
          });
        }
      }
    }

    return chunkTags;
  }

  /**
   * Abort all pending loads.
   */
  abort(): void {
    this.aborted = true;
  }

  /**
   * Reset loader state.
   */
  reset(): void {
    this.aborted = false;
    this.loadedChunks.clear();
    this.pendingLoads.clear();
  }

  /**
   * Get a loaded chunk from cache.
   */
  getCached(collection: string, index: number): string | undefined {
    return this.loadedChunks.get(createChunkKey(collection, index));
  }

  /**
   * Check if a chunk is cached.
   */
  isCached(collection: string, index: number): boolean {
    return this.loadedChunks.has(createChunkKey(collection, index));
  }
}

/**
 * Create a progressive loader instance.
 */
export function createProgressiveLoader(
  options: ProgressiveLoaderOptions
): ProgressiveLoader {
  return new ProgressiveLoader(options);
}
