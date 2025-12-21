# Viewing Contracts

Once you've deployed a renderable contract, how do you actually see its UI?

You don't build anything. Unlike traditional dApp development where you must create and deploy a frontend, Soroban Render contracts work with any compatible viewer. The viewer already exists—you just point it at your contract.

## Option 1: Use the Hosted Viewer (Easiest)

The Soroban Render project hosts a public viewer:

1. Go to **https://wyhaines.github.io/soroban-render/**
2. Enter your contract ID
3. Select the network (Testnet, Mainnet, or Local)
4. Click "Load Contract"

That's it. Your contract's UI appears in your browser.

**Time to view your contract: ~10 seconds**

## Option 2: Run the Viewer Locally

For local development or if you need to customize the viewer:

```bash
git clone https://github.com/wyhaines/soroban-render.git
cd soroban-render
pnpm install
pnpm dev
```

Open http://localhost:5173, enter your contract ID, and you're viewing.

**Time to set up: ~2 minutes** (one-time setup)

## Option 3: Embed in Your Own App

If you want the contract UI as part of a larger application:

```bash
pnpm add @soroban-render/core
```

```tsx
import { createClient, useRender, InteractiveRenderView, Networks } from "@soroban-render/core";

function ContractViewer({ contractId }: { contractId: string }) {
  const client = createClient(Networks.testnet.rpcUrl, Networks.testnet.networkPassphrase);
  const { html, loading, error, refresh } = useRender(client, contractId);

  return (
    <InteractiveRenderView
      client={client}
      contractId={contractId}
      html={html}
      loading={loading}
      error={error}
      onRefresh={refresh}
    />
  );
}
```

**Time to integrate: ~15 minutes** (if you already have a React app)

## Comparison: Viewing a Hello World Contract

### Traditional Approach

After deploying your contract, to view its UI you must:

1. **Set up a frontend project** (~15 min)
   ```bash
   npm create astro@latest
   cd my-frontend
   npm install
   ```

2. **Generate TypeScript bindings** (~5 min)
   ```bash
   stellar contract bindings typescript \
     --network testnet \
     --contract-id YOUR_CONTRACT_ID \
     --output-dir packages/client
   ```

3. **Configure environment** (~5 min)
   - Create `.env` file with RPC URLs
   - Configure network settings

4. **Install wallet integration** (~10 min)
   ```bash
   npm install @creit.tech/stellar-wallets-kit
   ```
   - Write wallet connection logic
   - Handle session state

5. **Build UI components** (~30+ min)
   - Create React/Astro components
   - Wire up contract calls
   - Handle loading states
   - Style the interface

6. **Deploy the frontend** (~10 min)
   - Build the project
   - Deploy to Vercel/Netlify/etc.

**Total: 1-2 hours minimum**, plus ongoing maintenance of a separate codebase.

## What the Viewer Provides

The generic viewer handles everything you'd normally build yourself:

| Feature | Traditional | Soroban Render Viewer |
|---------|------------|----------------------|
| Wallet connection | You build it | Built-in |
| Transaction signing | You build it | Built-in |
| Form handling | You build it | Built-in |
| Navigation | You build it | Built-in |
| Error handling | You build it | Built-in |
| Loading states | You build it | Built-in |
| Network switching | You build it | Built-in |
| Toast notifications | You build it | Built-in |

## When You Might Want Your Own Viewer

The generic viewer works for most use cases, but you might build a custom one if you need additional features like analytics or user accounts, embedding in a larger application, special transaction handling behavior, or other specific enhancements.

Even then, you're building a viewer that works with any renderable contract, not a single-purpose frontend for one contract.

## Workflow Summary

```
Traditional:
  Deploy Contract → Build Frontend → Deploy Frontend → Users visit your frontend

Soroban Render:
  Deploy Contract → Users visit any compatible viewer
```

The viewer is infrastructure that already exists. You only need to build and deploy your contract.

To create and deploy your first renderable contract, see [Getting Started](./getting-started.md). For a detailed breakdown of the complexity difference, [Hello World Comparison](./hello-world.md) walks through both approaches side by side. If you want to build a custom viewer, [React Integration](./react-integration.md) covers the hooks and components available.
