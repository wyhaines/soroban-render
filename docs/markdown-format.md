# Markdown Format Reference

Soroban Render extends standard Markdown with interactive protocols and custom syntax for building dynamic dApp interfaces.

## Basic Markdown

All standard Markdown is supported:

```markdown
# Heading 1
## Heading 2

**Bold** and *italic* text

- Unordered lists
- With multiple items

1. Ordered lists
2. Also work

[Regular links](https://example.com)

`inline code` and

    code blocks
```

GitHub Flavored Markdown extensions are also supported:
- Tables
- Task lists
- Strikethrough (`~~text~~`)
- Autolinks

**With the SDK:**
```rust
use soroban_render_sdk::prelude::*;

MarkdownBuilder::new(&env)
    .h1("Heading 1")
    .h2("Heading 2")
    .bold("Bold")
    .text(" and ")
    .italic("italic")
    .text(" text")
    .newline().newline()
    .list_item("Unordered lists")
    .list_item("With multiple items")
    .link("Regular links", "https://example.com")
    .build()
```


## Interactive Protocols

### Navigation: `render:`

Navigate to different paths within the contract:

```markdown
[Home](render:/)
[About Page](render:/about)
[Task Details](render:/task/123)
```

**With the SDK:**
```rust
.render_link("Home", "/")
.render_link("About Page", "/about")
.render_link("Task Details", "/task/123")
```

When clicked, the viewer calls `render()` with the new path and re-renders.

### Transactions: `tx:`

Trigger contract method calls:

```markdown
[Complete Task](tx:complete_task {"id":1})
[Delete](tx:delete_task {"id":42})
[Simple Action](tx:do_something)
```

**With the SDK:**
```rust
.tx_link_id("Complete Task", "complete_task", 1)  // Builds {"id":1}
.tx_link_id("Delete", "delete_task", 42)
.tx_link("Simple Action", "do_something", "")     // No args
```

**Syntax:** `tx:method_name` optionally followed by a JSON object of arguments.

The viewer will:
1. Prompt the user to sign the transaction
2. Submit it to the network
3. Re-render the page on success

#### Transaction with Funds

Attach XLM to a transaction using `.send=`:

```markdown
[Donate 1 XLM](tx:donate {"message":"Thanks!"} .send=10000000)
[Buy Item](tx:purchase {"item_id":42} .send=5000000)
```

The number is in stroops (1 XLM = 10,000,000 stroops).

#### User-Settable Parameters

Use empty strings to prompt the user for input:

```markdown
[Post Message](tx:post {"message":""})
[Transfer](tx:transfer {"to":"", "amount":""})
```

The viewer will display input fields for empty parameters before submitting.

#### Targeting Specific Contracts

Target a specific contract via registry alias:

```markdown
[Flag Post](tx:@content:flag_reply {"post_id":123})
[Ban User](tx:@admin:ban_user {"user":"GABC..."})
```

**Syntax:** `tx:@alias:method {args}` where `alias` is registered in the application's registry contract.

Or target a contract directly:

```markdown
[Flag](tx:CABC123...:flag_post {"id":1})
```

**With the SDK:**
```rust
.tx_link_to("Flag Post", "content", "flag_reply", r#"{"post_id":123}"#)
.tx_link_to("Ban User", "admin", "ban_user", r#"{"user":"GABC..."}"#)
```

### Forms: `form:`

Collect input values and submit them as transaction arguments:

```markdown
<input name="title" type="text" placeholder="Enter title" />
<textarea name="description" rows="3"></textarea>

[Submit](form:add_item)
```

**With the SDK:**
```rust
.input("title", "Enter title")
.textarea("description", 3, "Enter description")
.form_link("Submit", "add_item")
```

The viewer collects all named input values and passes them to the specified method.

