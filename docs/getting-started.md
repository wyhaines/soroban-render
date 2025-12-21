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

### 2. Add Render Metadata

Edit `src/lib.rs` to add the render convention metadata:

```rust
#![no_std]
use soroban_sdk::{contract, contractimpl, contractmeta, Address, Bytes, Env, String};

// Declare render support
contractmeta!(key = "render", val = "v1");
contractmeta!(key = "render_formats", val = "markdown");

#[contract]
pub struct MyContract;

#[contractimpl]
impl MyContract {
    pub fn render(env: Env, _path: Option<String>, _viewer: Option<Address>) -> Bytes {
        Bytes::from_slice(&env, b"# Hello from my contract!\n\nThis is my first renderable dApp.")
    }
}
```

### 3. Build the Contract

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

The basic contract above returns static markdown. To make your contract interactive, you can add navigation links, transaction triggers, and forms.

### Navigation Links

Add paths to navigate between views:

```rust
pub fn render(env: Env, path: Option<String>, _viewer: Option<Address>) -> Bytes {
    let path_str = path.map(|p| {
        let mut buf = [0u8; 64];
        let len = p.len() as usize;
        p.copy_into_slice(&mut buf[..len]);
        buf[..len].to_vec()
    });

    match path_str.as_deref() {
        Some(b"/about") => Bytes::from_slice(&env, b"# About\n\n[Back Home](render:/)"),
        _ => Bytes::from_slice(&env, b"# Home\n\n[Go to About](render:/about)"),
    }
}
```

### Transactions

Allow users to trigger contract methods:

```rust
// In your contract
pub fn increment(env: Env, caller: Address) {
    caller.require_auth();
    let count: u32 = env.storage().instance().get(&"count").unwrap_or(0);
    env.storage().instance().set(&"count", &(count + 1));
}

pub fn render(env: Env, _path: Option<String>, _viewer: Option<Address>) -> Bytes {
    let count: u32 = env.storage().instance().get(&"count").unwrap_or(0);

    // Assuming u32_to_bytes helper exists
    let mut parts = Vec::new(&env);
    parts.push_back(Bytes::from_slice(&env, b"# Counter: "));
    parts.push_back(Self::u32_to_bytes(&env, count));
    parts.push_back(Bytes::from_slice(&env, b"\n\n[Increment](tx:increment)"));

    Self::concat_bytes(&env, &parts)
}
```

### Forms

Collect user input with forms:

```rust
pub fn render(env: Env, _path: Option<String>, _viewer: Option<Address>) -> Bytes {
    Bytes::from_slice(&env, b"\
# Add Item

<input name=\"title\" type=\"text\" placeholder=\"Enter title\" />

[Submit](form:add_item)
")
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
