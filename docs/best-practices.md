# Best Practices

Design patterns and recommendations for building effective Soroban Render contracts.

## Contract Structure

### Separate Render Logic from Business Logic

Keep your contract organized by separating concerns:

```rust
#[contractimpl]
impl TodoContract {
    // === Public API Methods ===

    pub fn add_task(env: Env, description: String, caller: Address) -> u32 {
        caller.require_auth();
        Self::internal_add_task(&env, description, caller)
    }

    pub fn complete_task(env: Env, id: u32, caller: Address) {
        caller.require_auth();
        Self::internal_complete_task(&env, id, caller)
    }

    // === Render Entry Point ===

    pub fn render(env: Env, path: Option<String>, viewer: Option<Address>) -> Bytes {
        let tasks = Self::get_user_tasks(&env, &viewer);
        let wallet_connected = viewer.is_some();

        Router::new(&env, path)
            .handle(b"/", |_| Self::render_home(&env, wallet_connected))
            .or_handle(b"/tasks", |_| Self::render_tasks(&env, &tasks, wallet_connected))
            .or_default(|_| Self::render_home(&env, wallet_connected))
    }

    // === Private Helpers ===

    fn internal_add_task(env: &Env, description: String, caller: Address) -> u32 { ... }
    fn internal_complete_task(env: &Env, id: u32, caller: Address) { ... }
    fn get_user_tasks(env: &Env, viewer: &Option<Address>) -> Map<u32, Task> { ... }

    // === Render Functions ===

    fn render_home(env: &Env, wallet_connected: bool) -> Bytes { ... }
    fn render_tasks(env: &Env, tasks: &Map<u32, Task>, wallet_connected: bool) -> Bytes { ... }
}
```

### Use Helper Functions for Repeated Patterns

Extract common UI patterns:

```rust
fn render_nav(env: &Env, active: &str) -> MarkdownBuilder {
    MarkdownBuilder::new(env)
        .render_link(if active == "home" { "**Home**" } else { "Home" }, "/")
        .text(" | ")
        .render_link(if active == "tasks" { "**Tasks**" } else { "Tasks" }, "/tasks")
        .text(" | ")
        .render_link(if active == "about" { "**About**" } else { "About" }, "/about")
        .newline().newline()
}

fn render_tasks_page(env: &Env) -> Bytes {
    let mut md = render_nav(env, "tasks");
    md = md.h1("Tasks");
    // ... rest of page
    md.build()
}
```


## State Management

### Use Per-User Storage Keys

For multi-user contracts, namespace storage by user:

```rust
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Tasks(Address),    // Per-user task map
    NextId(Address),   // Per-user ID counter
    GlobalStats,       // Shared statistics
}

fn get_tasks(env: &Env, user: &Address) -> Map<u32, Task> {
    let key = DataKey::Tasks(user.clone());
    env.storage().persistent().get(&key).unwrap_or(Map::new(env))
}
```

### Handle Missing Data Gracefully

Always provide defaults for optional storage:

```rust
// Good - handles missing data
let tasks: Map<u32, Task> = env.storage()
    .persistent()
    .get(&tasks_key)
    .unwrap_or(Map::new(&env));

// Good - explicit default
let count: u32 = env.storage()
    .persistent()
    .get(&DataKey::Count)
    .unwrap_or(0);
```


## Size Optimization

### Use Feature Flags

Only include what you need:

```toml
# Markdown only (smallest)
soroban-render-sdk = { ..., default-features = false, features = ["markdown"] }

# Markdown + Router (common case)
soroban-render-sdk = { ..., default-features = false, features = ["markdown", "router"] }

# Everything (largest)
soroban-render-sdk = { ... }  # Uses defaults
```

### Minimize String Constants

```rust
// Instead of repeating strings:
.paragraph("Powered by Soroban Render")
.paragraph("Powered by Soroban Render")

// Use constants:
const FOOTER: &str = "Powered by Soroban Render";
.paragraph(FOOTER)
.paragraph(FOOTER)

// Or use includes for shared content:
.include(THEME_CONTRACT_ID, "footer")
```

### Factor Out Common Components

Use the theme contract pattern for shared UI:

```rust
// In your contract, include from theme:
.include(THEME_CONTRACT_ID, "header")
// ... page content ...
.include(THEME_CONTRACT_ID, "footer")
```


## Routing

### Order Routes Correctly

More specific routes should come first:

```rust
Router::new(&env, path)
    // Specific routes first
    .handle(b"/task/new", |_| new_task_form())
    .or_handle(b"/task/{id}/edit", |req| edit_task_form(req))
    // General pattern routes after
    .or_handle(b"/task/{id}", |req| show_task(req))
    // Catch-all last
    .or_default(|_| home())
```

### Always Provide a Default

