import {
  rpc,
  xdr,
  scValToNative,
  nativeToScVal,
  Contract,
  TransactionBuilder,
  BASE_FEE,
  Account,
} from "@stellar/stellar-sdk";

export interface RenderOptions {
  path?: string;
  viewer?: string;
  /**
   * Optional function name for render_* convention.
   * When specified, calls `render_{functionName}` instead of `render`.
   * Example: functionName="header" calls `render_header(path, viewer)`
   */
  functionName?: string;
}

export interface SorobanClient {
  server: rpc.Server;
  networkPassphrase: string;
}

export function createClient(rpcUrl: string, networkPassphrase: string): SorobanClient {
  const allowHttp = rpcUrl.startsWith("http://");
  return {
    server: new rpc.Server(rpcUrl, { allowHttp }),
    networkPassphrase,
  };
}

export const Networks = {
  local: {
    rpcUrl: "http://localhost:8000/soroban/rpc",
    networkPassphrase: "Standalone Network ; February 2017",
  },
  testnet: {
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
  },
  mainnet: {
    rpcUrl: "https://soroban.stellar.org",
    networkPassphrase: "Public Global Stellar Network ; September 2015",
  },
} as const;

export type NetworkName = keyof typeof Networks;

const SIMULATION_SOURCE = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

export async function callRender(
  client: SorobanClient,
  contractId: string,
  options: RenderOptions = {}
): Promise<string> {
  const contract = new Contract(contractId);

  console.log("[soroban-render] callRender invoked with path:", options.path);

  const pathArg = options.path
    ? xdr.ScVal.scvString(options.path)
    : xdr.ScVal.scvVoid();

  const viewerArg = options.viewer
    ? nativeToScVal(options.viewer, { type: "address" })
    : xdr.ScVal.scvVoid();

  // Use render_{functionName} if provided, otherwise just "render"
  const methodName = options.functionName
    ? `render_${options.functionName}`
    : "render";

  const operation = contract.call(methodName, pathArg, viewerArg);
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
    throw new Error("No result from simulation");
  }

  const retval = result.retval;

  if (retval.switch().name === "scvBytes") {
    const bytes = retval.bytes();
    const content = new TextDecoder().decode(bytes);
    console.log("[soroban-render] callRender returned (first 500 chars):", content.slice(0, 500));
    return content;
  }

  const native = scValToNative(retval);
  if (native instanceof Uint8Array) {
    const content = new TextDecoder().decode(native);
    console.log("[soroban-render] callRender returned (first 500 chars):", content.slice(0, 500));
    return content;
  }

  if (typeof native === "string") {
    console.log("[soroban-render] callRender returned (first 500 chars):", native.slice(0, 500));
    return native;
  }

  throw new Error(`Unexpected return type: ${typeof native}`);
}

export async function detectRenderSupport(
  client: SorobanClient,
  contractId: string
): Promise<{ supported: boolean; version?: string; formats?: string[] }> {
  try {
    await callRender(client, contractId);
    return { supported: true, version: "v1", formats: ["markdown"] };
  } catch {
    return { supported: false };
  }
}

