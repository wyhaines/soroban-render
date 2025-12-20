# Soroban Render

A community convention and library for self-contained, renderable Soroban dApps.

## [View Live Demo](https://wyhaines.github.io/soroban-render/)

The demo shows a fully functional Todo app where **the entire UI is defined by the smart contract itself**. The contract returns markdown with embedded forms and action links - no separate frontend code needed.

---

Inspired by [Gno.land's `Render()` function](https://docs.gno.land/concepts/realms#render), Soroban Render enables Soroban smart contracts to provide their own user interface, allowing developers to build simple, interactive dApps primarily within the contract itself.

## Features

- **Contract-side `render()` convention** - Contracts return Markdown or JSON UI descriptions
- **Interactive protocols** - `render:` for navigation, `tx:` for transactions, `form:` for form submissions
- **Composability** - Contracts can include UI components from other contracts
- **React library** - Hooks and components for rendering contract UIs
- **Universal viewer** - Works with any contract that implements `render()`
- **Local development** - Uses Stellar Quickstart Docker for fast iteration
- **Testnet/Mainnet support** - Deploy anywhere Soroban runs

## Quick Start

### Prerequisites

- [Node.js 18+](https://nodejs.org/)
- [pnpm 9+](https://pnpm.io/)
- [Docker](https://www.docker.com/) (for local development)
- [Rust](https://www.rust-lang.org/) (for contract development)
- [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools#cli)

### Installation

```bash
# Clone the repository
git clone https://github.com/wyhaines/soroban-render.git
cd soroban-render

# Install dependencies
pnpm install

# Build the library
pnpm build
```

### Local Development

1. **Start the local Stellar network:**

```bash
pnpm docker:start
```

This starts Stellar Quickstart with Soroban RPC at `http://localhost:8000`.

2. **Build and deploy the example contract:**

```bash
# Build the contract
pnpm contract:build

# Deploy to local network (you'll need to set up identities first)
stellar keys generate alice --network local
pnpm contract:deploy
```

3. **Run the demo app:**

```bash
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173) and enter your contract ID.

## Project Structure

```
soroban-render/
├── contracts/
│   ├── todo/              # Example todo list contract
│   └── theme/             # Reusable UI components contract
├── packages/
│   └── soroban-render/    # @soroban-render/core library
├── apps/
│   └── viewer/            # Universal contract viewer
├── docker-compose.yml     # Local Stellar Quickstart
└── package.json           # Workspace root
```

## Contract Convention

To make your contract renderable, implement a `render()` function and add the metadata flags:

```rust
use soroban_sdk::{contractmeta, contract, contractimpl, Bytes, Env, String, Address};

// Declare render support
contractmeta!(key = "render", val = "v1");
contractmeta!(key = "render_formats", val = "markdown");

#[contract]
pub struct MyContract;

#[contractimpl]
impl MyContract {
    /// Render the contract UI
    /// Returns Markdown (or JSON) as UTF-8 bytes
    pub fn render(
        env: Env,
        path: Option<String>,    // Sub-view path, e.g., "/task/123"
        viewer: Option<Address>  // Connected wallet address
    ) -> Bytes {
        let markdown = String::from_str(&env, "# Hello, Soroban!\n\nThis is a renderable contract.");
        Bytes::from_slice(&env, markdown.to_buffer::<256>().as_slice())
    }
}
```

## Using the Library

### Installation

```bash
pnpm add @soroban-render/core
```

### React Usage

```tsx
import { createClient, useRender, RenderView, Networks } from "@soroban-render/core";

function App() {
  const client = createClient(Networks.testnet.rpcUrl, Networks.testnet.networkPassphrase);
  const { html, loading, error } = useRender(client, "CABC...XYZ");

  return <RenderView html={html} loading={loading} error={error} />;
}
```

### Direct API

```typescript
import { createClient, callRender } from "@soroban-render/core";

const client = createClient("http://localhost:8000/soroban/rpc", "Standalone Network ; February 2017");
const markdown = await callRender(client, "CABC...XYZ", { path: "/task/1" });
console.log(markdown);
```

## Interactive Markdown

Contracts can return markdown with special protocols for interactivity:

```markdown
# My Todo App

## Add Task
<input name="description" type="text" placeholder="Task description" />
[Add Task](form:add_task)

## Tasks
- [ ] Buy groceries [Done](tx:complete_task {"id":1}) [Delete](tx:delete_task {"id":1})
- [x] ~~Walk the dog~~ (completed)

## Navigation
[All](render:/) | [Pending](render:/pending) | [Completed](render:/completed)

---
{{include contract=THEME_CONTRACT_ID func="footer"}}
```

### Protocols

| Protocol | Example | Description |
|----------|---------|-------------|
| `render:` | `[Link](render:/path)` | Navigate to a new path (re-renders contract) |
| `tx:` | `[Click](tx:method {"arg":1})` | Submit a transaction |
| `form:` | `[Submit](form:method)` | Submit form inputs as transaction args |
| `{{include}}` | `{{include contract=ID func="name"}}` | Include UI from another contract |

## Development

```bash
# Install dependencies
pnpm install

# Start local Stellar
pnpm docker:start

# Build all packages
pnpm build

# Run the demo
pnpm dev

# Stop local Stellar
pnpm docker:stop
```

## Contributing

Contributions are welcome! Please see our [contributing guidelines](CONTRIBUTING.md).

## License

Apache 2.0 - see [LICENSE](LICENSE) for details.

## Resources

- [Soroban Documentation](https://soroban.stellar.org/docs)
- [Stellar SDK](https://github.com/stellar/js-stellar-sdk)
- [Gno.land Render Concept](https://docs.gno.land/concepts/realms#render)
