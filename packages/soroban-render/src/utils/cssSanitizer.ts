/**
 * CSS Sanitizer for Soroban Render
 *
 * Prevents security issues by:
 * - Blocking url() with external URLs
 * - Blocking @import rules with external URLs
 * - Blocking javascript: URLs
 * - Blocking expression() (IE)
 * - Blocking behavior: (IE)
 * - Blocking -moz-binding (Firefox)
 */

export interface SanitizeOptions {
  /** Allow data: URLs in url() (default: true for small images) */
  allowDataUrls?: boolean;
  /** Maximum size for data: URLs in bytes (default: 32KB) */
  maxDataUrlSize?: number;
  /** Contract ID for scoping (optional) */
  scopePrefix?: string;
}

// Dangerous patterns to block
const DANGEROUS_PATTERNS: RegExp[] = [
  // External URL patterns in url()
  /url\s*\(\s*['"]?https?:/gi,
  /url\s*\(\s*['"]?\/\//gi,
  // @import with external URLs
  /@import\s+(?:url\s*\()?['"]?https?:/gi,
  /@import\s+(?:url\s*\()?['"]?\/\//gi,
  // JavaScript injection
  /javascript\s*:/gi,
  // IE-specific exploits
  /expression\s*\(/gi,
  /behavior\s*:/gi,
  // Firefox binding
  /-moz-binding\s*:/gi,
];

/**
 * Sanitize CSS content to prevent security issues.
 */
export function sanitizeCss(
  css: string,
  options: SanitizeOptions = {}
): string {
  const { allowDataUrls = true, maxDataUrlSize = 32768 } = options;

  let sanitized = css;

  // Block dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    sanitized = sanitized.replace(pattern, "/* blocked */");
  }

  // Handle data URLs
  if (allowDataUrls) {
    // Check data URLs for size and type
    sanitized = sanitized.replace(
      /url\s*\(\s*['"]?(data:[^)'"]+)['"]?\s*\)/gi,
      (match, dataUrl: string) => {
        // Check size (rough estimate - actual base64 data length)
        if (dataUrl.length > maxDataUrlSize) {
          return "/* data url too large */";
        }
        // Only allow image data URLs
        if (!/^data:image\/(png|gif|jpeg|jpg|svg\+xml|webp)/i.test(dataUrl)) {
          return "/* non-image data url blocked */";
        }
        return match;
      }
    );
  } else {
    // Block all data URLs
    sanitized = sanitized.replace(
      /url\s*\(\s*['"]?data:/gi,
      "/* data url blocked */"
    );
  }

  // Apply scope prefix if provided
  if (options.scopePrefix) {
    sanitized = scopeCss(sanitized, options.scopePrefix);
  }

  return sanitized;
}

/**
 * Scope CSS selectors to prevent conflicts between contracts.
 *
 * Prefixes all selectors with .soroban-scope-{prefix}
 * to isolate styles to specific contract outputs.
 */
export function scopeCss(css: string, contractIdOrPrefix: string): string {
  // Use first 8 characters of contract ID for readable class name
  const prefix = contractIdOrPrefix.slice(0, 8);
  const scopeClass = `.soroban-scope-${prefix}`;

  // Process CSS rules - this is a simplified approach
  // For production, consider using a proper CSS parser
  return css.replace(
    /([^{}@/]+)(\{[^{}]*\})/g,
    (match: string, selectors: string, block: string) => {
      const trimmedSelectors = selectors.trim();

      // Skip @rules (media queries, keyframes, etc.)
      if (trimmedSelectors.startsWith("@")) {
        return match;
      }

      // Skip if inside a media query or other @rule (indicated by indentation)
      // This is a heuristic - proper parsing would be better
      if (/^\s+/.test(selectors) && selectors.includes("\n")) {
        return match;
      }

      // Process comma-separated selectors
      const scopedSelectors = trimmedSelectors
        .split(",")
        .map((s: string) => {
          const trimmed = s.trim();

          // Skip :root, html, body - these affect the whole page
          // Convert :root to scoped class
          if (/^:root\s*$/i.test(trimmed)) {
            return scopeClass;
          }
          if (/^(html|body)\s*$/i.test(trimmed)) {
            return trimmed; // Don't scope html/body
          }

          // For :root with pseudo-selectors, replace :root with scope
          if (/^:root/i.test(trimmed)) {
            return trimmed.replace(/^:root/i, scopeClass);
          }

          // Skip keyframe percentages
          if (/^\d+%$/.test(trimmed) || trimmed === "from" || trimmed === "to") {
            return trimmed;
          }

          // Prefix other selectors
          return `${scopeClass} ${trimmed}`;
        })
        .join(", ");

      return `${scopedSelectors}${block}`;
    }
  );
}

/**
 * Validate CSS syntax (basic check).
 */
export function validateCss(css: string): { valid: boolean; error?: string } {
  // Check for balanced braces
  let braceCount = 0;
  for (const char of css) {
    if (char === "{") braceCount++;
    if (char === "}") braceCount--;
    if (braceCount < 0) {
      return { valid: false, error: "Unbalanced closing brace" };
    }
  }
  if (braceCount !== 0) {
    return { valid: false, error: "Unbalanced opening brace" };
  }

  return { valid: true };
}

/**
 * Combine multiple CSS strings into one.
 */
export function combineCss(cssStrings: string[]): string {
  return cssStrings.filter((s) => s.trim()).join("\n\n");
}

/**
 * Create a scoped class name from a contract ID.
 */
export function createScopeClassName(contractId: string): string {
  return `soroban-scope-${contractId.slice(0, 8)}`;
}
