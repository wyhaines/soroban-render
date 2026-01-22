import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { parseErrors, hasErrorTags } from "./errors";

describe("parseErrors", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("should parse error mappings from JSON format", () => {
    const content = '{{errors {"1": "Board is read-only", "7": "Flair required"}}}';
    const result = parseErrors(content);

    expect(result.errorMappings["1"]).toBe("Board is read-only");
    expect(result.errorMappings["7"]).toBe("Flair required");
    expect(result.errorTags).toHaveLength(1);
  });

  it("should parse multiple error tags", () => {
    const content = `
      {{errors {"1": "Error one"}}}
      Some content here
      {{errors {"2": "Error two"}}}
    `;
    const result = parseErrors(content);

    expect(result.errorMappings["1"]).toBe("Error one");
    expect(result.errorMappings["2"]).toBe("Error two");
    expect(result.errorTags).toHaveLength(2);
  });

  it("should merge error mappings with later values overriding earlier ones", () => {
    const content = `
      {{errors {"1": "First message"}}}
      {{errors {"1": "Second message"}}}
    `;
    const result = parseErrors(content);

    expect(result.errorMappings["1"]).toBe("Second message");
  });

  it("should remove error tags from content", () => {
    const content = 'before{{errors {"1": "Error"}}}after';
    const result = parseErrors(content);

    expect(result.content).toBe("beforeafter");
    expect(result.content).not.toContain("{{errors");
  });

  it("should preserve surrounding content", () => {
    const content = `# Header

{{errors {"1": "Error message"}}}

Some text here`;
    const result = parseErrors(content);

    expect(result.content).toContain("# Header");
    expect(result.content).toContain("Some text here");
    expect(result.content).not.toContain("{{errors");
  });

  it("should return empty mappings for content without error tags", () => {
    const content = "Just some regular markdown content";
    const result = parseErrors(content);

    expect(result.errorMappings).toEqual({});
    expect(result.errorTags).toHaveLength(0);
    expect(result.content).toBe(content);
  });

  it("should handle empty content", () => {
    const result = parseErrors("");

    expect(result.errorMappings).toEqual({});
    expect(result.errorTags).toHaveLength(0);
    expect(result.content).toBe("");
  });

  it("should preserve start and end indices", () => {
    const content = 'prefix{{errors {"1": "E"}}}suffix';
    const result = parseErrors(content);

    expect(result.errorTags).toHaveLength(1);
    expect(result.errorTags[0].startIndex).toBe(6);
    expect(result.errorTags[0].original).toBe('{{errors {"1": "E"}}}');
  });

  it("should work correctly when called multiple times", () => {
    const content = '{{errors {"1": "Error"}}}';

    // Call twice to ensure regex state is reset properly
    const result1 = parseErrors(content);
    const result2 = parseErrors(content);

    expect(result1.errorTags).toHaveLength(1);
    expect(result2.errorTags).toHaveLength(1);
  });

  it("should skip invalid JSON and warn", () => {
    const content = "{{errors {not valid json}}}";
    const result = parseErrors(content);

    expect(result.errorTags).toHaveLength(0);
    expect(result.errorMappings).toEqual({});
    expect(warnSpy).toHaveBeenCalledWith(
      "Invalid JSON in {{errors ...}} tag:",
      "{not valid json}"
    );
  });

  it("should handle error tags case-insensitively", () => {
    const content = '{{ERRORS {"1": "Error"}}}';
    const result = parseErrors(content);

    expect(result.errorMappings["1"]).toBe("Error");
  });

  it("should handle multiple error codes in single tag", () => {
    const content =
      '{{errors {"1": "Error 1", "2": "Error 2", "100": "Error 100"}}}';
    const result = parseErrors(content);

    expect(result.errorMappings["1"]).toBe("Error 1");
    expect(result.errorMappings["2"]).toBe("Error 2");
    expect(result.errorMappings["100"]).toBe("Error 100");
    expect(result.errorTags).toHaveLength(1);
  });

  it("should handle error messages with special characters", () => {
    const content =
      '{{errors {"1": "Error: something \\"quoted\\" happened!"}}}';
    const result = parseErrors(content);

    expect(result.errorMappings["1"]).toBe(
      'Error: something "quoted" happened!'
    );
  });

  it("should handle numeric error codes", () => {
    const content = '{{errors {"0": "Zero error", "999": "Max error"}}}';
    const result = parseErrors(content);

    expect(result.errorMappings["0"]).toBe("Zero error");
    expect(result.errorMappings["999"]).toBe("Max error");
  });
});

describe("hasErrorTags", () => {
  it("should return true when content has error tags", () => {
    expect(hasErrorTags('text {{errors {"1": "E"}}} more')).toBe(true);
  });

  it("should return false when content has no error tags", () => {
    expect(hasErrorTags("just regular text")).toBe(false);
  });

  it("should return false for empty string", () => {
    expect(hasErrorTags("")).toBe(false);
  });

  it("should return false for partial/malformed error tags", () => {
    expect(hasErrorTags("{{errors")).toBe(false);
    expect(hasErrorTags('errors {"1": "E"}}}' )).toBe(false);
  });

  it("should work correctly when called multiple times", () => {
    const content = '{{errors {"1": "E"}}}';

    // Call twice to ensure regex state is reset properly
    expect(hasErrorTags(content)).toBe(true);
    expect(hasErrorTags(content)).toBe(true);
  });

  it("should be case-insensitive", () => {
    expect(hasErrorTags('{{ERRORS {"1": "E"}}}')).toBe(true);
    expect(hasErrorTags('{{Errors {"1": "E"}}}')).toBe(true);
  });
});
