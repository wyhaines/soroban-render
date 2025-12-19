import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkHtml from "remark-html";
import DOMPurify from "dompurify";

export async function parseMarkdown(markdown: string): Promise<string> {
  const result = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkHtml, { sanitize: false })
    .process(markdown);

  const html = String(result);

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "h1", "h2", "h3", "h4", "h5", "h6",
      "p", "br", "hr",
      "ul", "ol", "li",
      "blockquote", "pre", "code",
      "a", "strong", "em", "del", "s",
      "table", "thead", "tbody", "tr", "th", "td",
      "img",
      "div", "span",
    ],
    ALLOWED_ATTR: [
      "href", "src", "alt", "title", "class", "id",
      "target", "rel",
    ],
    ADD_ATTR: ["target", "rel"],
    FORBID_TAGS: ["script", "style", "iframe", "form", "input"],
  });
}

export function detectFormat(content: string): "markdown" | "json" | "unknown" {
  const trimmed = content.trim();

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.format && parsed.format.startsWith("soroban-render-json")) {
        return "json";
      }
      return "unknown";
    } catch {
      return "markdown";
    }
  }

  return "markdown";
}
