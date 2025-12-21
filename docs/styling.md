# CSS Styling Guide

Soroban Render supports a layered CSS styling system that allows contracts to define and share styles.

## Overview

The styling system supports multiple sources of CSS, applied in a specific cascade order:

1. **Theme contract styles** - Base styles from a referenced theme contract
2. **Contract styles** - Styles from the current contract's `styles()` function
3. **Style includes** - Styles from `{{style ...}}` tags in content
4. **Inline CSS blocks** - CSS from ```css code blocks in markdown

## StyleBuilder (SDK)

The `StyleBuilder` provides a fluent API for constructing CSS in contracts:

```rust
use soroban_render_sdk::prelude::*;

pub fn styles(env: Env) -> Bytes {
    StyleBuilder::new(&env)
        .comment("My App Styles")
        .newline()
        .root_vars_start()
        .var("primary", "#0066cc")
        .var("bg", "#ffffff")
        .root_vars_end()
        .rule("h1", "color: var(--primary);")
        .rule("a", "color: var(--primary); text-decoration: none;")
        .build()
}
```

### CSS Variables

```rust
// Single variable
.root_var("primary", "#0066cc")
// Output: :root { --primary: #0066cc; }

// Multiple variables in a block
.root_vars_start()
.var("primary", "#0066cc")
.var("bg", "#ffffff")
.root_vars_end()
// Output:
// :root {
//   --primary: #0066cc;
//   --bg: #ffffff;
// }
```

### CSS Rules

```rust
// Single-line rule
.rule("h1", "color: blue; font-size: 2rem;")
// Output: h1 { color: blue; font-size: 2rem; }

// Multi-line rule block
.rule_start("h1")
.prop("color", "blue")
.prop("font-size", "2rem")
.rule_end()
// Output:
// h1 {
//   color: blue;
//   font-size: 2rem;
// }
```

### Media Queries

```rust
// Generic media query
.media_start("(max-width: 768px)")
.rule("h1", "font-size: 1.5rem;")
.media_end()

// Dark mode helper
.dark_mode_start()
.rule_start(":root")
.prop("--bg", "#1a1a1a")
.prop("--text", "#e0e0e0")
.rule_end()
.media_end()

// Responsive breakpoints
.breakpoint_min(768)  // @media (min-width: 768px)
.breakpoint_max(767)  // @media (max-width: 767px)
```

### Utilities

```rust
.comment("Section header")  // /* Section header */
.newline()                   // Empty line
.raw("/* Custom CSS */")     // Raw CSS string
```

## Declaring Styles Support

Use the metadata macros to declare that your contract provides styles:

```rust
use soroban_render_sdk::prelude::*;

// Basic: Markdown with styles
soroban_render!(markdown, styles);

// With JSON support
soroban_render!(markdown, json, styles);

// With theme contract reference
soroban_render!(markdown, styles, theme = "CABCD123...");

// Full featured
soroban_render!(markdown, json, styles, theme = "CABCD123...");
```

## Theme Contracts

Theme contracts provide reusable base styles. Define a `styles()` function:

```rust
soroban_render!(markdown, styles);

#[contractimpl]
impl ThemeContract {
    pub fn styles(env: Env) -> Bytes {
        StyleBuilder::new(&env)
            .root_vars_start()
            .var("primary", "#0066cc")
            .var("success", "#22c55e")
            .var("warning", "#eab308")
            .var("danger", "#dc3545")
            .var("text", "#333333")
            .var("bg", "#ffffff")
            .var("border", "#e0e0e0")
            .root_vars_end()
            .rule("body", "font-family: system-ui, sans-serif;")
            .rule("h1", "color: var(--primary);")
            .build()
    }

    pub fn styles_dark(env: Env) -> Bytes {
        StyleBuilder::new(&env)
            .dark_mode_start()
            .rule_start(":root")
            .prop("--text", "#e0e0e0")
            .prop("--bg", "#1a1a1a")
            .rule_end()
            .media_end()
            .build()
    }
}
```

Reference the theme in other contracts:

```rust
soroban_render!(markdown, styles, theme = "THEME_CONTRACT_ID");
```

## Style Includes

Include styles from other contracts in your content:

```markdown
{{style contract=THEME_ID func="dark"}}

# My Page

