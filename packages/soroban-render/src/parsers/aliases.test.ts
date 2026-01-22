import { describe, it, expect } from "vitest";
import { parseAliases, hasAliasTags, resolveAlias } from "./aliases";

describe("parseAliases", () => {
  it("should parse key=value format aliases", () => {
    const content =
      "{{aliases config=CCOBK123 registry=CCDBT456}}";
    const result = parseAliases(content);

    expect(result.aliases.config).toBe("CCOBK123");
    expect(result.aliases.registry).toBe("CCDBT456");
    expect(result.aliasTags).toHaveLength(1);
  });

  it("should attempt JSON format but regex limitation prevents proper parsing", () => {
    // Note: Due to regex limitation with [^}]+ not matching braces,
    // JSON format like '{{aliases {"key":"value"}}}' won't fully parse.
    // The regex captures everything up to the first }, truncating JSON.
    // Key=value format is the reliable way to define aliases.
    const content = '{{aliases {"config":"CCOBK123"}}}';
    const result = parseAliases(content);

    // JSON parsing fails because captured string is incomplete
    // Falls back to key=value parsing which also fails for JSON syntax
    expect(result.aliasTags).toHaveLength(0);
    expect(result.aliases).toEqual({});
  });

  it("should handle double-quoted values", () => {
    const content = '{{aliases config="CCOBK123" registry="CCDBT456"}}';
    const result = parseAliases(content);

    expect(result.aliases.config).toBe("CCOBK123");
    expect(result.aliases.registry).toBe("CCDBT456");
  });

  it("should handle single-quoted values", () => {
    const content = "{{aliases config='CCOBK123' registry='CCDBT456'}}";
    const result = parseAliases(content);

    expect(result.aliases.config).toBe("CCOBK123");
    expect(result.aliases.registry).toBe("CCDBT456");
  });

  it("should handle mixed quote styles", () => {
    const content = `{{aliases config="CCOBK123" registry='CCDBT456' pages=CDJG789}}`;
    const result = parseAliases(content);

    expect(result.aliases.config).toBe("CCOBK123");
    expect(result.aliases.registry).toBe("CCDBT456");
    expect(result.aliases.pages).toBe("CDJG789");
  });

  it("should parse multiple alias tags", () => {
    const content = `
      {{aliases config=CCOBK123}}
      Some content here
      {{aliases registry=CCDBT456}}
    `;
    const result = parseAliases(content);

    expect(result.aliases.config).toBe("CCOBK123");
    expect(result.aliases.registry).toBe("CCDBT456");
    expect(result.aliasTags).toHaveLength(2);
  });

  it("should merge aliases with later values overriding earlier ones", () => {
    const content = `
      {{aliases config=FIRST}}
      {{aliases config=SECOND}}
    `;
    const result = parseAliases(content);

    expect(result.aliases.config).toBe("SECOND");
  });

  it("should remove alias tags from content", () => {
    const content = "before{{aliases config=ABC}}after";
    const result = parseAliases(content);

    expect(result.content).toBe("beforeafter");
    expect(result.content).not.toContain("{{aliases");
  });

  it("should preserve surrounding content", () => {
    const content = `# Header

{{aliases config=ABC}}

Some text here`;
    const result = parseAliases(content);

    expect(result.content).toContain("# Header");
    expect(result.content).toContain("Some text here");
    expect(result.content).not.toContain("{{aliases");
  });

  it("should return empty aliases for content without alias tags", () => {
    const content = "Just some regular markdown content";
    const result = parseAliases(content);

    expect(result.aliases).toEqual({});
    expect(result.aliasTags).toHaveLength(0);
    expect(result.content).toBe(content);
  });

  it("should handle empty content", () => {
    const result = parseAliases("");

    expect(result.aliases).toEqual({});
    expect(result.aliasTags).toHaveLength(0);
    expect(result.content).toBe("");
  });

  it("should preserve start and end indices", () => {
    const content = "prefix{{aliases key=VAL}}suffix";
    const result = parseAliases(content);

    expect(result.aliasTags).toHaveLength(1);
    expect(result.aliasTags[0].startIndex).toBe(6);
    expect(result.aliasTags[0].endIndex).toBe(25);
    expect(result.aliasTags[0].original).toBe("{{aliases key=VAL}}");
  });

  it("should work correctly when called multiple times", () => {
    const content = "{{aliases config=ABC}}";

    // Call twice to ensure regex state is reset properly
    const result1 = parseAliases(content);
    const result2 = parseAliases(content);

    expect(result1.aliasTags).toHaveLength(1);
    expect(result2.aliasTags).toHaveLength(1);
  });

  it("should skip malformed JSON when it starts with brace", () => {
    // When content starts with {, it tries JSON parsing first
    // Invalid JSON will fail, but the regex truncates at first }
    // so "config=ABC" is outside the capture
    const content = "{{aliases {invalid} config=ABC}}";
    const result = parseAliases(content);

    // The regex [^}]+ stops at first }, so captures "{invalid"
    // JSON.parse fails, then key=value parse of "{invalid" yields nothing
    expect(result.aliases).toEqual({});
  });

  it("should parse key=value format when not starting with brace", () => {
    // If content doesn't start with {, key=value parsing is used
    const content = "{{aliases config=ABC theme=DEF}}";
    const result = parseAliases(content);

    expect(result.aliases.config).toBe("ABC");
    expect(result.aliases.theme).toBe("DEF");
  });

  it("should skip alias tags with no valid mappings", () => {
    const content = "{{aliases }}";
    const result = parseAliases(content);

    expect(result.aliasTags).toHaveLength(0);
    expect(result.aliases).toEqual({});
  });

  it("should handle alias tags case-insensitively", () => {
    const content = "{{ALIASES config=ABC}}";
    const result = parseAliases(content);

    expect(result.aliases.config).toBe("ABC");
  });

  it("should handle full contract IDs as values", () => {
    const content =
      "{{aliases theme=CCOBKFEZERN3SSZBFAZY5A6M2WPLVDLKPAWU7IEUQU35VMA6VKHXA62C}}";
    const result = parseAliases(content);

    expect(result.aliases.theme).toBe(
      "CCOBKFEZERN3SSZBFAZY5A6M2WPLVDLKPAWU7IEUQU35VMA6VKHXA62C"
    );
  });
});

