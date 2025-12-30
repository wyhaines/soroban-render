/**
 * Meta tag parser for extracting document metadata from rendered content.
 *
 * Contracts can output meta tags like:
 *   <meta name="favicon" content="https://example.com/favicon.png" />
 *   <meta name="title" content="My Site" />
 *   <meta name="theme-color" content="#7857e1" />
 *
 * The viewer extracts these and applies them to the document head,
 * then optionally removes them from the body content.
 */

export interface MetaTag {
  /** Original matched string */
  original: string;
  /** Start index in the content string */
  startIndex: number;
  /** End index in the content string */
  endIndex: number;
  /** Meta tag name attribute */
  name: string;
  /** Meta tag content attribute */
  content: string;
}

export interface ParsedMeta {
  /** The content with meta tags removed */
  content: string;
  /** All meta tags found, keyed by name */
  meta: Record<string, string>;
  /** Raw meta tag objects */
  metaTags: MetaTag[];
}

// Regex to match <meta name="..." content="..." /> or <meta name="..." content="...">
// Handles both self-closing and non-self-closing variants
// Handles attributes in either order (name then content, or content then name)
const META_TAG_REGEX = /<meta\s+(?:name=["']([^"']+)["']\s+content=["']([^"']+)["']|content=["']([^"']+)["']\s+name=["']([^"']+)["'])\s*\/?>/gi;

/**
 * Parse content to find all meta tags.
 * Returns extracted metadata and content with meta tags removed.
 */
export function parseMeta(content: string): ParsedMeta {
  const metaTags: MetaTag[] = [];
  const meta: Record<string, string> = {};

  META_TAG_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = META_TAG_REGEX.exec(content)) !== null) {
    const fullMatch = match[0];
    const startIndex = match.index;
    const endIndex = startIndex + fullMatch.length;

    // Handle both attribute orders
    const name = match[1] || match[4] || "";
    const metaContent = match[2] || match[3] || "";

    if (name && metaContent) {
      metaTags.push({
        original: fullMatch,
        startIndex,
        endIndex,
        name,
        content: metaContent,
      });

      // Store in meta object (later values override earlier ones)
      meta[name] = metaContent;
    }
  }

  // Remove meta tags from content
  let processedContent = content;

  // Sort by startIndex descending to remove from end first
  const sortedTags = [...metaTags].sort((a, b) => b.startIndex - a.startIndex);
  for (const tag of sortedTags) {
    processedContent =
      processedContent.slice(0, tag.startIndex) +
      processedContent.slice(tag.endIndex);
  }

  return { content: processedContent, meta, metaTags };
}

/**
 * Check if content contains any meta tags.
 */
export function hasMetaTags(content: string): boolean {
  META_TAG_REGEX.lastIndex = 0;
  return META_TAG_REGEX.test(content);
}

/**
 * Apply extracted meta tags to the document.
 * Updates favicon, title, theme-color, etc.
 */
export function applyMetaToDocument(meta: Record<string, string>): void {
  // Apply favicon
  if (meta.favicon) {
    let faviconLink = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
    if (!faviconLink) {
      faviconLink = document.createElement("link");
      faviconLink.rel = "icon";
      document.head.appendChild(faviconLink);
    }
    faviconLink.href = meta.favicon;
  }

  // Apply title
  if (meta.title) {
    document.title = meta.title;
  }

  // Apply theme-color
  if (meta["theme-color"]) {
    let themeColorMeta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (!themeColorMeta) {
      themeColorMeta = document.createElement("meta");
      themeColorMeta.name = "theme-color";
      document.head.appendChild(themeColorMeta);
    }
    themeColorMeta.content = meta["theme-color"];
  }

  // Apply description
  if (meta.description) {
    let descMeta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!descMeta) {
      descMeta = document.createElement("meta");
      descMeta.name = "description";
      document.head.appendChild(descMeta);
    }
    descMeta.content = meta.description;
  }
}
