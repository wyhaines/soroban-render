import { describe, it, expect } from "vitest";
import {
  parseStyles,
  hasStyleTags,
  hasCssBlocks,
  createStyleKey,
  removeCssBlocks,
  extractInlineCss,
} from "./style";

describe("parseStyles", () => {
  it("extracts style tags from content", () => {
    const content = `{{style contract=CABCD123 func="dark"}}

# Hello

Some content`;

    const result = parseStyles(content);

    expect(result.styleTags).toHaveLength(1);
    expect(result.styleTags[0].contract).toBe("CABCD123");
    expect(result.styleTags[0].func).toBe("dark");
    expect(result.content).not.toContain("{{style");
  });

  it("handles style tags without func attribute", () => {
    const content = `{{style contract=CABCD123}}`;

    const result = parseStyles(content);

    expect(result.styleTags).toHaveLength(1);
    expect(result.styleTags[0].contract).toBe("CABCD123");
    expect(result.styleTags[0].func).toBeUndefined();
  });

  it("handles SELF keyword for contract", () => {
    const content = `{{style contract=SELF func="base"}}`;

    const result = parseStyles(content);

    expect(result.styleTags[0].contract).toBe("SELF");
  });

  it("extracts CSS blocks from markdown", () => {
    const content = `# Title

\`\`\`css
.my-class { color: blue; }
\`\`\`

Some text`;

    const result = parseStyles(content);

    expect(result.cssBlocks).toHaveLength(1);
    expect(result.cssBlocks[0].css).toBe(".my-class { color: blue; }");
  });

  it("handles multiple style tags and CSS blocks", () => {
    const content = `{{style contract=THEME1}}
{{style contract=THEME2 func="dark"}}

\`\`\`css
h1 { color: red; }
\`\`\`

\`\`\`css
p { margin: 0; }
\`\`\``;

    const result = parseStyles(content);

    expect(result.styleTags).toHaveLength(2);
    expect(result.cssBlocks).toHaveLength(2);
  });

  it("removes style tags from content but keeps CSS blocks", () => {
    const content = `{{style contract=CA123}}

\`\`\`css
h1 { color: blue; }
\`\`\``;

    const result = parseStyles(content);

    expect(result.content).not.toContain("{{style");
    expect(result.content).toContain("```css");
  });

  it("skips style tags without contract attribute", () => {
    const content = `{{style func="dark"}}`;

    const result = parseStyles(content);

    expect(result.styleTags).toHaveLength(0);
  });

  it("handles quoted attribute values", () => {
    const content = `{{style contract="CABCD123" func='dark'}}`;

    const result = parseStyles(content);

    expect(result.styleTags[0].contract).toBe("CABCD123");
    expect(result.styleTags[0].func).toBe("dark");
  });
});

describe("hasStyleTags", () => {
  it("returns true when content has style tags", () => {
    expect(hasStyleTags("{{style contract=CA123}}")).toBe(true);
  });

  it("returns false when content has no style tags", () => {
    expect(hasStyleTags("# Just markdown")).toBe(false);
  });
});

describe("hasCssBlocks", () => {
  it("returns true when content has CSS blocks", () => {
    expect(hasCssBlocks("```css\n.foo {}\n```")).toBe(true);
  });

  it("returns false when content has no CSS blocks", () => {
    expect(hasCssBlocks("```js\nconst x = 1;\n```")).toBe(false);
  });
});

describe("createStyleKey", () => {
  it("creates key with function name", () => {
    expect(createStyleKey("CABCD123", "dark")).toBe("style:CABCD123:dark");
  });

  it("creates key without function name", () => {
    expect(createStyleKey("CABCD123")).toBe("style:CABCD123:styles");
  });
});

describe("removeCssBlocks", () => {
  it("removes CSS blocks from content", () => {
    const content = `# Title

\`\`\`css
.foo { color: red; }
\`\`\`

More text`;

    const result = removeCssBlocks(content);

    expect(result).not.toContain("```css");
    expect(result).not.toContain(".foo");
    expect(result).toContain("# Title");
    expect(result).toContain("More text");
  });
});

describe("extractInlineCss", () => {
  it("extracts CSS from blocks", () => {
    const content = `\`\`\`css
.foo { color: red; }
\`\`\`

\`\`\`css
.bar { color: blue; }
\`\`\``;

    const result = extractInlineCss(content);

    expect(result).toContain(".foo { color: red; }");
    expect(result).toContain(".bar { color: blue; }");
  });

  it("returns empty string when no CSS blocks", () => {
    expect(extractInlineCss("# Just markdown")).toBe("");
  });
});
