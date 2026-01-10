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

  console.log("[soroban-render] callRender invoked with path:", options.path, "functionName:", options.functionName);

  const pathArg = options.path
    ? xdr.ScVal.scvString(options.path)
    : xdr.ScVal.scvVoid();

  const viewerArg = options.viewer
    ? nativeToScVal(options.viewer, { type: "address" })
    : xdr.ScVal.scvVoid();

  // Use render_{functionName} if provided, otherwise just "render"
  // If functionName already starts with "render_", use it as-is
  let methodName: string;
  if (options.functionName) {
    methodName = options.functionName.startsWith("render_")
      ? options.functionName
      : `render_${options.functionName}`;
  } else {
    methodName = "render";
  }

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
    console.error("[soroban-render] Simulation error for", methodName, ":", simResult.error);
    throw new Error(`Simulation failed: ${simResult.error}`);
  }

  if (!rpc.Api.isSimulationSuccess(simResult)) {
    console.error("[soroban-render] Simulation not successful for", methodName);
    throw new Error("Simulation did not succeed");
  }

  const result = simResult.result;
  if (!result) {
    console.error("[soroban-render] No result from simulation for", methodName);
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

/**
 * Options for parameterized render calls.
 */
export interface ParameterizedRenderOptions {
  /**
   * Optional function name (without render_ prefix).
   * When specified, calls `render_{functionName}` instead of `render`.
   */
  functionName?: string;
  /**
   * Parameters to pass to the function.
   * Flags (true) and string values are supported.
   */
  params: Record<string, string | true>;
  /**
   * Current viewer address. Used when `viewer` flag is present in params.
   */
  viewer?: string;
  /**
   * Alias-to-contract-ID mappings for resolving @alias patterns in values.
   */
  aliases?: Record<string, string>;
}

/**
 * Resolve @alias patterns in a string value.
 * Example: "@main:/b/1" becomes "CABC123...:/b/1"
 */
function resolveAliasesInValue(
  value: string,
  aliases: Record<string, string>
): string {
  return value.replace(/@(\w+)/g, (match, alias) => {
    return aliases[alias] ?? match;
  });
}

/**
 * Convert a parameter to its XDR ScVal representation.
 * Type inference based on key naming conventions:
 * - viewer flag → Address (from viewer option) or void
 * - *_id suffix → u64
 * - count/depth/index/limit/offset → u32
 * - Everything else → Option<String> (string value or void for flags)
 */
function convertParamToScVal(
  key: string,
  value: string | true,
  viewer: string | undefined,
  aliases: Record<string, string>
): xdr.ScVal {
  // Special handling for viewer flag
  if (key === "viewer") {
    if (value === true && viewer) {
      return nativeToScVal(viewer, { type: "address" });
    }
    return xdr.ScVal.scvVoid();
  }

  // For flags without value (other than viewer), treat as void
  if (value === true) {
    return xdr.ScVal.scvVoid();
  }

  // Resolve aliases in string values
  const resolvedValue = resolveAliasesInValue(value, aliases);

  // Type inference based on key naming
  if (key.endsWith("_id")) {
    // u64 for IDs
    const num = parseInt(resolvedValue, 10);
    if (isNaN(num)) {
      // If not a number, fall back to string
      return xdr.ScVal.scvString(resolvedValue);
    }
    return nativeToScVal(BigInt(num), { type: "u64" });
  }

  // u32 for common numeric params
  const u32Keys = ["count", "depth", "index", "limit", "offset"];
  if (u32Keys.includes(key)) {
    const num = parseInt(resolvedValue, 10);
    if (!isNaN(num)) {
      return nativeToScVal(num, { type: "u32" });
    }
  }

  // Default: string value (Option<String>)
  return xdr.ScVal.scvString(resolvedValue);
}

/**
 * Build XDR arguments array for a parameterized render call.
 * Parameter ordering:
 * 1. `viewer` always first (if present in params)
 * 2. Other params in alphabetical order
 */
function buildParameterizedArgs(
  params: Record<string, string | true>,
  viewer: string | undefined,
  aliases: Record<string, string>
): xdr.ScVal[] {
  const args: xdr.ScVal[] = [];
  const keys = Object.keys(params);

  // Sort keys: viewer first, then alphabetical
  keys.sort((a, b) => {
    if (a === "viewer") return -1;
    if (b === "viewer") return 1;
    return a.localeCompare(b);
  });

  for (const key of keys) {
    const value = params[key];
    if (value !== undefined) {
      args.push(convertParamToScVal(key, value, viewer, aliases));
    }
  }

  return args;
}

/**
 * Call a render function with arbitrary named parameters.
 *
 * Used for parameterized includes where the function has a custom signature
 * rather than the standard (path, viewer) arguments.
 *
 * ## Usage
 *
 * Called automatically by the include resolver for:
 * - Includes with custom params (viewer, return_path, etc.)
 * - Includes where func ends with "_include" (naming convention)
 *
 * ## Parameter Ordering
 *
 * Arguments are passed in this order:
 * 1. "viewer" always first (if present in params)
 * 2. Other params in alphabetical order
 *
 * This matches contract function signatures like:
 *   pub fn render_nav_include(env: Env, viewer: Option<Address>, return_path: Option<String>)
 *
 * ## Type Inference
 *
 * Parameters are converted to Soroban types based on naming:
 * - "viewer" flag → Address (from viewer option) or void
 * - *_id suffix → u64
 * - count/depth/index/limit/offset → u32
 * - Everything else → String
 *
 * ## Alias Resolution
 *
 * Values containing @alias patterns are resolved before being passed:
 *   return_path="@main:/b/1" → "CDZPTPO5FDAO...:/b/1"
 *
 * @example
 * // Include tag: {{include contract=@main func="render_nav_include" viewer return_path="@main:/b/1"}}
 * callRenderParameterized(client, "CDZPTPO5...", {
 *   functionName: "render_nav_include",
 *   params: { viewer: true, return_path: "@main:/b/1" },
 *   viewer: "GCPM76A3...",
 *   aliases: { main: "CDZPTPO5..." }
 * });
 */
export async function callRenderParameterized(
  client: SorobanClient,
  contractId: string,
  options: ParameterizedRenderOptions
): Promise<string> {
  const contract = new Contract(contractId);
  const aliases = options.aliases ?? {};

  console.log(
    "[soroban-render] callRenderParameterized invoked with params:",
    options.params
  );

  // Build args from params
  const args = buildParameterizedArgs(
    options.params,
    options.viewer,
    aliases
  );

  // Determine method name
  // If functionName already starts with "render_", use it as-is
  // Otherwise, prepend "render_"
  let methodName: string;
  if (options.functionName) {
    methodName = options.functionName.startsWith("render_")
      ? options.functionName
      : `render_${options.functionName}`;
  } else {
    methodName = "render";
  }

  const operation = contract.call(methodName, ...args);
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
    console.log(
      "[soroban-render] callRenderParameterized returned (first 500 chars):",
      content.slice(0, 500)
    );
    return content;
  }

  const native = scValToNative(retval);
  if (native instanceof Uint8Array) {
    const content = new TextDecoder().decode(native);
    console.log(
      "[soroban-render] callRenderParameterized returned (first 500 chars):",
      content.slice(0, 500)
    );
    return content;
  }

  if (typeof native === "string") {
    console.log(
      "[soroban-render] callRenderParameterized returned (first 500 chars):",
      native.slice(0, 500)
    );
    return native;
  }

  throw new Error(`Unexpected return type: ${typeof native}`);
}

