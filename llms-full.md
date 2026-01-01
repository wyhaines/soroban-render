# soroban-render

TypeScript library for rendering and interacting with Soroban Render contracts. Provides React components, hooks, and utilities for building viewers.

## ARCHITECTURE

```
Contract (Soroban/Rust)          Viewer (TypeScript/React)
─────────────────────            ─────────────────────────
render(path, viewer) ──────────► useRender() ──► parseMarkdown() ──► HTML
get_chunk(coll, idx) ◄───────── ProgressiveLoader ◄── {{chunk}} tags
styles() ────────────────────► StyleResolver ──► scoped CSS
get_contract_by_alias(alias) ◄─ resolveContractAlias() ◄── @alias links
```

---

## LINK PROTOCOLS

### render:

Navigation within contract UI.

| Syntax | Description |
|--------|-------------|
| `render:/path` | Navigate to path |
| `render:/path?query=value` | Navigate with query |
| `render:` | Navigate to root |
| `render:header` | Call `render_header()` function |
| `render:header/path` | Call `render_header()` with path |

PARSED TO:
```typescript
{ protocol: "render", path?: string, functionName?: string }
```

### tx:

Transaction execution with wallet signature.

| Syntax | Description |
|--------|-------------|
| `tx:method` | Call method, no args |
| `tx:method {"key":"value"}` | Call with JSON args |
| `tx:method {} .send=10000000` | Attach XLM (stroops) |
| `tx:method {"key":""}` | Prompt for empty values |
| `tx:@alias:method {...}` | Target contract by alias |
| `tx:CONTRACT_ID:method {...}` | Target contract directly |

1 XLM = 10,000,000 stroops

PARSED TO:
```typescript
{
  protocol: "tx",
  method: string,
  args: Record<string, unknown>,
  sendAmount?: string,
  userSettableParams?: string[],  // Keys with empty string values
  alias?: string,
  contractId?: string
}
```

### form:

Form submission - collects HTML inputs and submits as transaction.

| Syntax | Description |
|--------|-------------|
| `form:method` | Submit to method on current contract |
| `form:@alias:method` | Submit to aliased contract |
| `form:CONTRACT_ID:method` | Submit to specific contract |

INPUT COLLECTION:
1. Finds all `<input>`, `<textarea>`, `<select>` with `name` attribute
2. Skips `_`-prefixed fields (`_redirect`, `_csrf`)
3. Skips empty string values
4. Appends connected wallet as `caller` parameter

PARSED TO:
```typescript
{
  protocol: "form",
  method: string,
  alias?: string,
  contractId?: string
}
```

---

## TYPE CONVERSION (FORM INPUTS)

| Pattern | Input Value | ScVal Type |
|---------|-------------|------------|
| Starts with G, 56 chars | any | Address |
| Field ends with `_id` | `/^[0-9]+$/` | u64 |
| Field is depth/count/index/limit/offset | `/^[0-9]+$/` | u32 |
| Number, integer, 0 <= n <= 0xFFFFFFFF | number | u32 |
| Number, integer, larger | number | i128 |
| Boolean | boolean | Bool |
| null/undefined | null | Void |
| String | string | String |

---

## PROGRESSIVE LOADING TAGS

### {{continue}}

Marks location for remaining chunks to load.

```
{{continue collection="name" from=1 total=10}}
```

| Attribute | Type | Description |
|-----------|------|-------------|
| `collection` | string | Collection identifier |
| `from` | u32 | Starting chunk index |
| `total` | u32 | Optional total chunks |

VIEWER BEHAVIOR: Calls `get_chunk(collection, index)` for each chunk.

### {{chunk}}

Placeholder for a single chunk.

```
{{chunk collection="name" index=0}}
{{chunk collection="name" index=0 placeholder="Loading..."}}
```

VIEWER BEHAVIOR: Replaces with chunk content after loading.

### {{render}}

Waterfall loading - embed content from another path.

```
{{render path="/sidebar"}}
{{render contract="CXYZ..." path="/" func="render_header"}}
```

