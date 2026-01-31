"use client";

import { useState, useEffect, useCallback } from "react";
import {
  isConnected,
  getAddress,
  signTransaction,
  setAllowed,
} from "@stellar/freighter-api";

export interface WalletState {
  isConnected: boolean;
  publicKey: string | null;
  isLoading: boolean;
  error: string | null;
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    isConnected: false,
    publicKey: null,
    isLoading: true,
    error: null,
  });

  // Check wallet status on mount
  useEffect(() => {
    async function checkWallet() {
      try {
        const connectedResult = await isConnected();
        const connected =
          typeof connectedResult === "boolean"
            ? connectedResult
            : connectedResult.isConnected;

        if (connected) {
          try {
            const addressResult = await getAddress();
            const address =
              typeof addressResult === "string"
                ? addressResult
                : addressResult.address;

            setState({
              isConnected: true,
              publicKey: address,
              isLoading: false,
              error: null,
            });
          } catch {
            // Not allowed yet
            setState({
              isConnected: true,
              publicKey: null,
              isLoading: false,
              error: null,
            });
          }
        } else {
          setState({
            isConnected: false,
            publicKey: null,
            isLoading: false,
            error: null,
          });
        }
      } catch {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: "Failed to check wallet status",
        }));
      }
    }

    checkWallet();
  }, []);

  // Connect wallet
  const connect = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const connectedResult = await isConnected();
      const connected =
        typeof connectedResult === "boolean"
          ? connectedResult
          : connectedResult.isConnected;

      if (!connected) {
        throw new Error("Freighter wallet not found. Please install it.");
      }

      // Request access
      await setAllowed();
      const addressResult = await getAddress();
      const address =
        typeof addressResult === "string"
          ? addressResult
          : addressResult.address;

      setState({
        isConnected: true,
        publicKey: address,
        isLoading: false,
        error: null,
      });

      return address;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to connect";
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: message,
      }));
      throw err;
    }
  }, []);

  // Sign a transaction XDR
  const sign = useCallback(
    async (xdr: string, networkPassphrase: string): Promise<string> => {
      if (!state.publicKey) {
        throw new Error("Wallet not connected");
      }

      try {
        const signedResult = await signTransaction(xdr, {
          networkPassphrase,
          address: state.publicKey,
        });

        // Handle both string and object return types
        const signedXdr =
          typeof signedResult === "string"
            ? signedResult
            : signedResult.signedTxXdr;

        return signedXdr;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Signing failed";
        throw new Error(message);
      }
    },
    [state.publicKey],
  );

  // Disconnect (just clear local state, Freighter manages its own state)
  const disconnect = useCallback(() => {
    setState({
      isConnected: false,
      publicKey: null,
      isLoading: false,
      error: null,
    });
  }, []);

  return {
    ...state,
    connect,
    sign,
    disconnect,
  };
}
