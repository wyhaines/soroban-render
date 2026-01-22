import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { parseMeta, hasMetaTags, applyMetaToDocument } from "./meta";
import { JSDOM } from "jsdom";

describe("parseMeta", () => {
  it("should parse meta tags with name then content attribute order", () => {
    const content = '<meta name="title" content="My Site" />';
    const result = parseMeta(content);

    expect(result.meta.title).toBe("My Site");
    expect(result.metaTags).toHaveLength(1);
  });

  it("should parse meta tags with content then name attribute order", () => {
    const content = '<meta content="My Site" name="title" />';
    const result = parseMeta(content);

    expect(result.meta.title).toBe("My Site");
    expect(result.metaTags).toHaveLength(1);
  });

  it("should parse self-closing meta tags", () => {
    const content = '<meta name="favicon" content="https://example.com/favicon.png" />';
    const result = parseMeta(content);

    expect(result.meta.favicon).toBe("https://example.com/favicon.png");
  });

  it("should parse non-self-closing meta tags", () => {
    const content = '<meta name="description" content="A description">';
    const result = parseMeta(content);

    expect(result.meta.description).toBe("A description");
  });

  it("should parse multiple meta tags", () => {
    const content = `
      <meta name="title" content="My Site" />
      <meta name="favicon" content="https://example.com/favicon.png" />
      <meta name="theme-color" content="#7857e1" />
      <meta name="description" content="Site description" />
    `;
    const result = parseMeta(content);

    expect(result.meta.title).toBe("My Site");
    expect(result.meta.favicon).toBe("https://example.com/favicon.png");
    expect(result.meta["theme-color"]).toBe("#7857e1");
    expect(result.meta.description).toBe("Site description");
    expect(result.metaTags).toHaveLength(4);
  });

  it("should handle meta tags with later values overriding earlier ones", () => {
    const content = `
      <meta name="title" content="First Title" />
      <meta name="title" content="Second Title" />
    `;
    const result = parseMeta(content);

    expect(result.meta.title).toBe("Second Title");
  });

  it("should remove meta tags from content", () => {
    const content = 'before<meta name="title" content="Title" />after';
    const result = parseMeta(content);

    expect(result.content).toBe("beforeafter");
    expect(result.content).not.toContain("<meta");
  });

  it("should preserve surrounding content", () => {
    const content = `# Header

<meta name="title" content="My Site" />

Some text here`;
    const result = parseMeta(content);

    expect(result.content).toContain("# Header");
    expect(result.content).toContain("Some text here");
    expect(result.content).not.toContain("<meta");
  });

  it("should return empty meta for content without meta tags", () => {
    const content = "Just some regular markdown content";
    const result = parseMeta(content);

    expect(result.meta).toEqual({});
    expect(result.metaTags).toHaveLength(0);
    expect(result.content).toBe(content);
  });

  it("should handle empty content", () => {
    const result = parseMeta("");

    expect(result.meta).toEqual({});
    expect(result.metaTags).toHaveLength(0);
    expect(result.content).toBe("");
  });

  it("should preserve start and end indices", () => {
    const content = 'prefix<meta name="k" content="v" />suffix';
    const result = parseMeta(content);

    expect(result.metaTags).toHaveLength(1);
    expect(result.metaTags[0].startIndex).toBe(6);
    expect(result.metaTags[0].original).toBe('<meta name="k" content="v" />');
  });

  it("should work correctly when called multiple times", () => {
    const content = '<meta name="title" content="Test" />';

    // Call twice to ensure regex state is reset properly
    const result1 = parseMeta(content);
    const result2 = parseMeta(content);

    expect(result1.metaTags).toHaveLength(1);
    expect(result2.metaTags).toHaveLength(1);
  });

  it("should handle single quotes in attributes", () => {
    const content = "<meta name='title' content='My Site' />";
    const result = parseMeta(content);

    expect(result.meta.title).toBe("My Site");
  });

  it("should skip meta tags with missing name or content", () => {
    const content1 = '<meta name="title" />';
    const content2 = '<meta content="value" />';

    const result1 = parseMeta(content1);
    const result2 = parseMeta(content2);

    expect(result1.metaTags).toHaveLength(0);
    expect(result2.metaTags).toHaveLength(0);
  });

  it("should handle meta tag names with hyphens", () => {
    const content = '<meta name="theme-color" content="#ffffff" />';
    const result = parseMeta(content);

    expect(result.meta["theme-color"]).toBe("#ffffff");
  });

  it("should capture name and content in metaTags", () => {
    const content = '<meta name="title" content="Test Title" />';
    const result = parseMeta(content);

    expect(result.metaTags[0].name).toBe("title");
    expect(result.metaTags[0].content).toBe("Test Title");
  });
});

