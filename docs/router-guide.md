# Router Guide

This guide covers path-based routing in Soroban Render contracts using the SDK's Router. The Router provides declarative, pattern-based routing inspired by gno.land's mux router, adapted for Soroban's `no_std` environment.

## Why Use Routing?

Routing allows a single `render()` function to serve multiple views based on the path. Instead of creating separate contracts for each page, you can:

- Navigate between views within one contract
- Create detail pages for items (e.g., `/task/42`)
- Organize complex UIs with logical URL structures
- Support deep linking to specific views

## Basic Concepts

### The Path Parameter

The `render()` function receives an optional path:

```rust
pub fn render(env: Env, path: Option<String>, viewer: Option<Address>) -> Bytes {
    // path is None for the root view
    // path is Some("/about") for /about
    // path is Some("/task/123") for /task/123
}
```

### Pattern Matching

The Router matches paths against patterns:

| Pattern | Matches | Captures |
|---------|---------|----------|
| `/` | Root only | Nothing |
| `/tasks` | `/tasks` exactly | Nothing |
| `/task/{id}` | `/task/1`, `/task/42`, `/task/abc` | `id` = "1", "42", "abc" |
| `/files/*` | `/files/a`, `/files/a/b/c` | `*` = "a", "a/b/c" |

### First-Match Semantics

Routes are evaluated in order. The first matching pattern wins:

```rust
Router::new(&env, path)
    .handle(b"/task/new", |_| create_task_form())  // Checked first
    .or_handle(b"/task/{id}", |_| show_task())     // Only if above doesn't match
    .or_default(|_| home())                         // Fallback
```

**Important:** Place more specific routes before general ones.


## Getting Started

### Minimal Router

```rust
use soroban_render_sdk::prelude::*;

pub fn render(env: Env, path: Option<String>, _viewer: Option<Address>) -> Bytes {
    Router::new(&env, path)
        .handle(b"/", |_| {
            MarkdownBuilder::new(&env)
                .h1("Home")
                .render_link("About", "/about")
                .build()
        })
        .or_handle(b"/about", |_| {
            MarkdownBuilder::new(&env)
                .h1("About")
                .render_link("Home", "/")
                .build()
        })
        .or_default(|_| {
            MarkdownBuilder::new(&env)
                .h1("Not Found")
                .render_link("Home", "/")
                .build()
        })
}
```

### Using Helper Functions

For cleaner code, extract handlers to separate functions:

```rust
pub fn render(env: Env, path: Option<String>, viewer: Option<Address>) -> Bytes {
    Router::new(&env, path)
        .handle(b"/", |_| Self::render_home(&env))
        .or_handle(b"/about", |_| Self::render_about(&env))
        .or_handle(b"/tasks", |_| Self::render_tasks(&env))
        .or_default(|_| Self::render_home(&env))
}

fn render_home(env: &Env) -> Bytes {
    MarkdownBuilder::new(env)
        .h1("Welcome")
        .paragraph("This is the home page.")
        .build()
}

fn render_about(env: &Env) -> Bytes {
    MarkdownBuilder::new(env)
        .h1("About")
        .paragraph("About this app...")
        .build()
}

fn render_tasks(env: &Env) -> Bytes {
    MarkdownBuilder::new(env)
        .h1("Tasks")
        .paragraph("Your tasks here...")
        .build()
}
```


## Pattern Types

### Static Routes

Match exact paths:

```rust
.handle(b"/", |_| home())
.or_handle(b"/tasks", |_| task_list())
.or_handle(b"/tasks/pending", |_| pending_tasks())
.or_handle(b"/settings/account", |_| account_settings())
```

### Named Parameters

Capture path segments as variables using `{name}` syntax:

```rust
.or_handle(b"/task/{id}", |req| {
    // Access the parameter
    let id_bytes: Option<Bytes> = req.get_var(b"id");
    let id: Option<u32> = req.get_var_u32(b"id");

    // Use the ID
    match id {
        Some(task_id) => render_task(&env, task_id),
        None => render_error(&env, "Invalid task ID"),
    }
})
```

**Multiple parameters:**