> [!IMPORTANT]
> Form values are automatically converted to Soroban types based on field naming conventions.
> See [Form Type Conversion](api-reference.md#form-type-conversion) for the complete rules.
> Key patterns: fields ending in `_id` become `u64`, fields named `count`/`limit`/`offset` become `u32`.

**Supported input types:**
- `text` - Single line text
- `textarea` - Multi-line text
- `number` - Numeric input
- `checkbox` - Boolean values
- `select` - Dropdown selection

#### Targeting Specific Contracts

In multi-contract applications, target a specific contract via registry alias:

```markdown
[Update Settings](form:@admin:set_chunk_size)
[Create Thread](form:@content:create_thread)
```

**Syntax:** `form:@alias:method` where `alias` is registered in the application's registry contract.

Or target a contract directly by ID:

```markdown
[Update](form:CABC123...:set_value)
```

**Syntax:** `form:CONTRACT_ID:method` where `CONTRACT_ID` is the full 56-character contract address.

**With the SDK:**
```rust
.form_link_to("Update Settings", "admin", "set_chunk_size")
.form_link_to("Create Thread", "content", "create_thread")
```

The viewer resolves aliases by calling `get_contract_by_alias(alias)` on the registry contract.


## Alerts and Callouts

GitHub-style alert syntax for highlighting important information:

```markdown
> [!NOTE]
> This is informational content.

> [!TIP]
> Here's a helpful suggestion.

> [!INFO]
> Additional context about something.

> [!WARNING]
> Be careful with this action.

> [!CAUTION]
> This action cannot be undone!
```

**With the SDK:**
```rust
.note("This is informational content.")
.tip("Here's a helpful suggestion.")
.info("Additional context about something.")
.warning("Be careful with this action.")
.caution("This action cannot be undone!")

// Or with custom type:
.alert("IMPORTANT", "Custom alert type.")
```

**Alert Types:**
| Type | Color | Use For |
|------|-------|---------|
| NOTE | Blue | General information |
| TIP | Green | Helpful suggestions |
| INFO | Gray | Additional context |
| WARNING | Yellow | Important cautions |
| CAUTION | Red | Dangerous actions |


## Multi-Column Layouts

Create responsive column layouts for dashboards:

```markdown
:::columns
**First Column**

Content for the first column with **markdown** support.
|||
**Second Column**

Content for the second column.
|||
**Third Column**

Optional third column.
:::
```

**With the SDK:**
```rust
.columns_start()
.bold("First Column")
.newline().newline()
.text("Content for the first column.")
.column_separator()
.bold("Second Column")
.newline().newline()
.text("Content for the second column.")
.columns_end()
```

**Features:**
- 2-4 columns supported
- Responsive: stacks on mobile
- Full markdown support within columns
- Columns separated by `|||`


## Progressive Content Loading

For content that exceeds comfortable single-response sizes, use continuation markers to enable progressive loading. The viewer fetches the initial content immediately and loads remaining chunks in the background.

### Continuation Markers

Signal that more content should be loaded from a chunk collection:

```markdown
# Comments (showing first 5)

> **Alice**: Great post!

> **Bob**: I have a question.

...first 5 comments...

{{continue collection="comments" from=5 total=50}}
```

**With the SDK:**
```rust
.continuation("comments", 5, Some(50))
// Output: {{continue collection="comments" from=5 total=50}}

// Without total count:
.continuation("comments", 5, None)
// Output: {{continue collection="comments" from=5}}
```

The viewer detects this marker and calls `get_chunk()` for indices 5, 6, 7... until all content loads.

### Chunk References

Reference a specific chunk inline:

```markdown
## Article Body

{{chunk collection="article" index=0}}

## Comments

{{chunk collection="comments" index=0 placeholder="Loading comments..."}}
```

**With the SDK:**
```rust
.chunk_ref("article", 0)
// Output: {{chunk collection="article" index=0}}

.chunk_ref_placeholder("comments", 0, "Loading comments...")
// Output: {{chunk collection="comments" index=0 placeholder="Loading comments..."}}
```

### Paginated Continuation

For page-based navigation:

```markdown
## Comments (page 2 of 5)

{{continue collection="comments" page=2 per_page=10 total=47}}
```

**With the SDK:**
```rust
.continue_page("comments", 2, 10, 47)
// Output: {{continue collection="comments" page=2 per_page=10 total=47}}
```

### Contract Implementation

Contracts using continuation markers must implement `get_chunk()`:

```rust
use soroban_chonk::prelude::*;

// Main render - returns first N items with continuation marker
pub fn render(env: Env, _path: Option<String>, _viewer: Option<Address>) -> Bytes {
    let comments = Chonk::open(&env, symbol_short!("comments"));
    let total = comments.count();

    let mut builder = MarkdownBuilder::new(&env);
    builder = builder.h1("Comments");

    // Show first 5 immediately
    for i in 0..5.min(total) {
        if let Some(chunk) = comments.get(i) {
            builder = builder.raw(chunk);
        }
    }

    // Add continuation for the rest
    if total > 5 {
        builder = builder.continuation("comments", 5, Some(total));
    }

    builder.build()
}

// Called by viewer for each remaining chunk
pub fn get_chunk(env: Env, collection: Symbol, index: u32) -> Option<Bytes> {
    Chonk::open(&env, collection).get(index)
}

// Optional: metadata for progress indicators
pub fn get_chunk_meta(env: Env, collection: Symbol) -> Option<ChonkMeta> {
    let chonk = Chonk::open(&env, collection);
    if chonk.count() > 0 {
        Some(chonk.meta())
    } else {
        None
    }
}
```


## Contract Alias Definitions: `{{aliases}}`

Define friendly alias names for contract IDs, allowing includes to use short names instead of 56-character contract addresses.

```markdown
{{aliases config=CCOBK... registry=CCDBT... theme=CBWU6...}}
```

**Alternative JSON format:**
```markdown
{{aliases {"config":"CCOBK...","registry":"CCDBT...","theme":"CBWU6..."}}}
```

The viewer extracts these mappings early in the rendering pipeline and uses them when resolving `{{include}}` tags.

**With the SDK (BaseRegistry):**
```rust
use soroban_render_sdk::registry::BaseRegistry;

// Emit all registered aliases automatically
let aliases_tag = BaseRegistry::emit_aliases(&env);
MarkdownBuilder::new(&env)
    .raw(aliases_tag)  // {{aliases theme=CXYZ... content=CABC...}}
    // ... rest of content
```

**Cross-contract pattern:**
```rust
// Registry exposes:
pub fn render_aliases(env: Env) -> Bytes {
    BaseRegistry::emit_aliases(&env)
}

// Other contracts fetch via cross-contract call:
fn fetch_aliases(env: &Env) -> Bytes {
    let registry: Address = /* get registry address */;
    let args: Vec<Val> = Vec::new(env);
    env.try_invoke_contract::<Bytes, soroban_sdk::Error>(
        &registry,
        &Symbol::new(env, "render_aliases"),
        args,
    ).ok().and_then(|r| r.ok()).unwrap_or(Bytes::new(env))
}

// In render function:
let aliases = Self::fetch_aliases(env);
MarkdownBuilder::new(env)
    .raw(aliases)
    // ... rest of content
```

**Manual approach (for custom alias logic):**
```rust
fn emit_aliases(env: &Env) -> Bytes {
    let mut result = Bytes::from_slice(env, b"{{aliases ");
    // Add each alias: name=CONTRACT_ID
    result.append(&Bytes::from_slice(env, b"config="));
    result.append(&config_contract_id_bytes);
    result.append(&Bytes::from_slice(env, b" registry="));
    result.append(&registry_contract_id_bytes);
    result.append(&Bytes::from_slice(env, b"}}"));
    result
}
```

**Benefits:**
- Users can write `{{include contract=config func="logo"}}` instead of `{{include contract=CCOBKFEZERN3SSZBFAZY5A6M2WPLVDLKPAWU7IEUQU35VMA6VKHXA62C func="logo"}}`
- Centralized alias definitions in one place
- Aliases are removed from rendered output (viewer extracts and removes the tag)


## Cross-Contract Includes

Include UI components from other contracts:

```markdown
{{include contract=CABC...XYZ func="header"}}

Your content here...

{{include contract=CABC...XYZ func="footer"}}
```

**Using aliases** (requires `{{aliases}}` tag in content):
```markdown
{{include contract=config func="logo"}}
{{include contract=theme func="footer"}}
```

**Special `SELF` keyword** (refers to current contract):
```markdown
{{include contract=SELF func="sidebar"}}
```

**With the SDK:**
```rust
const THEME_ID: &str = "CABC...XYZ";

.include(THEME_ID, "header")
// Your content here...
.include(THEME_ID, "footer")

// With path argument:
.include_with_path(THEME_ID, "render", "/tasks")
```

**Parameters:**
- `contract` - The contract ID, alias name, or `SELF`
- `func` - The render function name (e.g., "header" calls `render_header()`)

The included contract must implement the corresponding function:

```rust
pub fn render_header(env: Env) -> Bytes {
    Bytes::from_slice(&env, b"# My Header\n\n---\n")
}
```


## Protecting Content from Resolution: `{{noparse}}`

Content wrapped in `{{noparse}}...{{/noparse}}` blocks is preserved exactly as-is during include resolution. The noparse tags themselves are stripped after processing, leaving only the inner content.

**Use Case:** Form field values containing `{{include ...}}` tags that should be displayed for editing rather than resolved.

```markdown
{{noparse}}{{include contract=config func="logo"}}{{/noparse}}
```

**Result:** The include tag is preserved as literal text:
```
{{include contract=config func="logo"}}
```

Without noparse, the viewer would attempt to resolve the include and replace it with the actual logo content (or an error message if resolution fails).

**With the SDK:**
```rust
// Use the noparse variant for textarea values
.textarea_markdown_with_value_noparse_string(
    "footer_text",
    3,
    "Custom footer text",
    &branding.footer_text
)
```

The SDK method `textarea_markdown_with_value_noparse_string()` automatically wraps the value in noparse tags, ensuring that any special syntax in the value is displayed as-is in the editor rather than being resolved.

**When to Use:**
- Form fields that edit content containing `{{include ...}}` tags
- Displaying raw template syntax for documentation
- Any content that should bypass the viewer's tag resolution pipeline


## HTML Form Elements

Embedded HTML form elements are supported and sanitized:

### Text Input
```html
<input name="title" type="text" placeholder="Enter title" />
```

### Textarea
```html
<textarea name="description" rows="4" placeholder="Details..."></textarea>
```

### Number Input
```html
<input name="amount" type="number" min="0" max="100" />
```

### Checkbox
```html
<input name="agree" type="checkbox" /> I agree to the terms
```

### Select Dropdown
```html
<select name="priority">
  <option value="low">Low</option>
  <option value="medium">Medium</option>
  <option value="high">High</option>
</select>
```


## Security

All Markdown output is sanitized using [DOMPurify](https://github.com/cure53/DOMPurify). The following are allowed:

**Safe HTML tags:**
- Structural: `div`, `span`, `p`, `br`, `hr`
- Text: `h1`-`h6`, `strong`, `em`, `code`, `pre`
- Lists: `ul`, `ol`, `li`
- Tables: `table`, `thead`, `tbody`, `tr`, `th`, `td`
- Forms: `form`, `input`, `textarea`, `select`, `option`, `label`, `button`
- Links: `a` (with `href`)
- Media: `img` (with `src`, `alt`)

**Blocked:**
- Script tags and event handlers
- iframes and embeds
- Style tags (inline styles allowed)
- Any JavaScript execution


## Complete Example

```markdown
{{include contract=THEME_ID func="header"}}

[Home](render:/) | [Tasks](render:/tasks) | [About](render:/about)


> [!TIP]
> This entire UI is generated by the smart contract!

## Add Task

<textarea name="description" rows="2" placeholder="What needs to be done?"></textarea>

[Add Task](form:add_task)

:::columns
**Pending Tasks**

- [ ] Buy groceries [Done](tx:complete {"id":1})
- [ ] Walk the dog [Done](tx:complete {"id":2})
|||
**Completed Tasks**

- [x] ~~Wash dishes~~
- [x] ~~Send email~~
:::


{{include contract=THEME_ID func="footer"}}
```

For structured component definitions with type-safe layouts and chart support, see [JSON Format](./json-format.md). To integrate contract rendering into your own React application, [React Integration](./react-integration.md) documents the available hooks and components. The [API Reference](./api-reference.md) provides complete documentation for all exported functions.
