import { describe, it, expect } from "vitest";
import {
  extractNoparseBlocks,
  restoreNoparseBlocks,
  hasNoparseBlocks,
  wrapNoparse,
} from "./noparse";

describe("extractNoparseBlocks", () => {
  it("should extract single noparse block", () => {
    const content = '{{noparse}}{{include contract=config func="logo"}}{{/noparse}}';
    const result = extractNoparseBlocks(content);

    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].innerContent).toBe(
      '{{include contract=config func="logo"}}'
    );
  });

  it("should replace noparse blocks with placeholders", () => {
    const content =
      '{{noparse}}{{include contract=ABC}}{{/noparse}}';
    const result = extractNoparseBlocks(content);

    expect(result.content).not.toContain("{{noparse}}");
    expect(result.content).not.toContain("{{/noparse}}");
    expect(result.content).toContain("___NOPARSE_BLOCK_");
  });

  it("should extract multiple noparse blocks", () => {
    const content = `
      {{noparse}}Block 1{{/noparse}}
      Some content
      {{noparse}}Block 2{{/noparse}}
    `;
    const result = extractNoparseBlocks(content);

    expect(result.blocks).toHaveLength(2);
    expect(result.blocks[0].innerContent).toBe("Block 1");
    expect(result.blocks[1].innerContent).toBe("Block 2");
  });

  it("should preserve indices correctly", () => {
    const content = "prefix{{noparse}}inner{{/noparse}}suffix";
    const result = extractNoparseBlocks(content);

    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].startIndex).toBe(6);
    // "{{noparse}}inner{{/noparse}}" = 28 chars, so end index = 6 + 28 = 34
    expect(result.blocks[0].endIndex).toBe(34);
    expect(result.blocks[0].original).toBe("{{noparse}}inner{{/noparse}}");
  });

  it("should handle empty noparse blocks", () => {
    const content = "{{noparse}}{{/noparse}}";
    const result = extractNoparseBlocks(content);

    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].innerContent).toBe("");
  });

  it("should return empty blocks for content without noparse", () => {
    const content = "Just some regular content";
    const result = extractNoparseBlocks(content);

    expect(result.blocks).toHaveLength(0);
    expect(result.content).toBe(content);
  });

  it("should handle empty content", () => {
    const result = extractNoparseBlocks("");

    expect(result.blocks).toHaveLength(0);
    expect(result.content).toBe("");
  });

  it("should handle multiline content inside noparse", () => {
    const content = `{{noparse}}
Line 1
Line 2
Line 3
{{/noparse}}`;
    const result = extractNoparseBlocks(content);

    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].innerContent).toContain("Line 1");
    expect(result.blocks[0].innerContent).toContain("Line 2");
    expect(result.blocks[0].innerContent).toContain("Line 3");
  });

  it("should work correctly when called multiple times", () => {
    const content = "{{noparse}}test{{/noparse}}";

    // Call twice to ensure regex state is reset properly
    const result1 = extractNoparseBlocks(content);
    const result2 = extractNoparseBlocks(content);

    expect(result1.blocks).toHaveLength(1);
    expect(result2.blocks).toHaveLength(1);
  });

  it("should use unique placeholder IDs", () => {
    const content = `{{noparse}}First{{/noparse}}{{noparse}}Second{{/noparse}}`;
    const result = extractNoparseBlocks(content);

    expect(result.blocks[0].placeholderId).not.toBe(
      result.blocks[1].placeholderId
    );
  });

  it("should handle case-insensitively", () => {
    const content = "{{NOPARSE}}inner{{/NOPARSE}}";
    const result = extractNoparseBlocks(content);

    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].innerContent).toBe("inner");
  });
});

describe("restoreNoparseBlocks", () => {
  it("should restore single block content", () => {
    const original =
      '{{noparse}}{{include contract=ABC}}{{/noparse}}';
    const extracted = extractNoparseBlocks(original);
    const restored = restoreNoparseBlocks(extracted.content, extracted.blocks);

    // Should restore inner content without noparse tags
    expect(restored).toBe("{{include contract=ABC}}");
    expect(restored).not.toContain("{{noparse}}");
  });

  it("should restore multiple blocks", () => {
    const original = `before{{noparse}}Block1{{/noparse}}middle{{noparse}}Block2{{/noparse}}after`;
    const extracted = extractNoparseBlocks(original);
    const restored = restoreNoparseBlocks(extracted.content, extracted.blocks);

    expect(restored).toBe("beforeBlock1middleBlock2after");
  });

  it("should handle empty blocks array", () => {
    const content = "No placeholders here";
    const result = restoreNoparseBlocks(content, []);

    expect(result).toBe(content);
  });

  it("should restore content in correct positions", () => {
    const original = "{{noparse}}A{{/noparse}}+{{noparse}}B{{/noparse}}";
    const extracted = extractNoparseBlocks(original);
    const restored = restoreNoparseBlocks(extracted.content, extracted.blocks);

    expect(restored).toBe("A+B");
  });

  it("should handle nested include tags in noparse content", () => {
    const includeTag =
      '{{include contract=@main func="nav_include" viewer return_path="@main:/b/1"}}';
    const original = `{{noparse}}${includeTag}{{/noparse}}`;
    const extracted = extractNoparseBlocks(original);
    const restored = restoreNoparseBlocks(extracted.content, extracted.blocks);

    expect(restored).toBe(includeTag);
  });
});