```rust
Router::new(&env, path)
    .handle(b"/", |_| home())
    .or_handle(b"/about", |_| about())
    .or_default(|_| {
        // Don't leave users stranded
        home()
        // Or show a helpful message:
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


## Error Handling

### Show Meaningful Messages

```rust
fn render_task(env: &Env, tasks: &Map<u32, Task>, id: u32) -> Bytes {
    match tasks.get(id) {
        Some(task) => {
            // Render task details
            MarkdownBuilder::new(env)
                .h1("Task Details")
                .text("Description: ")
                .text_string(&task.description)
                .build()
        }
        None => {
            // Clear error message with navigation
            MarkdownBuilder::new(env)
                .h1("Task Not Found")
                .paragraph("The requested task doesn't exist or has been deleted.")
                .render_link("View All Tasks", "/tasks")
                .build()
        }
    }
}
```

### Handle Wallet Connection States

```rust
fn render_tasks(env: &Env, viewer: &Option<Address>) -> Bytes {
    match viewer {
        Some(user) => {
            // Render user's tasks
            let tasks = get_user_tasks(env, user);
            render_task_list(env, &tasks)
        }
        None => {
            // Clear call to action
            MarkdownBuilder::new(env)
                .h2("Connect Your Wallet")
                .warning("Please connect your wallet to view and manage your tasks.")
                .paragraph("Each user has their own private task list.")
                .build()
        }
    }
}
```


## When to Use Markdown vs JSON

### Use Markdown When:

- Content is primarily text-based
- You want simple, fast rendering
- Layout is mostly linear/sequential
- You need minimal contract size

```rust
soroban_render!(markdown);

pub fn render(...) -> Bytes {
    MarkdownBuilder::new(&env)
        .h1("Simple Page")
        .paragraph("Text-heavy content works well in markdown.")
        .build()
}
```

### Use JSON When:

- You need structured components (charts, complex forms)
- Rich interactivity is important
- You want more control over layout
- You're building a dashboard-style UI

```rust
soroban_render!(json);

pub fn render(...) -> Bytes {
    JsonDocument::new(&env, "Dashboard")
        .pie_chart_start("Status")
        .pie_slice("Complete", 10, "#22c55e", true)
        .pie_slice("Pending", 5, "#eab308", false)
        .pie_chart_end()
        .build()
}
```

### Use Both When:

- You want different views (user preference)
- Some pages are text-heavy, others need charts

```rust
soroban_render!(markdown, json);

pub fn render(env: Env, path: Option<String>, viewer: Option<Address>) -> Bytes {
    Router::new(&env, path)
        .handle(b"/", |_| render_markdown_home(&env))
        .or_handle(b"/json", |_| render_json_home(&env))
        .or_handle(b"/json/*", |req| render_json(&env, req.get_wildcard()))
        .or_default(|_| render_markdown_home(&env))
}
```


## Testing

### Test Both States

```rust
#[test]
fn test_with_and_without_wallet() {
    // Test anonymous view
    let output_anon = client.render(&None, &None);
    assert!(output_anon_str.contains("Connect your wallet"));

    // Test authenticated view
    let user = Address::generate(&env);
    let output_auth = client.render(&None, &Some(user));
    assert!(!output_auth_str.contains("Connect your wallet"));
}
```

### Test All Routes

```rust
#[test]
fn test_all_routes() {
    let paths = ["/", "/about", "/tasks", "/tasks/pending"];

    for path_str in paths {
        let path = String::from_str(&env, path_str);
        let output = client.render(&Some(path), &None);
        assert!(output.len() > 0, "Route {} returned empty", path_str);
    }
}
```


## Performance

### Minimize Storage Reads

```rust
// Good - one storage read
pub fn render(env: Env, path: Option<String>, viewer: Option<Address>) -> Bytes {
    let tasks = get_tasks(&env, &viewer);  // Read once

    Router::new(&env, path)
        .handle(b"/", |_| render_home(&env, &tasks))      // Pass reference
        .or_handle(b"/tasks", |_| render_tasks(&env, &tasks))
        .or_default(|_| render_home(&env, &tasks))
}

// Avoid - multiple storage reads
fn render_home(env: &Env) -> Bytes {
    let tasks = get_tasks(env);  // Don't re-read in each handler
    // ...
}
```

### Use Early Returns

```rust
fn render_task(env: &Env, tasks: &Map<u32, Task>, id: u32) -> Bytes {
    // Early return for error case
    let task = match tasks.get(id) {
        Some(t) => t,
        None => return MarkdownBuilder::new(env)
            .h1("Not Found")
            .build()
    };

    // Main logic
    MarkdownBuilder::new(env)
        .h1("Task")
        .text_string(&task.description)
        .build()
}
```


## Progressive Loading

For content that exceeds comfortable single-response sizes, use chunked storage and continuation markers.

### When to Use Progressive Loading

- Comment threads with 10+ entries
- Long-form articles (> 10KB)
- Paginated lists
- Media galleries

### First-Paint-Fast Pattern

Show initial content immediately, load the rest in the background:

```rust
use soroban_chonk::prelude::*;

