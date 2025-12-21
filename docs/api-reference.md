# API Reference

Complete reference for the `@soroban-render/core` library. This page documents all exported functions, hooks, components, and types.

## Client Utilities

These functions handle communication with the Soroban RPC server. Use `createClient` to establish a connection, then `callRender` to fetch contract UI content.

### createClient

Creates a Soroban RPC client.

```typescript
function createClient(
  rpcUrl: string,
  networkPassphrase: string
): SorobanClient;
```

**Example:**
```typescript
import { createClient, Networks } from "@soroban-render/core";

const client = createClient(
  Networks.testnet.rpcUrl,
  Networks.testnet.networkPassphrase
);
```

### callRender

Calls a contract's render function.

```typescript
async function callRender(
  client: SorobanClient,
  contractId: string,
  options?: RenderOptions
): Promise<string>;
```

**Options:**
```typescript
interface RenderOptions {
  path?: string;      // Sub-view path
  viewer?: string;    // Wallet address
}
```

**Example:**
```typescript
const content = await callRender(client, "CABC...XYZ", {
  path: "/tasks",
  viewer: "GABC...123"
});
```

### detectRenderSupport

Checks if a contract implements the render convention.

```typescript
async function detectRenderSupport(
  client: SorobanClient,
  contractId: string
): Promise<{ supported: boolean; formats: string[] }>;
```

### Networks

Predefined network configurations.

```typescript
const Networks: {
  local: { rpcUrl: string; networkPassphrase: string };
  testnet: { rpcUrl: string; networkPassphrase: string };
  mainnet: { rpcUrl: string; networkPassphrase: string };
};
```


## Transaction Utilities

These functions handle blockchain transactions triggered by `tx:` and `form:` links in rendered content. The `InteractiveRenderView` component uses these internally, but you can use them directly for custom transaction flows.

### submitTransaction

Submits a transaction to the network.

```typescript
async function submitTransaction(
  client: SorobanClient,
  params: TransactionParams,
  signTransaction: (xdr: string) => Promise<string>
): Promise<TransactionResult>;
```

**Types:**
```typescript
interface TransactionParams {
  contractId: string;
  method: string;
  args: Record<string, unknown>;
  publicKey: string;
  sendAmount?: string;  // Optional XLM in stroops
}

interface TransactionResult {
  hash: string;
  success: boolean;
}
```

### parseTransactionLink

Parses a `tx:` protocol link.

```typescript
function parseTransactionLink(href: string): {
  method: string;
  args: Record<string, unknown>;
} | null;
```

### parseFormLink

Parses a `form:` protocol link.

```typescript
function parseFormLink(href: string): {
  method: string;
} | null;
```

### parseRenderLink

Parses a `render:` protocol link.

```typescript
function parseRenderLink(href: string): {
  path: string;
} | null;
```


## Markdown Parser

These functions convert contract markdown output to HTML. The `useRender` hook handles this automatically, but you can use them directly for server-side rendering or custom processing pipelines.

### parseMarkdown

Converts contract markdown to HTML.

```typescript
async function parseMarkdown(markdown: string): Promise<string>;
```

Features:
- GitHub Flavored Markdown
- Alert/callout syntax
- Multi-column layouts
- HTML sanitization via DOMPurify

### detectFormat

Detects if content is JSON or Markdown.

```typescript
function detectFormat(content: string): "json" | "markdown";
```


## JSON Parser

These functions parse contracts that return JSON format instead of Markdown. Use `isJsonFormat` or `detectFormat` to determine the format before parsing.

### parseJsonUI

Parses JSON UI format.

```typescript
function parseJsonUI(json: string): ParseJsonResult;

interface ParseJsonResult {
  success: boolean;
  document?: JsonUIDocument;
  error?: string;
}
```

### isJsonFormat

Quick check for JSON format.

```typescript
function isJsonFormat(content: string): boolean;
```

### Type Definitions

```typescript
interface JsonUIDocument {
  format: string;  // "soroban-render-json-v1"
  title?: string;
  components: JsonComponent[];
}

type JsonComponent =
  | HeadingComponent
  | TextComponent
  | MarkdownComponent
  | DividerComponent
  | FormComponent
  | ButtonComponent
  | ListComponent
  | TaskComponent
  | NavigationComponent
  | ContainerComponent
  | IncludeComponent
  | ChartComponent;

interface HeadingComponent {
  type: "heading";
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
}

interface TextComponent {
  type: "text";
  content: string;
}

interface MarkdownComponent {
  type: "markdown";
  content: string;
}

interface DividerComponent {
  type: "divider";
}

interface FormComponent {
  type: "form";
  action: string;
  fields: FormField[];
  submitLabel?: string;
}

interface FormField {
  name: string;
  type: "text" | "textarea" | "number" | "checkbox" | "select";
  placeholder?: string;
  required?: boolean;
  options?: { label: string; value: string }[];
}

interface ButtonComponent {
  type: "button";
  action: "tx" | "render";
  label: string;
  method?: string;
  args?: Record<string, unknown>;
  path?: string;
}

interface ListComponent {
  type: "list";
  ordered: boolean;
  items: JsonComponent[];
}

interface TaskComponent {
  type: "task";
  id: number;
  text: string;
  completed: boolean;
  actions?: TaskAction[];
}

interface NavigationComponent {
  type: "navigation";
  items: { label: string; path: string; active?: boolean }[];
}

interface ContainerComponent {
  type: "container";
  className?: string;
  components: JsonComponent[];
}

interface IncludeComponent {
  type: "include";
  contract: string;
  path?: string;
}

// Chart types
interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

interface PieChartComponent {
  type: "chart";
  chartType: "pie";
  title?: string;
  data: ChartDataPoint[];
}

interface GaugeChartComponent {
  type: "chart";
  chartType: "gauge";
  value: number;
  max: number;
  label?: string;
  color?: string;
}

interface BarChartComponent {
  type: "chart";
  chartType: "bar";
  title?: string;
  data: ChartDataPoint[];
}

type ChartComponent =
  | PieChartComponent
  | GaugeChartComponent
  | BarChartComponent;
```


