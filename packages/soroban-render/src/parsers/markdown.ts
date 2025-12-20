import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkHtml from "remark-html";
import DOMPurify from "dompurify";

function escapeHtmlAttr(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const CUSTOM_PROTOCOLS = ["render:", "tx:", "form:"];

function isCustomProtocol(url: string): boolean {
  return CUSTOM_PROTOCOLS.some(p => url.startsWith(p));
}

function convertRemainingLinks(html: string): string {
  // Convert any remaining markdown link syntax [text](url) to HTML links
  // This handles links that remark doesn't convert (e.g., inside task list items)
  return html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_, text, url) => {
      if (isCustomProtocol(url)) {
        // Use data-action for custom protocols to prevent browser from handling them
        return `<a href="#" data-action="${escapeHtmlAttr(url)}" class="soroban-action">${text}</a>`;
      }
      return `<a href="${escapeHtmlAttr(url)}">${text}</a>`;
    }
  );
}

function convertCustomProtocolHrefs(html: string): string {
  // Convert existing <a href="render:..."> etc. to use data-action instead
  // This handles links that remark already converted to HTML
  return html.replace(
    /<a\s+href="((?:render:|tx:|form:)[^"]*)"([^>]*)>/g,
    (_, url, rest) => `<a href="#" data-action="${escapeHtmlAttr(url)}" class="soroban-action"${rest}>`
  );
}

export async function parseMarkdown(markdown: string): Promise<string> {
  const result = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkHtml, { sanitize: false })
    .process(markdown);

  let html = String(result);

  // Convert any remaining markdown links that weren't processed
  html = convertRemainingLinks(html);

  // Convert custom protocol hrefs to data-action attributes
  // This prevents the browser from trying to handle them as external protocols
  html = convertCustomProtocolHrefs(html);

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
      "input", "select", "option", "button", "label", "textarea",
    ],
    ALLOWED_ATTR: [
      "href", "src", "alt", "title", "class", "id",
      "target", "rel",
      "name", "type", "placeholder", "value", "required", "disabled",
      "checked", "selected", "readonly", "maxlength", "minlength",
      "min", "max", "step", "pattern", "for",
      "data-*",
    ],
    ADD_ATTR: ["target", "rel"],
    FORBID_TAGS: ["script", "style", "iframe", "form"],
    ALLOW_UNKNOWN_PROTOCOLS: true,
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