```rust
.or_handle(b"/user/{user_id}/post/{post_id}", |req| {
    let user_id = req.get_var_u32(b"user_id").unwrap_or(0);
    let post_id = req.get_var_u32(b"post_id").unwrap_or(0);
    render_post(&env, user_id, post_id)
})
```

### Wildcards

Capture everything after the pattern using `*`:

```rust
.or_handle(b"/files/*", |req| {
    // Get everything after /files/
    let remaining: Option<Bytes> = req.get_wildcard();

    match remaining {
        Some(path) => render_file(&env, path),
        None => render_file_list(&env),
    }
})
```

For path `/files/docs/readme.md`, `get_wildcard()` returns `"docs/readme.md"`.


## Parameter Extraction

### The Request Object

Each handler receives a `Request` object:

```rust
.or_handle(b"/task/{id}", |req| {
    // Full path as Bytes
    let path: &Bytes = req.path();

    // Named parameter as Bytes
    let id_bytes: Option<Bytes> = req.get_var(b"id");

    // Named parameter as u32 (parsed)
    let id: Option<u32> = req.get_var_u32(b"id");

    // Wildcard match
    let wildcard: Option<Bytes> = req.get_wildcard();

    // ...
})
```

### get_var

Returns the raw bytes of a named parameter:

```rust
.or_handle(b"/user/{name}", |req| {
    match req.get_var(b"name") {
        Some(name_bytes) => {
            // name_bytes is Bytes, use for string comparison
            if path_eq(&name_bytes, b"admin") {
                render_admin(&env)
            } else {
                render_user(&env, name_bytes)
            }
        }
        None => render_error(&env),
    }
})
```

### get_var_u32

Parses a named parameter as a `u32`. Returns `None` if:
- The parameter doesn't exist
- The parameter contains non-numeric characters

```rust
.or_handle(b"/page/{num}", |req| {
    let page = req.get_var_u32(b"num").unwrap_or(1);
    render_page(&env, page)
})
```

### get_wildcard

Returns everything captured by `*`:

```rust
.or_handle(b"/api/*", |req| {
    let api_path = req.get_wildcard().unwrap_or_else(|| {
        Bytes::from_slice(&env, b"")
    });

    // Route to different API handlers based on api_path
    if path_starts_with(&api_path, b"users") {
        handle_users_api(&env, api_path)
    } else if path_starts_with(&api_path, b"tasks") {
        handle_tasks_api(&env, api_path)
    } else {
        api_not_found(&env)
    }
})
```


## Common Patterns

### List and Detail Views

```rust
Router::new(&env, path)
    .handle(b"/tasks", |_| {
        // Show all tasks
        Self::render_task_list(&env)
    })
    .or_handle(b"/task/{id}", |req| {
        // Show single task
        let id = req.get_var_u32(b"id").unwrap_or(0);
        Self::render_task_detail(&env, id)
    })
    .or_default(|_| Self::render_task_list(&env))
```

### Filtered Lists

```rust
Router::new(&env, path)
    .handle(b"/tasks", |_| Self::render_tasks(&env, None))
    .or_handle(b"/tasks/pending", |_| Self::render_tasks(&env, Some(false)))
    .or_handle(b"/tasks/completed", |_| Self::render_tasks(&env, Some(true)))
    .or_default(|_| Self::render_tasks(&env, None))

fn render_tasks(env: &Env, completed_filter: Option<bool>) -> Bytes {
    // Filter tasks based on completed_filter
    // None = all, Some(false) = pending, Some(true) = completed
}
```

### Multi-Format Support

Serve markdown and JSON from the same contract:

```rust
Router::new(&env, path)
    .handle(b"/", |_| Self::render_markdown_home(&env))
    .or_handle(b"/json", |_| Self::render_json_home(&env))
    .or_handle(b"/json/*", |req| {
        let json_path = req.get_wildcard();
        Self::render_json(&env, json_path)
    })
    .or_default(|_| Self::render_markdown_home(&env))
```

### Nested Routes with Wildcards