## Include System

These functions handle `{{include}}` directives that pull content from other contracts. The `useRender` hook resolves includes automatically when `resolveIncludes: true` is set.

### parseIncludes

Finds include tags in content.

```typescript
function parseIncludes(content: string): ParsedIncludes;

interface ParsedIncludes {
  includes: IncludeTag[];
  hasIncludes: boolean;
}

interface IncludeTag {
  raw: string;        // Full tag text
  contract: string;   // Contract ID
  func: string;       // Function name
  args?: string;      // Optional arguments
}
```

### hasIncludes

Quick check for include tags.

```typescript
function hasIncludes(content: string): boolean;
```

### resolveIncludes

Resolves include tags by fetching from contracts.

```typescript
async function resolveIncludes(
  content: string,
  resolver: IncludeResolver,
  options?: ResolveOptions
): Promise<ResolveResult>;

interface ResolveOptions {
  maxDepth?: number;  // Recursion limit (default: 5)
  cache?: Map<string, CacheEntry>;
}

interface ResolveResult {
  content: string;
  resolved: number;
  errors: string[];
}
```

### createIncludeResolver

Creates a resolver function.

```typescript
function createIncludeResolver(
  client: SorobanClient
): IncludeResolver;
```


## Link Parser

These functions parse the special link protocols (`tx:`, `form:`, `render:`) used in rendered content. The `InteractiveRenderView` component uses these internally to handle link clicks.

### parseLink

Parses any soroban-render protocol link.

```typescript
function parseLink(href: string): ParsedLink;

interface ParsedLink {
  type: "tx" | "form" | "render" | "standard";
  method?: string;
  args?: Record<string, unknown>;
  path?: string;
  functionName?: string;
  href?: string;
  sendAmount?: string;
  userSettableParams?: string[];
}

type LinkProtocol = "tx" | "form" | "render" | "standard";
```

### collectFormInputs

Collects values from form inputs.

```typescript
function collectFormInputs(
  form: HTMLFormElement
): Record<string, unknown>;
```

### buildPathWithParams

Builds a path with query parameters.

```typescript
function buildPathWithParams(
  basePath: string,
  params: Record<string, string>
): string;
```


## React Hooks

These hooks provide the primary React integration. For most applications, `useRender` and `useWallet` are all you need.

### useRender

```typescript
function useRender(
  client: SorobanClient | null,
  contractId: string | null,
  options?: UseRenderOptions
): UseRenderResult;

interface UseRenderOptions {
  path?: string;
  viewerAddress?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
  resolveIncludes?: boolean;
}

interface UseRenderResult {
  html: string;
  rawContent: string;
  loading: boolean;
  error: Error | null;
  format: "markdown" | "json";
  refresh: () => void;
}
```

### useRenderSupport

```typescript
function useRenderSupport(
  client: SorobanClient | null,
  contractId: string | null
): {
  supported: boolean | null;
  loading: boolean;
  error: Error | null;
  formats: string[];
};
```

### useWallet

```typescript
function useWallet(): UseWalletResult;

interface WalletState {
  address: string | null;
  connected: boolean;
}

interface UseWalletResult extends WalletState {
  connect: () => Promise<void>;
  disconnect: () => void;
  signTransaction: (xdr: string) => Promise<string>;
}
```


## React Components

Components for rendering contract UI. Use `RenderView` for static display, `InteractiveRenderView` for full interactivity with forms and transactions. The JSON variants handle contracts that return JSON format.

### RenderView

```typescript
interface RenderViewProps {
  html: string;
  loading?: boolean;
  error?: Error | null;
  styles?: Record<string, React.CSSProperties>;
}
```

### InteractiveRenderView

```typescript
interface InteractiveRenderViewProps extends RenderViewProps {
  client: SorobanClient;
  contractId: string;
  publicKey?: string | null;
  onRefresh?: () => void;
  onNavigate?: (path: string) => void;
  onTransaction?: (result: TransactionResult) => void;
  onError?: (error: Error) => void;
}
```

### JsonRenderView

```typescript
interface JsonRenderViewProps {
  document: JsonUIDocument | null;
  loading?: boolean;
  error?: Error | null;
  styles?: Record<string, React.CSSProperties>;
}
```

### InteractiveJsonRenderView

```typescript
interface InteractiveJsonRenderViewProps extends JsonRenderViewProps {
  client: SorobanClient;
  contractId: string;
  publicKey?: string | null;
  onRefresh?: () => void;
  onNavigate?: (path: string) => void;
  onTransaction?: (result: TransactionResult) => void;
  onError?: (error: Error) => void;
}
```


## Chart Components

### PieChart

```typescript
interface PieChartProps {
  data: ChartDataPoint[];
  title?: string;
}
```

### GaugeChart

```typescript
interface GaugeChartProps {
  value: number;
  max: number;
  label?: string;
  color?: string;
}
```

### BarChart

```typescript
interface BarChartProps {
  data: ChartDataPoint[];
  title?: string;
}
```


## Style Exports

### defaultStyles

Default styles for markdown rendering.

```typescript
const defaultStyles: Record<string, React.CSSProperties>;
```

### jsonStyles

Default styles for JSON rendering.

```typescript
const jsonStyles: Record<string, React.CSSProperties>;
```
