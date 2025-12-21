# Example Contracts

This guide walks through the example contracts included in the Soroban Render repository, demonstrating patterns from simple to complex.

## Overview

| Contract | Complexity | Features |
|----------|------------|----------|
| [Hello](#hello-contract) | Minimal | Viewer detection, conditional content |
| [Theme](#theme-contract) | Simple | Reusable components, include system |
| [Todo](#todo-contract) | Full | Routing, forms, state, CRUD, JSON format |


## Hello Contract

**Location:** `contracts/hello/`

The simplest possible renderable contract. In about 30 lines, it demonstrates the core concept: a contract that renders its own UI.

### Full Source

```rust
#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env, String};
use soroban_render_sdk::prelude::*;

// Declare render support - viewers check this metadata
soroban_render!(markdown);

#[contract]
pub struct HelloContract;

#[contractimpl]
impl HelloContract {
    pub fn render(env: Env, _path: Option<String>, viewer: Option<Address>) -> Bytes {
        match viewer {
            Some(_) => MarkdownBuilder::new(&env)
                .h1("Hello, Stellar User!")
                .paragraph("Your wallet is connected.")
                .paragraph("Welcome to **Soroban Render** - where your smart contract IS your frontend.")
                .build(),
            None => MarkdownBuilder::new(&env)
                .h1("Hello, World!")
                .paragraph("Connect your wallet to see a personalized greeting.")
                .paragraph("This UI is rendered directly from the smart contract.")
                .build(),
        }
    }
}
```

### Key Patterns

**1. Metadata Declaration**
```rust
soroban_render!(markdown);
```
This macro tells viewers that the contract supports rendering and outputs markdown format.

**2. The render() Function Signature**
```rust
pub fn render(env: Env, _path: Option<String>, viewer: Option<Address>) -> Bytes
```
- `env`: The Soroban environment
- `_path`: Optional sub-path for navigation (unused in this simple contract)
- `viewer`: Optional wallet address of the connected user
- Returns: `Bytes` containing the markdown output

**3. Viewer Detection**
```rust
match viewer {
    Some(_) => // User has wallet connected
    None => // Anonymous user
}
```
The viewer parameter lets you personalize content based on whether a wallet is connected.

### Testing

```rust
#[test]
fn test_render_without_wallet() {
    let env = Env::default();
    let contract_id = env.register(HelloContract, ());
    let client = HelloContractClient::new(&env, &contract_id);

    let result = client.render(&None, &None);
    // Convert bytes to string and verify content
    assert!(output.contains("Hello, World!"));
}
```


## Theme Contract

**Location:** `contracts/theme/`

A contract that provides reusable UI components for other contracts to include. Demonstrates the include system and component library pattern.

### Structure

```rust
#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env, String};
use soroban_render_sdk::prelude::*;

soroban_render!(markdown);

#[contract]
pub struct ThemeContract;

#[contractimpl]
impl ThemeContract {
    pub fn init(_env: Env) {}

    pub fn render(env: Env, _path: Option<String>, _viewer: Option<Address>) -> Bytes {
        // Returns documentation about available components
        MarkdownBuilder::new(&env)
            .h1("Soroban Render Theme Components")
            .paragraph("This contract provides reusable UI components...")
            .h2("Available Components")
            .list_item("`render_header` - App header with branding")
            .list_item("`render_footer` - App footer with credits")
            .list_item("`render_nav` - Navigation component")
            .build()
    }

    pub fn render_header(env: Env, _path: Option<String>, _viewer: Option<Address>) -> Bytes {
        MarkdownBuilder::new(&env)
            .h1("Todo List Demo")
            .paragraph("**This entire UI is rendered from a Soroban smart contract.**")
            .link("View Source on GitHub", "https://github.com/wyhaines/soroban-render")
            .hr()
            .build()
    }

    pub fn render_footer(env: Env, _path: Option<String>, _viewer: Option<Address>) -> Bytes {
        MarkdownBuilder::new(&env)
            .hr()
            .h3("How This Works")
            .paragraph("This UI comes directly from the smart contract...")
            .build()
    }

    pub fn render_nav(env: Env, _path: Option<String>, _viewer: Option<Address>) -> Bytes {
        MarkdownBuilder::new(&env)
            .render_link("Home", "/")
            .text(" | ")
            .render_link("Tasks", "/tasks")
            .text(" | ")
            .render_link("About", "/about")
            .build()
    }
}
```

### Key Patterns

**1. Multiple Render Functions**

Unlike hello, theme exports multiple public render functions:
- `render()` - Main entry point, returns component documentation
- `render_header()` - Header component
- `render_footer()` - Footer component
- `render_nav()` - Navigation component

**2. Consistent Function Signature**

All render functions use the same signature for compatibility with the include system:
```rust
pub fn render_*(env: Env, _path: Option<String>, _viewer: Option<Address>) -> Bytes
```

**3. Using Components from Other Contracts**

Other contracts can include these components:
```rust
MarkdownBuilder::new(&env)
    .include("CABCD...XYZ", "header")
    // ... main content ...
    .include("CABCD...XYZ", "footer")
    .build()
```

The viewer resolves these at runtime by calling `render_header()` and `render_footer()` on the theme contract.


## Todo Contract

**Location:** `contracts/todo/`

A full-featured todo list application demonstrating all major Soroban Render features: routing, forms, state management, and multi-format output.

### Contract Structure

```rust
#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Map, String, Vec};
use soroban_render_sdk::prelude::*;

soroban_render!(markdown, json);  // Supports both formats

// Storage keys
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Tasks(Address),    // Map<u32, Task> for each user
    NextId(Address),   // Next task ID for each user
    UserCount,         // Total unique users
    TotalTasks,        // Total tasks across all users
    HasTasks(Address), // Track unique users
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Task {
    pub id: u32,
    pub description: String,
    pub completed: bool,
    pub owner: Address,
}

#[contract]
pub struct TodoContract;

const THEME_CONTRACT_ID: &str = "CCYEOY2JTOQ2JIMLLERAFNHAVKEKMEJDBOTLN6DIIWBHWEIMUA2T2VY4";
```

### Routing

The contract uses the Router for path-based navigation:

```rust
pub fn render(env: Env, path: Option<String>, viewer: Option<Address>) -> Bytes {
    // Get tasks for the viewer (if connected)
    let tasks: Map<u32, Task> = if let Some(ref user) = viewer {
        let tasks_key = DataKey::Tasks(user.clone());
        env.storage().persistent().get(&tasks_key).unwrap_or(Map::new(&env))
    } else {
        Map::new(&env)
    };

    let wallet_connected = viewer.is_some();

    Router::new(&env, path)
        .handle(b"/", |_| Self::render_home(&env, wallet_connected))
        .or_handle(b"/about", |_| Self::render_about(&env))
        .or_handle(b"/tasks", |_| {
            Self::render_task_list(&env, &tasks, None, wallet_connected)
        })
        .or_handle(b"/tasks/pending", |_| {
            Self::render_task_list(&env, &tasks, Some(false), wallet_connected)
        })
        .or_handle(b"/tasks/completed", |_| {
            Self::render_task_list(&env, &tasks, Some(true), wallet_connected)
        })
        .or_handle(b"/task/{id}", |req| {
            let id = req.get_var_u32(b"id").unwrap_or(0);
            Self::render_single_task(&env, &tasks, id)
        })
        .or_handle(b"/json", |_| {
            Self::render_json(&env, &tasks, None, wallet_connected)
        })
        .or_handle(b"/json/*", |req| {
            Self::render_json(&env, &tasks, req.get_wildcard(), wallet_connected)
        })
        .or_default(|_| Self::render_home(&env, wallet_connected))
}
```

### Per-User Storage

Each user has their own isolated task list:

```rust
pub fn add_task(env: Env, description: String, caller: Address) -> u32 {
    caller.require_auth();

    let tasks_key = DataKey::Tasks(caller.clone());
    let next_id_key = DataKey::NextId(caller.clone());

    let mut tasks: Map<u32, Task> = env
        .storage()
        .persistent()
        .get(&tasks_key)
        .unwrap_or(Map::new(&env));

    let next_id: u32 = env.storage().persistent().get(&next_id_key).unwrap_or(1);

    let task = Task {
        id: next_id,
        description,
        completed: false,
        owner: caller.clone(),
    };

    tasks.set(next_id, task);
    env.storage().persistent().set(&tasks_key, &tasks);
    env.storage().persistent().set(&next_id_key, &(next_id + 1));

    next_id
}
```

### Form Handling

The task list page includes a form for adding tasks:

```rust
fn render_task_list(env: &Env, tasks: &Map<u32, Task>, filter: Option<bool>, wallet_connected: bool) -> Bytes {
    let mut md = MarkdownBuilder::new(env)
        .include(THEME_CONTRACT_ID, "header");

    if !wallet_connected {
        md = md
            .h2("Connect Your Wallet")
            .paragraph("Please connect your wallet to view and manage your personal todo list.");
    } else {
        // Add task form
        md = md
            .h2("Add Task")
            .textarea("description", 2, "What needs to be done?")
            .form_link("Add Task", "add_task")  // Triggers add_task method

            // Filter navigation
            .h2("Filter")
            .render_link("All", "/tasks")
            .text(" | ")
            .render_link("Pending", "/tasks/pending")
            .text(" | ")
            .render_link("Completed", "/tasks/completed")

            .h2("Your Tasks");

        // Render tasks with action buttons
        for (_, task) in tasks.iter() {
            // Apply filter...

            md = md.checkbox(task.completed, "");

            if task.completed {
                md = md.raw_str("~~").text_string(&task.description).raw_str("~~");
            } else {
                md = md.text_string(&task.description);
            }

            md = md.text(" (#").number(task.id).text(") ");

            // Action buttons
            if !task.completed {
                md = md.tx_link_id("Done", "complete_task", task.id).text(" ");
            }
            md = md.tx_link_id("Delete", "delete_task", task.id).newline();
        }
    }

    md.include(THEME_CONTRACT_ID, "footer").build()
}
```

### JSON Format Output

The same contract can output JSON format for a different UI experience:

```rust
fn render_json(env: &Env, tasks: &Map<u32, Task>, subpath: Option<Bytes>, wallet_connected: bool) -> Bytes {
    let filter = /* parse filter from subpath */;

    let mut doc = JsonDocument::new(env, "Todo List")
        .heading(1, "Todo List");

    if !wallet_connected {
        doc = doc
            .heading(2, "Connect Your Wallet")
            .text("Please connect your wallet...");
    } else {
        // Form
        doc = doc
            .form("add_task")
            .text_field("description", "Enter task description", true)
            .submit("Add Task");

        // Navigation
        doc = doc
            .nav_start()
            .nav_item("All", "/json", filter.is_none(), true)
            .nav_item("Pending", "/json/pending", filter == Some(false), false)
            .nav_item("Completed", "/json/completed", filter == Some(true), false)
            .nav_end();

        // Pie chart showing task status
        if completed_count > 0 || pending_count > 0 {
            doc = doc
                .pie_chart_start("Task Status")
                .pie_slice("Completed", completed_count, "#22c55e", true)
                .pie_slice("Pending", pending_count, "#eab308", false)
                .pie_chart_end();
        }

        // Task list
        doc = doc.heading(2, "Your Tasks").container_start("task-list");

        for (_, task) in tasks.iter() {
            let mut task_builder = doc.task_string(task.id, &task.description, task.completed);

            if !task.completed {
                task_builder = task_builder.tx_action("complete_task", task.id, "Done");
            }
            task_builder = task_builder.tx_action("delete_task", task.id, "Delete");

            doc = task_builder.end();
        }

        doc = doc.container_end();
    }

    doc.divider()
        .text("Powered by Soroban Render")
        .build()
}
```

### Component Includes

The todo contract includes header and footer from the theme contract:

```rust
fn render_home(env: &Env, wallet_connected: bool) -> Bytes {
    let mut md = MarkdownBuilder::new(env)
        .include(THEME_CONTRACT_ID, "header")  // Include header from theme
        // ... navigation and content ...
        .include(THEME_CONTRACT_ID, "footer")  // Include footer from theme
        .build()
}
```

### Global Statistics

The about page shows aggregate statistics using columns:

```rust
fn render_about(env: &Env) -> Bytes {
    let total_tasks: u32 = env.storage().persistent()
        .get(&DataKey::TotalTasks).unwrap_or(0);
    let user_count: u32 = env.storage().persistent()
        .get(&DataKey::UserCount).unwrap_or(0);

    MarkdownBuilder::new(env)
        .h3("Live Stats")
        .columns_start()
        .raw_str("**Total Tasks**\n\n# ")
        .number(total_tasks)
        .raw_str("\n\ntasks stored on-chain\n")
        .column_separator()
        .raw_str("**Unique Users**\n\n# ")
        .number(user_count)
        .raw_str("\n\nwallets with tasks\n")
        .columns_end()
        .build()
}
```


## Running the Examples

### Local Development

```bash
# Clone the repository
git clone https://github.com/wyhaines/soroban-render.git
cd soroban-render

# Install dependencies
pnpm install

# Start local Stellar network
pnpm docker:start

# Generate test identity
stellar keys generate alice --network local

# Build and deploy contracts
cd contracts/hello
stellar contract build
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/soroban_render_hello.wasm \
  --source alice \
  --network local
# Note the contract ID

# Start the viewer
cd ../..
pnpm dev

# Open http://localhost:5173 and enter the contract ID
```

### Running Tests

```bash
# Run all tests
cd contracts/hello && cargo test
cd contracts/theme && cargo test
cd contracts/todo && cargo test
```


## Related Documentation

- [Rust SDK Reference](./rust-sdk.md) - Complete API reference
- [Router Guide](./router-guide.md) - Path-based routing details
- [Markdown Format](./markdown-format.md) - Interactive protocols
- [JSON Format](./json-format.md) - Structured UI format