VIEWER BEHAVIOR: Calls render() and embeds result.

---

## CONTRACT ALIASING

### Syntax

| Format | Description |
|--------|-------------|
| `@alias:method` | Look up alias in registry |
| `CONTRACT_ID:method` | Use explicit 56-char ID |

### Resolution Flow

1. Parse `@alias` from link
2. Call registry's `get_contract_by_alias(alias)`
3. Cache result per-registry
4. Submit transaction to resolved contract

### Registry Requirement

Registry contract must implement:
```rust
pub fn get_contract_by_alias(env: Env, alias: Symbol) -> Option<Address>;
```

---

## REACT HOOKS

### useRender

Main rendering hook.

```typescript
function useRender(
  client: SorobanClient | null,
  contractId: string | null,
  options?: UseRenderOptions
): UseRenderResult;
```

OPTIONS:
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `path` | string | "/" | Initial path |
| `viewer` | string | undefined | Viewer wallet address |
| `enabled` | boolean | true | Enable fetching |
| `resolveIncludes` | boolean | true | Resolve {{include}} |
| `includeCacheTtl` | number | 30000 | Include cache TTL (ms) |
| `resolveStyles` | boolean | true | Resolve styles |
| `styleCacheTtl` | number | 60000 | Style cache TTL (ms) |
| `themeContractId` | string | undefined | Theme contract for styles |
| `scopeStyles` | boolean | true | CSS scoping |
| `resolveProgressive` | boolean | true | Resolve {{continue}}/{{chunk}} |
| `progressiveBatchSize` | number | 3 | Chunks per request |
| `progressiveMaxConcurrent` | number | 2 | Max parallel requests |
| `resolveRenderContinuations` | boolean | true | Resolve {{render}} |
| `renderContinuationMaxConcurrent` | number | 2 | Max parallel renders |
| `renderContinuationMaxTotal` | number | 100 | Max total continuations |

RESULT:
| Field | Type | Description |
|-------|------|-------------|
| `html` | string \| null | Rendered HTML |
| `raw` | string \| null | Raw markdown/JSON |
| `jsonDocument` | JsonUIDocument \| null | Parsed JSON UI |
| `format` | "markdown" \| "json" \| "unknown" \| null | Detected format |
| `loading` | boolean | Loading state |
| `error` | string \| null | Error message |
| `path` | string | Current path |
| `setPath` | (path: string) => void | Navigate |
| `refetch` | () => Promise<void> | Reload content |
| `css` | string \| null | Resolved CSS |
| `scopeClassName` | string \| null | CSS scope class |

### useWallet

Wallet connection hook.

```typescript
function useWallet(): {
  address: string | null;
  connected: boolean;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
};
```

### useRenderSupport

Check if contract supports rendering.

```typescript
function useRenderSupport(
  client: SorobanClient | null,
  contractId: string | null
): {
  supported: boolean | null;
  loading: boolean;
  error: string | null;
};
```

---

## REACT COMPONENTS

### RenderView

Static content display.

```tsx
<RenderView
  html={html}
  loading={loading}
  error={error}
  styles={customStyles}
/>
```

### InteractiveRenderView

Full-featured with form/transaction handling.

```tsx
<InteractiveRenderView
  client={client}
  contractId="CXYZ..."
  registryId="CREG..."      // For @alias resolution
  html={html}
  loading={loading}
  error={error}
  publicKey={walletAddress}
  onRefresh={() => refetch()}
  onNavigate={(path) => setPath(path)}
  onTransaction={(result) => handleTx(result)}
  onError={(error) => handleError(error)}
  styles={customStyles}
/>
```

PROPS:
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `client` | SorobanClient | yes | RPC client |
| `contractId` | string | yes | Main contract |
| `registryId` | string | no | Registry for aliases |
| `html` | string | yes | Rendered content |
| `publicKey` | string | no | Connected wallet |
| `onNavigate` | (path: string) => void | no | render: handler |
| `onTransaction` | (result) => void | no | tx success handler |
| `onError` | (error: Error) => void | no | Error handler |
| `onRefresh` | () => void | no | Refresh callback |

