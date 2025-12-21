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


## Interactive Protocols

### Navigation: `render:`

Navigate to different paths within the contract:

```markdown
[Home](render:/)
[About Page](render:/about)
[Task Details](render:/task/123)
```

When clicked, the viewer calls `render()` with the new path and re-renders.

### Transactions: `tx:`

Trigger contract method calls:

```markdown
[Complete Task](tx:complete_task {"id":1})
[Delete](tx:delete_task {"id":42})
[Simple Action](tx:do_something)
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

### Forms: `form:`

Collect input values and submit them as transaction arguments:

```markdown
<input name="title" type="text" placeholder="Enter title" />
<textarea name="description" rows="3"></textarea>

[Submit](form:add_item)
```

The viewer collects all named input values and passes them to the specified method.

**Supported input types:**
- `text` - Single line text
- `textarea` - Multi-line text
- `number` - Numeric input
- `checkbox` - Boolean values
- `select` - Dropdown selection


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

**Features:**
- 2-4 columns supported
- Responsive: stacks on mobile
- Full markdown support within columns
- Columns separated by `|||`


## Cross-Contract Includes

Include UI components from other contracts:

```markdown
{{include contract=CABC...XYZ func="header"}}

Your content here...

{{include contract=CABC...XYZ func="footer"}}
```

**Parameters:**
- `contract` - The contract ID to call
- `func` - The render function name (e.g., "header" calls `render_header()`)

The included contract must implement the corresponding function:

```rust
pub fn render_header(env: Env) -> Bytes {
    Bytes::from_slice(&env, b"# My Header\n\n---\n")
}
```


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
