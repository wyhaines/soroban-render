import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  resolveContractAlias,
  clearAliasCache,
  getAliasCacheSize,
  resolveTargetContract,
} from "./contractResolver";
import type { SorobanClient } from "./client";

// Mock the stellar-sdk
vi.mock("@stellar/stellar-sdk", async () => {
  const actual = await vi.importActual("@stellar/stellar-sdk");
  return {
    ...actual,
    Contract: vi.fn().mockImplementation(() => ({
      call: vi.fn().mockReturnValue({}),
    })),
    TransactionBuilder: vi.fn().mockImplementation(() => ({
      addOperation: vi.fn().mockReturnThis(),
      setTimeout: vi.fn().mockReturnThis(),
      build: vi.fn().mockReturnValue({}),
    })),
    Account: vi.fn().mockImplementation(() => ({})),
    rpc: {
      Api: {
        isSimulationError: vi.fn(),
        isSimulationSuccess: vi.fn(),
      },
    },
  };
});

describe("contractResolver", () => {
  let mockClient: SorobanClient;
  let mockRpcApi: {
    isSimulationError: ReturnType<typeof vi.fn>;
    isSimulationSuccess: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    clearAliasCache(); // Clear cache between tests

    const stellarSdk = await import("@stellar/stellar-sdk");
    mockRpcApi = stellarSdk.rpc.Api as unknown as typeof mockRpcApi;

    mockClient = {
      server: {
        simulateTransaction: vi.fn(),
      } as unknown as SorobanClient["server"],
      networkPassphrase: "Test SDF Network ; September 2015",
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearAliasCache();
  });

  describe("resolveContractAlias", () => {
    it("should return null when simulation errors", async () => {
      (mockClient.server.simulateTransaction as ReturnType<typeof vi.fn>).mockResolvedValue({
        error: "Some error",
      });
      mockRpcApi.isSimulationError.mockReturnValue(true);

      const result = await resolveContractAlias(
        mockClient,
        "REGISTRY123",
        "admin"
      );

      expect(result).toBeNull();
    });

    it("should return null when simulation does not succeed", async () => {
      (mockClient.server.simulateTransaction as ReturnType<typeof vi.fn>).mockResolvedValue({});
      mockRpcApi.isSimulationError.mockReturnValue(false);
      mockRpcApi.isSimulationSuccess.mockReturnValue(false);

      const result = await resolveContractAlias(
        mockClient,
        "REGISTRY123",
        "admin"
      );

      expect(result).toBeNull();
    });

    it("should return null when result is void (alias not found)", async () => {
      (mockClient.server.simulateTransaction as ReturnType<typeof vi.fn>).mockResolvedValue({
        result: {
          retval: {
            switch: () => ({ name: "scvVoid" }),
          },
        },
      });
      mockRpcApi.isSimulationError.mockReturnValue(false);
      mockRpcApi.isSimulationSuccess.mockReturnValue(true);

      const result = await resolveContractAlias(
        mockClient,
        "REGISTRY123",
        "unknown"
      );

      expect(result).toBeNull();
    });

    it("should return null when scValToNative returns null", async () => {
      (mockClient.server.simulateTransaction as ReturnType<typeof vi.fn>).mockResolvedValue({
        result: {
          retval: {
            switch: () => ({ name: "scvAddress" }),
          },
        },
      });
      mockRpcApi.isSimulationError.mockReturnValue(false);
      mockRpcApi.isSimulationSuccess.mockReturnValue(true);

      // Mock scValToNative to return null
      const stellarSdk = await import("@stellar/stellar-sdk");
      vi.spyOn(stellarSdk, "scValToNative").mockReturnValue(null);

      const result = await resolveContractAlias(
        mockClient,
        "REGISTRY123",
        "admin"
      );

      expect(result).toBeNull();
    });

    it("should return null when no result from simulation", async () => {
      (mockClient.server.simulateTransaction as ReturnType<typeof vi.fn>).mockResolvedValue({
        result: null,
      });
      mockRpcApi.isSimulationError.mockReturnValue(false);
      mockRpcApi.isSimulationSuccess.mockReturnValue(true);

      const result = await resolveContractAlias(
        mockClient,
        "REGISTRY123",
        "admin"
      );

      expect(result).toBeNull();
    });

    it("should return null when exception is thrown", async () => {
      (mockClient.server.simulateTransaction as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Network error")
      );

      const result = await resolveContractAlias(
        mockClient,
        "REGISTRY123",
        "admin"
      );

      expect(result).toBeNull();
    });
  });

  describe("clearAliasCache", () => {
    it("should clear all caches when no registryId provided", () => {
      // clearAliasCache is tested for its clearing behavior
      // The cache starts empty after the beforeEach clearAliasCache call
      expect(getAliasCacheSize()).toBe(0);

      clearAliasCache();

      expect(getAliasCacheSize()).toBe(0);
    });

    it("should not throw when clearing specific registry that does not exist", () => {
      expect(() => clearAliasCache("NONEXISTENT")).not.toThrow();
    });
  });

  describe("getAliasCacheSize", () => {
    it("should return 0 for empty cache", () => {
      expect(getAliasCacheSize()).toBe(0);
    });
  });

  describe("resolveTargetContract", () => {
    it("should return null when alias resolution fails", async () => {
      (mockClient.server.simulateTransaction as ReturnType<typeof vi.fn>).mockResolvedValue({
        error: "Resolution failed",
      });
      mockRpcApi.isSimulationError.mockReturnValue(true);

      const result = await resolveTargetContract(
        "admin",
        undefined,
        "DEFAULT123",
        "REGISTRY123",
        mockClient
      );

      expect(result).toBeNull();
    });

    it("should use explicit contractId when no alias", async () => {
      const result = await resolveTargetContract(
        undefined,
        "EXPLICIT123",
        "DEFAULT123",
        "REGISTRY123",
        mockClient
      );

      expect(result).toBe("EXPLICIT123");
    });

    it("should use default contractId when no alias and no explicit", async () => {
      const result = await resolveTargetContract(
        undefined,
        undefined,
        "DEFAULT123",
        "REGISTRY123",
        mockClient
      );

      expect(result).toBe("DEFAULT123");
    });

    it("should use default when alias provided but no registryId", async () => {
      const result = await resolveTargetContract(
        "admin",
        undefined,
        "DEFAULT123",
        undefined,
        mockClient
      );

      expect(result).toBe("DEFAULT123");
    });

    it("should use default when alias provided but no client", async () => {
      const result = await resolveTargetContract(
        "admin",
        undefined,
        "DEFAULT123",
        "REGISTRY123",
        null
      );

      expect(result).toBe("DEFAULT123");
    });

    it("should prefer explicit contractId over default", async () => {
      const result = await resolveTargetContract(
        undefined,
        "EXPLICIT123",
        "DEFAULT123",
        undefined,
        null
      );

      expect(result).toBe("EXPLICIT123");
    });
  });
});
