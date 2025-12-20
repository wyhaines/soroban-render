import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  resolveIncludes,
  createIncludeResolver,
  CacheEntry,
} from "./includeResolver";
import type { SorobanClient } from "./client";

// Mock the client module
vi.mock("./client", () => ({
  callRender: vi.fn(),
}));

import { callRender } from "./client";

const mockCallRender = vi.mocked(callRender);

describe("resolveIncludes", () => {
  const mockClient = {} as SorobanClient;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return content unchanged if no includes", async () => {
    const content = "Just some regular content";

    const result = await resolveIncludes(mockClient, content, {
      contractId: "CABC123",
    });

    expect(result.content).toBe(content);
    expect(result.cycleDetected).toBe(false);
    expect(result.resolvedIncludes).toEqual([]);
    expect(mockCallRender).not.toHaveBeenCalled();
  });

  it("should resolve a simple include", async () => {
    const content = "Before {{include contract=CDEF456 func=\"header\"}} After";
    mockCallRender.mockResolvedValueOnce("HEADER CONTENT");

    const result = await resolveIncludes(mockClient, content, {
      contractId: "CABC123",
    });

    expect(result.content).toBe("Before HEADER CONTENT After");
    expect(result.cycleDetected).toBe(false);
    expect(mockCallRender).toHaveBeenCalledWith(mockClient, "CDEF456", {
      path: undefined,
      viewer: undefined,
      functionName: "header",
    });
  });

  it("should resolve SELF to current contract ID", async () => {
    const content = '{{include contract=SELF func="footer"}}';
    mockCallRender.mockResolvedValueOnce("FOOTER");

    await resolveIncludes(mockClient, content, {
      contractId: "CABC123",
    });

    expect(mockCallRender).toHaveBeenCalledWith(mockClient, "CABC123", {
      path: undefined,
      viewer: undefined,
      functionName: "footer",
    });
  });

  it("should pass viewer to nested calls", async () => {
    const content = '{{include contract=CDEF456 func="nav"}}';
    mockCallRender.mockResolvedValueOnce("NAV");

    await resolveIncludes(mockClient, content, {
      contractId: "CABC123",
      viewer: "GVIEWER123",
    });

    expect(mockCallRender).toHaveBeenCalledWith(mockClient, "CDEF456", {
      path: undefined,
      viewer: "GVIEWER123",
      functionName: "nav",
    });
  });

  it("should pass path to render call", async () => {
    const content = '{{include contract=CDEF456 path="/tasks"}}';
    mockCallRender.mockResolvedValueOnce("TASKS");

    await resolveIncludes(mockClient, content, {
      contractId: "CABC123",
    });

    expect(mockCallRender).toHaveBeenCalledWith(mockClient, "CDEF456", {
      path: "/tasks",
      viewer: undefined,
      functionName: undefined,
    });
  });

  it("should resolve multiple includes", async () => {
    const content = '{{include contract=A func="header"}} middle {{include contract=B func="footer"}}';
    // Note: includes are processed in reverse order to maintain correct indices
    // So footer (at end) is resolved first, then header
    mockCallRender.mockResolvedValueOnce("FOOTER");
    mockCallRender.mockResolvedValueOnce("HEADER");

    const result = await resolveIncludes(mockClient, content, {
      contractId: "CABC123",
    });

    expect(result.content).toBe("HEADER middle FOOTER");
    expect(mockCallRender).toHaveBeenCalledTimes(2);
  });

  it("should resolve nested includes", async () => {
    const content = '{{include contract=A func="outer"}}';
    // First call returns content with another include
    mockCallRender.mockResolvedValueOnce('Before {{include contract=B func="inner"}} After');
    // Second call returns final content
    mockCallRender.mockResolvedValueOnce("INNER");

    const result = await resolveIncludes(mockClient, content, {
      contractId: "CABC123",
    });

    expect(result.content).toBe("Before INNER After");
    expect(mockCallRender).toHaveBeenCalledTimes(2);
  });

  it("should detect and break direct cycles", async () => {
    const content = '{{include contract=A func="self"}}';
    // A includes itself
    mockCallRender.mockResolvedValue('{{include contract=A func="self"}}');

    const result = await resolveIncludes(mockClient, content, {
      contractId: "CABC123",
    });

    expect(result.cycleDetected).toBe(true);
    expect(result.content).toContain("<!-- cycle detected -->");
    // Should only call once before detecting cycle
    expect(mockCallRender).toHaveBeenCalledTimes(1);
  });

  it("should detect and break indirect cycles", async () => {
    const content = '{{include contract=A func="a"}}';
    // A includes B
    mockCallRender.mockResolvedValueOnce('{{include contract=B func="b"}}');
    // B includes A (cycle)
    mockCallRender.mockResolvedValueOnce('{{include contract=A func="a"}}');

    const result = await resolveIncludes(mockClient, content, {
      contractId: "CABC123",
    });

    expect(result.cycleDetected).toBe(true);
    // A and B should both be called, then cycle detected
    expect(mockCallRender).toHaveBeenCalledTimes(2);
  });

  it("should handle errors gracefully", async () => {
    const content = '{{include contract=BAD func="error"}}';
    mockCallRender.mockRejectedValueOnce(new Error("Contract not found"));

    const result = await resolveIncludes(mockClient, content, {
      contractId: "CABC123",
    });

    expect(result.content).toContain("<!-- include error:");
    expect(result.content).toContain("Contract not found");
    expect(result.cycleDetected).toBe(false);
  });

  it("should use cache for repeated includes", async () => {
    const content = '{{include contract=A}} {{include contract=A}}';
    mockCallRender.mockResolvedValue("CACHED");

    const cache = new Map<string, CacheEntry>();

    await resolveIncludes(mockClient, content, {
      contractId: "CABC123",
      cache,
    });

    // Should only call once due to caching
    expect(mockCallRender).toHaveBeenCalledTimes(1);
  });

  it("should respect cache TTL", async () => {
    const content = '{{include contract=A}}';
    mockCallRender.mockResolvedValue("CONTENT");

    const cache = new Map<string, CacheEntry>();
    // Pre-populate cache with expired entry
    cache.set("A:|", {
      content: "OLD CONTENT",
      timestamp: Date.now() - 60000, // 60 seconds ago
    });

    const result = await resolveIncludes(mockClient, content, {
      contractId: "CABC123",
      cache,
      cacheTtl: 30000, // 30 second TTL
    });

    // Should fetch fresh content because cache expired
    expect(mockCallRender).toHaveBeenCalledTimes(1);
    expect(result.content).toBe("CONTENT");
  });

  it("should use valid cache entry", async () => {
    const content = '{{include contract=A}}';

    const cache = new Map<string, CacheEntry>();
    // Pre-populate cache with fresh entry
    cache.set("A:|", {
      content: "CACHED CONTENT",
      timestamp: Date.now() - 5000, // 5 seconds ago
    });

    const result = await resolveIncludes(mockClient, content, {
      contractId: "CABC123",
      cache,
      cacheTtl: 30000, // 30 second TTL
    });

    // Should use cache, not fetch
    expect(mockCallRender).not.toHaveBeenCalled();
    expect(result.content).toBe("CACHED CONTENT");
  });
});

