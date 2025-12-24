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


## Progressive Loading

These functions handle continuation markers (`{{continue}}` and `{{chunk}}` tags) for loading chunked content progressively. The `useProgressiveRender` hook wraps these utilities for React applications.

### parseProgressiveTags

Parses content for continuation and chunk tags.

```typescript
function parseProgressiveTags(content: string): ParsedProgressiveContent;

interface ParsedProgressiveContent {
  content: string;       // Content with tags replaced by placeholder divs
  tags: ProgressiveTag[];  // All tags found
  hasProgressive: boolean; // Whether any tags were found
}

type ProgressiveTag = ContinuationTag | ChunkTag;

interface ContinuationTag {
  type: "continue";
  collection: string;
  from?: number;
  page?: number;
  perPage?: number;
  total?: number;
  position: number;
  length: number;
}

interface ChunkTag {
  type: "chunk";
  collection: string;
  index: number;
  placeholder?: string;
  position: number;
  length: number;
}
```

### hasProgressiveTags

Quick check for continuation markers.

```typescript
function hasProgressiveTags(content: string): boolean;
```

### createTagId

Creates a unique ID for a placeholder element.

```typescript
function createTagId(tag: ProgressiveTag): string;
// "chunk-comments-5" or "continue-comments-5"
```

### createChunkKey

Creates a cache key for a chunk.

```typescript
function createChunkKey(collection: string, index: number): string;
// "comments:5"
```

### ProgressiveLoader

Class for loading chunked content from contracts.

```typescript
class ProgressiveLoader {
  constructor(options: ProgressiveLoaderOptions);

  loadChunk(collection: string, index: number): Promise<string>;
  getChunkMeta(collection: string): Promise<ChunkMeta | null>;
  loadTags(tags: ProgressiveTag[]): Promise<ChunkResult[]>;
  abort(): void;
  reset(): void;
}

interface ProgressiveLoaderOptions {
  contractId: string;
  client: SorobanClient;
  batchSize?: number;       // Default: 3
  maxConcurrent?: number;   // Default: 2
  onChunkLoaded?: (collection: string, index: number, content: string) => void;
  onProgress?: (loaded: number, total: number) => void;
  onError?: (error: Error) => void;
}

interface ChunkMeta {
  count: number;
  totalBytes: number;
  version: number;
}

interface ChunkResult {
  collection: string;
  index: number;
  content: string;
}
```

### useProgressiveRender

React hook for progressive content loading.

```typescript
function useProgressiveRender(
  options: UseProgressiveRenderOptions
): UseProgressiveRenderResult;

interface UseProgressiveRenderOptions {
  contractId: string;
  client: SorobanClient;
  initialContent: string;
  autoLoad?: boolean;       // Default: true
  batchSize?: number;       // Default: 3
  maxConcurrent?: number;   // Default: 2
}

interface UseProgressiveRenderResult {
  content: string;
  initialContent: string;
  isLoading: boolean;
  loadedChunks: number;
  totalChunks: number | null;
  progress: number;
  errors: Error[];
  tags: ProgressiveTag[];
  hasProgressive: boolean;
  load: () => Promise<void>;
  cancel: () => void;
  reset: () => void;
}
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
  /**
   * Contract alias for registry lookup.
   * Present when link uses @alias: syntax (e.g., "form:@admin:method")
   */
  alias?: string;
  /**
   * Explicit contract ID to target.
   * Present when link uses CONTRACT_ID: syntax (e.g., "form:CXYZ...:method")
   */
  contractId?: string;
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


## Contract Resolution

These functions resolve contract aliases to contract IDs using a registry contract. Required when using `@alias:method` syntax in forms and transactions.

### resolveContractAlias

Resolves an alias to a contract ID via the registry.

```typescript
async function resolveContractAlias(
  client: SorobanClient,
  registryId: string,
  alias: string
): Promise<string | null>;
```

**Example:**
```typescript
const contentId = await resolveContractAlias(client, registryId, "content");
// Returns: "CXYZ..." or null if not found
```

Results are cached per-registry to avoid repeated RPC calls.

### clearAliasCache

Clears the alias resolution cache.

```typescript
function clearAliasCache(registryId?: string): void;
```

**Example:**
```typescript
// Clear cache for specific registry
clearAliasCache("CREG...");

