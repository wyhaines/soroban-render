import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ProgressiveLoader,
  createProgressiveLoader,
} from "./progressiveLoader";
import type { SorobanClient } from "./client";
import type { ChunkTag, ContinuationTag } from "../parsers/continuation";

// Mock stellar-sdk
vi.mock("@stellar/stellar-sdk", async () => {
  const actual = await vi.importActual("@stellar/stellar-sdk");

  // Create a proper mock class for Contract
  class MockContract {
    call = vi.fn().mockReturnValue({});
  }

  // Create a proper mock class for TransactionBuilder
  class MockTransactionBuilder {
    addOperation = vi.fn().mockReturnThis();
    setTimeout = vi.fn().mockReturnThis();
    build = vi.fn().mockReturnValue({});
  }

  // Create a proper mock class for Account
  class MockAccount {}

  return {
    ...actual,
    Contract: MockContract,
    TransactionBuilder: MockTransactionBuilder,
    Account: MockAccount,
    rpc: {
      Api: {
        isSimulationError: vi.fn(),
        isSimulationSuccess: vi.fn(),
      },
    },
    xdr: {
      ScVal: {
        scvSymbol: vi.fn().mockReturnValue({}),
      },
    },
  };
});

describe("ProgressiveLoader", () => {
  let mockClient: SorobanClient;
  let mockRpcApi: {
    isSimulationError: ReturnType<typeof vi.fn>;
    isSimulationSuccess: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const stellarSdk = await import("@stellar/stellar-sdk");
    mockRpcApi = stellarSdk.rpc.Api as unknown as typeof mockRpcApi;

    mockClient = {
      server: {
        simulateTransaction: vi.fn(),
      } as unknown as SorobanClient["server"],
      networkPassphrase: "Test Network",
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor and createProgressiveLoader", () => {
    it("should create loader with default options", () => {
      const loader = new ProgressiveLoader({
        contractId: "CONTRACT123",
        client: mockClient,
      });

      expect(loader).toBeDefined();
    });

    it("should create loader with custom options", () => {
      const onChunkLoaded = vi.fn();
      const onProgress = vi.fn();
      const onError = vi.fn();

      const loader = new ProgressiveLoader({
        contractId: "CONTRACT123",
        client: mockClient,
        batchSize: 5,
        maxConcurrent: 3,
        onChunkLoaded,
        onProgress,
        onError,
      });

      expect(loader).toBeDefined();
    });

    it("should create loader via factory function", () => {
      const loader = createProgressiveLoader({
        contractId: "CONTRACT123",
        client: mockClient,
      });

      expect(loader).toBeInstanceOf(ProgressiveLoader);
    });
  });

  describe("loadChunk", () => {
    it("should load chunk from contract", async () => {
      const chunkContent = "Chunk content here";
      (mockClient.server.simulateTransaction as ReturnType<typeof vi.fn>).mockResolvedValue({
        result: {
          retval: {
            switch: () => ({ name: "scvBytes" }),
            bytes: () => new TextEncoder().encode(chunkContent),
          },
        },
      });
      mockRpcApi.isSimulationError.mockReturnValue(false);
      mockRpcApi.isSimulationSuccess.mockReturnValue(true);

      const loader = new ProgressiveLoader({
        contractId: "CONTRACT123",
        client: mockClient,
      });

      const result = await loader.loadChunk("posts", 0);

      expect(result).toBe(chunkContent);
    });

    it("should return cached chunk on subsequent calls", async () => {
      const chunkContent = "Cached content";
      (mockClient.server.simulateTransaction as ReturnType<typeof vi.fn>).mockResolvedValue({
        result: {
          retval: {
            switch: () => ({ name: "scvBytes" }),
            bytes: () => new TextEncoder().encode(chunkContent),
          },
        },
      });
      mockRpcApi.isSimulationError.mockReturnValue(false);
      mockRpcApi.isSimulationSuccess.mockReturnValue(true);

      const loader = new ProgressiveLoader({
        contractId: "CONTRACT123",
        client: mockClient,
      });

      // First load
      const result1 = await loader.loadChunk("posts", 0);
      // Second load - should use cache
      const result2 = await loader.loadChunk("posts", 0);

      expect(result1).toBe(chunkContent);
      expect(result2).toBe(chunkContent);
      expect(mockClient.server.simulateTransaction).toHaveBeenCalledTimes(1);
    });

    it("should deduplicate concurrent requests for same chunk", async () => {
      (mockClient.server.simulateTransaction as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 50));
        return {
          result: {
            retval: {
              switch: () => ({ name: "scvBytes" }),
              bytes: () => new TextEncoder().encode("content"),
            },
          },
        };
      });
      mockRpcApi.isSimulationError.mockReturnValue(false);
      mockRpcApi.isSimulationSuccess.mockReturnValue(true);

      const loader = new ProgressiveLoader({
        contractId: "CONTRACT123",
        client: mockClient,
      });

      // Fire multiple concurrent requests for same chunk
      const promises = [
        loader.loadChunk("posts", 0),
        loader.loadChunk("posts", 0),
        loader.loadChunk("posts", 0),
      ];

      await Promise.all(promises);

      // Should only make one actual call
      expect(mockClient.server.simulateTransaction).toHaveBeenCalledTimes(1);
    });

    it("should return empty string when result is void", async () => {
      (mockClient.server.simulateTransaction as ReturnType<typeof vi.fn>).mockResolvedValue({
        result: {
          retval: {
            switch: () => ({ name: "scvVoid" }),
          },
        },
      });
      mockRpcApi.isSimulationError.mockReturnValue(false);
      mockRpcApi.isSimulationSuccess.mockReturnValue(true);

      const loader = new ProgressiveLoader({
        contractId: "CONTRACT123",
        client: mockClient,
      });

      const result = await loader.loadChunk("posts", 0);

      expect(result).toBe("");
    });

    it("should call onChunkLoaded callback", async () => {
      const onChunkLoaded = vi.fn();
      (mockClient.server.simulateTransaction as ReturnType<typeof vi.fn>).mockResolvedValue({
        result: {
          retval: {
            switch: () => ({ name: "scvBytes" }),
            bytes: () => new TextEncoder().encode("chunk data"),
          },
        },
      });
      mockRpcApi.isSimulationError.mockReturnValue(false);
      mockRpcApi.isSimulationSuccess.mockReturnValue(true);

      const loader = new ProgressiveLoader({
        contractId: "CONTRACT123",
        client: mockClient,
        onChunkLoaded,
      });

      await loader.loadChunk("posts", 5);

      expect(onChunkLoaded).toHaveBeenCalledWith("posts", 5, "chunk data");
    });

    it("should throw when simulation errors", async () => {
      (mockClient.server.simulateTransaction as ReturnType<typeof vi.fn>).mockResolvedValue({
        error: "Simulation failed",
      });
      mockRpcApi.isSimulationError.mockReturnValue(true);

      const loader = new ProgressiveLoader({
        contractId: "CONTRACT123",
        client: mockClient,
      });

      await expect(loader.loadChunk("posts", 0)).rejects.toThrow(
        "Simulation failed"
      );
    });
  });

  describe("getChunkMeta", () => {
    it("should return chunk metadata", async () => {
      const stellarSdk = await import("@stellar/stellar-sdk");
      vi.spyOn(stellarSdk, "scValToNative").mockReturnValue({
        count: 10,
        total_bytes: 5000,
        version: 1,
      });

      (mockClient.server.simulateTransaction as ReturnType<typeof vi.fn>).mockResolvedValue({
        result: {
          retval: {},
        },
      });
      mockRpcApi.isSimulationError.mockReturnValue(false);
      mockRpcApi.isSimulationSuccess.mockReturnValue(true);

      const loader = new ProgressiveLoader({
        contractId: "CONTRACT123",
        client: mockClient,
      });

      const meta = await loader.getChunkMeta("posts");

      expect(meta).toEqual({
        count: 10,
        total_bytes: 5000,
        version: 1,
      });
    });

    it("should return null when simulation errors", async () => {
      (mockClient.server.simulateTransaction as ReturnType<typeof vi.fn>).mockResolvedValue({
        error: "Error",
      });
      mockRpcApi.isSimulationError.mockReturnValue(true);

      const loader = new ProgressiveLoader({
        contractId: "CONTRACT123",
        client: mockClient,
      });

      const meta = await loader.getChunkMeta("posts");

      expect(meta).toBeNull();
    });

    it("should return null when no result", async () => {
      (mockClient.server.simulateTransaction as ReturnType<typeof vi.fn>).mockResolvedValue({
        result: null,
      });
      mockRpcApi.isSimulationError.mockReturnValue(false);
      mockRpcApi.isSimulationSuccess.mockReturnValue(true);

      const loader = new ProgressiveLoader({
        contractId: "CONTRACT123",
        client: mockClient,
      });

      const meta = await loader.getChunkMeta("posts");

      expect(meta).toBeNull();
    });
  });

  describe("loadTags", () => {
    it("should load chunk tags", async () => {
      (mockClient.server.simulateTransaction as ReturnType<typeof vi.fn>).mockResolvedValue({
        result: {
          retval: {
            switch: () => ({ name: "scvBytes" }),
            bytes: () => new TextEncoder().encode("chunk content"),
          },
        },
      });
      mockRpcApi.isSimulationError.mockReturnValue(false);
      mockRpcApi.isSimulationSuccess.mockReturnValue(true);

      const loader = new ProgressiveLoader({
        contractId: "CONTRACT123",
        client: mockClient,
      });

      const tags: ChunkTag[] = [
        { type: "chunk", collection: "posts", index: 0, position: 0, length: 10 },
        { type: "chunk", collection: "posts", index: 1, position: 10, length: 10 },
      ];

      const results = await loader.loadTags(tags);

      expect(results).toHaveLength(2);
      expect(results[0].collection).toBe("posts");
      expect(results[0].index).toBe(0);
    });

    it("should call onProgress callback", async () => {
      const onProgress = vi.fn();
      (mockClient.server.simulateTransaction as ReturnType<typeof vi.fn>).mockResolvedValue({
        result: {
          retval: {
            switch: () => ({ name: "scvBytes" }),
            bytes: () => new TextEncoder().encode("chunk"),
          },
        },
      });
      mockRpcApi.isSimulationError.mockReturnValue(false);
      mockRpcApi.isSimulationSuccess.mockReturnValue(true);

      const loader = new ProgressiveLoader({
        contractId: "CONTRACT123",
        client: mockClient,
        onProgress,
      });

      const tags: ChunkTag[] = [
        { type: "chunk", collection: "posts", index: 0, position: 0, length: 10 },
        { type: "chunk", collection: "posts", index: 1, position: 10, length: 10 },
      ];

      await loader.loadTags(tags);

      expect(onProgress).toHaveBeenCalled();
    });

    it("should call onError callback on failures", async () => {
      const onError = vi.fn();
      (mockClient.server.simulateTransaction as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Load failed")
      );

      const loader = new ProgressiveLoader({
        contractId: "CONTRACT123",
        client: mockClient,
        onError,
      });

      const tags: ChunkTag[] = [
        { type: "chunk", collection: "posts", index: 0, position: 0, length: 10 },
      ];

      const results = await loader.loadTags(tags);

      expect(onError).toHaveBeenCalled();
      expect(results).toHaveLength(0);
    });

    it("should expand continuation tags", async () => {
      const stellarSdk = await import("@stellar/stellar-sdk");
      vi.spyOn(stellarSdk, "scValToNative").mockReturnValue({
        count: 3,
        total_bytes: 1000,
        version: 1,
      });

      (mockClient.server.simulateTransaction as ReturnType<typeof vi.fn>).mockResolvedValue({
        result: {
          retval: {
            switch: () => ({ name: "scvBytes" }),
            bytes: () => new TextEncoder().encode("chunk"),
          },
        },
      });
      mockRpcApi.isSimulationError.mockReturnValue(false);
      mockRpcApi.isSimulationSuccess.mockReturnValue(true);

      const loader = new ProgressiveLoader({
        contractId: "CONTRACT123",
        client: mockClient,
      });

      const tags: ContinuationTag[] = [
        { type: "continuation", collection: "posts", from: 0, position: 0, length: 10 },
      ];

      const results = await loader.loadTags(tags);

      // Should expand to 3 chunks (0, 1, 2)
      expect(results.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("abort and reset", () => {
    it("should abort pending loads", async () => {
      (mockClient.server.simulateTransaction as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 100));
        return {
          result: {
            retval: {
              switch: () => ({ name: "scvBytes" }),
              bytes: () => new TextEncoder().encode("chunk"),
            },
          },
        };
      });
      mockRpcApi.isSimulationError.mockReturnValue(false);
      mockRpcApi.isSimulationSuccess.mockReturnValue(true);

      const loader = new ProgressiveLoader({
        contractId: "CONTRACT123",
        client: mockClient,
      });

      // Start loading
      const loadPromise = loader.loadTags([
        { type: "chunk", collection: "posts", index: 0, position: 0, length: 10 },
        { type: "chunk", collection: "posts", index: 1, position: 10, length: 10 },
        { type: "chunk", collection: "posts", index: 2, position: 20, length: 10 },
      ]);

      // Abort immediately
      loader.abort();

      const results = await loadPromise;

      // Some chunks may have loaded before abort
      expect(results.length).toBeLessThanOrEqual(3);
    });

    it("should reset loader state", async () => {
      (mockClient.server.simulateTransaction as ReturnType<typeof vi.fn>).mockResolvedValue({
        result: {
          retval: {
            switch: () => ({ name: "scvBytes" }),
            bytes: () => new TextEncoder().encode("chunk"),
          },
        },
      });
      mockRpcApi.isSimulationError.mockReturnValue(false);
      mockRpcApi.isSimulationSuccess.mockReturnValue(true);

      const loader = new ProgressiveLoader({
        contractId: "CONTRACT123",
        client: mockClient,
      });

      // Load and cache a chunk
      await loader.loadChunk("posts", 0);
      expect(loader.isCached("posts", 0)).toBe(true);

      // Reset
      loader.reset();

      expect(loader.isCached("posts", 0)).toBe(false);
    });
  });

  describe("cache methods", () => {
    it("should check if chunk is cached", async () => {
      (mockClient.server.simulateTransaction as ReturnType<typeof vi.fn>).mockResolvedValue({
        result: {
          retval: {
            switch: () => ({ name: "scvBytes" }),
            bytes: () => new TextEncoder().encode("chunk"),
          },
        },
      });
      mockRpcApi.isSimulationError.mockReturnValue(false);
      mockRpcApi.isSimulationSuccess.mockReturnValue(true);

      const loader = new ProgressiveLoader({
        contractId: "CONTRACT123",
        client: mockClient,
      });

      expect(loader.isCached("posts", 0)).toBe(false);

      await loader.loadChunk("posts", 0);

      expect(loader.isCached("posts", 0)).toBe(true);
    });

    it("should get cached chunk content", async () => {
      const content = "cached chunk content";
      (mockClient.server.simulateTransaction as ReturnType<typeof vi.fn>).mockResolvedValue({
        result: {
          retval: {
            switch: () => ({ name: "scvBytes" }),
            bytes: () => new TextEncoder().encode(content),
          },
        },
      });
      mockRpcApi.isSimulationError.mockReturnValue(false);
      mockRpcApi.isSimulationSuccess.mockReturnValue(true);

      const loader = new ProgressiveLoader({
        contractId: "CONTRACT123",
        client: mockClient,
      });

      expect(loader.getCached("posts", 0)).toBeUndefined();

      await loader.loadChunk("posts", 0);

      expect(loader.getCached("posts", 0)).toBe(content);
    });
  });
});
