# JSON Format Reference

For more complex interfaces, contracts can return structured JSON instead of Markdown. This provides type-safe component definitions and enables features like charts.

## When to Use JSON

JSON format suits complex, structured UIs where you want explicit control over component layout and type-safe definitions. It's also required for chart components (pie, gauge, bar) and works well when you prefer a declarative component tree over markdown parsing.

Markdown remains the better choice for content-focused interfaces, rapid prototyping, and cases where human-readable contract output matters for debugging or auditing.

## Document Structure

```json
{
  "format": "soroban-render-json-v1",
  "title": "My Application",
  "components": [
    { "type": "heading", "level": 1, "text": "Hello" },
    { "type": "text", "content": "Welcome to my app" }
  ]
}
```

**With the SDK:**
```rust
use soroban_render_sdk::prelude::*;

JsonDocument::new(&env, "My Application")
    .heading(1, "Hello")
    .text("Welcome to my app")
    .build()
```

**Required fields:**
- `format` - Must be `"soroban-render-json-v1"`
- `components` - Array of component objects

**Optional fields:**
- `title` - Page title


## Component Types

### Heading

```json
{
  "type": "heading",
  "level": 1,
  "text": "Page Title"
}
```

- `level` - 1-6 (corresponds to h1-h6)
- `text` - The heading text

### Text

```json
{
  "type": "text",
  "content": "Plain text paragraph"
}
```

### Markdown

```json
{
  "type": "markdown",
  "content": "Text with **bold** and *italic*"
}
```

Renders inline markdown within the content.

### Divider

```json
{
  "type": "divider"
}
```

Horizontal rule separator.

### Button

```json
{
  "type": "button",
  "action": "tx",
  "method": "do_something",
  "args": { "id": 42 },
  "label": "Click Me"
}
```

**Actions:**
- `"tx"` - Submit a transaction (requires `method`, optional `args`)
- `"render"` - Navigate to a path (requires `path`)

```json
{
  "type": "button",
  "action": "render",
  "path": "/about",
  "label": "Go to About"
}
```

### Form

```json
{
  "type": "form",
  "action": "add_task",
  "fields": [
    {
      "name": "title",
      "type": "text",
      "placeholder": "Task title",
      "required": true
    },
    {
      "name": "priority",
      "type": "select",
      "options": [
        { "label": "Low", "value": "low" },
        { "label": "High", "value": "high" }
      ]
    }
  ],
  "submitLabel": "Add Task"
}
```

**With the SDK:**
```rust
.form("add_task")
    .text_field("title", "Task title", true)
    .textarea_field("description", "Details")
    .submit("Add Task")
```

**Field types:**
- `text` - Single line input
- `textarea` - Multi-line input
- `number` - Numeric input
- `checkbox` - Boolean checkbox
- `select` - Dropdown with options

### List

```json
{
  "type": "list",
  "ordered": false,
  "items": [
    { "type": "text", "content": "First item" },
    { "type": "text", "content": "Second item" }
  ]
}
```

- `ordered` - `true` for numbered list, `false` for bullets
- `items` - Array of components to render as list items

### Task

Specialized component for todo-style items:

```json
{
  "type": "task",
  "id": 1,
  "text": "Buy groceries",
  "completed": false,
  "actions": [
    {
      "type": "tx",
      "method": "complete_task",
      "args": { "id": 1 },
      "label": "Done"
    },
    {
      "type": "tx",
      "method": "delete_task",
      "args": { "id": 1 },
      "label": "Delete"
    }
  ]
}
```

**With the SDK:**
```rust
.task(1, "Buy groceries", false)
    .tx_action("complete_task", 1, "Done")
    .tx_action("delete_task", 1, "Delete")
    .end()

// With dynamic text:
.task_string(task.id, &task.description, task.completed)
    .tx_action("complete_task", task.id, "Done")
    .end()
```

### Navigation

```json
{
  "type": "navigation",
  "items": [
    { "label": "Home", "path": "/", "active": true },
    { "label": "Tasks", "path": "/tasks" },
    { "label": "About", "path": "/about" }
  ]
}
```

