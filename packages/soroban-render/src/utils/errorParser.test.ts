import { describe, it, expect } from "vitest";
import {
  parseSimulationError,
  lookupErrorMessage,
  isParsedError,
  ParsedError,
} from "./errorParser";

describe("parseSimulationError", () => {
  describe("contract errors", () => {
    it("should parse Error(Contract, #N) format", () => {
      const result = parseSimulationError("Error(Contract, #1)");

      expect(result.type).toBe("contract");
      expect(result.code).toBe(1);
      expect(result.rawMessage).toBe("Error(Contract, #1)");
      expect(result.isRetryable).toBe(true);
    });

    it("should parse contract errors with different codes", () => {
      expect(parseSimulationError("Error(Contract, #0)").code).toBe(0);
      expect(parseSimulationError("Error(Contract, #7)").code).toBe(7);
      expect(parseSimulationError("Error(Contract, #100)").code).toBe(100);
      expect(parseSimulationError("Error(Contract, #999)").code).toBe(999);
    });

    it("should be case-insensitive", () => {
      const result = parseSimulationError("error(contract, #5)");

      expect(result.type).toBe("contract");
      expect(result.code).toBe(5);
    });

    it("should handle contract error with surrounding text", () => {
      const result = parseSimulationError(
        "HostError: Error(Contract, #3) in simulation"
      );

      expect(result.type).toBe("contract");
      expect(result.code).toBe(3);
    });

    it("should provide generic user message without code", () => {
      const result = parseSimulationError("Error(Contract, #1)");

      expect(result.userMessage).not.toContain("#1");
      expect(result.userMessage).toContain("couldn't be completed");
    });
  });

  describe("wasm errors", () => {
    it("should parse WasmVm errors", () => {
      const result = parseSimulationError("WasmVm: unreachable code executed");

      expect(result.type).toBe("wasm");
      expect(result.isRetryable).toBe(true);
    });

    it("should parse UnreachableCodeReached errors", () => {
      const result = parseSimulationError("UnreachableCodeReached at index 5");

      expect(result.type).toBe("wasm");
    });

    it("should parse trap errors", () => {
      const result = parseSimulationError("trap: integer overflow");

      expect(result.type).toBe("wasm");
    });
  });

  describe("auth errors", () => {
    it("should parse Error(Auth...) format", () => {
      const result = parseSimulationError("Error(Auth, InvalidAction)");

      expect(result.type).toBe("auth");
      expect(result.isRetryable).toBe(true);
      expect(result.userMessage).toContain("permission");
    });

    it("should parse authorization keyword", () => {
      const result = parseSimulationError("authorization required");

      expect(result.type).toBe("auth");
    });

    it("should parse 'not authorized' message", () => {
      const result = parseSimulationError("user not authorized for this action");

      expect(result.type).toBe("auth");
    });
  });

  describe("storage errors", () => {
    it("should parse Error(Storage...) format", () => {
      const result = parseSimulationError("Error(Storage, MissingValue)");

      expect(result.type).toBe("storage");
      expect(result.isRetryable).toBe(true);
    });

    it("should parse storage keyword", () => {
      const result = parseSimulationError("storage limit exceeded");

      expect(result.type).toBe("storage");
    });
  });

  describe("budget errors", () => {
    it("should parse Error(Budget...) format", () => {
      const result = parseSimulationError("Error(Budget, Exceeded)");

      expect(result.type).toBe("budget");
      expect(result.isRetryable).toBe(true);
      expect(result.userMessage).toContain("resources");
    });

    it("should parse budget keyword", () => {
      const result = parseSimulationError("budget exhausted");

      expect(result.type).toBe("budget");
    });

    it("should parse exceeded keyword", () => {
      const result = parseSimulationError("cpu instructions exceeded");

      expect(result.type).toBe("budget");
    });
  });

  describe("account errors", () => {
    it("should parse 'not found' errors", () => {
      const result = parseSimulationError("account not found");

      expect(result.type).toBe("account");
      expect(result.isRetryable).toBe(true);
      expect(result.userMessage).toContain("funding");
    });

    it("should parse 'unfunded' errors", () => {
      const result = parseSimulationError("account unfunded");

      expect(result.type).toBe("account");
    });

    it("should parse 'not funded' errors", () => {
      const result = parseSimulationError("account not funded on testnet");

      expect(result.type).toBe("account");
    });

    it("should parse 'Account not funded' message", () => {
      const result = parseSimulationError("Account not funded");

      expect(result.type).toBe("account");
    });
  });

  describe("network errors", () => {
    it("should parse network keyword", () => {
      const result = parseSimulationError("network unavailable");

      expect(result.type).toBe("network");
      expect(result.isRetryable).toBe(true);
      expect(result.userMessage).toContain("connection");
    });

    it("should parse connection keyword", () => {
      const result = parseSimulationError("connection refused");

      expect(result.type).toBe("network");
    });

    it("should parse timeout keyword", () => {
      const result = parseSimulationError("request timeout");

      expect(result.type).toBe("network");
    });

    it("should parse ECONNREFUSED", () => {
      const result = parseSimulationError("ECONNREFUSED 127.0.0.1:8000");

      expect(result.type).toBe("network");
    });
  });

  describe("unknown errors", () => {
    it("should categorize unrecognized errors as unknown", () => {
      const result = parseSimulationError("some random error message");

      expect(result.type).toBe("unknown");
      expect(result.rawMessage).toBe("some random error message");
      expect(result.isRetryable).toBe(true);
    });

    it("should handle empty string", () => {
      const result = parseSimulationError("");

      expect(result.type).toBe("unknown");
      expect(result.rawMessage).toBe("");
    });

    it("should preserve raw message for debugging", () => {
      const errorMsg = "Unexpected internal error XYZ-123";
      const result = parseSimulationError(errorMsg);

      expect(result.rawMessage).toBe(errorMsg);
    });
  });

  describe("all errors are retryable", () => {
    it("should mark all error types as retryable", () => {
      const errors = [
        "Error(Contract, #1)",
        "WasmVm error",
        "Error(Auth, Denied)",
        "Error(Storage, Full)",
        "Error(Budget, Exceeded)",
        "account not found",
        "network timeout",
        "unknown error",
      ];

      for (const err of errors) {
        expect(parseSimulationError(err).isRetryable).toBe(true);
      }
    });
  });
});