### JsonRenderView

Renders JSON UI format.

```tsx
<JsonRenderView
  document={jsonDocument}
  client={client}
  contractId="CXYZ..."
  publicKey={walletAddress}
  onTransaction={(result) => handleTx(result)}
/>
```

---

## UTILITIES

### SorobanClient

RPC client wrapper.

```typescript
function createClient(rpcUrl: string, networkPassphrase: string): SorobanClient;

interface SorobanClient {
  server: rpc.Server;
  networkPassphrase: string;
}
```

### callRender

Call contract's render function.

```typescript
async function callRender(
  client: SorobanClient,
  contractId: string,
  options?: RenderOptions
): Promise<string>;

interface RenderOptions {
  path?: string;
  viewer?: string;
  functionName?: string;  // For render_* functions
}
```

### submitTransaction

Execute contract method with wallet signature.

```typescript
async function submitTransaction(
  client: SorobanClient,
  contractId: string,
  params: TransactionParams,
  userAddress: string
): Promise<TransactionResult>;

interface TransactionParams {
  method: string;
  args: Record<string, unknown>;
}

interface TransactionResult {
  success: boolean;
  hash?: string;
  error?: string;
}
```

### Contract Resolution

```typescript
// Resolve alias to contract ID
async function resolveContractAlias(
  client: SorobanClient,
  registryId: string,
  alias: string
): Promise<string | null>;

// Clear alias cache
function clearAliasCache(registryId?: string): void;

// Resolve target contract for parsed link
async function resolveTargetContract(
  alias: string | undefined,
  explicitContractId: string | undefined,
  defaultContractId: string,
  registryId: string | undefined,
  client: SorobanClient | null
): Promise<string | null>;
```

### Link Parsing

```typescript
function parseLink(href: string): ParsedLink;

interface ParsedLink {
  protocol: "render" | "tx" | "form" | "standard";
  href: string;
  method?: string;
  args?: Record<string, unknown>;
  path?: string;
  functionName?: string;
  sendAmount?: string;
  userSettableParams?: string[];
  alias?: string;
  contractId?: string;
}

function collectFormInputs(
  container: HTMLElement,
  beforeElement?: HTMLElement
): Record<string, string>;

function buildPathWithParams(
  basePath: string,
  params: Record<string, string>
): string;
```

---

## PARSERS

### parseMarkdown

Convert markdown to HTML with soroban-render extensions.

```typescript
async function parseMarkdown(content: string): Promise<string>;
```

EXTENSIONS:
- `> [!TIP]` / `> [!NOTE]` / `> [!WARNING]` / `> [!INFO]` / `> [!CAUTION]` → Alert boxes
- `:::columns ... ||| ... :::` → Multi-column layout
- `{{include ...}}` → Include directive
- `{{chunk ...}}` → Progressive loading placeholder
- `{{continue ...}}` → Continuation marker
- `{{render ...}}` → Waterfall loading

### parseJsonUI

Parse JSON UI format.

```typescript
function parseJsonUI(content: string): {
  success: boolean;
  document?: JsonUIDocument;
  error?: string;
};

interface JsonUIDocument {
  format: "soroban-render-json-v1";
  title: string;
  components: JsonComponent[];
}
```

### detectFormat

Detect content format.

```typescript
function detectFormat(content: string): "markdown" | "json" | "unknown";
```

---

## CSS CLASSES

| Class | Description |
|-------|-------------|
| `.soroban-render` | Root container |
| `.soroban-loading` | Loading state |
| `.soroban-error` | Error state |
| `.soroban-alert` | Alert box base |
| `.soroban-alert-tip` | Tip alert |
| `.soroban-alert-note` | Note alert |
| `.soroban-alert-warning` | Warning alert |
| `.soroban-alert-info` | Info alert |
| `.soroban-alert-caution` | Caution alert |
| `.soroban-columns` | Column container |
| `.soroban-column` | Individual column |
| `.soroban-form` | Form container |
| `.soroban-button` | Button element |
| `.soroban-progressive-loaded` | Progressive content wrapper |