Content here...
```

This calls `styles_dark()` on the theme contract and includes the CSS.

## Inline CSS Blocks

Embed CSS directly in markdown:

````markdown
```css
.custom-class {
  padding: 1rem;
  background: linear-gradient(135deg, var(--primary), var(--success));
}
```

<div class="custom-class">
  Styled content
</div>
````

## Viewer Integration

The viewer automatically handles style resolution:

```typescript
const { html, css, scopeClassName } = useRender(client, contractId, {
  resolveStyles: true,      // Default: true
  styleCacheTtl: 60000,     // Cache for 60 seconds
  themeContractId: "...",   // Override metadata theme
  scopeStyles: true,        // Scope CSS to prevent conflicts
});

// RenderView applies styles automatically
<RenderView
  html={html}
  css={css}
  scopeClassName={scopeClassName}
/>
```

### Style Options

| Option | Default | Description |
|--------|---------|-------------|
| `resolveStyles` | `true` | Enable style resolution |
| `styleCacheTtl` | `60000` | Cache TTL in milliseconds |
| `themeContractId` | (from metadata) | Override theme contract |
| `scopeStyles` | `true` | Scope CSS to prevent conflicts |

## CSS Scoping

To prevent style conflicts between contracts, CSS selectors are automatically prefixed with a scope class:

```css
/* Before scoping */
h1 { color: blue; }

/* After scoping */
.soroban-scope-CABCD123 h1 { color: blue; }
```

The scope class is derived from the contract ID and applied to the container element.

## Security

CSS is sanitized to prevent security issues:

**Blocked patterns:**
- External URLs in `url()` (e.g., `url(https://...)`)
- `@import` rules with external URLs
- `javascript:` URLs
- IE-specific exploits (`expression()`, `behavior:`)

**Allowed:**
- `data:` URLs for images (up to 32KB)
- Local fragment references (`url(#id)`)
- All standard CSS properties

## Best Practices

CSS variables provide the foundation for a maintainable styling system. Define your color palette and common values in a theme contract's `:root` block, then reference them throughout your contracts with `var(--name)`. This approach keeps individual contracts small while ensuring visual consistency.

```rust
// Theme defines the palette
.var("primary", "#0066cc")

// Contracts reference it
.rule("a", "color: var(--primary);")
```

Contract size matters on Soroban—every byte counts toward the 64KB limit. Keep your styles minimal by relying on theme variables rather than repeating values, and only include rules your contract actually needs.

```rust
// Good - minimal, uses theme variables
.rule("h1", "color: var(--primary);")

// Avoid - verbose, duplicates theme
.rule("h1", "color: #0066cc; font-family: -apple-system, BlinkMacSystemFont, sans-serif;")
```

Group related styles together using comments to mark logical sections. This makes the CSS easier to maintain and debug.

```rust
StyleBuilder::new(&env)
    .comment("Task Item Styles")
    .rule(".task-item", "display: flex; gap: 0.5rem;")
    .rule(".task-item.completed", "opacity: 0.6;")
    .newline()
    .comment("Form Styles")
    .rule(".add-form", "padding: 1rem;")
    .build()
```

### Dark Mode Support

Add dark mode with the built-in helper:

```rust
.dark_mode_start()
.rule_start(":root")
.prop("--bg", "#1a1a1a")
.rule_end()
.media_end()
```

## Complete Example

```rust
#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env, String};
use soroban_render_sdk::prelude::*;

soroban_render!(markdown, styles, theme = "THEME_ID");

#[contract]
pub struct MyContract;

#[contractimpl]
impl MyContract {
    pub fn styles(env: Env) -> Bytes {
        StyleBuilder::new(&env)
            .comment("Custom App Styles")
            .rule(".hero", "padding: 2rem; text-align: center;")
            .rule(".hero h1", "font-size: 2.5rem;")
            .rule(".cta-button", "display: inline-block; padding: 0.75rem 1.5rem; background: var(--primary); color: white; border-radius: 4px;")
            .build()
    }

    pub fn render(env: Env, _path: Option<String>, _viewer: Option<Address>) -> Bytes {
        MarkdownBuilder::new(&env)
            .raw_str("<div class=\"hero\">\n")
            .h1("Welcome to My App")
            .paragraph("Built with Soroban Render")
            .raw_str("<a class=\"cta-button\" href=\"render:/start\">Get Started</a>\n")
            .raw_str("</div>\n")
            .build()
    }
}
```

## Related Documentation

- [Rust SDK Reference](./rust-sdk.md) - Complete API documentation
- [Markdown Format](./markdown-format.md) - Interactive markdown syntax
- [Best Practices](./best-practices.md) - Design patterns
- [Examples](./examples.md) - Contract walkthroughs