// Clear all caches
clearAliasCache();
```

### resolveTargetContract

Resolves the target contract for a form or transaction link.

```typescript
async function resolveTargetContract(
  alias: string | undefined,
  explicitContractId: string | undefined,
  defaultContractId: string,
  registryId: string | undefined,
  client: SorobanClient | null
): Promise<string | null>;
```

Resolution priority:
1. If `alias` provided, resolve via registry
2. If `explicitContractId` provided, use it directly
3. Otherwise, use `defaultContractId`

Returns `null` if alias resolution fails.


## Form Type Conversion

When forms are submitted via `form:` links, the viewer automatically converts string values from HTML inputs to appropriate Soroban types. Understanding these conversion rules is critical when designing your contract's function signatures.

### Conversion Rules

The viewer applies the following heuristics (in order of precedence):

| Rule | Field Pattern | Value Pattern | Converted Type |
|------|---------------|---------------|----------------|
| **Address** | Any | Starts with `G`, 56 chars | `Address` |
| **ID Fields** | Ends with `_id` (e.g., `board_id`, `thread_id`, `parent_id`) | Pure integer (`/^[0-9]+$/`) | `u64` |
| **Counter Fields** | Matches `depth`, `count`, `index`, `limit`, or `offset` | Pure integer | `u32` |
| **Numbers** | Any | JavaScript number type | `u32` (if 0 ≤ n ≤ 0xFFFFFFFF), else `i128` |
| **Booleans** | Any | JavaScript boolean | `bool` |
| **Null/Undefined** | Any | `null` or `undefined` | `void` |
| **Default** | Any | String | `String` |

### Examples

```typescript
// Form inputs collected:
{
  board_id: "0",      // → u64 (ends with _id, pure integer)
  threshold: "5",     // → String (no matching heuristic)
  count: "10",        // → u32 (matches "count", pure integer)
  title: "Hello",     // → String (default)
  viewer: "GABC..."   // → Address (starts with G, 56 chars)
}
```

### Contract Function Signatures

Design your contract functions to match these conversion rules:

```rust
// Good: matches viewer heuristics
pub fn set_flag_threshold(
    env: Env,
    board_id: u64,       // ✓ Converted from "board_id" field
    threshold: String,   // ✓ No special heuristic, stays String
    caller: Address,     // ✓ Wallet address auto-injected
) { ... }

// Also good: use count/limit/offset for u32
pub fn list_items(
    env: Env,
    board_id: u64,  // ✓ _id suffix → u64
    limit: u32,     // ✓ "limit" keyword → u32
    offset: u32,    // ✓ "offset" keyword → u32
) { ... }
```

### Handling Numeric Inputs

If you need a numeric parameter that doesn't match the heuristics (like `threshold`), you have two options:

**Option 1: Accept String and parse in contract**
```rust
// Helper function to parse string to u32
fn parse_string_to_u32(env: &Env, s: &String) -> u32 {
    let bytes = string_to_bytes(env, s);
    let mut result: u32 = 0;
    for i in 0..bytes.len() {
        let byte = bytes.get(i).unwrap();
        if byte >= b'0' && byte <= b'9' {
            result = result * 10 + (byte - b'0') as u32;
        }
    }
    result
}

pub fn set_threshold(env: Env, threshold: String) {
    let value = parse_string_to_u32(&env, &threshold);
    // use value...
}
```

**Option 2: Use a matching field name**
```html
<!-- In your form, use a name that triggers conversion -->
<input type="hidden" name="threshold_count" value="5">
<!-- "count" suffix triggers u32 conversion -->
```

### Reserved Field Prefixes

Fields starting with underscore (`_`) are filtered out before submission:

| Field | Purpose |
|-------|---------|
| `_redirect` | Navigation path after successful transaction |
| `_csrf` | Security tokens (if implemented) |
| `_*` | Any underscore-prefixed field is metadata, not contract args |

### Caller Injection

The viewer automatically appends the connected wallet address as the final `caller` parameter for transaction methods. Your contract function should expect this:

```rust
pub fn my_action(
    env: Env,
    // ... your form parameters ...
    caller: Address,  // Auto-injected by viewer
) {
    caller.require_auth();
    // ...
}
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
  registryId?: string;  // Registry contract for alias resolution
  publicKey?: string | null;
  onRefresh?: () => void;
  onNavigate?: (path: string) => void;
  onTransaction?: (result: TransactionResult) => void;
  onError?: (error: Error) => void;
}
```

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `client` | `SorobanClient` | RPC client connection |
| `contractId` | `string` | Main rendering contract ID |
| `registryId` | `string` | Registry contract for resolving @alias links |
| `publicKey` | `string` | Connected wallet address |
| `onNavigate` | `(path: string) => void` | Callback for `render:` link clicks |
| `onTransaction` | `(result) => void` | Callback after transaction success |
| `onError` | `(error: Error) => void` | Callback for errors |

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
