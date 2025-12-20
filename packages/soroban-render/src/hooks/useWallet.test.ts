import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useWallet } from "./useWallet";

// Mock the Freighter API
vi.mock("@stellar/freighter-api", () => ({
  isConnected: vi.fn(),
  requestAccess: vi.fn(),
  getAddress: vi.fn(),
  getNetworkDetails: vi.fn(),
}));

import {
  isConnected,
  requestAccess,
  getAddress,
  getNetworkDetails,
} from "@stellar/freighter-api";

const mockIsConnected = vi.mocked(isConnected);
const mockRequestAccess = vi.mocked(requestAccess);
const mockGetAddress = vi.mocked(getAddress);
const mockGetNetworkDetails = vi.mocked(getNetworkDetails);

describe("useWallet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default to not connected
    mockIsConnected.mockResolvedValue({ isConnected: false });
  });

  describe("initial state", () => {
    it("should start with disconnected state", () => {
      const { result } = renderHook(() => useWallet());

      expect(result.current.connected).toBe(false);
      expect(result.current.connecting).toBe(false);
      expect(result.current.address).toBeNull();
      expect(result.current.network).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it("should check for existing connection on mount", async () => {
      mockIsConnected.mockResolvedValue({ isConnected: true });
      mockGetAddress.mockResolvedValue({
        address: "GTEST123",
      });
      mockGetNetworkDetails.mockResolvedValue({
        network: "TESTNET",
        networkPassphrase: "Test SDF Network ; September 2015",
      });

      const { result } = renderHook(() => useWallet());

      await waitFor(() => {
        expect(result.current.connected).toBe(true);
      });

      expect(result.current.address).toBe("GTEST123");
      expect(result.current.network).toBe("TESTNET");
      expect(result.current.networkPassphrase).toBe(
        "Test SDF Network ; September 2015"
      );
    });

    it("should not auto-connect if address is empty", async () => {
      mockIsConnected.mockResolvedValue({ isConnected: true });
      mockGetAddress.mockResolvedValue({
        address: "", // Empty - site not authorized
      });

      const { result } = renderHook(() => useWallet());

      // Wait a bit for the check to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(result.current.connected).toBe(false);
      expect(result.current.address).toBeNull();
    });

    it("should not auto-connect if getAddress returns error", async () => {
      mockIsConnected.mockResolvedValue({ isConnected: true });
      mockGetAddress.mockResolvedValue({
        error: "Not authorized",
        address: "",
      });

      const { result } = renderHook(() => useWallet());

      // Wait a bit for the check to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(result.current.connected).toBe(false);
    });
  });

  describe("connect", () => {
    it("should connect successfully", async () => {
      mockIsConnected.mockResolvedValue({ isConnected: true });
      mockRequestAccess.mockResolvedValue({
        address: "GCONNECTED123",
      });
      mockGetNetworkDetails.mockResolvedValue({
        network: "TESTNET",
        networkPassphrase: "Test SDF Network ; September 2015",
      });

      const { result } = renderHook(() => useWallet());

      await act(async () => {
        await result.current.connect();
      });

      expect(result.current.connected).toBe(true);
      expect(result.current.address).toBe("GCONNECTED123");
      expect(result.current.network).toBe("TESTNET");
      expect(result.current.error).toBeNull();
    });

    it("should show connecting state", async () => {
      mockIsConnected.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { result } = renderHook(() => useWallet());

      act(() => {
        result.current.connect();
      });

      expect(result.current.connecting).toBe(true);
    });

    it("should handle Freighter not installed", async () => {
      mockIsConnected.mockResolvedValue({ isConnected: false });

      const { result } = renderHook(() => useWallet());

      await act(async () => {
        await result.current.connect();
      });

      expect(result.current.connected).toBe(false);
      expect(result.current.error).toBe("Freighter wallet is not installed");
      expect(result.current.connecting).toBe(false);
    });

    it("should handle access denied", async () => {
      mockIsConnected.mockResolvedValue({ isConnected: true });
      mockRequestAccess.mockResolvedValue({
        error: "User rejected access",
        address: "",
      });

      const { result } = renderHook(() => useWallet());

      await act(async () => {
        await result.current.connect();
      });

      expect(result.current.connected).toBe(false);
      expect(result.current.error).toBe("User rejected access");
      expect(result.current.connecting).toBe(false);
    });

    it("should handle unexpected errors", async () => {
      mockIsConnected.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useWallet());

      await act(async () => {
        await result.current.connect();
      });

      expect(result.current.connected).toBe(false);
      expect(result.current.error).toBe("Network error");
      expect(result.current.connecting).toBe(false);
    });

    it("should clear previous error on new connect attempt", async () => {
      // First attempt fails
      mockIsConnected.mockResolvedValueOnce({ isConnected: false });

      const { result } = renderHook(() => useWallet());

      await act(async () => {
        await result.current.connect();
      });

      expect(result.current.error).toBe("Freighter wallet is not installed");

      // Second attempt succeeds
      mockIsConnected.mockResolvedValueOnce({ isConnected: true });
      mockRequestAccess.mockResolvedValueOnce({ address: "GTEST123" });
      mockGetNetworkDetails.mockResolvedValueOnce({
        network: "TESTNET",
        networkPassphrase: "Test",
      });

      await act(async () => {
        await result.current.connect();
      });

      expect(result.current.error).toBeNull();
      expect(result.current.connected).toBe(true);
    });
  });

  describe("disconnect", () => {
    it("should disconnect and reset state", async () => {
      // First connect
      mockIsConnected.mockResolvedValue({ isConnected: true });
      mockRequestAccess.mockResolvedValue({ address: "GTEST123" });
      mockGetNetworkDetails.mockResolvedValue({
        network: "TESTNET",
        networkPassphrase: "Test",
      });

      const { result } = renderHook(() => useWallet());

      await act(async () => {
        await result.current.connect();
      });

      expect(result.current.connected).toBe(true);

      // Then disconnect
      act(() => {
        result.current.disconnect();
      });

      expect(result.current.connected).toBe(false);
      expect(result.current.address).toBeNull();
      expect(result.current.network).toBeNull();
      expect(result.current.networkPassphrase).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });
});
