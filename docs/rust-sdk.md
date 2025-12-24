# Rust SDK Reference

Complete reference for the `soroban-render-sdk` crate. This SDK provides builders and utilities for creating renderable Soroban contracts with minimal boilerplate.

## Installation

Add to your `Cargo.toml`:

```toml
[dependencies]
soroban-sdk = "22.0.0"
soroban-render-sdk = { git = "https://github.com/wyhaines/soroban-render-sdk.git" }
```

### Feature Flags

The SDK uses feature flags to minimize contract size:

| Feature | Default | Description |
|---------|---------|-------------|
| `markdown` | Yes | MarkdownBuilder for markdown output |
| `json` | Yes | JsonDocument for JSON UI format |
| `router` | Yes | Router and path utilities |
| `styles` | Yes | StyleBuilder for CSS stylesheets |

To use only specific features:

```toml
[dependencies]
soroban-render-sdk = {
    git = "https://github.com/wyhaines/soroban-render-sdk.git",
    default-features = false,
    features = ["markdown"]
}
```

## Quick Start

```rust
#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env, String};
use soroban_render_sdk::prelude::*;

soroban_render!(markdown);

#[contract]
pub struct MyContract;

#[contractimpl]
impl MyContract {
    pub fn render(env: Env, _path: Option<String>, _viewer: Option<Address>) -> Bytes {
        MarkdownBuilder::new(&env)
            .h1("Hello, World!")
            .paragraph("Welcome to Soroban Render.")
            .build()
    }
}
```


## Metadata Macros

These macros declare your contract's render capabilities in the WASM metadata.

### soroban_render!

The main convenience macro that declares both render version and format support.

```rust
use soroban_render_sdk::prelude::*;

// Markdown only
soroban_render!(markdown);

// JSON only
soroban_render!(json);

// Both formats
soroban_render!(markdown, json);

// With styles support
soroban_render!(markdown, styles);

// With theme contract reference
soroban_render!(markdown, styles, theme = "CABCD123...");

// Full featured
soroban_render!(markdown, json, styles, theme = "CABCD123...");
```

**Expands to:**
```rust
contractmeta!(key = "render", val = "v1");
contractmeta!(key = "render_formats", val = "markdown");
contractmeta!(key = "render_styles", val = "true");      // with styles
contractmeta!(key = "render_theme", val = "CABCD123..."); // with theme
```

### render_v1!

Declares render v1 protocol support.

```rust
render_v1!();
// Expands to: contractmeta!(key = "render", val = "v1");
```

### render_formats!

Declares supported output formats.

```rust
render_formats!(markdown);
render_formats!(json);
render_formats!(markdown, json);
```

### render_has_styles!

Declares that the contract provides a `styles()` function.

```rust
render_has_styles!();
// Expands to: contractmeta!(key = "render_styles", val = "true");
```

### render_theme!

Declares a theme contract ID for style inheritance.

```rust
render_theme!("CABCD123...");
// Expands to: contractmeta!(key = "render_theme", val = "CABCD123...");
```


## MarkdownBuilder

A fluent builder for constructing markdown content with Soroban Render's interactive protocols.

### Construction

```rust
let md = MarkdownBuilder::new(&env);
```

### Headings

```rust
.h1("Level 1 Heading")    // # Heading
.h2("Level 2 Heading")    // ## Heading
.h3("Level 3 Heading")    // ### Heading
.heading(4, "Level 4")    // #### Heading (levels 1-6)
```

### Text Content

```rust
.text("Inline text")              // No trailing newline
.paragraph("A paragraph.")        // Adds double newline after
.bold("Bold text")                // **text**
.italic("Italic text")            // *text*
.code("inline_code")              // `code`
.strikethrough("Deleted text")    // ~~text~~
```

### Dynamic Content

For content from Soroban SDK types:

```rust
// From soroban_sdk::String
.text_string(&my_string)

// From u32
.number(42)

// Raw bytes
.raw(some_bytes)
.raw_str("raw string slice")
```

### Links

```rust
// Standard markdown link
.link("Click here", "https://example.com")

// Navigation link (render: protocol)
.render_link("Home", "/")
// Output: [Home](render:/)

// Transaction link (tx: protocol)
.tx_link("Submit", "method_name", "{\"key\":\"value\"}")
// Output: [Submit](tx:method_name {"key":"value"})

// Transaction link with ID argument
.tx_link_id("Delete", "delete_item", 42)
// Output: [Delete](tx:delete_item {"id":42})

// Form submission link (form: protocol)
.form_link("Submit", "add_item")
// Output: [Submit](form:add_item)
```

### Contract-Targeted Links

