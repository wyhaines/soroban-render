import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useRender, useRenderSupport } from "./useRender";
import type { SorobanClient } from "../utils/client";

// Mock the dependencies
vi.mock("../utils/client", () => ({
  callRender: vi.fn(),
}));

vi.mock("../parsers/markdown", () => ({
  parseMarkdown: vi.fn((content: string) =>
    Promise.resolve(`<p>${content}</p>`)
  ),
  detectFormat: vi.fn((content: string) => {
    if (content.startsWith("{")) {
      try {
        const parsed = JSON.parse(content);
        if (parsed.format?.startsWith("soroban-render-json")) return "json";
      } catch {
        // not json
      }
    }
    return "markdown";
  }),
}));

vi.mock("../parsers/json", () => ({
  parseJsonUI: vi.fn((content: string) => {
    try {
      const parsed = JSON.parse(content);
      if (parsed.format === "soroban-render-json-v1") {
        return { success: true, document: parsed };
      }
      return { success: false, error: "Invalid format" };
    } catch {
      return { success: false, error: "Parse error" };
    }
  }),
}));

vi.mock("../utils/includeResolver", () => ({
  resolveIncludes: vi.fn(
    (_client: unknown, content: string, _options: unknown) =>
      Promise.resolve({ content, cycleDetected: false, resolvedIncludes: [] })
  ),
}));

vi.mock("../utils/styleResolver", () => ({
  resolveStyles: vi.fn(
    (_client: unknown, content: string, options: { contractId: string }) =>
      Promise.resolve({
        content,
        css: "",
        scopeClassName: `soroban-scope-${options.contractId.slice(0, 8)}`,
        sources: { includes: [], inline: [] },
      })
  ),
}));

import { callRender } from "../utils/client";

const mockCallRender = vi.mocked(callRender);

describe("useRender", () => {
  const mockClient = {} as SorobanClient;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should start with loading state when enabled", async () => {
    mockCallRender.mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    const { result } = renderHook(() =>
      useRender(mockClient, "CONTRACT123")
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.html).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("should not fetch when client is null", () => {
    const { result } = renderHook(() =>
      useRender(null, "CONTRACT123")
    );

    expect(result.current.loading).toBe(false);
    expect(mockCallRender).not.toHaveBeenCalled();
  });

  it("should not fetch when contractId is null", () => {
    const { result } = renderHook(() =>
      useRender(mockClient, null)
    );

    expect(result.current.loading).toBe(false);
    expect(mockCallRender).not.toHaveBeenCalled();
  });

  it("should not fetch when enabled is false", () => {
    const { result } = renderHook(() =>
      useRender(mockClient, "CONTRACT123", { enabled: false })
    );

    expect(result.current.loading).toBe(false);
    expect(mockCallRender).not.toHaveBeenCalled();
  });

  it("should fetch and parse markdown content", async () => {
    mockCallRender.mockResolvedValue("# Hello World");

    const { result } = renderHook(() =>
      useRender(mockClient, "CONTRACT123")
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.html).toBe("<p># Hello World</p>");
    expect(result.current.raw).toBe("# Hello World");
    expect(result.current.format).toBe("markdown");
    expect(result.current.error).toBeNull();
  });

  it("should fetch and parse JSON content", async () => {
    const jsonContent = JSON.stringify({
      format: "soroban-render-json-v1",
      components: [{ type: "text", content: "Hello" }],
    });
    mockCallRender.mockResolvedValue(jsonContent);

    const { result } = renderHook(() =>
      useRender(mockClient, "CONTRACT123")
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.jsonDocument).toBeDefined();
    expect(result.current.jsonDocument?.format).toBe("soroban-render-json-v1");
    expect(result.current.format).toBe("json");
    expect(result.current.html).toBeNull();
  });

  it("should handle errors", async () => {
    mockCallRender.mockRejectedValue(new Error("Contract not found"));

    const { result } = renderHook(() =>
      useRender(mockClient, "CONTRACT123")
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("Contract not found");
    expect(result.current.html).toBeNull();
    expect(result.current.raw).toBeNull();
  });

  it("should use default path of /", async () => {
    mockCallRender.mockResolvedValue("Content");

    const { result } = renderHook(() =>
      useRender(mockClient, "CONTRACT123")
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.path).toBe("/");
  });

  it("should use custom initial path", async () => {
    mockCallRender.mockResolvedValue("Content");

    const { result } = renderHook(() =>
      useRender(mockClient, "CONTRACT123", { path: "/tasks" })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.path).toBe("/tasks");
    expect(mockCallRender).toHaveBeenCalledWith(
      mockClient,
      "CONTRACT123",
      expect.objectContaining({ path: "/tasks" })
    );
  });

  it("should update path via setPath", async () => {
    mockCallRender.mockResolvedValue("Content");

    const { result } = renderHook(() =>
      useRender(mockClient, "CONTRACT123")
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.setPath("/new-path");
    });

    await waitFor(() => {
      expect(result.current.path).toBe("/new-path");
    });
  });

  it("should refetch when path changes", async () => {
    mockCallRender.mockResolvedValue("Content");

    const { result } = renderHook(() =>
      useRender(mockClient, "CONTRACT123")
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockCallRender).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.setPath("/tasks");
    });

    await waitFor(() => {
      expect(mockCallRender).toHaveBeenCalledTimes(2);
    });
  });

  it("should pass viewer to callRender", async () => {
    mockCallRender.mockResolvedValue("Content");

    renderHook(() =>
      useRender(mockClient, "CONTRACT123", { viewer: "GVIEWER123" })
    );

    await waitFor(() => {
      expect(mockCallRender).toHaveBeenCalledWith(
        mockClient,
        "CONTRACT123",
        expect.objectContaining({ viewer: "GVIEWER123" })
      );
    });
  });

  it("should allow manual refetch", async () => {
    mockCallRender.mockResolvedValue("Content");

    const { result } = renderHook(() =>
      useRender(mockClient, "CONTRACT123")
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockCallRender).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refetch();
    });

    expect(mockCallRender).toHaveBeenCalledTimes(2);
  });
});

describe("useRenderSupport", () => {
  const mockClient = {} as SorobanClient;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return null supported when client is null", () => {
    const { result } = renderHook(() =>
      useRenderSupport(null, "CONTRACT123")
    );

    expect(result.current.supported).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("should return null supported when contractId is null", () => {
    const { result } = renderHook(() =>
      useRenderSupport(mockClient, null)
    );

    expect(result.current.supported).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("should return supported true when render succeeds", async () => {
    mockCallRender.mockResolvedValue("Content");

    const { result } = renderHook(() =>
      useRenderSupport(mockClient, "CONTRACT123")
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.supported).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it("should return supported false when render fails", async () => {
    mockCallRender.mockRejectedValue(new Error("No render function"));

    const { result } = renderHook(() =>
      useRenderSupport(mockClient, "CONTRACT123")
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.supported).toBe(false);
    expect(result.current.error).toBe("No render function");
  });

  it("should show loading state while checking", async () => {
    mockCallRender.mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    const { result } = renderHook(() =>
      useRenderSupport(mockClient, "CONTRACT123")
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.supported).toBeNull();
  });
});
