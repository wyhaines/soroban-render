import { describe, it, expect } from "vitest";
import { createClient, Networks } from "./client";

describe("createClient", () => {
  it("should create a client with http URL", () => {
    const client = createClient(
      "http://localhost:8000/soroban/rpc",
      "Test Network"
    );

    expect(client.server).toBeDefined();
    expect(client.networkPassphrase).toBe("Test Network");
  });

  it("should create a client with https URL", () => {
    const client = createClient(
      "https://soroban-testnet.stellar.org",
      "Test SDF Network ; September 2015"
    );

    expect(client.server).toBeDefined();
    expect(client.networkPassphrase).toBe("Test SDF Network ; September 2015");
  });
});

describe("Networks", () => {
  it("should have local network configuration", () => {
    expect(Networks.local).toBeDefined();
    expect(Networks.local.rpcUrl).toBe("http://localhost:8000/soroban/rpc");
    expect(Networks.local.networkPassphrase).toBe(
      "Standalone Network ; February 2017"
    );
  });

  it("should have testnet configuration", () => {
    expect(Networks.testnet).toBeDefined();
    expect(Networks.testnet.rpcUrl).toBe("https://soroban-testnet.stellar.org");
    expect(Networks.testnet.networkPassphrase).toBe(
      "Test SDF Network ; September 2015"
    );
  });

  it("should have mainnet configuration", () => {
    expect(Networks.mainnet).toBeDefined();
    expect(Networks.mainnet.rpcUrl).toBe("https://soroban.stellar.org");
    expect(Networks.mainnet.networkPassphrase).toBe(
      "Public Global Stellar Network ; September 2015"
    );
  });

  it("should have all networks use https except local", () => {
    expect(Networks.local.rpcUrl).toMatch(/^http:\/\//);
    expect(Networks.testnet.rpcUrl).toMatch(/^https:\/\//);
    expect(Networks.mainnet.rpcUrl).toMatch(/^https:\/\//);
  });
});

// Note: callRender and detectRenderSupport require actual network calls
// and are better tested via integration tests with a running Stellar network