---

## CONTRACT METADATA

Contracts declare capabilities via metadata:

| Key | Value | Description |
|-----|-------|-------------|
| `render` | `"v1"` | Render protocol version |
| `render_formats` | `"markdown"` \| `"json"` \| `"markdown,json"` | Supported formats |
| `render_styles` | `"true"` | Has styles() function |
| `render_theme` | `"CONTRACT_ID"` | Theme contract for styles |

---

## RUST SDK (soroban-render-sdk)

The SDK provides contract-side builders for generating renderable output.

### Feature Flags

| Feature | Default | Exports |
|---------|---------|---------|
| `markdown` | yes | `MarkdownBuilder` |
| `json` | yes | `JsonDocument`, `FormBuilder`, `TaskBuilder` |
| `router` | yes | `Router`, `RouterResult`, `Request` |
| `styles` | yes | `StyleBuilder` |
| `registry` | no | `BaseRegistry`, `RegistryKey`, `ContractRegistry` |

### MarkdownBuilder Key Methods

| Method | Output |
|--------|--------|
| `.h1("text")` | `# text\n\n` |
| `.paragraph("text")` | `text\n\n` |
| `.render_link("label", "/path")` | `[label](render:/path)` |
| `.form_link("label", "method")` | `[label](form:method)` |
| `.form_link_to("label", "alias", "method")` | `[label](form:@alias:method)` |
| `.tx_link("label", "method", "args")` | `[label](tx:method args)` |
| `.tx_link_to("label", "alias", "method", "args")` | `[label](tx:@alias:method args)` |
| `.continuation("coll", from, total)` | `{{continue collection="coll" from=N total=M}}` |
| `.render_continue("/path")` | `{{render path="/path"}}` |
| `.div_start("classes")` | `<div class="classes">` |
| `.div_end()` | `</div>` |
| `.build()` | Final `Bytes` |

### Registry (Multi-Contract Apps)

```rust
use soroban_render_sdk::registry::BaseRegistry;
use soroban_sdk::{symbol_short, Map};

// Initialize
let mut contracts = Map::new(&env);
contracts.set(symbol_short!("content"), content_addr);
contracts.set(symbol_short!("perms"), perms_addr);
BaseRegistry::init(&env, &admin, contracts);

// Look up
let addr = BaseRegistry::get_by_alias(&env, symbol_short!("content"));
```

### Router Pattern

```rust
Router::new(&env, path)
    .handle(b"/", |_| render_home(&env))
    .or_handle(b"/task/{id}", |req| {
        let id = req.get_var_u32(b"id").unwrap_or(0);
        render_task(&env, id)
    })
    .or_default(|_| render_home(&env))
```

### StyleBuilder

```rust
StyleBuilder::new(&env)
    .root_var("primary", "#0066cc")
    .rule("h1", "color: var(--primary);")
    .dark_mode_start()
    .rule(":root", "--bg: #1a1a1a;")
    .media_end()
    .build()
```

### Byte Utilities

| Function | Description |
|----------|-------------|
| `concat_bytes(&env, &parts)` | Concatenate `Vec<Bytes>` into single `Bytes` |
| `string_to_bytes(&env, &s)` | Convert `soroban_sdk::String` to `Bytes` |
| `escape_json_string(&env, &s)` | Escape string for JSON inclusion |
| `escape_json_bytes(&env, bytes)` | Escape byte slice for JSON |

Max string size: 16KB. For larger content, use soroban-chonk with progressive loading.

### Number Conversion

Bidirectional conversion for all integer types plus `U256`/`I256`.

**To Decimal Bytes:**

| Function | Example |
|----------|---------|
| `u32_to_bytes(&env, 42)` | `"42"` |
| `i64_to_bytes(&env, -42)` | `"-42"` |
| `u128_to_bytes`, `i128_to_bytes`, `u256_to_bytes`, `i256_to_bytes` | Same pattern |

**To Hexadecimal:**