pub fn render(env: Env, _path: Option<String>, _viewer: Option<Address>) -> Bytes {
    let comments = Chonk::open(&env, symbol_short!("comments"));
    let total = comments.count();

    let mut builder = MarkdownBuilder::new(&env)
        .h1("Comments");

    // Render first 5 immediately (fast first paint)
    for i in 0..5.min(total) {
        if let Some(chunk) = comments.get(i) {
            builder = builder.raw(chunk);
        }
    }

    // Add continuation for remaining
    if total > 5 {
        builder = builder.continuation("comments", 5, Some(total));
    }

    builder.build()
}

// Viewer calls this for remaining chunks
pub fn get_chunk(env: Env, collection: Symbol, index: u32) -> Option<Bytes> {
    Chonk::open(&env, collection).get(index)
}
```

### Chunk Size Guidelines

| Content Type | Recommended Size | Rationale |
|--------------|------------------|-----------|
| Comments/replies | 1 item per chunk | Natural edit boundaries |
| Long-form text | 4-8 KB | Balance calls vs. size |
| Structured data | 2-4 KB | Keep logical units together |


## Multi-Contract Architecture

For larger applications, split functionality across multiple contracts to stay within Soroban's 64KB limit and maintain separation of concerns.

### When to Use Multiple Contracts

- Contract exceeds ~50KB compiled
- Different logical domains (users, content, admin)
- Different upgrade cadences
- Need for specialized storage patterns

### Registry Pattern

Use a registry contract to manage contract discovery:

```rust
// In your registry contract
use soroban_render_sdk::registry::BaseRegistry;

#[contractimpl]
impl MyRegistry {
    pub fn init(env: Env, admin: Address, theme: Address, content: Address) {
        let mut contracts = Map::new(&env);
        contracts.set(symbol_short!("theme"), theme);
        contracts.set(symbol_short!("content"), content);
        BaseRegistry::init(&env, &admin, contracts);
    }

    pub fn get_contract_by_alias(env: Env, alias: Symbol) -> Option<Address> {
        if alias == symbol_short!("registry") {
            return Some(env.current_contract_address());
        }
        BaseRegistry::get_by_alias(&env, alias)
    }
}
```

### Targeting Contracts in Forms

Use `form_link_to` and `tx_link_to` to send transactions to specific contracts:

```rust
// Instead of calling this contract
.form_link("Submit", "create_reply")

// Target a specific contract via registry alias
.form_link_to("Submit", "content", "create_reply")
// Output: [Submit](form:@content:create_reply)
```

The viewer resolves `@content` by calling `registry.get_contract_by_alias("content")`.

### Contract Responsibilities

Design contracts around clear responsibilities:

| Contract | Example Responsibilities |
|----------|-------------------------|
| **Registry** | Contract discovery, board creation, global config |
| **Content** | Store/retrieve threads, replies, media |
| **Permissions** | Role management, bans, invites |
| **Theme** | UI rendering, CSS, layout |
| **Admin** | Settings UI, moderation tools |

### Cross-Contract Data Access

For rendering, contracts can read data from other contracts:

```rust
fn render_board(env: &Env, board_id: u64) -> Bytes {
    // Get content contract address from registry
    let content_addr = get_content_contract(env);

    // Create client and fetch data
    let content = ContentClient::new(env, &content_addr);
    let threads = content.list_threads(&board_id, &0, &10);

    // Render with the data
    let mut md = MarkdownBuilder::new(env);
    for thread in threads.iter() {
        md = md.render_link(&thread.title, &format!("/b/{}/t/{}", board_id, thread.id));
    }
    md.build()
}
```

### Upgrade Strategy

With multiple contracts, plan your upgrade approach:

```rust
// In registry: upgrade any registered contract
pub fn upgrade_contract(env: Env, contract_id: Address, new_wasm_hash: BytesN<32>) {
    let admin: Address = env.storage().instance().get(&RegistryKey::Admin).unwrap();
    admin.require_auth();

    // Call the target contract's upgrade function
    let client = UpgradeableClient::new(&env, &contract_id);
    client.upgrade(&new_wasm_hash);
}
```

### Example: Soroban Boards Architecture

See [Soroban Boards](https://github.com/wyhaines/soroban-boards) for a complete multi-contract application:

- **Registry**: Board factory, contract aliases
- **Board**: Per-board thread management
- **Content**: Thread/reply content storage
- **Permissions**: Roles, bans, invites
- **Theme**: UI rendering
- **Admin**: Admin panel


## Related Documentation

- [Rust SDK Reference](./rust-sdk.md) - API details
- [Router Guide](./router-guide.md) - Routing patterns
- [Examples](./examples.md) - Complete examples
- [Testing](./testing.md) - Testing strategies
- [Troubleshooting](./troubleshooting.md) - Common issues