**With the SDK:**
```rust
.nav_start()
.nav_item("Home", "/", true, true)      // label, path, active, first
.nav_item("Tasks", "/tasks", false, false)
.nav_item("About", "/about", false, false)
.nav_end()
```

### Container

Group components with optional styling:

```json
{
  "type": "container",
  "className": "task-list",
  "components": [
    { "type": "heading", "level": 2, "text": "Tasks" },
    { "type": "text", "content": "Your tasks appear here" }
  ]
}
```

### Include

Include content from another contract:

```json
{
  "type": "include",
  "contract": "CABC...XYZ",
  "path": "/header"
}
```


## Chart Components

### Pie Chart

```json
{
  "type": "chart",
  "chartType": "pie",
  "title": "Task Distribution",
  "data": [
    { "label": "Completed", "value": 75, "color": "#22c55e" },
    { "label": "Pending", "value": 25, "color": "#eab308" }
  ]
}
```

**With the SDK:**
```rust
.pie_chart_start("Task Distribution")
.pie_slice("Completed", 75, "#22c55e", true)   // label, value, color, first
.pie_slice("Pending", 25, "#eab308", false)
.pie_chart_end()
```

### Gauge Chart

```json
{
  "type": "chart",
  "chartType": "gauge",
  "value": 75,
  "max": 100,
  "label": "Progress",
  "color": "#3b82f6"
}
```

**With the SDK:**
```rust
.gauge(75, 100, "Progress")  // value, max, label
```

### Bar Chart

```json
{
  "type": "chart",
  "chartType": "bar",
  "title": "Monthly Stats",
  "data": [
    { "label": "Jan", "value": 100, "color": "#3b82f6" },
    { "label": "Feb", "value": 150, "color": "#3b82f6" },
    { "label": "Mar", "value": 120, "color": "#3b82f6" }
  ]
}
```


## Complete Example

```json
{
  "format": "soroban-render-json-v1",
  "title": "Todo Application",
  "components": [
    {
      "type": "navigation",
      "items": [
        { "label": "Home", "path": "/" },
        { "label": "Tasks", "path": "/tasks", "active": true },
        { "label": "Stats", "path": "/stats" }
      ]
    },
    { "type": "divider" },
    { "type": "heading", "level": 1, "text": "Your Tasks" },
    {
      "type": "form",
      "action": "add_task",
      "fields": [
        { "name": "description", "type": "textarea", "placeholder": "What needs to be done?" }
      ],
      "submitLabel": "Add Task"
    },
    {
      "type": "chart",
      "chartType": "pie",
      "title": "Task Status",
      "data": [
        { "label": "Completed", "value": 3, "color": "#22c55e" },
        { "label": "Pending", "value": 2, "color": "#eab308" }
      ]
    },
    {
      "type": "container",
      "className": "task-list",
      "components": [
        {
          "type": "task",
          "id": 1,
          "text": "Buy groceries",
          "completed": false,
          "actions": [
            { "type": "tx", "method": "complete_task", "args": { "id": 1 }, "label": "Done" }
          ]
        },
        {
          "type": "task",
          "id": 2,
          "text": "Walk the dog",
          "completed": true,
          "actions": []
        }
      ]
    },
    { "type": "divider" },
    { "type": "text", "content": "Powered by Soroban Render" }
  ]
}
```


## TypeScript Types

The full TypeScript type definitions are available in the library:

```typescript
import type {
  JsonUIDocument,
  JsonComponent,
  HeadingComponent,
  TextComponent,
  FormComponent,
  ChartComponent,
  // ... more
} from "@soroban-render/core";
```

See [API Reference](./api-reference.md) for complete type definitions.


## Detecting Format

Contracts can support both formats. The library auto-detects based on content:

```typescript
import { detectFormat, parseMarkdown, parseJsonUI } from "@soroban-render/core";

const format = detectFormat(contractOutput);

if (format === "json") {
  const result = parseJsonUI(contractOutput);
} else {
  const html = await parseMarkdown(contractOutput);
}
```

For simpler content-focused interfaces, [Markdown Format](./markdown-format.md) covers the interactive markdown syntax. To integrate contract rendering into your own React application, see [React Integration](./react-integration.md). The [API Reference](./api-reference.md) documents all exported functions and types.
