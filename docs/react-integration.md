# React Integration

The `@soroban-render/core` library provides React hooks and components for rendering contract UIs in your application.

## Installation

```bash
pnpm add @soroban-render/core
# or
npm install @soroban-render/core
```

**Peer dependencies:**
- React 18+
- @stellar/stellar-sdk 13+
- @stellar/freighter-api 3+ (for wallet integration)


## Quick Start

```tsx
import {
  createClient,
  useRender,
  InteractiveRenderView,
  useWallet,
  Networks
} from "@soroban-render/core";

function App() {
  const client = createClient(
    Networks.testnet.rpcUrl,
    Networks.testnet.networkPassphrase
  );

  const { address, connect, disconnect } = useWallet();

  const {
    html,
    loading,
    error,
    refresh
  } = useRender(client, "CABC...XYZ", {
    viewerAddress: address,
  });

  return (
    <div>
      <header>
        {address ? (
          <button onClick={disconnect}>Disconnect</button>
        ) : (
          <button onClick={connect}>Connect Wallet</button>
        )}
      </header>

      <InteractiveRenderView
        client={client}
        contractId="CABC...XYZ"
        html={html}
        loading={loading}
        error={error}
        onRefresh={refresh}
        publicKey={address}
      />
    </div>
  );
}
```


## Hooks

The library provides three hooks. `useRender` is the primary hook for fetching and displaying contract UI. `useWallet` manages Freighter wallet connections. `useRenderSupport` checks whether a contract implements the render convention before attempting to render it.

### useRender

Fetches and parses contract UI.

```typescript
const {
  html,        // Parsed HTML string (for markdown)
  rawContent,  // Raw contract output
  loading,     // boolean
  error,       // Error | null
  format,      // "markdown" | "json"
  refresh,     // () => void - refetch content
} = useRender(client, contractId, options);
```

**Options:**
```typescript
interface UseRenderOptions {
  path?: string;           // Current path (e.g., "/tasks")
  viewerAddress?: string;  // Connected wallet address
  autoRefresh?: boolean;   // Auto-refresh after transactions
  refreshInterval?: number; // Auto-refresh interval in ms
}
```

### useRenderSupport

Check if a contract implements the render convention.

```typescript
const {
  supported,  // boolean | null (null while loading)
  loading,    // boolean
  error,      // Error | null
  formats,    // string[] - supported formats
} = useRenderSupport(client, contractId);
```

### useWallet

Manage Freighter wallet connection.

```typescript
const {
  address,      // string | null - connected wallet address
  connected,    // boolean
  connect,      // () => Promise<void>
  disconnect,   // () => void
  signTransaction, // (xdr: string) => Promise<string>
} = useWallet();
```


## Components

The library provides view components for both Markdown and JSON formats. For most applications, use `InteractiveRenderView` which handles navigation, forms, and transactions automatically. Use the non-interactive variants when you need display-only rendering or want to handle interactions yourself.

### RenderView

Basic markdown rendering without interactivity.

```tsx
<RenderView
  html={html}
  loading={loading}
  error={error}
  styles={customStyles}  // Optional CSS overrides
/>
```

### InteractiveRenderView

Full-featured view with form and transaction handling.

```tsx
<InteractiveRenderView
  client={client}
  contractId="CABC...XYZ"
  html={html}
  loading={loading}
  error={error}
  publicKey={walletAddress}
  onRefresh={refresh}
  onNavigate={(path) => handleNavigation(path)}
  onTransaction={(result) => handleTxResult(result)}
  onError={(error) => handleError(error)}
  styles={customStyles}
/>
```

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `client` | `SorobanClient` | RPC client instance |
| `contractId` | `string` | Target contract ID |
| `html` | `string` | Parsed HTML content |
| `loading` | `boolean` | Loading state |
| `error` | `Error \| null` | Error state |
| `publicKey` | `string \| null` | Connected wallet |
| `onRefresh` | `() => void` | Called to refresh content |
| `onNavigate` | `(path: string) => void` | Path change handler |
| `onTransaction` | `(result) => void` | Transaction success handler |
| `onError` | `(error) => void` | Error handler |
| `styles` | `object` | CSS style overrides |

### JsonRenderView

Renders JSON format UIs.

```tsx
<JsonRenderView
  document={parsedDocument}
  loading={loading}
  error={error}
/>
```

