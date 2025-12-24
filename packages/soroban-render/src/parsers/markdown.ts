import { marked } from "marked";
import DOMPurify from "dompurify";

// Configure marked once at module load
marked.setOptions({
  gfm: true, // GitHub Flavored Markdown (tables, strikethrough, task lists)
  breaks: false, // Don't convert \n to <br>
});

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
  // This handles links that marked doesn't convert (e.g., inside certain contexts)
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
  // This handles links that marked already converted to HTML
  return html.replace(
    /<a\s+href="((?:render:|tx:|form:)[^"]*)"([^>]*)>/g,
    (_, url, rest) => {
      // Check if there's an existing class attribute in rest
      const classMatch = rest.match(/\s+class="([^"]*)"/);
      if (classMatch) {
        // Merge soroban-action with existing classes
        const existingClasses = classMatch[1];
        const restWithoutClass = rest.replace(/\s+class="[^"]*"/, "");
        return `<a href="#" data-action="${escapeHtmlAttr(url)}" class="soroban-action ${existingClasses}"${restWithoutClass}>`;
      }
      return `<a href="#" data-action="${escapeHtmlAttr(url)}" class="soroban-action"${rest}>`;
    }
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

function processColumnBlocks(
  html: string,
  blocks: ColumnBlock[],
  processMarkdown: (md: string) => string
): string {
  let result = html;

  for (const block of blocks) {
    // Process each column's content through markdown
    const processedColumns = block.columns.map(col => processMarkdown(col));

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
  // Input pattern from marked: <blockquote>\n<p>[!TYPE]</p>\n<p>content</p>\n</blockquote>
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
function processMarkdownCore(markdown: string): string {
  let html = marked.parse(markdown) as string;

  // Convert any remaining markdown links that weren't processed
  html = convertRemainingLinks(html);

  // Convert custom protocol hrefs to data-action attributes
  html = convertCustomProtocolHrefs(html);

  // Convert GitHub-style alert syntax
  html = convertAlertSyntax(html);

  return html;
}

// Keep async signature for backward compatibility
export async function parseMarkdown(markdown: string): Promise<string> {
  // Extract column blocks before processing
  const { markdown: processedMarkdown, blocks: columnBlocks } = extractColumnBlocks(markdown);

  // Process the main markdown content
  let html = processMarkdownCore(processedMarkdown);

  // Process column blocks (each column's content gets processed through markdown)
  if (columnBlocks.length > 0) {
    html = processColumnBlocks(html, columnBlocks, processMarkdownCore);
  }

  // Add hook to preserve 'name' attribute on form elements
  // DOMPurify strips 'name' by default for security, but we need it for form handling
  DOMPurify.addHook('uponSanitizeAttribute', (node, data) => {
    if (data.attrName === 'name') {
      const tagName = node.tagName?.toLowerCase();
      // Only preserve 'name' on form-related elements
      if (tagName === 'input' || tagName === 'textarea' || tagName === 'select' || tagName === 'button') {
        data.forceKeepAttr = true;
      }
    }
  });

  // Debug: log hidden inputs before sanitization
  const hiddenInputsBefore = html.match(/<input[^>]*type="hidden"[^>]*>/g) || [];
  console.log("[soroban-render] Hidden inputs BEFORE DOMPurify:", hiddenInputsBefore);

  try {
    const sanitized = DOMPurify.sanitize(html, {
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

    // Debug: log hidden inputs after sanitization
    const hiddenInputsAfter = sanitized.match(/<input[^>]*type="hidden"[^>]*>/g) || [];
    console.log("[soroban-render] Hidden inputs AFTER DOMPurify:", hiddenInputsAfter);

    return sanitized;
  } finally {
    // Clean up hook to avoid affecting other DOMPurify calls
    DOMPurify.removeAllHooks();
  }
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