| Function | Example |
|----------|---------|
| `u64_to_hex(&env, 255)` | `"0xff"` |
| `i32_to_hex(&env, -16)` | `"-0x10"` |
| All types: `u32`, `i32`, `u64`, `i64`, `u128`, `i128`, `U256`, `I256` | |

**Parse Decimal (returns `Option<T>`):**

| Function | Input | Output |
|----------|-------|--------|
| `bytes_to_u64(&bytes)` | `"12345"` | `Some(12345)` |
| `bytes_to_i32(&bytes)` | `"-42"` | `Some(-42)` |
| `bytes_to_*(&bytes)` | `"abc"` | `None` |

**Parse Hexadecimal (returns `Option<T>`):**

| Function | Input | Output |
|----------|-------|--------|
| `hex_to_u32(&bytes)` | `"0xFF"` or `"ff"` | `Some(255)` |
| `hex_to_*(&bytes)` | Case-insensitive, `0x` prefix optional | |

**String Convenience (for form input):**

| Function | Example |
|----------|---------|
| `string_to_u32(&env, &s)` | Parse `soroban_sdk::String` to `u32` |
| `string_to_*` variants | All integer types supported |

---

## MULTI-CONTRACT EXAMPLE (soroban-boards)

Reference implementation showing registry-based multi-contract architecture.

### Contract Structure

| Contract | Alias | Responsibility |
|----------|-------|----------------|
| Registry | `registry` | Board factory, contract discovery |
| Board | `board_{id}` | Per-board thread management |
| Content | `content` | Thread/reply content storage |
| Permissions | `perms` | Roles, bans, invites |
| Theme | `theme` | UI rendering |
| Admin | `admin` | Admin panel |

### Form Targeting Pattern

```rust
// In theme contract - forms target other contracts
.form_link_to("Post Reply", "content", "create_reply")
// Output: [Post Reply](form:@content:create_reply)

.tx_link_to("Flag", "perms", "flag_content", r#"{"id":1}"#)
// Output: [Flag](tx:@perms:flag_content {"id":1})
```

### Waterfall Loading Pattern

```rust
// Render first N replies, then load more
fn render_thread(&env: &Env, board_id: u64, thread_id: u64) -> Bytes {
    let mut md = MarkdownBuilder::new(env);
    // ... render first batch ...

    if has_more {
        md = md.render_continue(&format!("/b/{}/t/{}/replies/{}", board_id, thread_id, offset));
    }
    md.build()
}
```

---

## ERROR HANDLING

| Error | Cause | Resolution |
|-------|-------|------------|
| "Account not funded" | Wallet has no XLM | Fund via friendbot |
| "Simulation failed" | Contract error | Check contract logs |
| "Signing failed" | User rejected | Retry transaction |
| "Unknown contract alias" | Alias not in registry | Check registry |
| "Contract does not support render" | No render() function | Wrong contract |

---

## NETWORK CONFIGURATION

### Testnet
```typescript
const client = createClient(
  "https://soroban-testnet.stellar.org",
  "Test SDF Network ; September 2015"
);
```

### Local (Quickstart)
```typescript
const client = createClient(
  "http://localhost:8000/soroban/rpc",
  "Standalone Network ; February 2017"
);
```

---

## TYPICAL USAGE

```tsx
import {
  createClient,
  useRender,
  useWallet,
  InteractiveRenderView,
} from "@nickelshack/soroban-render";

function App() {
  const client = createClient(RPC_URL, NETWORK_PASSPHRASE);
  const { address } = useWallet();
  const {
    html,
    loading,
    error,
    path,
    setPath,
    refetch,
    css,
    scopeClassName,
  } = useRender(client, CONTRACT_ID, {
    viewer: address,
  });

  return (
    <>
      {css && <style>{css}</style>}
      <div className={scopeClassName || ""}>
        <InteractiveRenderView
          client={client}
          contractId={CONTRACT_ID}
          registryId={REGISTRY_ID}
          html={html}
          loading={loading}
          error={error}
          publicKey={address}
          onNavigate={setPath}
          onTransaction={() => refetch()}
        />
      </div>
    </>
  );
}
```
