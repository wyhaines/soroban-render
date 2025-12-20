import { describe, it, expect } from "vitest";
import { parseMarkdown, detectFormat } from "./markdown";

describe("parseMarkdown", () => {
  it("should parse basic markdown to HTML", async () => {
    const html = await parseMarkdown("# Hello World");
    expect(html).toContain("<h1>");
    expect(html).toContain("Hello World");
  });

  it("should parse paragraphs", async () => {
    const html = await parseMarkdown("This is a paragraph.");
    expect(html).toContain("<p>This is a paragraph.</p>");
  });

  it("should parse bold text", async () => {
    const html = await parseMarkdown("**bold text**");
    expect(html).toContain("<strong>bold text</strong>");
  });

  it("should parse italic text", async () => {
    const html = await parseMarkdown("*italic text*");
    expect(html).toContain("<em>italic text</em>");
  });

  it("should parse strikethrough text", async () => {
    const html = await parseMarkdown("~~deleted~~");
    expect(html).toContain("<del>deleted</del>");
  });

  it("should parse unordered lists", async () => {
    const html = await parseMarkdown("- item 1\n- item 2");
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>item 1</li>");
    expect(html).toContain("<li>item 2</li>");
  });

  it("should parse ordered lists", async () => {
    const html = await parseMarkdown("1. first\n2. second");
    expect(html).toContain("<ol>");
    expect(html).toContain("<li>first</li>");
    expect(html).toContain("<li>second</li>");
  });

  it("should parse standard links", async () => {
    const html = await parseMarkdown("[Link](https://example.com)");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain(">Link</a>");
  });

  it("should parse code blocks", async () => {
    const html = await parseMarkdown("```\ncode here\n```");
    expect(html).toContain("<pre>");
    expect(html).toContain("<code>");
    expect(html).toContain("code here");
  });

  it("should parse inline code", async () => {
    const html = await parseMarkdown("Use `code` here");
    expect(html).toContain("<code>code</code>");
  });

  it("should parse horizontal rules", async () => {
    const html = await parseMarkdown("---");
    expect(html).toContain("<hr");
  });

  it("should parse blockquotes", async () => {
    const html = await parseMarkdown("> quoted text");
    expect(html).toContain("<blockquote>");
    expect(html).toContain("quoted text");
  });

  describe("custom protocols", () => {
    it("should convert render: links to data-action", async () => {
      const html = await parseMarkdown("[View](render:/tasks)");
      expect(html).toContain('data-action="render:/tasks"');
      expect(html).toContain('href="#"');
      expect(html).toContain('class="soroban-action"');
    });

    it("should convert tx: links to data-action", async () => {
      const html = await parseMarkdown('[Submit](tx:add_task {"name":"test"})');
      expect(html).toContain("data-action=");
      expect(html).toContain("tx:add_task");
      expect(html).toContain('href="#"');
    });

    it("should convert form: links to data-action", async () => {
      const html = await parseMarkdown("[Submit](form:create)");
      expect(html).toContain('data-action="form:create"');
      expect(html).toContain('href="#"');
    });

    it("should handle render: with function name", async () => {
      const html = await parseMarkdown("[Header](render:header)");
      expect(html).toContain('data-action="render:header"');
    });

    it("should handle render: with empty path", async () => {
      const html = await parseMarkdown("[Home](render:/)");
      expect(html).toContain('data-action="render:/"');
    });
  });

  describe("form elements", () => {
    it("should preserve input elements", async () => {
      const html = await parseMarkdown('<input name="test" type="text" />');
      expect(html).toContain('<input name="test" type="text"');
    });

    it("should preserve select elements", async () => {
      const html = await parseMarkdown(
        '<select name="choice"><option value="a">A</option></select>'
      );
      expect(html).toContain("<select");
      expect(html).toContain("<option");
    });

    it("should preserve textarea elements", async () => {
      const html = await parseMarkdown('<textarea name="content"></textarea>');
      expect(html).toContain("<textarea");
    });

    it("should preserve placeholder attribute", async () => {
      const html = await parseMarkdown(
        '<input name="task" placeholder="Enter task" />'
      );
      expect(html).toContain('placeholder="Enter task"');
    });

    it("should preserve required attribute", async () => {
      const html = await parseMarkdown('<input name="email" required />');
      expect(html).toContain("required");
    });
  });

  describe("sanitization", () => {
    it("should remove script tags", async () => {
      const html = await parseMarkdown("<script>alert('xss')</script>");
      expect(html).not.toContain("<script>");
      expect(html).not.toContain("alert");
    });

    it("should remove style tags", async () => {
      const html = await parseMarkdown("<style>body{color:red}</style>");
      expect(html).not.toContain("<style>");
    });

    it("should remove iframe tags", async () => {
      const html = await parseMarkdown('<iframe src="evil.com"></iframe>');
      expect(html).not.toContain("<iframe>");
    });

    it("should remove form tags (but keep inputs)", async () => {
      const html = await parseMarkdown(
        '<form action="/"><input name="x" /></form>'
      );
      expect(html).not.toContain("<form");
      // Input should be preserved
      expect(html).toContain("<input");
    });
  });

  describe("GFM features", () => {
    it("should parse task list items", async () => {
      const html = await parseMarkdown("- [ ] unchecked\n- [x] checked");
      expect(html).toContain('type="checkbox"');
      expect(html).toContain("unchecked");
      expect(html).toContain("checked");
    });

    it("should parse tables", async () => {
      const markdown = `
| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
      `;
      const html = await parseMarkdown(markdown);
      expect(html).toContain("<table>");
      expect(html).toContain("<th>");
      expect(html).toContain("<td>");
    });
  });
});

describe("detectFormat", () => {
  it("should detect markdown content", () => {
    expect(detectFormat("# Hello")).toBe("markdown");
    expect(detectFormat("Regular text")).toBe("markdown");
    expect(detectFormat("- list item")).toBe("markdown");
  });

  it("should detect soroban-render-json format", () => {
    const json = JSON.stringify({
      format: "soroban-render-json-v1",
      components: [],
    });
    expect(detectFormat(json)).toBe("json");
  });

  it("should return unknown for non-soroban JSON", () => {
    const json = JSON.stringify({ foo: "bar" });
    expect(detectFormat(json)).toBe("unknown");
  });

  it("should handle malformed JSON as markdown", () => {
    expect(detectFormat("{not valid json")).toBe("markdown");
  });

  it("should handle empty string", () => {
    expect(detectFormat("")).toBe("markdown");
  });

  it("should handle whitespace-only", () => {
    expect(detectFormat("   \n\t  ")).toBe("markdown");
  });

  it("should detect JSON arrays as unknown", () => {
    expect(detectFormat("[1, 2, 3]")).toBe("unknown");
  });

  it("should handle JSON with format prefix", () => {
    const json = JSON.stringify({
      format: "soroban-render-json-v2",
      components: [],
    });
    expect(detectFormat(json)).toBe("json");
  });
});
