import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  loadRenderContinuations,
  hasRenderContinuations,
  hasRenderPlaceholders,
  extractRenderPaths,
} from "./renderContinuation";
import type { SorobanClient } from "./client";

// Mock the client module
vi.mock("./client", () => ({
  callRender: vi.fn(),
}));

describe("renderContinuation", () => {
  let mockClient: SorobanClient;
  let mockCallRender: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();

    const clientModule = await import("./client");
    mockCallRender = clientModule.callRender as ReturnType<typeof vi.fn>;

    mockClient = {
      server: {} as SorobanClient["server"],
      networkPassphrase: "Test Network",
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("hasRenderContinuations", () => {
    it("should return true when content has render tags", () => {
      expect(hasRenderContinuations('{{render path="/page1"}}')).toBe(true);
      expect(hasRenderContinuations('text {{render path="/foo"}} more')).toBe(true);
    });

    it("should return false when content has no render tags", () => {
      expect(hasRenderContinuations("regular content")).toBe(false);
      expect(hasRenderContinuations("{{include contract=ABC}}")).toBe(false);
    });

    it("should return false for malformed render tags", () => {
      expect(hasRenderContinuations("{{render}}")).toBe(false);
      expect(hasRenderContinuations("{{render path=no-quotes}}")).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(hasRenderContinuations("")).toBe(false);
    });
  });

  describe("hasRenderPlaceholders", () => {
    it("should return true when content has placeholder divs (data-type first)", () => {
      const content = '<div data-type="render" data-path="/page1"></div>';
      expect(hasRenderPlaceholders(content)).toBe(true);
    });

    it("should return true when content has placeholder divs (data-path first)", () => {
      const content = '<div data-path="/page1" data-type="render"></div>';
      expect(hasRenderPlaceholders(content)).toBe(true);
    });

    it("should return false when content has no placeholder divs", () => {
      expect(hasRenderPlaceholders("regular content")).toBe(false);
      expect(hasRenderPlaceholders('<div class="normal"></div>')).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(hasRenderPlaceholders("")).toBe(false);
    });
  });

  describe("extractRenderPaths", () => {
    it("should extract paths from raw render tags", () => {
      const content = `
        {{render path="/page1"}}
        {{render path="/page2"}}
      `;
      const paths = extractRenderPaths(content);

      expect(paths).toContain("/page1");
      expect(paths).toContain("/page2");
      expect(paths).toHaveLength(2);
    });

    it("should extract paths from placeholder divs (data-type first)", () => {
      const content = `
        <div data-type="render" data-path="/page1"></div>
        <div data-type="render" data-path="/page2"></div>
      `;
      const paths = extractRenderPaths(content);

      expect(paths).toContain("/page1");
      expect(paths).toContain("/page2");
    });

    it("should extract paths from placeholder divs (data-path first)", () => {
      const content = '<div data-path="/page1" data-type="render"></div>';
      const paths = extractRenderPaths(content);

      expect(paths).toContain("/page1");
    });

    it("should extract from both tags and divs", () => {
      const content = `
        {{render path="/from-tag"}}
        <div data-type="render" data-path="/from-div"></div>
      `;
      const paths = extractRenderPaths(content);

      expect(paths).toContain("/from-tag");
      expect(paths).toContain("/from-div");
    });

    it("should remove duplicates", () => {
      const content = `
        {{render path="/page"}}
        <div data-type="render" data-path="/page"></div>
      `;
      const paths = extractRenderPaths(content);

      expect(paths).toHaveLength(1);
      expect(paths[0]).toBe("/page");
    });

    it("should return empty array for content without paths", () => {
      expect(extractRenderPaths("no render paths here")).toEqual([]);
    });
  });

  describe("loadRenderContinuations", () => {
    it("should return unchanged content when no placeholders", async () => {
      const content = "<p>No placeholders</p>";

      const result = await loadRenderContinuations(content, {
        contractId: "CONTRACT123",
        client: mockClient,
      });

      expect(result.content).toBe(content);
      expect(result.continuationsLoaded).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it("should replace placeholders with loaded content", async () => {
      mockCallRender.mockResolvedValue("<p>Loaded content</p>");

      const content = '<div data-type="render" data-path="/page1"></div>';

      const result = await loadRenderContinuations(content, {
        contractId: "CONTRACT123",
        client: mockClient,
      });

      expect(result.content).toContain("Loaded content");
      expect(result.content).not.toContain('data-type="render"');
      expect(result.continuationsLoaded).toBe(1);
    });

    it("should handle multiple placeholders", async () => {
      mockCallRender.mockImplementation(async (_client, _contractId, options) => {
        return `<p>Content for ${options?.path}</p>`;
      });

      const content = `
        <div data-type="render" data-path="/page1"></div>
        <div data-type="render" data-path="/page2"></div>
      `;

      const result = await loadRenderContinuations(content, {
        contractId: "CONTRACT123",
        client: mockClient,
      });

      expect(result.content).toContain("Content for /page1");
      expect(result.content).toContain("Content for /page2");
      expect(result.continuationsLoaded).toBe(2);
    });

    it("should pass viewer to render calls", async () => {
      mockCallRender.mockResolvedValue("<p>Loaded</p>");

      const content = '<div data-type="render" data-path="/page"></div>';

      await loadRenderContinuations(content, {
        contractId: "CONTRACT123",
        client: mockClient,
        viewer: "VIEWER_ADDRESS",
      });

      expect(mockCallRender).toHaveBeenCalledWith(
        mockClient,
        "CONTRACT123",
        expect.objectContaining({ viewer: "VIEWER_ADDRESS" })
      );
    });

    it("should call onContinuationLoaded callback", async () => {
      mockCallRender.mockResolvedValue("raw content");
      const onContinuationLoaded = vi
        .fn()
        .mockResolvedValue("<p>processed</p>");

      const content = '<div data-type="render" data-path="/page"></div>';

      await loadRenderContinuations(content, {
        contractId: "CONTRACT123",
        client: mockClient,
        onContinuationLoaded,
      });

      expect(onContinuationLoaded).toHaveBeenCalledWith("/page", "raw content");
    });

    it("should call onError callback on failure", async () => {
      mockCallRender.mockRejectedValue(new Error("Load failed"));
      const onError = vi.fn();

      const content = '<div data-type="render" data-path="/page"></div>';

      const result = await loadRenderContinuations(content, {
        contractId: "CONTRACT123",
        client: mockClient,
        onError,
      });

      expect(onError).toHaveBeenCalled();
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].path).toBe("/page");
    });

    it("should prevent infinite loops by tracking loaded paths", async () => {
      // Return content that contains the same placeholder
      mockCallRender.mockResolvedValue(
        '<div data-type="render" data-path="/page"></div>'
      );

      const content = '<div data-type="render" data-path="/page"></div>';

      const result = await loadRenderContinuations(content, {
        contractId: "CONTRACT123",
        client: mockClient,
      });

      // Should only load once despite recursive placeholder
      expect(result.continuationsLoaded).toBe(1);
    });

    it("should respect maxContinuations limit", async () => {
      let counter = 0;
      mockCallRender.mockImplementation(async () => {
        counter++;
        // Return new placeholders to trigger more loads
        return `<div data-type="render" data-path="/page${counter}"></div>`;
      });

      const content = '<div data-type="render" data-path="/start"></div>';

      const result = await loadRenderContinuations(content, {
        contractId: "CONTRACT123",
        client: mockClient,
        maxContinuations: 5,
      });

      expect(result.continuationsLoaded).toBeLessThanOrEqual(5);
    });

    it("should handle recursive continuations", async () => {
      let callCount = 0;
      mockCallRender.mockImplementation(async (_client, _contractId, options) => {
        callCount++;
        if (options?.path === "/level1") {
          return '<div data-type="render" data-path="/level2"></div>';
        }
        if (options?.path === "/level2") {
          return "<p>Final content</p>";
        }
        return "";
      });

      const content = '<div data-type="render" data-path="/level1"></div>';

      const result = await loadRenderContinuations(content, {
        contractId: "CONTRACT123",
        client: mockClient,
      });

      expect(result.content).toContain("Final content");
      expect(result.continuationsLoaded).toBe(2);
    });

    it("should respect maxConcurrent for batching", async () => {
      const loadTimes: number[] = [];
      mockCallRender.mockImplementation(async () => {
        loadTimes.push(Date.now());
        await new Promise((r) => setTimeout(r, 10));
        return "<p>Loaded</p>";
      });

      const content = `
        <div data-type="render" data-path="/p1"></div>
        <div data-type="render" data-path="/p2"></div>
        <div data-type="render" data-path="/p3"></div>
        <div data-type="render" data-path="/p4"></div>
      `;

      await loadRenderContinuations(content, {
        contractId: "CONTRACT123",
        client: mockClient,
        maxConcurrent: 2,
      });

      // With maxConcurrent: 2, loads should be batched
      expect(mockCallRender).toHaveBeenCalledTimes(4);
    });
  });
});