```rust
Router::new(&env, path)
    .handle(b"/", |_| home())
    .or_handle(b"/admin/*", |req| {
        // Sub-router for admin section
        let admin_path = req.get_wildcard();
        route_admin(&env, admin_path)
    })
    .or_default(|_| home())

fn route_admin(env: &Env, path: Option<Bytes>) -> Bytes {
    let path_bytes = path.unwrap_or_else(|| Bytes::from_slice(env, b""));

    if path_eq(&path_bytes, b"users") {
        admin_users(env)
    } else if path_eq(&path_bytes, b"settings") {
        admin_settings(env)
    } else {
        admin_dashboard(env)
    }
}
```

### CRUD Routes

```rust
Router::new(&env, path)
    // List
    .handle(b"/items", |_| Self::list_items(&env))

    // Create form
    .or_handle(b"/items/new", |_| Self::new_item_form(&env))

    // Read single
    .or_handle(b"/item/{id}", |req| {
        let id = req.get_var_u32(b"id").unwrap_or(0);
        Self::show_item(&env, id)
    })

    // Edit form
    .or_handle(b"/item/{id}/edit", |req| {
        let id = req.get_var_u32(b"id").unwrap_or(0);
        Self::edit_item_form(&env, id)
    })

    .or_default(|_| Self::list_items(&env))
```


## Path Utility Functions

For cases where the Router isn't needed, use these utility functions directly.

### path_to_bytes

Convert `Option<String>` to `Bytes`:

```rust
use soroban_render_sdk::router::path_to_bytes;

let path_bytes = path_to_bytes(&env, &path);
// None → "/" as Bytes
// Some("/tasks") → "/tasks" as Bytes
```

### path_eq

Check exact path match:

```rust
use soroban_render_sdk::router::path_eq;

if path_eq(&path_bytes, b"/") {
    return render_home(&env);
}
```

### path_starts_with

Check path prefix:

```rust
use soroban_render_sdk::router::path_starts_with;

if path_starts_with(&path_bytes, b"/api/") {
    return handle_api(&env, &path_bytes);
}
```

### path_suffix

Extract path after a prefix:

```rust
use soroban_render_sdk::router::path_suffix;

// path = "/files/docs/readme.md"
let suffix = path_suffix(&env, &path_bytes, b"/files/");
// suffix = "docs/readme.md"
```

### parse_id

Parse numeric ID from a path:

```rust
use soroban_render_sdk::router::parse_id;

// path = "/task/123"
if let Some(id) = parse_id(&path_bytes, b"/task/") {
    return render_task(&env, id);  // id = 123
}
```


## Best Practices

### Route Order

Place specific routes before general ones:

```rust
// GOOD - specific before general
.handle(b"/task/new", |_| new_task())
.or_handle(b"/task/{id}", |_| show_task())

// BAD - general catches everything
.handle(b"/task/{id}", |_| show_task())  // Catches /task/new!
.or_handle(b"/task/new", |_| new_task()) // Never reached
```

### Default Handler

Always provide a sensible default:

```rust
.or_default(|_| {
    // Option 1: Redirect to home
    render_home(&env)

    // Option 2: 404-style message
    // MarkdownBuilder::new(&env)
    //     .h1("Page Not Found")
    //     .render_link("Go Home", "/")
    //     .build()
})
```

### Handle Invalid Parameters

```rust
.or_handle(b"/task/{id}", |req| {
    match req.get_var_u32(b"id") {
        Some(id) if id > 0 => render_task(&env, id),
        _ => MarkdownBuilder::new(&env)
            .h1("Invalid Task")
            .paragraph("Task ID must be a positive number.")
            .render_link("View All Tasks", "/tasks")
            .build()
    }
})
```

### Keep Handlers Simple

Extract complex logic to helper functions:

```rust
// GOOD - handler calls helper
.or_handle(b"/task/{id}", |req| {
    let id = req.get_var_u32(b"id").unwrap_or(0);
    Self::render_task_detail(&env, &tasks, id)
})

// AVOID - complex logic inline
.or_handle(b"/task/{id}", |req| {
    let id = req.get_var_u32(b"id").unwrap_or(0);
    let task = tasks.iter().find(|t| t.id == id);
    // ... lots more code ...
})
```


## Related Documentation

- [Rust SDK Reference](./rust-sdk.md) - Complete API reference
- [Examples](./examples.md) - See routing in example contracts
- [Markdown Format](./markdown-format.md) - The `render:` protocol for navigation
