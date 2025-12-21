import { describe, it, expect } from "vitest";
import {
  sanitizeCss,
  scopeCss,
  validateCss,
  combineCss,
  createScopeClassName,
} from "./cssSanitizer";

describe("sanitizeCss", () => {
  describe("blocking dangerous patterns", () => {
    it("blocks url() with http URLs", () => {
      const css = "background: url(http://evil.com/img.png);";
      const result = sanitizeCss(css);
      expect(result).toContain("/* blocked */");
      expect(result).not.toContain("http://evil.com");
    });

    it("blocks url() with https URLs", () => {
      const css = "background: url(https://evil.com/img.png);";
      const result = sanitizeCss(css);
      expect(result).toContain("/* blocked */");
    });

    it("blocks url() with protocol-relative URLs", () => {
      const css = "background: url(//evil.com/img.png);";
      const result = sanitizeCss(css);
      expect(result).toContain("/* blocked */");
    });

    it("blocks @import with external URLs", () => {
      const css = '@import "https://evil.com/styles.css";';
      const result = sanitizeCss(css);
      expect(result).toContain("/* blocked */");
    });

    it("blocks @import url() with external URLs", () => {
      const css = "@import url(https://evil.com/styles.css);";
      const result = sanitizeCss(css);
      expect(result).toContain("/* blocked */");
    });

    it("blocks javascript: URLs", () => {
      const css = "background: url(javascript:alert(1));";
      const result = sanitizeCss(css);
      expect(result).toContain("/* blocked */");
    });

    it("blocks expression() (IE exploit)", () => {
      const css = "width: expression(alert(1));";
      const result = sanitizeCss(css);
      expect(result).toContain("/* blocked */");
    });

    it("blocks behavior: property (IE exploit)", () => {
      const css = ".foo { behavior: url(evil.htc); }";
      const result = sanitizeCss(css);
      expect(result).toContain("/* blocked */");
    });

    it("blocks -moz-binding (Firefox exploit)", () => {
      const css = ".foo { -moz-binding: url(evil.xml); }";
      const result = sanitizeCss(css);
      expect(result).toContain("/* blocked */");
    });
  });

  describe("allowing safe patterns", () => {
    it("allows normal CSS rules", () => {
      const css = "h1 { color: blue; font-size: 2rem; }";
      const result = sanitizeCss(css);
      expect(result).toBe(css);
    });

    it("allows CSS variables", () => {
      const css = ":root { --primary: #0066cc; }";
      const result = sanitizeCss(css);
      expect(result).toBe(css);
    });

    it("allows local fragment references", () => {
      const css = "fill: url(#gradient);";
      const result = sanitizeCss(css);
      expect(result).toBe(css);
    });

    it("allows small data URLs for images", () => {
      const dataUrl =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      const css = `background: url(${dataUrl});`;
      const result = sanitizeCss(css);
      expect(result).toContain("data:image/png");
    });
  });

  describe("data URL handling", () => {
    it("blocks data URLs when allowDataUrls is false", () => {
      const css = "background: url(data:image/png;base64,abc);";
      const result = sanitizeCss(css, { allowDataUrls: false });
      expect(result).toContain("/* data url blocked */");
    });

    it("blocks non-image data URLs", () => {
      const css = "background: url(data:text/html;base64,abc);";
      const result = sanitizeCss(css);
      expect(result).toContain("/* non-image data url blocked */");
    });

    it("blocks oversized data URLs", () => {
      const largeData = "x".repeat(50000);
      const css = `background: url(data:image/png;base64,${largeData});`;
      const result = sanitizeCss(css);
      expect(result).toContain("/* data url too large */");
    });
  });
});

describe("scopeCss", () => {
  it("prefixes selectors with scope class", () => {
    const css = "h1 { color: blue; }";
    const result = scopeCss(css, "CABCD123XYZ");
    expect(result).toContain(".soroban-scope-CABCD123 h1");
  });

  it("handles comma-separated selectors", () => {
    const css = "h1, h2, h3 { color: blue; }";
    const result = scopeCss(css, "CABCD123");
    expect(result).toContain(".soroban-scope-CABCD123 h1");
    expect(result).toContain(".soroban-scope-CABCD123 h2");
    expect(result).toContain(".soroban-scope-CABCD123 h3");
  });

  it("converts :root to scope class", () => {
    const css = ":root { --primary: blue; }";
    const result = scopeCss(css, "CABCD123");
    expect(result).toContain(".soroban-scope-CABCD123");
    expect(result).toContain("--primary: blue;");
    expect(result).not.toContain(":root");
  });

  it("does not scope html or body selectors", () => {
    const css = "html { font-size: 16px; } body { margin: 0; }";
    const result = scopeCss(css, "CABCD123");
    // html/body selectors are preserved without scoping
    expect(result).toContain("html");
    expect(result).toContain("body");
    expect(result).toContain("font-size: 16px;");
    expect(result).toContain("margin: 0;");
  });

  it("does not scope @media rules", () => {
    const css = "@media (max-width: 768px) { h1 { font-size: 1.5rem; } }";
    const result = scopeCss(css, "CABCD123");
    expect(result).toContain("@media");
  });

  it("does not scope keyframe percentages", () => {
    const css = "@keyframes fade { 0% { opacity: 0; } 100% { opacity: 1; } }";
    const result = scopeCss(css, "CABCD123");
    // Keyframe percentages are preserved
    expect(result).toContain("0%");
    expect(result).toContain("100%");
    expect(result).toContain("opacity: 0;");
    expect(result).toContain("opacity: 1;");
  });

  it("uses first 8 characters of contract ID", () => {
    const css = "h1 { color: blue; }";
    const result = scopeCss(css, "CABCDEFGHIJKLMNOP");
    expect(result).toContain(".soroban-scope-CABCDEFG");
  });
});

describe("validateCss", () => {
  it("returns valid for balanced braces", () => {
    const css = "h1 { color: blue; } .foo { margin: 0; }";
    const result = validateCss(css);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("returns error for unbalanced opening brace", () => {
    const css = "h1 { color: blue;";
    const result = validateCss(css);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Unbalanced opening brace");
  });

  it("returns error for unbalanced closing brace", () => {
    const css = "h1 color: blue; }";
    const result = validateCss(css);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Unbalanced closing brace");
  });
});

describe("combineCss", () => {
  it("combines multiple CSS strings", () => {
    const result = combineCss(["h1 { color: blue; }", "h2 { color: red; }"]);
    expect(result).toBe("h1 { color: blue; }\n\nh2 { color: red; }");
  });

  it("filters out empty strings", () => {
    const result = combineCss(["h1 { color: blue; }", "", "  ", "h2 { color: red; }"]);
    expect(result).toBe("h1 { color: blue; }\n\nh2 { color: red; }");
  });

  it("returns empty string for empty array", () => {
    expect(combineCss([])).toBe("");
  });
});

describe("createScopeClassName", () => {
  it("creates scope class from contract ID", () => {
    expect(createScopeClassName("CABCD12345678")).toBe("soroban-scope-CABCD123");
  });

  it("handles short contract IDs", () => {
    expect(createScopeClassName("CA")).toBe("soroban-scope-CA");
  });
});