describe("hasAliasTags", () => {
  it("should return true when content has alias tags", () => {
    expect(hasAliasTags("text {{aliases config=ABC}} more")).toBe(true);
  });

  it("should return false when content has no alias tags", () => {
    expect(hasAliasTags("just regular text")).toBe(false);
  });

  it("should return false for empty string", () => {
    expect(hasAliasTags("")).toBe(false);
  });

  it("should return false for partial/malformed alias tags", () => {
    expect(hasAliasTags("{{aliases")).toBe(false);
    expect(hasAliasTags("aliases config=ABC}}")).toBe(false);
  });

  it("should work correctly when called multiple times", () => {
    const content = "{{aliases config=ABC}}";

    // Call twice to ensure regex state is reset properly
    expect(hasAliasTags(content)).toBe(true);
    expect(hasAliasTags(content)).toBe(true);
  });

  it("should be case-insensitive", () => {
    expect(hasAliasTags("{{ALIASES config=ABC}}")).toBe(true);
    expect(hasAliasTags("{{Aliases config=ABC}}")).toBe(true);
  });
});

describe("resolveAlias", () => {
  const aliases = {
    config: "CCOBK123",
    registry: "CCDBT456",
    theme: "CDJG789",
  };

  it("should resolve known alias to contract ID", () => {
    expect(resolveAlias("config", aliases)).toBe("CCOBK123");
    expect(resolveAlias("registry", aliases)).toBe("CCDBT456");
    expect(resolveAlias("theme", aliases)).toBe("CDJG789");
  });

  it("should return original value for unknown alias", () => {
    expect(resolveAlias("unknown", aliases)).toBe("unknown");
  });

  it("should return original value when it looks like a contract ID", () => {
    expect(resolveAlias("CABC123", aliases)).toBe("CABC123");
  });

  it("should handle empty aliases object", () => {
    expect(resolveAlias("config", {})).toBe("config");
  });

  it("should handle empty alias string", () => {
    expect(resolveAlias("", aliases)).toBe("");
  });
});
