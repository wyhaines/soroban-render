/**
 * Error parser for Soroban transaction errors
 * Converts raw Soroban error messages into user-friendly structured errors
 */

export interface ParsedError {
  /** The category of error */
  type: 'contract' | 'wasm' | 'auth' | 'storage' | 'budget' | 'account' | 'network' | 'unknown';
  /** For contract errors: the error code number */
  code?: number;
  /** Original error string for debugging */
  rawMessage: string;
  /** Human-readable message for users */
  userMessage: string;
  /** Whether the user can retry after fixing input */
  isRetryable: boolean;
}

/**
 * Parse a Soroban simulation/execution error into a structured format
 */
export function parseSimulationError(error: string): ParsedError {
  const rawMessage = error;

  // Contract error: Error(Contract, #N)
  const contractMatch = error.match(/Error\(Contract,\s*#(\d+)\)/i);
  if (contractMatch && contractMatch[1]) {
    const code = parseInt(contractMatch[1], 10);
    return {
      type: 'contract',
      code,
      rawMessage,
      // Note: Don't include code in userMessage - it's displayed separately in the UI
      userMessage: `The operation couldn't be completed. Please check your input and try again.`,
      isRetryable: true,
    };
  }

  // WasmVm errors (panics, traps)
  if (error.includes('WasmVm') || error.includes('UnreachableCodeReached') || error.includes('trap')) {
    return {
      type: 'wasm',
      rawMessage,
      userMessage: 'Something went wrong. Please try again, or contact support if this continues.',
      isRetryable: true,
    };
  }

  // Auth errors
  if (error.includes('Error(Auth') || error.includes('authorization') || error.includes('not authorized')) {
    return {
      type: 'auth',
      rawMessage,
      userMessage: "You don't have permission to perform this action. Please check you're logged in with the correct account.",
      isRetryable: true,
    };
  }

  // Storage errors
  if (error.includes('Error(Storage') || error.includes('storage')) {
    return {
      type: 'storage',
      rawMessage,
      userMessage: 'A storage error occurred. Please try again.',
      isRetryable: true,
    };
  }

  // Budget errors (resource limits)
  if (error.includes('Error(Budget') || error.includes('budget') || error.includes('exceeded')) {
    return {
      type: 'budget',
      rawMessage,
      userMessage: 'This operation requires too many resources. Try with less data.',
      isRetryable: true,
    };
  }

  // Account not found/unfunded
  if (error.includes('not found') || error.includes('unfunded') || error.includes('not funded') || error.includes('Account not funded')) {
    return {
      type: 'account',
      rawMessage,
      userMessage: 'Your account needs funding on this network. Please add funds and try again.',
      isRetryable: true,
    };
  }

  // Network errors
  if (error.includes('network') || error.includes('connection') || error.includes('timeout') || error.includes('ECONNREFUSED')) {
    return {
      type: 'network',
      rawMessage,
      userMessage: "Couldn't connect to the network. Please check your connection and try again.",
      isRetryable: true,
    };
  }

  // Unknown error - show generic message but include raw for debugging
  return {
    type: 'unknown',
    rawMessage,
    userMessage: 'An error occurred. Please try again.',
    isRetryable: true,
  };
}

/**
 * Look up a custom error message from a contract-provided error mapping
 * Returns the custom message if found, otherwise returns the default user message
 */
export function lookupErrorMessage(
  parsed: ParsedError,
  errorMappings?: Record<string, string>
): string {
  if (!errorMappings || parsed.type !== 'contract' || parsed.code === undefined) {
    return parsed.userMessage;
  }

  const customMessage = errorMappings[String(parsed.code)];
  if (customMessage) {
    return customMessage;
  }

  return parsed.userMessage;
}

/**
 * Check if an error object is a ParsedError (vs a plain string)
 */
export function isParsedError(error: unknown): error is ParsedError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    'rawMessage' in error &&
    'userMessage' in error
  );
}
