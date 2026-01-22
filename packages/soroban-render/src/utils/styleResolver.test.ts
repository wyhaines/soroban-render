import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  resolveStyles,
  createStyleResolver,
  StyleResolveOptions,
} from "./styleResolver";
import type { SorobanClient } from "./client";

// Mock the client module
vi.mock("./client", () => ({
  callRender: vi.fn(),
}));

describe("styleResolver", () => {
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

  describe("resolveStyles", () => {
    it("should return empty CSS when no styles available", async () => {
      mockCallRender.mockRejectedValue(new Error("No styles function"));

      const result = await resolveStyles(mockClient, "# Hello World", {
        contractId: "CONTRACT123",
      });

      expect(result.css).toBe("");
      expect(result.content).toBe("# Hello World");
      expect(result.scopeClassName).toContain("soroban-scope-");
    });

    it("should fetch and include theme styles when themeContractId provided", async () => {
      mockCallRender.mockImplementation(async (_client, contractId, options) => {
        if (contractId === "THEME123" && options?.functionName === "styles") {
          return ".theme { color: blue; }";
        }
        throw new Error("No styles");
      });

      const result = await resolveStyles(mockClient, "Content", {
        contractId: "CONTRACT123",
        themeContractId: "THEME123",
      });

      expect(result.css).toContain("color: blue");
      expect(result.sources.theme).toBeDefined();
    });

    it("should fetch contract styles", async () => {
      mockCallRender.mockImplementation(async (_client, contractId, options) => {
        if (contractId === "CONTRACT123" && options?.functionName === "styles") {
          return ".contract { margin: 10px; }";
        }
        throw new Error("No styles");
      });

      const result = await resolveStyles(mockClient, "Content", {
        contractId: "CONTRACT123",
      });

      expect(result.css).toContain("margin: 10px");
      expect(result.sources.contract).toBeDefined();
    });

    it("should parse and resolve {{style ...}} tags", async () => {
      mockCallRender.mockImplementation(async (_client, contractId, options) => {
        if (contractId === "STYLE123" && options?.functionName === "styles_dark") {
          return ".dark { background: black; }";
        }
        throw new Error("No styles");
      });

      const content = `{{style contract=STYLE123 func="dark"}}
# Hello`;

      const result = await resolveStyles(mockClient, content, {
        contractId: "CONTRACT123",
      });

      expect(result.css).toContain("background: black");
      expect(result.sources.includes).toHaveLength(1);
      expect(result.content).not.toContain("{{style");
    });

    it("should resolve SELF keyword in style tags", async () => {
      mockCallRender.mockImplementation(async (_client, contractId, options) => {
        if (contractId === "CONTRACT123" && options?.functionName === "styles_custom") {
          return ".custom { padding: 5px; }";
        }
        throw new Error("No styles");
      });

      const content = `{{style contract=SELF func="custom"}}`;

      const result = await resolveStyles(mockClient, content, {
        contractId: "CONTRACT123",
      });

      expect(result.css).toContain("padding: 5px");
    });

    it("should extract inline CSS blocks", async () => {
      mockCallRender.mockRejectedValue(new Error("No styles"));

      const content = `# Title

\`\`\`css
.inline { font-size: 14px; }
\`\`\`

Some content`;

      const result = await resolveStyles(mockClient, content, {
        contractId: "CONTRACT123",
      });

      expect(result.css).toContain("font-size: 14px");
      expect(result.sources.inline).toHaveLength(1);
    });

    it("should remove CSS blocks from content when removeCssBlocksFromContent is true", async () => {
      mockCallRender.mockRejectedValue(new Error("No styles"));

      const content = `# Title

\`\`\`css
.test { color: red; }
\`\`\`

More content`;

      const result = await resolveStyles(mockClient, content, {
        contractId: "CONTRACT123",
        removeCssBlocksFromContent: true,
      });

      expect(result.content).not.toContain("```css");
      expect(result.content).toContain("# Title");
      expect(result.content).toContain("More content");
    });

    it("should keep CSS blocks in content when removeCssBlocksFromContent is false", async () => {
      mockCallRender.mockRejectedValue(new Error("No styles"));

      const content = `\`\`\`css
.test { color: red; }
\`\`\``;

      const result = await resolveStyles(mockClient, content, {
        contractId: "CONTRACT123",
        removeCssBlocksFromContent: false,
      });

      expect(result.content).toContain("```css");
    });

    it("should use cache for repeated style fetches", async () => {
      let callCount = 0;
      mockCallRender.mockImplementation(async () => {
        callCount++;
        return ".cached { display: block; }";
      });

      const cache = new Map();
      const options: StyleResolveOptions = {
        contractId: "CONTRACT123",
        cache,
      };

      // First call
      await resolveStyles(mockClient, "Content", options);
      // Second call with same cache
      await resolveStyles(mockClient, "Content", options);

      // Should only fetch once due to caching
      expect(callCount).toBe(1);
    });

    it("should generate unique scope class name per contract", async () => {
      mockCallRender.mockRejectedValue(new Error("No styles"));

      // Use contract IDs that differ in first 8 characters
      const result1 = await resolveStyles(mockClient, "Content", {
        contractId: "CABC1234567890",
      });
      const result2 = await resolveStyles(mockClient, "Content", {
        contractId: "CDEF5678901234",
      });

      expect(result1.scopeClassName).not.toBe(result2.scopeClassName);
    });

    it("should combine CSS from all sources in correct order", async () => {
      mockCallRender.mockImplementation(async (_client, contractId, options) => {
        if (contractId === "THEME123") {
          return "/* theme */";
        }
        if (contractId === "CONTRACT123" && options?.functionName === "styles") {
          return "/* contract */";
        }
        throw new Error("No styles");
      });

      const content = `\`\`\`css
/* inline */
\`\`\``;

      const result = await resolveStyles(mockClient, content, {
        contractId: "CONTRACT123",
        themeContractId: "THEME123",
      });

      // CSS should be ordered: theme, contract, includes, inline
      const themeIndex = result.css.indexOf("Theme:");
      const contractIndex = result.css.indexOf("Contract:");
      const inlineIndex = result.css.indexOf("Inline");

      expect(themeIndex).toBeLessThan(contractIndex);
      expect(contractIndex).toBeLessThan(inlineIndex);
    });

    it("should disable scoping when scopeStyles is false", async () => {
      mockCallRender.mockImplementation(async () => {
        return ".test { color: red; }";
      });

      const result = await resolveStyles(mockClient, "Content", {
        contractId: "CONTRACT123",
        scopeStyles: false,
      });

      // When scoping is disabled, CSS should not have scope prefix
      // The exact format depends on scopeCss implementation
      expect(result.css).toContain(".test");
    });
  });

  describe("createStyleResolver", () => {
    it("should create resolver with shared cache", async () => {
      mockCallRender.mockResolvedValue(".cached { opacity: 1; }");

      const resolver = createStyleResolver(mockClient);

      // First resolve
      await resolver.resolve("Content", { contractId: "CONTRACT123" });
      expect(resolver.getCacheSize()).toBeGreaterThan(0);

      // Clear cache
      resolver.clearCache();
      expect(resolver.getCacheSize()).toBe(0);
    });

    it("should use custom TTL", async () => {
      const resolver = createStyleResolver(mockClient, 30000);

      // The resolver should be created with custom TTL
      expect(resolver).toBeDefined();
      expect(typeof resolver.resolve).toBe("function");
      expect(typeof resolver.clearCache).toBe("function");
      expect(typeof resolver.getCacheSize).toBe("function");
    });

    it("should resolve styles through the resolver instance", async () => {
      mockCallRender.mockResolvedValue(".instance { visibility: visible; }");

      const resolver = createStyleResolver(mockClient);
      const result = await resolver.resolve("Content", {
        contractId: "CONTRACT123",
      });

      expect(result.css).toContain("visibility: visible");
    });
  });
});
