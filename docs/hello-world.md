# Hello World: Two Approaches

This guide compares building a simple "Hello World" dApp using the traditional approach versus Soroban Render. The goal is straightforward: display "Hello, World!" to anonymous users, and "Hello, [User]!" when a wallet is connected.

## Traditional Approach

Building a frontend for a Soroban contract typically involves these steps:

### Step 1: Set Up Frontend Project

Clone an Astro template, install dependencies, and configure the build system.

```bash
npm create astro@latest -- --template basics
cd my-frontend
npm install
```

### Step 2: Generate Contract Bindings

Use the Stellar CLI to generate TypeScript client bindings from your deployed contract.

```bash
stellar contract bindings typescript \
  --network testnet \
  --contract-id CABC...XYZ \
  --output-dir packages/hello-client
```

### Step 3: Configure Environment

Set up environment variables for network configuration, RPC endpoints, and contract addresses.

```env
PUBLIC_STELLAR_NETWORK=testnet
PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org
PUBLIC_CONTRACT_ID=CABC...XYZ
```

### Step 4: Wallet Integration

Install and configure wallet libraries for connecting user wallets.

```bash
npm install @creit.tech/stellar-wallets-kit
```

Then write a wallet connection component that handles discovery, manages connection state, handles disconnection gracefully, and persists session state across page loads.

### Step 5: Build UI Components

Create React or Astro components that display the greeting, check wallet connection status, and show different content based on whether the user is connected.

### Step 6: Deploy Frontend

Build and deploy the frontend to a hosting service (Vercel, Netlify, GitHub Pages, etc.).

```bash
npm run build
# Deploy dist/ folder
```

By the end of this process, you have 10+ files across the frontend and contract, dependencies on Astro, wallet libraries, and contract bindings, two separate deployments to maintain, and two codebases to keep in sync.

## Soroban Render Approach

With Soroban Render, the entire "frontend" is part of the contract:

```rust
#![no_std]
use soroban_sdk::{contract, contractimpl, contractmeta, Address, Bytes, Env, String, Vec};

contractmeta!(key = "render", val = "v1");
contractmeta!(key = "render_formats", val = "markdown");

#[contract]
pub struct HelloContract;

#[contractimpl]
impl HelloContract {
    pub fn render(env: Env, _path: Option<String>, viewer: Option<Address>) -> Bytes {
        let mut parts: Vec<Bytes> = Vec::new(&env);

        match viewer {
            Some(_) => {
                parts.push_back(Bytes::from_slice(&env, b"# Hello, Stellar User!\n\n"));
                parts.push_back(Bytes::from_slice(&env, b"Your wallet is connected."));
            }
            None => {
                parts.push_back(Bytes::from_slice(&env, b"# Hello, World!\n\n"));
                parts.push_back(Bytes::from_slice(&env, b"Connect your wallet to see a personalized greeting."));
            }
        };

        Self::concat_bytes(&env, &parts)
    }

    fn concat_bytes(env: &Env, parts: &Vec<Bytes>) -> Bytes {
        let mut result = Bytes::new(env);
        for part in parts.iter() {
            result.append(&part);
        }
        result
    }
}
```

### Deployment

```bash
stellar contract build
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/hello.wasm \
  --source alice \
  --network testnet
```

### Viewing

Open any Soroban Render viewer, enter the contract ID, and you're done. One file, one dependency (soroban-sdk), one deployment, one codebase.

## Side-by-Side Comparison

| Aspect | Traditional | Soroban Render |
|--------|-------------|----------------|
| **Files to write** | 10+ | 1 |
| **Languages** | Rust + TypeScript/JS | Rust only |
| **Build systems** | Cargo + npm/pnpm | Cargo only |
| **Deployments** | 2 (contract + frontend) | 1 (contract) |
| **Wallet integration** | Manual setup | Built into viewer |
| **TypeScript bindings** | Generate & maintain | Not needed |
| **Hosting costs** | Contract + frontend hosting | Contract only |
| **Time to first deploy** | Hours | Minutes |

## When Each Approach Makes Sense

Soroban Render works well for simple applications like todos, polls, and registries, and for rapid prototyping where you want to validate an idea quickly. It's particularly suited to single-developer or small team projects where minimizing infrastructure overhead matters, and for cases where the UI should live with the data on-chain.

A traditional frontend makes more sense for complex, highly interactive UIs that require client-side state management, heavy custom styling or branding, or mobile-first responsive design. Larger teams with frontend specialists, or projects integrating with existing frontend infrastructure, will likely prefer the traditional approach.

## Try It Yourself

The hello contract is included in the Soroban Render repository:

```bash
git clone https://github.com/wyhaines/soroban-render.git
cd soroban-render

# Build and test the hello contract
cd contracts/hello
cargo test

# Deploy locally
cd ../..
pnpm docker:start
stellar keys generate alice --network local
cd contracts/hello
stellar contract build
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/soroban_render_hello.wasm \
  --source alice \
  --network local

# View it
cd ../..
pnpm dev
# Open http://localhost:5173 and enter your contract ID
```

To build your own renderable contract, see [Getting Started](./getting-started.md). Once you have a basic contract working, [Markdown Format](./markdown-format.md) covers adding interactivity with forms and transactions, and [JSON Format](./json-format.md) explains the structured component approach for more complex UIs.