### InteractiveJsonRenderView

JSON rendering with interactivity.

```tsx
<InteractiveJsonRenderView
  client={client}
  contractId="CABC...XYZ"
  document={parsedDocument}
  loading={loading}
  error={error}
  publicKey={walletAddress}
  onRefresh={refresh}
  onNavigate={handleNavigation}
/>
```

### Chart Components

Standalone chart components for custom use:

```tsx
import { PieChart, GaugeChart, BarChart } from "@soroban-render/core";

// Pie Chart
<PieChart
  data={[
    { label: "A", value: 60, color: "#3b82f6" },
    { label: "B", value: 40, color: "#22c55e" }
  ]}
/>

// Gauge Chart
<GaugeChart
  value={75}
  max={100}
  label="Progress"
  color="#3b82f6"
/>

// Bar Chart
<BarChart
  data={[
    { label: "Jan", value: 100 },
    { label: "Feb", value: 150 }
  ]}
  title="Monthly Data"
/>
```


## Styling

### Default Styles

The library provides default styles you can import:

```tsx
import { defaultStyles, jsonStyles } from "@soroban-render/core";

// Use defaults
<RenderView styles={defaultStyles} ... />

// Or extend them
<RenderView
  styles={{
    ...defaultStyles,
    container: { ...defaultStyles.container, padding: "2rem" }
  }}
  ...
/>
```

### Custom Styling

Override specific style classes:

```tsx
const customStyles = {
  container: { maxWidth: "800px", margin: "0 auto" },
  heading: { color: "#1f2937" },
  link: { color: "#2563eb" },
  button: { backgroundColor: "#3b82f6", color: "white" },
  form: { backgroundColor: "#f9fafb", padding: "1rem" },
  input: { border: "1px solid #d1d5db" },
  alert: { borderRadius: "8px" },
  alertNote: { backgroundColor: "#eff6ff" },
  alertWarning: { backgroundColor: "#fefce8" },
};
```

### CSS Classes

For external CSS, the library uses these class patterns:
- `.soroban-container` - Main container
- `.soroban-alert`, `.soroban-alert-note`, etc. - Alert boxes
- `.soroban-columns`, `.soroban-column` - Column layouts
- `.soroban-form` - Form containers
- `.soroban-button` - Buttons
- `.soroban-chart` - Chart containers


## Handling Navigation

Track path state for multi-page contracts:

```tsx
function App() {
  const [path, setPath] = useState("/");

  const { html, refresh } = useRender(client, contractId, {
    path,
    viewerAddress: address,
  });

  return (
    <InteractiveRenderView
      // ...
      onNavigate={(newPath) => {
        setPath(newPath);
        // Optionally update URL
        window.history.pushState({}, "", `#${newPath}`);
      }}
    />
  );
}
```


## Handling Transactions

Process transaction results:

```tsx
<InteractiveRenderView
  onTransaction={(result) => {
    console.log("Transaction successful:", result.hash);
    showToast("Transaction confirmed!");
  }}
  onError={(error) => {
    console.error("Transaction failed:", error);
    showToast(`Error: ${error.message}`, "error");
  }}
/>
```


## Include Resolution

The library automatically resolves `{{include}}` tags:

```tsx
const { html } = useRender(client, contractId, {
  resolveIncludes: true,  // Default: true
  includeCache: sharedCache,  // Optional shared cache
});
```

For manual resolution:

```typescript
import { resolveIncludes, createIncludeResolver } from "@soroban-render/core";

const resolver = createIncludeResolver(client);
const resolved = await resolveIncludes(markdown, resolver);
```


## Direct API Usage

For non-React applications or server-side rendering:

```typescript
import {
  createClient,
  callRender,
  parseMarkdown,
  parseJsonUI,
  detectFormat
} from "@soroban-render/core";

// Create client
const client = createClient(rpcUrl, networkPassphrase);

// Fetch content
const content = await callRender(client, contractId, {
  path: "/tasks",
  viewer: walletAddress,
});

// Parse based on format
const format = detectFormat(content);
if (format === "json") {
  const { document } = parseJsonUI(content);
} else {
  const html = await parseMarkdown(content);
}
```

For complete API documentation including all function signatures and type definitions, see [API Reference](./api-reference.md). The [Markdown Format](./markdown-format.md) and [JSON Format](./json-format.md) references explain the content formats that contracts can return.