For multi-contract applications, target specific contracts via registry aliases:

```rust
// Form link targeting admin contract via alias
.form_link_to("Update Settings", "admin", "set_chunk_size")
// Output: [Update Settings](form:@admin:set_chunk_size)

// Transaction link targeting content contract
.tx_link_to("Flag Post", "content", "flag_reply", r#"{"id":123}"#)
// Output: [Flag Post](tx:@content:flag_reply {"id":123})

// Transaction link with empty args
.tx_link_to("Ban User", "admin", "ban_user", "")
// Output: [Ban User](tx:@admin:ban_user)
```

These methods require a registry contract that maps aliases to contract addresses. The viewer looks up the alias at runtime and submits the transaction to the resolved contract.

### Alerts / Callouts

GitHub-style alert boxes:

```rust
.tip("This is a helpful tip.")
.note("Important information here.")
.warning("Be careful about this.")
.info("Additional context.")
.caution("Proceed with caution.")

// Custom alert type
.alert("IMPORTANT", "Custom alert content.")
```

**Output:**
```markdown
> [!TIP]
> This is a helpful tip.
```

### Columns Layout

Multi-column layouts:

```rust
.columns_start()
.text("Left column content")
.column_separator()
.text("Right column content")
.columns_end()
```

**Output:**
```markdown
:::columns
Left column content
|||
Right column content
:::
```

### Includes

Include content from other contracts:

```rust
// Basic include
.include("CABCD123...XYZ", "header")
// Output: {{include contract=CABCD123...XYZ func="header"}}

// Include with path argument
.include_with_path("CABCD123...XYZ", "render", "/tasks")
// Output: {{include contract=CABCD123...XYZ func="render" path="/tasks"}}
```

### Form Elements

HTML form inputs for use with `form:` links:

```rust
// Text input
.input("name", "Enter your name")
// Output: <input name="name" placeholder="Enter your name" />

// Textarea
.textarea("description", 3, "Enter description")
// Output: <textarea name="description" rows="3" placeholder="Enter description"></textarea>
```

### Progressive Loading

For chunked content with `soroban-chonk`:

```rust
// Continuation marker - load remaining chunks from index
.continuation("comments", 5, Some(50))
// Output: {{continue collection="comments" from=5 total=50}}

// Without total count
.continuation("comments", 5, None)
// Output: {{continue collection="comments" from=5}}

// Inline chunk reference
.chunk_ref("article", 0)
// Output: {{chunk collection="article" index=0}}

// Chunk reference with placeholder text
.chunk_ref_placeholder("comments", 3, "Loading...")
// Output: {{chunk collection="comments" index=3 placeholder="Loading..."}}

// Paginated continuation
.continue_page("comments", 2, 10, 47)
// Output: {{continue collection="comments" page=2 per_page=10 total=47}}
```