describe("hasMetaTags", () => {
  it("should return true when content has meta tags", () => {
    expect(hasMetaTags('text <meta name="t" content="v" /> more')).toBe(true);
  });

  it("should return false when content has no meta tags", () => {
    expect(hasMetaTags("just regular text")).toBe(false);
  });

  it("should return false for empty string", () => {
    expect(hasMetaTags("")).toBe(false);
  });

  it("should return false for partial/malformed meta tags", () => {
    expect(hasMetaTags("<meta")).toBe(false);
    expect(hasMetaTags('meta name="t" content="v" />')).toBe(false);
  });

  it("should work correctly when called multiple times", () => {
    const content = '<meta name="t" content="v" />';

    // Call twice to ensure regex state is reset properly
    expect(hasMetaTags(content)).toBe(true);
    expect(hasMetaTags(content)).toBe(true);
  });
});

describe("applyMetaToDocument", () => {
  let dom: JSDOM;
  let originalDocument: Document;

  beforeEach(() => {
    dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>");
    originalDocument = globalThis.document;
    globalThis.document = dom.window.document;
  });

  afterEach(() => {
    globalThis.document = originalDocument;
  });

  it("should apply favicon to document", () => {
    applyMetaToDocument({ favicon: "https://example.com/favicon.png" });

    const faviconLink = document.querySelector(
      'link[rel="icon"]'
    ) as HTMLLinkElement;
    expect(faviconLink).not.toBeNull();
    expect(faviconLink.href).toBe("https://example.com/favicon.png");
  });

  it("should update existing favicon", () => {
    // Create existing favicon
    const existingFavicon = document.createElement("link");
    existingFavicon.rel = "icon";
    existingFavicon.href = "https://old.com/favicon.png";
    document.head.appendChild(existingFavicon);

    applyMetaToDocument({ favicon: "https://new.com/favicon.png" });

    const faviconLinks = document.querySelectorAll('link[rel="icon"]');
    expect(faviconLinks).toHaveLength(1);
    expect((faviconLinks[0] as HTMLLinkElement).href).toBe(
      "https://new.com/favicon.png"
    );
  });

  it("should apply title to document", () => {
    applyMetaToDocument({ title: "My Site Title" });

    expect(document.title).toBe("My Site Title");
  });

  it("should apply theme-color to document", () => {
    applyMetaToDocument({ "theme-color": "#7857e1" });

    const themeMeta = document.querySelector(
      'meta[name="theme-color"]'
    ) as HTMLMetaElement;
    expect(themeMeta).not.toBeNull();
    expect(themeMeta.content).toBe("#7857e1");
  });

  it("should update existing theme-color", () => {
    // Create existing theme-color meta
    const existingMeta = document.createElement("meta");
    existingMeta.name = "theme-color";
    existingMeta.content = "#000000";
    document.head.appendChild(existingMeta);

    applyMetaToDocument({ "theme-color": "#ffffff" });

    const themeMetas = document.querySelectorAll('meta[name="theme-color"]');
    expect(themeMetas).toHaveLength(1);
    expect((themeMetas[0] as HTMLMetaElement).content).toBe("#ffffff");
  });

  it("should apply description to document", () => {
    applyMetaToDocument({ description: "Site description here" });

    const descMeta = document.querySelector(
      'meta[name="description"]'
    ) as HTMLMetaElement;
    expect(descMeta).not.toBeNull();
    expect(descMeta.content).toBe("Site description here");
  });

  it("should update existing description", () => {
    // Create existing description meta
    const existingMeta = document.createElement("meta");
    existingMeta.name = "description";
    existingMeta.content = "Old description";
    document.head.appendChild(existingMeta);

    applyMetaToDocument({ description: "New description" });

    const descMetas = document.querySelectorAll('meta[name="description"]');
    expect(descMetas).toHaveLength(1);
    expect((descMetas[0] as HTMLMetaElement).content).toBe("New description");
  });

  it("should apply multiple meta values at once", () => {
    applyMetaToDocument({
      title: "My Site",
      favicon: "https://example.com/favicon.png",
      "theme-color": "#123456",
      description: "A great site",
    });

    expect(document.title).toBe("My Site");
    expect(
      (document.querySelector('link[rel="icon"]') as HTMLLinkElement).href
    ).toBe("https://example.com/favicon.png");
    expect(
      (document.querySelector('meta[name="theme-color"]') as HTMLMetaElement)
        .content
    ).toBe("#123456");
    expect(
      (document.querySelector('meta[name="description"]') as HTMLMetaElement)
        .content
    ).toBe("A great site");
  });

  it("should not modify document for empty meta object", () => {
    const headBefore = document.head.innerHTML;

    applyMetaToDocument({});

    expect(document.head.innerHTML).toBe(headBefore);
  });

  it("should only apply provided meta values", () => {
    applyMetaToDocument({ title: "Just Title" });

    expect(document.title).toBe("Just Title");
    expect(document.querySelector('link[rel="icon"]')).toBeNull();
    expect(document.querySelector('meta[name="theme-color"]')).toBeNull();
    expect(document.querySelector('meta[name="description"]')).toBeNull();
  });
});
