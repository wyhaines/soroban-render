# Soroban Render

[![CI](https://github.com/wyhaines/soroban-render/actions/workflows/ci.yml/badge.svg)](https://github.com/wyhaines/soroban-render/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@soroban-render/core.svg)](https://www.npmjs.com/package/@soroban-render/core)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

**Self-contained, renderable dApps on Stellar's Soroban platform.**

[Live Demos](https://wyhaines.github.io/soroban-render/) | [Documentation](./docs/README.md)

What if your smart contract could render its own UI? No separate frontend to build, deploy, or maintain. Just the contract.

Inspired by [Gno.land's `Render()` function](https://docs.gno.land/users/explore-with-gnoweb/#viewing-rendered-content), Soroban Render lets contracts return Markdown or JSON that any compatible viewer can display.

## Traditional vs Soroban Render

| Traditional Approach | Soroban Render |
|---------------------|----------------|
| Clone frontend template | Add `render()` function |
| Generate TypeScript bindings | — |
| Set up wallet integration | — |
| Build UI components | — |
| Deploy frontend separately | Deploy contract only |
| **200+ lines across 10+ files** | **~30 lines, 1 file** |

## Hello World

This is a complete, renderable Soroban dApp using the SDK:

```rust
#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env, String};
use soroban_render_sdk::prelude::*;

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
                .build(),
            None => MarkdownBuilder::new(&env)
                .h1("Hello, World!")
                .paragraph("Connect your wallet for a personalized greeting.")
                .build(),
        }
    }
}
```

Deploy it, and view it instantly.

## The SDK

The [soroban-render-sdk](https://github.com/wyhaines/soroban-render-sdk) provides builders and utilities to make contract development easier:

```toml
[dependencies]
soroban-render-sdk = { git = "https://github.com/wyhaines/soroban-render-sdk.git" }
```

**Features:**
- `MarkdownBuilder` — Fluent API for markdown construction
- `JsonDocument` — Type-safe JSON UI builder
- `Router` — Declarative path-based routing
- `soroban_render!()` macro — Simple metadata declaration
- Utilities for byte conversion, JSON escaping, and more

You can also build without the SDK using raw bytes — see [docs/hello-world.md](docs/hello-world.md) for a comparison.

## Viewing Your Contract

**You don't build a frontend.** You use an existing viewer:

### Option 1: Hosted Viewer (Easiest)

1. Deploy your contract to testnet/mainnet
2. Go to **https://wyhaines.github.io/soroban-render/**
3. Enter your contract ID
4. Done — **10 seconds**

### Option 2: Local Development

```bash
git clone https://github.com/wyhaines/soroban-render.git
cd soroban-render && pnpm install && pnpm dev
```

Open http://localhost:5173 and enter your contract ID.

### Option 3: Deploy Your Own Viewer

Want your contract at your own URL? Use the [deploy template](./templates/viewer-deploy/):

1. Copy `templates/viewer-deploy/` to a new repository
2. Add `VITE_CONTRACT_ID` and `VITE_NETWORK` as GitHub secrets
3. Enable GitHub Pages → Push to `main`

Your viewer deploys at `https://YOUR_USERNAME.github.io/YOUR_REPO/` — **5 minutes**

### Option 4: Embed in Your App

Use the [@soroban-render/core](https://www.npmjs.com/package/@soroban-render/core) library to add contract viewing to any React application.

**The viewer handles everything:** wallet connection, transaction signing, form submission, navigation, error handling. You just build and deploy the contract.

## Features

- **Contract-side UI** — `render()` returns Markdown or JSON
- **Interactive protocols** — `render:`, `tx:`, `form:` links for navigation and transactions
- **Composability** — Include components from other contracts
- **React library** — Hooks and components for custom viewers
- **Charts** — Pie, gauge, and bar charts in JSON format
- **Alerts & layouts** — GitHub-style callouts, multi-column layouts

## Quick Start

### View the Live Demos

Several example contracts are deployed on testnet. Just visit:

**https://wyhaines.github.io/soroban-render/**

The viewer auto-loads a homepage contract that links to all the example demos. The homepage itself is a Soroban contract.

### Build Your Own Contract

**Prerequisites:**
- [Rust](https://www.rust-lang.org/tools/install)
- [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools#cli)

**Deploy to testnet:**

```bash
# Create your contract (or use the hello example)
git clone https://github.com/wyhaines/soroban-render.git
cd soroban-render/contracts/hello

# Build
stellar contract build

# Deploy to testnet
stellar keys generate mykey --network testnet
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/soroban_render_hello.wasm \
  --source mykey \
  --network testnet
```

Then view it at https://wyhaines.github.io/soroban-render/ — enter your contract ID and select "Testnet".

### Local Development

For local development with a private Stellar network:

```bash
# Prerequisites: Docker, Node.js 18+, pnpm
git clone https://github.com/wyhaines/soroban-render.git
cd soroban-render
pnpm install
pnpm docker:start

# Deploy locally
stellar keys generate alice --network local
cd contracts/hello
stellar contract build
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/soroban_render_hello.wasm \
  --source alice \
  --network local

# Run local viewer
cd ../..
pnpm dev
```

### Embed in Your App

```bash
pnpm add @soroban-render/core
```

```tsx
import { createClient, useRender, InteractiveRenderView, Networks } from "@soroban-render/core";

function App() {
  const client = createClient(Networks.testnet.rpcUrl, Networks.testnet.networkPassphrase);
  const { html, loading, error, refresh } = useRender(client, "CABC...XYZ");

  return <InteractiveRenderView client={client} contractId="CABC...XYZ" html={html} loading={loading} error={error} onRefresh={refresh} />;
}
```

## Documentation

**Getting Started**
- [Introduction](./docs/introduction.md) — Why Soroban Render?
- [Getting Started](./docs/getting-started.md) — Build your first contract
- [Viewing Contracts](./docs/viewing-contracts.md) — How to view any renderable contract
- [Hello World Comparison](./docs/hello-world.md) — Full complexity comparison

**Rust SDK** ([soroban-render-sdk](https://github.com/wyhaines/soroban-render-sdk))
- [Rust SDK Reference](./docs/rust-sdk.md) — Complete API for MarkdownBuilder, JsonDocument, Router
- [Router Guide](./docs/router-guide.md) — Path matching and routing patterns
- [Examples](./docs/examples.md) — Walkthrough of example contracts

**Format References**
- [Markdown Format](./docs/markdown-format.md) — Interactive markdown syntax
- [JSON Format](./docs/json-format.md) — Structured UI definitions

**Guides**
- [Testing](./docs/testing.md) — Testing renderable contracts
- [Best Practices](./docs/best-practices.md) — Design patterns and recommendations
- [Troubleshooting](./docs/troubleshooting.md) — Common issues and solutions

**TypeScript/React**
- [React Integration](./docs/react-integration.md) — Hooks and components
- [API Reference](./docs/api-reference.md) — Complete library documentation


## Project Structure

```
soroban-render/
├── contracts/
│   ├── hello/           # Minimal hello world example
│   ├── todo/            # Full-featured todo app
│   ├── theme/           # Reusable UI components
│   ├── chunked-example/ # Progressive content loading demo
│   └── homepage/        # Demo portal (links to all examples)
├── packages/
│   └── soroban-render/  # @soroban-render/core library
├── apps/
│   └── viewer/          # Universal contract viewer
├── templates/
│   └── viewer-deploy/   # Fork-and-deploy viewer template
└── docs/                # Documentation
```


## Interactive Markdown

Contracts can return markdown with special protocols:

```markdown
# My App

[Home](render:/)                              <!-- Navigation -->
[Delete](tx:delete {"id":1})                  <!-- Transaction -->
<input name="title" />[Add](form:add_item)    <!-- Form submission -->

> [!TIP]                                      <!-- Alert callout -->
> This UI comes from the blockchain!

:::columns                                    <!-- Multi-column layout -->
Column 1 content
|||
Column 2 content
:::

{{include contract=THEME_ID func="footer"}}   <!-- Include from other contract -->
```


## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

Apache 2.0 — see [LICENSE](LICENSE)


## Resources

- [Soroban Documentation](https://soroban.stellar.org/docs)
- [Stellar Developer Portal](https://developers.stellar.org)
- [Gno.land Render Concept](https://docs.gno.land/users/explore-with-gnoweb/#viewing-rendered-content)
