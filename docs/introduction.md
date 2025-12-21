# Introduction to Soroban Render

Soroban Render is a community convention and library for building **self-contained, renderable dApps** on Stellar's Soroban smart contract platform.

## Why Another Approach?

Traditional blockchain dApp development requires building and maintaining two separate codebases: the smart contract itself and a frontend application. This means setting up a build system, generating TypeScript bindings, managing wallet connections, and deploying both pieces separately. For simple applications—a todo list, a poll, a registry—this overhead can exceed the complexity of the application itself.

Soroban Render takes a different approach: your **smart contract defines its own UI**. The contract returns Markdown or JSON that describes the interface, and a generic viewer renders it.

```
┌─────────────────────┐     ┌─────────────────────┐
│                     │     │                     │
│   Smart Contract    │────▶│   Generic Viewer    │
│                     │     │                     │
│  - Business logic   │     │  - Renders Markdown │
│  - render() returns │     │  - Handles forms    │
│    the UI           │     │  - Submits txns     │
│                     │     │                     │
└─────────────────────┘     └─────────────────────┘
         │                           │
         │                           │
         ▼                           ▼
   One Codebase              Any Viewer Works
```

## Inspiration

Soroban Render is inspired by [Gno.land's `Render()` function](https://docs.gno.land/users/explore-with-gnoweb/#viewing-rendered-content), which pioneered the concept of contracts that render their own UI. We've adapted this for Stellar's Soroban ecosystem.

## How It Works

Contracts implement a `render(path, viewer)` function that returns Markdown or JSON. The viewer calls this function, parses the output, and displays it. Special link protocols like `render:/path` for navigation, `tx:method` for transactions, and `form:method` for form submissions enable full interactivity without client-side code.

Contracts can also include UI components from other contracts using the `{{include}}` directive, enabling reusable headers, footers, and widgets across applications.

The format is flexible: Markdown works well for content-focused interfaces and rapid prototyping, while JSON provides structured component definitions with support for charts and complex layouts. Any contract implementing `render()` works with any compatible viewer—no per-app frontend deployment needed.

## When to Use Soroban Render

Soroban Render works best for simple applications like todo lists, polls, and registries—anywhere the UI complexity is low but the traditional frontend overhead would be high. It's also useful for prototypes and MVPs where you want to validate an idea quickly, and for on-chain configuration interfaces where the UI should live alongside the data.

For complex, highly interactive UIs with significant client-side state, heavy data visualization, custom branding, or mobile-first design requirements, a traditional frontend still makes sense. Soroban Render is a tool for reducing complexity when that complexity isn't needed, not a replacement for all frontend development.

To see the difference in practice, the [Hello World Comparison](./hello-world.md) walks through both approaches side by side. When you're ready to build, [Getting Started](./getting-started.md) covers the setup process, and [Markdown Format](./markdown-format.md) documents the full syntax.