describe("hasNoparseBlocks", () => {
  it("should return true when content has noparse blocks", () => {
    expect(hasNoparseBlocks("text {{noparse}}inner{{/noparse}} more")).toBe(
      true
    );
  });

  it("should return false when content has no noparse blocks", () => {
    expect(hasNoparseBlocks("just regular text")).toBe(false);
  });

  it("should return false for empty string", () => {
    expect(hasNoparseBlocks("")).toBe(false);
  });

  it("should return false for partial/malformed noparse tags", () => {
    expect(hasNoparseBlocks("{{noparse}}")).toBe(false);
    expect(hasNoparseBlocks("{{/noparse}}")).toBe(false);
    expect(hasNoparseBlocks("{{noparse}} without closing")).toBe(false);
  });

  it("should work correctly when called multiple times", () => {
    const content = "{{noparse}}test{{/noparse}}";

    // Call twice to ensure regex state is reset properly
    expect(hasNoparseBlocks(content)).toBe(true);
    expect(hasNoparseBlocks(content)).toBe(true);
  });

  it("should be case-insensitive", () => {
    expect(hasNoparseBlocks("{{NOPARSE}}inner{{/NOPARSE}}")).toBe(true);
    expect(hasNoparseBlocks("{{Noparse}}inner{{/Noparse}}")).toBe(true);
  });
});

describe("wrapNoparse", () => {
  it("should wrap content in noparse tags", () => {
    const content = "{{include contract=ABC}}";
    const wrapped = wrapNoparse(content);

    expect(wrapped).toBe("{{noparse}}{{include contract=ABC}}{{/noparse}}");
  });

  it("should wrap empty string", () => {
    expect(wrapNoparse("")).toBe("{{noparse}}{{/noparse}}");
  });

  it("should wrap multiline content", () => {
    const content = "Line 1\nLine 2\nLine 3";
    const wrapped = wrapNoparse(content);

    expect(wrapped).toBe("{{noparse}}Line 1\nLine 2\nLine 3{{/noparse}}");
  });

  it("should allow extracting wrapped content", () => {
    const original = "some include tag";
    const wrapped = wrapNoparse(original);
    const extracted = extractNoparseBlocks(wrapped);

    expect(extracted.blocks).toHaveLength(1);
    expect(extracted.blocks[0].innerContent).toBe(original);
  });

  it("should preserve content exactly", () => {
    const content = '  spaces   and\ttabs\nand newlines  ';
    const wrapped = wrapNoparse(content);
    const extracted = extractNoparseBlocks(wrapped);

    expect(extracted.blocks[0].innerContent).toBe(content);
  });
});

describe("integration: extract and restore", () => {
  it("should round-trip content correctly", () => {
    const includeContent = '{{include contract=@theme func="styles"}}';
    const original = `# Header

${wrapNoparse(includeContent)}

Some **markdown** content.

${wrapNoparse("{{include contract=@other}}")}

Footer`;

    const extracted = extractNoparseBlocks(original);

    // Verify placeholders are in content
    expect(extracted.content).not.toContain("{{noparse}}");
    expect(extracted.content).toContain("___NOPARSE_BLOCK_");

    // Restore
    const restored = restoreNoparseBlocks(extracted.content, extracted.blocks);

    // Should have include tags without noparse wrappers
    expect(restored).toContain(includeContent);
    expect(restored).toContain("{{include contract=@other}}");
    expect(restored).not.toContain("{{noparse}}");
    expect(restored).not.toContain("___NOPARSE_BLOCK_");
  });

  it("should preserve surrounding content through round-trip", () => {
    const original = "before{{noparse}}protected{{/noparse}}after";
    const extracted = extractNoparseBlocks(original);
    const restored = restoreNoparseBlocks(extracted.content, extracted.blocks);

    expect(restored).toBe("beforeprotectedafter");
  });
});