describe("createIncludeResolver", () => {
  const mockClient = {} as SorobanClient;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a resolver with shared cache", async () => {
    const resolver = createIncludeResolver(mockClient);

    expect(resolver.resolve).toBeInstanceOf(Function);
    expect(resolver.clearCache).toBeInstanceOf(Function);
    expect(resolver.getCacheSize).toBeInstanceOf(Function);
  });

  it("should share cache between resolve calls", async () => {
    mockCallRender.mockResolvedValue("CONTENT");

    const resolver = createIncludeResolver(mockClient);

    await resolver.resolve('{{include contract=A}}', "CABC123");
    await resolver.resolve('{{include contract=A}}', "CABC123");

    // Should only call once due to shared cache
    expect(mockCallRender).toHaveBeenCalledTimes(1);
    expect(resolver.getCacheSize()).toBe(1);
  });

  it("should clear cache", async () => {
    mockCallRender.mockResolvedValue("CONTENT");

    const resolver = createIncludeResolver(mockClient);

    await resolver.resolve('{{include contract=A}}', "CABC123");
    expect(resolver.getCacheSize()).toBe(1);

    resolver.clearCache();
    expect(resolver.getCacheSize()).toBe(0);

    await resolver.resolve('{{include contract=A}}', "CABC123");
    // Should call again after cache cleared
    expect(mockCallRender).toHaveBeenCalledTimes(2);
  });

  it("should respect custom cache TTL", async () => {
    mockCallRender.mockResolvedValue("CONTENT");

    // Very short TTL
    const resolver = createIncludeResolver(mockClient, 1);

    await resolver.resolve('{{include contract=A}}', "CABC123");

    // Wait for cache to expire
    await new Promise((resolve) => setTimeout(resolve, 10));

    await resolver.resolve('{{include contract=A}}', "CABC123");

    // Should call twice because cache expired
    expect(mockCallRender).toHaveBeenCalledTimes(2);
  });

  it("should pass viewer to resolve", async () => {
    mockCallRender.mockResolvedValue("CONTENT");

    const resolver = createIncludeResolver(mockClient);

    await resolver.resolve(
      '{{include contract=A func="header"}}',
      "CABC123",
      "GVIEWER456"
    );

    expect(mockCallRender).toHaveBeenCalledWith(mockClient, "A", {
      path: undefined,
      viewer: "GVIEWER456",
      functionName: "header",
    });
  });
});
