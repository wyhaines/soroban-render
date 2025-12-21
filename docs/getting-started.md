# Getting Started

This guide walks you through creating your first renderable Soroban contract.

## Prerequisites

Before you begin, ensure you have:

- [Rust](https://www.rust-lang.org/tools/install) (latest stable)
- [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools#cli)
- [Docker](https://www.docker.com/) (for local development)
- [Node.js 18+](https://nodejs.org/) and [pnpm](https://pnpm.io/) (for the viewer)

## Project Setup

### 1. Create a New Contract

```bash
stellar contract init my-renderable-app
cd my-renderable-app
```

### 2. Add the SDK Dependency

Add `soroban-render-sdk` to your `Cargo.toml`:

```toml
[dependencies]
soroban-sdk = "22.0.0"
soroban-render-sdk = { git = "https://github.com/wyhaines/soroban-render-sdk.git" }
```

### 3. Add Render Support

Edit `src/lib.rs` to add the render convention:

```rust
#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env, String};
use soroban_render_sdk::prelude::*;

// Declare render support
soroban_render!(markdown);

#[contract]
pub struct MyContract;

#[contractimpl]
impl MyContract {
    pub fn render(env: Env, _path: Option<String>, _viewer: Option<Address>) -> Bytes {
        MarkdownBuilder::new(&env)
            .h1("Hello from my contract!")
            .paragraph("This is my first renderable dApp.")
            .build()
    }
}
```

The `soroban_render!()` macro declares the contract's render capability, and `MarkdownBuilder` provides a fluent API for constructing markdown output.

### 4. Build the Contract

```bash
stellar contract build
```

This creates a WASM file in `target/wasm32-unknown-unknown/release/`.

## Local Development

With the contract built, you can run it on a local Stellar network for testing.

### Start Local Stellar Network

Using Docker:

```bash
docker run --rm -it \
  -p 8000:8000 \
  --name stellar-local \
  stellar/quickstart:latest \
  --standalone \
  --enable-soroban-rpc
```

Or using the Soroban Render repository's Docker Compose:

```bash
git clone https://github.com/wyhaines/soroban-render.git
cd soroban-render
pnpm install
pnpm docker:start
```

### Deploy Your Contract

```bash
# Generate a test identity
stellar keys generate alice --network local

# Deploy the contract
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/my_contract.wasm \
  --source alice \
  --network local
```

Save the returned contract ID (e.g., `CABC...XYZ`).

### View Your Contract

Using the Soroban Render viewer:

1. Clone and start the viewer:
   ```bash
   git clone https://github.com/wyhaines/soroban-render.git
   cd soroban-render
   pnpm install
   pnpm dev
   ```

2. Open http://localhost:5173

3. Enter your contract ID and select "Local" network

4. Your contract's UI appears!

## Adding Interactivity

The basic contract above returns static markdown. To make your contract interactive, you can add navigation links, transaction triggers, and forms using the SDK.

### Navigation with Router

Use the Router for clean path-based navigation:

```rust
use soroban_render_sdk::prelude::*;

pub fn render(env: Env, path: Option<String>, _viewer: Option<Address>) -> Bytes {
    Router::new(&env, path)
        .handle(b"/", |_| {
            MarkdownBuilder::new(&env)
                .h1("Home")
                .render_link("Go to About", "/about")
                .build()
        })
        .or_handle(b"/about", |_| {
            MarkdownBuilder::new(&env)
                .h1("About")
                .render_link("Back Home", "/")
                .build()
        })
        .or_default(|_| {
            MarkdownBuilder::new(&env)
                .h1("Home")
                .render_link("Go to About", "/about")
                .build()
        })
}
```

### Transactions

Allow users to trigger contract methods:

```rust
pub fn increment(env: Env, caller: Address) {
    caller.require_auth();
    let count: u32 = env.storage().instance().get(&"count").unwrap_or(0);
    env.storage().instance().set(&"count", &(count + 1));
}

pub fn render(env: Env, _path: Option<String>, _viewer: Option<Address>) -> Bytes {
    let count: u32 = env.storage().instance().get(&"count").unwrap_or(0);

    MarkdownBuilder::new(&env)
        .h1("Counter")
        .text("Current count: ")
        .number(count)
        .newline().newline()
        .tx_link("Increment", "increment", "")
        .build()
}
```

### Forms

Collect user input with forms:

```rust
pub fn render(env: Env, _path: Option<String>, _viewer: Option<Address>) -> Bytes {
    MarkdownBuilder::new(&env)
        .h1("Add Item")
        .input("title", "Enter title")
        .form_link("Submit", "add_item")
        .build()
}
```

## Deploying to Testnet

Once your contract works locally, you can deploy it to testnet for broader testing or to share with others.

1. Fund a testnet account at https://laboratory.stellar.org/#account-creator

2. Add your identity:
   ```bash
   stellar keys add my-wallet --secret-key
   # Enter your secret key when prompted
   ```

3. Deploy:
   ```bash
   stellar contract deploy \
     --wasm target/wasm32-unknown-unknown/release/my_contract.wasm \
     --source my-wallet \
     --network testnet
   ```

4. View at https://wyhaines.github.io/soroban-render/ using "Testnet" network

For a side-by-side comparison of this approach versus traditional frontend development, see [Hello World Comparison](./hello-world.md). The [Markdown Format](./markdown-format.md) reference covers all interactive protocols in detail, and [JSON Format](./json-format.md) explains the structured component approach. The [example contracts](https://github.com/wyhaines/soroban-render/tree/main/contracts) in the repository demonstrate more complex patterns.