describe("lookupErrorMessage", () => {
  const contractError: ParsedError = {
    type: "contract",
    code: 1,
    rawMessage: "Error(Contract, #1)",
    userMessage: "The operation couldn't be completed.",
    isRetryable: true,
  };

  const authError: ParsedError = {
    type: "auth",
    rawMessage: "Error(Auth, Denied)",
    userMessage: "You don't have permission.",
    isRetryable: true,
  };

  it("should return custom message when mapping exists", () => {
    const mappings = {
      "1": "Board is read-only",
      "2": "Invalid input",
    };

    const message = lookupErrorMessage(contractError, mappings);

    expect(message).toBe("Board is read-only");
  });

  it("should return default user message when no mapping exists", () => {
    const mappings = {
      "99": "Some other error",
    };

    const message = lookupErrorMessage(contractError, mappings);

    expect(message).toBe("The operation couldn't be completed.");
  });

  it("should return default user message when mappings is undefined", () => {
    const message = lookupErrorMessage(contractError, undefined);

    expect(message).toBe("The operation couldn't be completed.");
  });

  it("should return default user message when mappings is empty", () => {
    const message = lookupErrorMessage(contractError, {});

    expect(message).toBe("The operation couldn't be completed.");
  });

  it("should return default user message for non-contract errors", () => {
    const mappings = {
      "1": "Custom message",
    };

    const message = lookupErrorMessage(authError, mappings);

    expect(message).toBe("You don't have permission.");
  });

  it("should return default user message when code is undefined", () => {
    const errorWithoutCode: ParsedError = {
      type: "contract",
      rawMessage: "Error(Contract)",
      userMessage: "Generic contract error",
      isRetryable: true,
    };
    const mappings = { "1": "Custom" };

    const message = lookupErrorMessage(errorWithoutCode, mappings);

    expect(message).toBe("Generic contract error");
  });

  it("should handle string code lookup correctly", () => {
    const error: ParsedError = {
      type: "contract",
      code: 100,
      rawMessage: "Error(Contract, #100)",
      userMessage: "Default message",
      isRetryable: true,
    };
    const mappings = {
      "100": "Custom error 100",
    };

    const message = lookupErrorMessage(error, mappings);

    expect(message).toBe("Custom error 100");
  });
});

describe("isParsedError", () => {
  it("should return true for valid ParsedError objects", () => {
    const error: ParsedError = {
      type: "contract",
      code: 1,
      rawMessage: "Error(Contract, #1)",
      userMessage: "An error occurred",
      isRetryable: true,
    };

    expect(isParsedError(error)).toBe(true);
  });

  it("should return true for minimal valid ParsedError", () => {
    const error = {
      type: "unknown",
      rawMessage: "error",
      userMessage: "An error occurred",
      isRetryable: false,
    };

    expect(isParsedError(error)).toBe(true);
  });

  it("should return false for plain string", () => {
    expect(isParsedError("An error message")).toBe(false);
  });

  it("should return false for null", () => {
    expect(isParsedError(null)).toBe(false);
  });

  it("should return false for undefined", () => {
    expect(isParsedError(undefined)).toBe(false);
  });

  it("should return false for number", () => {
    expect(isParsedError(42)).toBe(false);
  });

  it("should return false for object missing type", () => {
    const obj = {
      rawMessage: "error",
      userMessage: "message",
    };

    expect(isParsedError(obj)).toBe(false);
  });

  it("should return false for object missing rawMessage", () => {
    const obj = {
      type: "contract",
      userMessage: "message",
    };

    expect(isParsedError(obj)).toBe(false);
  });

  it("should return false for object missing userMessage", () => {
    const obj = {
      type: "contract",
      rawMessage: "error",
    };

    expect(isParsedError(obj)).toBe(false);
  });

  it("should return false for empty object", () => {
    expect(isParsedError({})).toBe(false);
  });

  it("should return false for array", () => {
    expect(isParsedError(["type", "rawMessage", "userMessage"])).toBe(false);
  });
});
