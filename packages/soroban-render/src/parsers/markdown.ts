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

const ALERT_TYPES = ["NOTE", "WARNING", "TIP", "INFO", "CAUTION"] as const;

// Placeholder for column content during processing
const COLUMN_PLACEHOLDER_PREFIX = "<!--SOROBAN_COLUMN_";
const COLUMN_PLACEHOLDER_SUFFIX = "-->";

interface ColumnBlock {
  placeholder: string;
  columns: string[];
}

function extractColumnBlocks(markdown: string): { markdown: string; blocks: ColumnBlock[] } {
  const blocks: ColumnBlock[] = [];
  let blockIndex = 0;

  const processed = markdown.replace(
    /:::columns\s*\n([\s\S]*?)\n:::/g,
    (_, content) => {
      const columns = content.split(/\n\|\|\|\n/).map((col: string) => col.trim());
      const placeholder = `${COLUMN_PLACEHOLDER_PREFIX}${blockIndex}${COLUMN_PLACEHOLDER_SUFFIX}`;
      blocks.push({ placeholder, columns });
      blockIndex++;
      return placeholder;
    }
  );

  return { markdown: processed, blocks };
}

async function processColumnBlocks(
  html: string,
  blocks: ColumnBlock[],
  processMarkdown: (md: string) => Promise<string>
): Promise<string> {
  let result = html;

  for (const block of blocks) {
    // Process each column's content through markdown
    const processedColumns = await Promise.all(
      block.columns.map(col => processMarkdown(col))
    );

    // Build the column HTML
    const columnCount = processedColumns.length;
    const columnDivs = processedColumns
      .map(col => `<div class="soroban-column">${col}</div>`)
      .join("\n");
    const columnHtml = `<div class="soroban-columns soroban-columns-${columnCount}">\n${columnDivs}\n</div>`;

    // Replace the placeholder
    result = result.replace(block.placeholder, columnHtml);
  }

  return result;
}

function convertAlertSyntax(html: string): string {
  // Convert blockquotes with [!TYPE] to styled alert divs
  // Input pattern from remark: <blockquote>\n<p>[!TYPE]</p>\n<p>content</p>\n</blockquote>
  // Also handles: <blockquote>\n<p>[!TYPE]\ncontent on same line</p>\n</blockquote>
  const alertPattern = new RegExp(
    `<blockquote>\\s*<p>\\[!(${ALERT_TYPES.join("|")})\\](?:<br>\\s*)?([\\s\\S]*?)</p>([\\s\\S]*?)</blockquote>`,
    "gi"
  );

  return html.replace(alertPattern, (_, type, firstContent, restContent) => {
    const upperType = type.toUpperCase();
    const lowerType = type.toLowerCase();
    // Combine content from the first paragraph and any remaining paragraphs
    const content = (firstContent.trim() + restContent).trim();
    return `<div class="soroban-alert soroban-alert-${lowerType}"><div class="soroban-alert-title">${upperType}</div><div class="soroban-alert-content">${content}</div></div>`;
  });
}

// Internal markdown processor without column handling (to avoid recursion)
async function processMarkdownCore(markdown: string): Promise<string> {
  const result = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkHtml, { sanitize: false })
    .process(markdown);

  let html = String(result);

  // Convert any remaining markdown links that weren't processed
  html = convertRemainingLinks(html);

  // Convert custom protocol hrefs to data-action attributes
  html = convertCustomProtocolHrefs(html);

  // Convert GitHub-style alert syntax
  html = convertAlertSyntax(html);

  return html;
}

export async function parseMarkdown(markdown: string): Promise<string> {
  // Extract column blocks before processing
  const { markdown: processedMarkdown, blocks: columnBlocks } = extractColumnBlocks(markdown);

  // Process the main markdown content
  let html = await processMarkdownCore(processedMarkdown);

  // Process column blocks (each column's content gets processed through markdown)
  if (columnBlocks.length > 0) {
    html = await processColumnBlocks(html, columnBlocks, processMarkdownCore);
  }

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
      "rows", "cols", "size", "wrap",  // textarea/input sizing
      "style",  // inline styling
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
