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

  describe("alerts/callouts", () => {
    it("should convert NOTE alert", async () => {
      const html = await parseMarkdown("> [!NOTE]\n> This is a note");
      expect(html).toContain('class="soroban-alert soroban-alert-note"');
      expect(html).toContain('class="soroban-alert-title"');
      expect(html).toContain("NOTE");
      expect(html).toContain("This is a note");
    });

    it("should convert WARNING alert", async () => {
      const html = await parseMarkdown("> [!WARNING]\n> Be careful");
      expect(html).toContain('class="soroban-alert soroban-alert-warning"');
      expect(html).toContain("WARNING");
      expect(html).toContain("Be careful");
    });

    it("should convert TIP alert", async () => {
      const html = await parseMarkdown("> [!TIP]\n> Here is a tip");
      expect(html).toContain('class="soroban-alert soroban-alert-tip"');
      expect(html).toContain("TIP");
      expect(html).toContain("Here is a tip");
    });

    it("should convert INFO alert", async () => {
      const html = await parseMarkdown("> [!INFO]\n> Additional info");
      expect(html).toContain('class="soroban-alert soroban-alert-info"');
      expect(html).toContain("INFO");
      expect(html).toContain("Additional info");
    });

    it("should convert CAUTION alert", async () => {
      const html = await parseMarkdown("> [!CAUTION]\n> This cannot be undone");
      expect(html).toContain('class="soroban-alert soroban-alert-caution"');
      expect(html).toContain("CAUTION");
      expect(html).toContain("This cannot be undone");
    });

    it("should handle alert with markdown content", async () => {
      const html = await parseMarkdown("> [!NOTE]\n> This is **bold** and *italic*");
      expect(html).toContain('class="soroban-alert soroban-alert-note"');
      expect(html).toContain("<strong>bold</strong>");
      expect(html).toContain("<em>italic</em>");
    });

    it("should handle multiple alerts", async () => {
      const html = await parseMarkdown(
        "> [!NOTE]\n> First note\n\n> [!WARNING]\n> A warning"
      );
      expect(html).toContain("soroban-alert-note");
      expect(html).toContain("soroban-alert-warning");
      expect(html).toContain("First note");
      expect(html).toContain("A warning");
    });

    it("should preserve regular blockquotes", async () => {
      const html = await parseMarkdown("> Regular quote without alert syntax");
      expect(html).toContain("<blockquote>");
      expect(html).toContain("Regular quote");
      expect(html).not.toContain("soroban-alert");
    });

    it("should handle case-insensitive alert types", async () => {
      const html = await parseMarkdown("> [!note]\n> Lowercase note");
      expect(html).toContain('class="soroban-alert soroban-alert-note"');
      expect(html).toContain("NOTE"); // Title should be uppercase
    });

    it("should handle alert with multiline content", async () => {
      const html = await parseMarkdown(
        "> [!TIP]\n> First line\n> Second line\n> Third line"
      );
      expect(html).toContain("soroban-alert-tip");
      expect(html).toContain("First line");
      expect(html).toContain("Second line");
      expect(html).toContain("Third line");
    });

    it("should handle alert with links", async () => {
      const html = await parseMarkdown(
        "> [!INFO]\n> Check [the docs](https://example.com)"
      );
      expect(html).toContain("soroban-alert-info");
      expect(html).toContain('href="https://example.com"');
      expect(html).toContain("the docs");
    });
  });

  describe("multi-column layouts", () => {
    it("should convert two-column layout", async () => {
      const html = await parseMarkdown(
        ":::columns\nFirst column\n|||\nSecond column\n:::"
      );
      expect(html).toContain('class="soroban-columns soroban-columns-2"');
      expect(html).toContain('class="soroban-column"');
      expect(html).toContain("First column");
      expect(html).toContain("Second column");
    });

    it("should convert three-column layout", async () => {
      const html = await parseMarkdown(
        ":::columns\nCol 1\n|||\nCol 2\n|||\nCol 3\n:::"
      );
      expect(html).toContain('class="soroban-columns soroban-columns-3"');
      const columnMatches = html.match(/class="soroban-column"/g);
      expect(columnMatches).toHaveLength(3);
    });

    it("should convert four-column layout", async () => {
      const html = await parseMarkdown(
        ":::columns\nA\n|||\nB\n|||\nC\n|||\nD\n:::"
      );
      expect(html).toContain('class="soroban-columns soroban-columns-4"');
      const columnMatches = html.match(/class="soroban-column"/g);
      expect(columnMatches).toHaveLength(4);
    });

    it("should process markdown inside columns", async () => {
      const html = await parseMarkdown(
        ":::columns\n**Bold text**\n|||\n*Italic text*\n:::"
      );
      expect(html).toContain("<strong>Bold text</strong>");
      expect(html).toContain("<em>Italic text</em>");
    });

    it("should handle lists inside columns", async () => {
      const html = await parseMarkdown(
        ":::columns\n- Item 1\n- Item 2\n|||\n1. First\n2. Second\n:::"
      );
      expect(html).toContain("<ul>");
      expect(html).toContain("<ol>");
      expect(html).toContain("Item 1");
      expect(html).toContain("First");
    });

    it("should handle headings inside columns", async () => {
      const html = await parseMarkdown(
        ":::columns\n## Heading A\nContent A\n|||\n## Heading B\nContent B\n:::"
      );
      expect(html).toContain("<h2>");
      expect(html).toContain("Heading A");
      expect(html).toContain("Heading B");
    });

    it("should handle code blocks inside columns", async () => {
      const html = await parseMarkdown(
        ":::columns\n```\ncode here\n```\n|||\nRegular text\n:::"
      );
      expect(html).toContain("<pre>");
      expect(html).toContain("<code>");
      expect(html).toContain("code here");
    });

    it("should handle links inside columns", async () => {
      const html = await parseMarkdown(
        ":::columns\n[Link](https://example.com)\n|||\n[Action](render:/path)\n:::"
      );
      expect(html).toContain('href="https://example.com"');
      expect(html).toContain('data-action="render:/path"');
    });

    it("should handle multiple column blocks", async () => {
      const html = await parseMarkdown(
        ":::columns\nFirst block col 1\n|||\nFirst block col 2\n:::\n\nSome text between\n\n:::columns\nSecond block col 1\n|||\nSecond block col 2\n:::"
      );
      const columnsMatches = html.match(/class="soroban-columns/g);
      expect(columnsMatches).toHaveLength(2);
      expect(html).toContain("First block col 1");
      expect(html).toContain("Second block col 1");
      expect(html).toContain("Some text between");
    });

    it("should handle single column", async () => {
      const html = await parseMarkdown(
        ":::columns\nJust one column\n:::"
      );
      expect(html).toContain('class="soroban-columns soroban-columns-1"');
      expect(html).toContain("Just one column");
    });

    it("should preserve content outside columns", async () => {
      const html = await parseMarkdown(
        "# Title\n\n:::columns\nCol A\n|||\nCol B\n:::\n\n## Footer"
      );
      expect(html).toContain("<h1>");
      expect(html).toContain("Title");
      expect(html).toContain("soroban-columns");
      expect(html).toContain("<h2>");
      expect(html).toContain("Footer");
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
