import { useState, useEffect, useCallback } from "react";
import {
  isConnected,
  requestAccess,
  getAddress,
  getNetworkDetails,
} from "@stellar/freighter-api";

export interface WalletState {
  address: string | null;
  connected: boolean;
  connecting: boolean;
  network: string | null;
  networkPassphrase: string | null;
  error: string | null;
}

export interface UseWalletResult extends WalletState {
  connect: () => Promise<void>;
  disconnect: () => void;
}

export function useWallet(): UseWalletResult {
  const [state, setState] = useState<WalletState>({
    address: null,
    connected: false,
    connecting: false,
    network: null,
    networkPassphrase: null,
    error: null,
  });

  const checkConnection = useCallback(async () => {
    try {
      const connection = await isConnected();
      if (connection.isConnected) {
        const addressResult = await getAddress();
        // Check for error OR empty address (Freighter returns empty string if site not authorized)
        if (addressResult.error || !addressResult.address) {
          return;
        }
        const networkResult = await getNetworkDetails();
        setState({
          address: addressResult.address,
          connected: true,
          connecting: false,
          network: networkResult.network || null,
          networkPassphrase: networkResult.networkPassphrase || null,
          error: null,
        });
      }
    } catch {
      // Freighter not installed or not accessible
    }
  }, []);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  const connect = useCallback(async () => {
    setState((prev) => ({ ...prev, connecting: true, error: null }));

    try {
      const connectionCheck = await isConnected();
      if (!connectionCheck.isConnected) {
        setState((prev) => ({
          ...prev,
          connecting: false,
          error: "Freighter wallet is not installed",
        }));
        return;
      }

      const accessResult = await requestAccess();
      if (accessResult.error) {
        // Ensure error is always a string (Freighter may return an object)
        const errorMessage =
          typeof accessResult.error === "string"
            ? accessResult.error
            : (accessResult.error as { message?: string })?.message ||
              "Connection cancelled";
        setState((prev) => ({
          ...prev,
          connecting: false,
          error: errorMessage,
        }));
        return;
      }

      const networkResult = await getNetworkDetails();

      setState({
        address: accessResult.address,
        connected: true,
        connecting: false,
        network: networkResult.network || null,
        networkPassphrase: networkResult.networkPassphrase || null,
        error: null,
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        connecting: false,
        error: err instanceof Error ? err.message : "Failed to connect wallet",
      }));
    }
  }, []);

  const disconnect = useCallback(() => {
    setState({
      address: null,
      connected: false,
      connecting: false,
      network: null,
      networkPassphrase: null,
      error: null,
    });
  }, []);

  return {
    ...state,
    connect,
    disconnect,
  };
}