The viewer detects these markers and calls `get_chunk()` to load remaining content. See [Markdown Format - Progressive Loading](./markdown-format.md#progressive-content-loading) for syntax details.

### Lists

```rust
// Unordered list item
.list_item("First item")
.list_item("Second item")
// Output:
// - First item
// - Second item

// Checkbox list
.checkbox(false, "Unchecked task")
.checkbox(true, "Completed task")
// Output:
// - [ ] Unchecked task
// - [x] Completed task
```

### Blockquotes

```rust
.blockquote("Quoted text here")
// Output: > Quoted text here
```

### Utilities

```rust
.newline()  // Single newline
.hr()       // Horizontal rule (---)
```

### Building

```rust
let output: Bytes = md.build();
```


## JsonDocument

A builder for constructing JSON UI documents following the `soroban-render-json-v1` format.

### Construction

```rust
let doc = JsonDocument::new(&env, "App Title");
```

### Basic Components

```rust
// Heading (levels 1-6)
.heading(1, "Title")
.heading_string(2, &dynamic_string)

// Text content
.text("Static text content")
.text_string(&dynamic_string)

// Horizontal divider
.divider()
```

### Forms

Forms use a nested builder pattern:

```rust
.form("add_item")                              // Start form with action
    .text_field("name", "Enter name", true)    // Required text field
    .text_field("email", "Enter email", false) // Optional text field
    .textarea_field("bio", "Enter bio")        // Textarea field
    .submit("Add Item")                        // Complete form with submit button
```

**Output:**
```json
{
  "type": "form",
  "action": "add_item",
  "fields": [
    {"name": "name", "type": "text", "placeholder": "Enter name", "required": true},
    {"name": "email", "type": "text", "placeholder": "Enter email"},
    {"name": "bio", "type": "textarea", "placeholder": "Enter bio"}
  ],
  "submitLabel": "Add Item"
}
```

### Navigation

```rust
.nav_start()
.nav_item("Home", "/", true, true)        // label, path, active, first
.nav_item("Tasks", "/tasks", false, false)
.nav_item("About", "/about", false, false)
.nav_end()
```

**Parameters:**
- `label`: Display text
- `path`: Navigation path
- `active`: Whether this item is currently active
- `first`: Set `true` for the first item (controls comma placement)

### Charts

**Pie Chart:**
```rust
.pie_chart_start("Task Status")
.pie_slice("Completed", 5, "#22c55e", true)   // label, value, color, first
.pie_slice("Pending", 3, "#eab308", false)
.pie_chart_end()
```

**Gauge Chart:**
```rust
.gauge(75, 100, "Progress")  // value, max, label
```

### Containers

Group components together:

```rust
.container_start("task-list")
.heading(2, "Tasks")
.text("Your tasks here...")
.container_end()
```

### Task Components

For task/todo list items with actions:

```rust
.task(1, "Buy groceries", false)           // id, text, completed
    .tx_action("complete", 1, "Done")      // method, id, label
    .tx_action("delete", 1, "Delete")
    .end()

// With dynamic text
.task_string(2, &task_title, true)
    .tx_action("uncomplete", 2, "Undo")
    .end()
```

### Building

```rust
let output: Bytes = doc.build();
```


## Router

A declarative router for path-based routing, inspired by gno.land's mux router.

### Pattern Types

| Pattern | Example | Description |
|---------|---------|-------------|
| Static | `/tasks` | Exact match |
| Named parameter | `/task/{id}` | Captures segment as variable |
| Wildcard | `/files/*` | Captures remaining path |

### Basic Usage

```rust
pub fn render(env: Env, path: Option<String>, _viewer: Option<Address>) -> Bytes {
    Router::new(&env, path)
        .handle(b"/", |_| render_home(&env))
        .or_handle(b"/about", |_| render_about(&env))
        .or_handle(b"/task/{id}", |req| {
            let id = req.get_var_u32(b"id").unwrap_or(0);
            render_task(&env, id)
        })
        .or_handle(b"/files/*", |req| {
            let remaining = req.get_wildcard().unwrap();
            render_file(&env, remaining)
        })
        .or_default(|_| render_home(&env))
}
```

### Router Methods

```rust
// Create router from Option<String> path
Router::new(&env, path)

// Create router from existing Bytes
Router::from_bytes(&env, path_bytes)

// First route handler
.handle(b"/pattern", |req| { ... })

// Additional route handlers
.or_handle(b"/pattern", |req| { ... })

// Default handler (consumes router, returns result)
.or_default(|req| { ... })
```

### Request Object

The `Request` object is passed to handlers:

```rust
|req| {
    // Get the full path
    let path: &Bytes = req.path();

    // Get named parameter as Bytes
    let id_bytes: Option<Bytes> = req.get_var(b"id");

    // Get named parameter as u32
    let id: Option<u32> = req.get_var_u32(b"id");

    // Get wildcard match (everything after *)
    let remaining: Option<Bytes> = req.get_wildcard();

    // ...
}
```

### First-Match Semantics

The router uses first-match-wins. The first pattern that matches the path wins:

```rust
Router::new(&env, path)
    .handle(b"/task/new", |_| new_task())      // Checked first
    .or_handle(b"/task/{id}", |req| show_task()) // Only if /task/new doesn't match
    .or_default(|_| home())
```


## Path Utilities

Low-level utilities for path manipulation, used internally by the Router but available for direct use.

### path_to_bytes

Convert `Option<String>` to `Bytes`, defaulting to "/" if None.

```rust
let path_bytes = path_to_bytes(&env, &path);
```

### path_eq

Check if a path exactly equals a pattern.

```rust
if path_eq(&path_bytes, b"/tasks") {
    // Handle /tasks
}
```

### path_starts_with

Check if a path starts with a prefix.

```rust
if path_starts_with(&path_bytes, b"/api/") {
    // Handle API routes
}
```

### path_suffix

Extract the remaining path after a prefix.

```rust
let suffix = path_suffix(&env, &path_bytes, b"/files/");
// "/files/docs/readme.md" → "docs/readme.md"
```

### parse_id

Parse a numeric ID from a path with a prefix.

```rust
let id = parse_id(&path_bytes, b"/task/");
// "/task/123" → Some(123)
// "/task/abc" → None
```


## StyleBuilder

Build CSS stylesheets with a fluent API. For complete documentation, see the [Styling Guide](./styling.md).

### Basic Usage

```rust
use soroban_render_sdk::prelude::*;

pub fn styles(env: Env) -> Bytes {
    StyleBuilder::new(&env)
        .root_var("primary", "#0066cc")
        .rule("h1", "color: var(--primary);")
        .build()
}
```

### CSS Variables

```rust
// Single variable
.root_var("name", "value")

// Multiple variables
.root_vars_start()
.var("primary", "#0066cc")
.var("bg", "#ffffff")
.root_vars_end()
```

### CSS Rules

```rust
// Inline rule
.rule("h1", "color: blue; font-size: 2rem;")

// Multi-line rule
.rule_start("h1")
.prop("color", "blue")
.prop("font-size", "2rem")
.rule_end()
```

### Media Queries

```rust
// Dark mode
.dark_mode_start()
.rule(":root", "--bg: #1a1a1a;")
.media_end()

// Responsive
.breakpoint_max(768)
.rule("h1", "font-size: 1.5rem;")
.media_end()
```

### Utilities

```rust
.comment("Section")  // /* Section */
.newline()           // Empty line
.raw("/* Raw CSS */")
```


## Byte Utilities

Low-level utilities for working with `Bytes` in Soroban's `no_std` environment.

### Constants

```rust
pub const STRING_BUFFER_SIZE: usize = 256;
```

Strings longer than 256 bytes will be truncated when using `string_to_bytes`.

### concat_bytes

Concatenate a vector of `Bytes` into a single `Bytes` object.

```rust
let mut parts: Vec<Bytes> = Vec::new(&env);
parts.push_back(Bytes::from_slice(&env, b"Hello, "));
parts.push_back(Bytes::from_slice(&env, b"World!"));

let result = concat_bytes(&env, &parts);
// result = "Hello, World!"
```

### string_to_bytes

Convert a `soroban_sdk::String` to `Bytes`.

```rust
let s = String::from_str(&env, "Hello");
let bytes = string_to_bytes(&env, &s);
```

### u32_to_bytes

Convert a `u32` to its decimal string representation as `Bytes`.

```rust
let bytes = u32_to_bytes(&env, 42);
// bytes = "42"
```

### i64_to_bytes

Convert an `i64` to its decimal string representation as `Bytes`.

```rust
let bytes = i64_to_bytes(&env, -42);
// bytes = "-42"
```

### escape_json_string

Escape a `String` for safe inclusion in JSON.

```rust
let s = String::from_str(&env, "Hello \"World\"");
let escaped = escape_json_string(&env, &s);
// escaped = Hello \"World\"
```

Escapes: `"` → `\"`, `\` → `\\`, newline → `\n`, carriage return → `\r`, tab → `\t`

### escape_json_bytes

Same as `escape_json_string` but works with byte slices.

```rust
let escaped = escape_json_bytes(&env, b"Hello \"World\"");
```


## Registry Module

For multi-contract applications where multiple contracts need to interact, the SDK provides a base registry implementation.

### BaseRegistry

A ready-to-use registry for managing contract address aliases:

```rust
use soroban_render_sdk::registry::{BaseRegistry, RegistryKey};
use soroban_sdk::{symbol_short, Address, Env, Map, Symbol};

// Initialize with admin and initial contracts
let mut contracts = Map::new(&env);
contracts.set(symbol_short!("theme"), theme_address);
contracts.set(symbol_short!("content"), content_address);
BaseRegistry::init(&env, &admin, contracts);

// Look up a contract by alias
let theme = BaseRegistry::get_by_alias(&env, symbol_short!("theme"));

// Register a new contract (admin only)
BaseRegistry::register(&env, symbol_short!("new"), new_address);

// Remove a contract alias (admin only)
BaseRegistry::unregister(&env, symbol_short!("old"));

// Get all registered contracts
let all = BaseRegistry::get_all(&env);
```

### Integration Example

Implement a registry contract using BaseRegistry:

```rust
use soroban_render_sdk::registry::BaseRegistry;
use soroban_sdk::{contract, contractimpl, symbol_short, Address, Env, Map, Symbol};

#[contract]
pub struct MyRegistry;

#[contractimpl]
impl MyRegistry {
    pub fn init(env: Env, admin: Address, theme: Address, content: Address) {
        let mut contracts = Map::new(&env);
        contracts.set(symbol_short!("theme"), theme);
        contracts.set(symbol_short!("content"), content);
        BaseRegistry::init(&env, &admin, contracts);
    }

    pub fn get_contract_by_alias(env: Env, alias: Symbol) -> Option<Address> {
        // Handle "registry" specially to return self
        if alias == symbol_short!("registry") {
            return Some(env.current_contract_address());
        }
        BaseRegistry::get_by_alias(&env, alias)
    }

    pub fn register_contract(env: Env, alias: Symbol, address: Address) {
        BaseRegistry::register(&env, alias, address);
    }
}
```

The viewer calls `get_contract_by_alias` to resolve aliases like `@theme` or `@content` to actual contract addresses.

### RegistryKey

Storage keys used internally by BaseRegistry:

| Key | Type | Description |
|-----|------|-------------|
| `Contracts` | `Map<Symbol, Address>` | Alias to address mappings |
| `Admin` | `Address` | Admin address for modifications |

### ContractRegistry Trait

Optional trait for type-safe registry implementations:

```rust
pub trait ContractRegistry {
    fn register_contract(env: &Env, alias: Symbol, address: Address);
    fn get_contract_by_alias(env: &Env, alias: Symbol) -> Option<Address>;
    fn get_all_contracts(env: &Env) -> Map<Symbol, Address>;
}
```


## Prelude

The prelude module re-exports common types for convenience:

```rust
use soroban_render_sdk::prelude::*;
```

This imports:
- `Bytes` (from soroban_sdk)
- `soroban_render!`, `render_v1!`, `render_formats!` macros
- `MarkdownBuilder` (with `markdown` feature)
- `JsonDocument`, `FormBuilder`, `TaskBuilder` (with `json` feature)
- `Router`, `RouterResult`, `Request` (with `router` feature)
- `BaseRegistry`, `RegistryKey`, `ContractRegistry` (with default features)
- All path utilities (with `router` feature)
- All byte utilities


## Example: Complete Contract

Here's a complete example showing multiple SDK features:

```rust
#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env, String, Vec};
use soroban_render_sdk::prelude::*;

soroban_render!(markdown, json);

#[contract]
pub struct TodoContract;

#[contractimpl]
impl TodoContract {
    pub fn render(env: Env, path: Option<String>, viewer: Option<Address>) -> Bytes {
        let wallet_connected = viewer.is_some();

        Router::new(&env, path)
            .handle(b"/", |_| Self::render_home(&env, wallet_connected))
            .or_handle(b"/about", |_| Self::render_about(&env))
            .or_handle(b"/task/{id}", |req| {
                let id = req.get_var_u32(b"id").unwrap_or(0);
                Self::render_task(&env, id)
            })
            .or_handle(b"/json", |_| Self::render_json(&env))
            .or_default(|_| Self::render_home(&env, wallet_connected))
    }

    fn render_home(env: &Env, wallet_connected: bool) -> Bytes {
        let mut md = MarkdownBuilder::new(env)
            .h1("Todo App")
            .render_link("About", "/about")
            .text(" | ")
            .render_link("JSON View", "/json")
            .newline().newline();

        if wallet_connected {
            md = md
                .input("title", "New task...")
                .form_link("Add Task", "add_task")
                .hr();
        } else {
            md = md
                .note("Connect your wallet to add tasks.")
                .hr();
        }

        md.paragraph("Your tasks will appear here.").build()
    }

    fn render_about(env: &Env) -> Bytes {
        MarkdownBuilder::new(env)
            .h1("About")
            .paragraph("This is a todo app built with Soroban Render.")
            .render_link("Back to Home", "/")
            .build()
    }

    fn render_task(env: &Env, id: u32) -> Bytes {
        MarkdownBuilder::new(env)
            .h1("Task Details")
            .text("Task ID: ")
            .number(id)
            .newline().newline()
            .tx_link_id("Complete", "complete_task", id)
            .text(" | ")
            .tx_link_id("Delete", "delete_task", id)
            .newline().newline()
            .render_link("Back to Home", "/")
            .build()
    }

    fn render_json(env: &Env) -> Bytes {
        JsonDocument::new(env, "Todo App")
            .nav_start()
            .nav_item("Home", "/", false, true)
            .nav_item("JSON", "/json", true, false)
            .nav_end()
            .heading(1, "Tasks")
            .form("add_task")
                .text_field("title", "Enter task...", true)
                .submit("Add")
            .divider()
            .task(1, "Example task", false)
                .tx_action("complete_task", 1, "Done")
                .tx_action("delete_task", 1, "Delete")
                .end()
            .build()
    }
}
```


## Related Documentation

- [Router Guide](./router-guide.md) - Detailed routing patterns and examples
- [Examples](./examples.md) - Walkthrough of example contracts
- [Markdown Format](./markdown-format.md) - Raw markdown syntax reference
- [JSON Format](./json-format.md) - JSON UI format specification
- [Getting Started](./getting-started.md) - First contract tutorial
