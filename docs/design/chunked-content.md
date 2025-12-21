# Chunked Content System Design

## Overview

This document describes a system for storing and progressively loading large content in Soroban smart contracts. The system consists of two main components:

1. **soroban-chonk** - A standalone crate for chunked storage
2. **Viewer progressive loading** - Integration with soroban-render for seamless UX

## Problem Statement

Soroban has several constraints that make large content challenging:

| Constraint | Limit | Impact |
|------------|-------|--------|
| Storage entry size | ~64KB | Large documents can't fit in one entry |
| Execution limits | CPU/memory per call | Can't process huge content in one invocation |
| Return value size | Variable | Can't return very large responses |
| Transaction size | ~100KB | Can't write large content in one tx |

**Real-world example:** A Boards-style application with a popular thread might have:
- Thread body: 2KB
- 100 comments: 50KB average
- Metadata, formatting: 10KB
- **Total: ~62KB** - approaching limits for a single render

If the viewer has to make N contract calls before showing anything, the UX degrades significantly. Users expect immediate feedback.

## Design Goals

1. **First paint fast** - Show meaningful content immediately (< 500ms)
2. **Progressive enhancement** - Additional content loads in the background
3. **Simple API** - Basic use cases require minimal code
4. **Composable** - Works with or without soroban-render
5. **Transparent** - Viewer handles continuation automatically
6. **Editable** - Support insert/update/delete without full rewrites

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Smart Contract                           │
│  ┌─────────────────┐     ┌──────────────────────────────────┐  │
│  │  soroban-chonk  │     │         Application Logic         │  │
│  │                 │     │                                    │  │
│  │  - Chunked      │────▶│  render() returns:                │  │
│  │    storage      │     │  - Main content (immediate)       │  │
│  │  - Iteration    │     │  - Continuation markers           │  │
│  │  - Edit ops     │     │  - Chunk references               │  │
│  └─────────────────┘     └──────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                          Viewer                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  Progressive Loader                       │   │
│  │                                                           │   │
│  │  1. Render initial content immediately                   │   │
│  │  2. Detect continuation markers                          │   │
│  │  3. Fetch additional chunks in background                │   │
│  │  4. Append content as it arrives                         │   │
│  │  5. Show loading indicators for pending sections         │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 1: soroban-chonk Crate

### Storage Model

```rust
/// Storage keys for chunked content
#[derive(Clone)]
#[contracttype]
pub enum ChonkKey {
    /// Metadata for a content collection
    Meta(Symbol),        // collection_id -> ChonkMeta
    /// Individual chunk
    Chunk(Symbol, u32),  // (collection_id, index) -> Bytes
}

/// Metadata about a chunked content collection
#[derive(Clone)]
#[contracttype]
pub struct ChonkMeta {
    /// Number of chunks in this collection
    pub count: u32,
    /// Total size in bytes across all chunks
    pub total_bytes: u32,
    /// Recommended chunk size for this collection
    pub chunk_size: u32,
    /// Version for optimistic locking
    pub version: u32,
}
```

### Core API

```rust
/// A collection of chunked content
pub struct Chonk<'a> {
    env: &'a Env,
    id: Symbol,
    meta: ChonkMeta,
}

impl<'a> Chonk<'a> {
    /// Create or open a chunk collection
    pub fn open(env: &'a Env, id: Symbol) -> Self;

    /// Get metadata
    pub fn meta(&self) -> &ChonkMeta;

    /// Get number of chunks
    pub fn count(&self) -> u32;

    /// Get total bytes across all chunks
    pub fn total_bytes(&self) -> u32;

    // ─── Read Operations ───────────────────────────────────

    /// Get a single chunk by index
    pub fn get(&self, index: u32) -> Option<Bytes>;

    /// Get multiple chunks (for batch loading)
    pub fn get_range(&self, start: u32, count: u32) -> Vec<Bytes>;

    /// Iterate over all chunks
    pub fn iter(&self) -> ChonkIter;

    /// Assemble all chunks into a single Bytes
    /// Warning: May hit execution limits for large content
    pub fn assemble(&self) -> Bytes;

    // ─── Write Operations ──────────────────────────────────

    /// Append a chunk to the end
    pub fn push(&mut self, data: Bytes) -> u32;

    /// Replace a specific chunk
    pub fn set(&mut self, index: u32, data: Bytes);

    /// Insert a chunk at index (shifts subsequent chunks)
    pub fn insert(&mut self, index: u32, data: Bytes);

    /// Remove a chunk (shifts subsequent chunks)
    pub fn remove(&mut self, index: u32) -> Option<Bytes>;

    /// Remove all chunks
    pub fn clear(&mut self);

    // ─── Bulk Operations ───────────────────────────────────

    /// Write content, automatically chunking at specified size
    pub fn write_chunked(&mut self, content: Bytes, chunk_size: u32);

    /// Append content to last chunk or create new if needed
    pub fn append(&mut self, content: Bytes, max_chunk_size: u32);
}

/// Iterator over chunks
pub struct ChonkIter<'a> {
    chonk: &'a Chonk<'a>,
    current: u32,
}

impl<'a> Iterator for ChonkIter<'a> {
    type Item = Bytes;
    fn next(&mut self) -> Option<Self::Item>;
}
```

### Storage Layout

```
Storage Key                          Value
──────────────────────────────────────────────────────────
ChonkKey::Meta("article")        →  ChonkMeta { count: 5, total_bytes: 12500, ... }
ChonkKey::Chunk("article", 0)    →  Bytes("# Introduction\n\nThis is...")
ChonkKey::Chunk("article", 1)    →  Bytes("## Chapter 1\n\nThe story...")
ChonkKey::Chunk("article", 2)    →  Bytes("## Chapter 2\n\nMeanwhile...")
ChonkKey::Chunk("article", 3)    →  Bytes("## Chapter 3\n\nFinally...")
ChonkKey::Chunk("article", 4)    →  Bytes("## Conclusion\n\nIn summary...")
```

### Chunk Size Guidelines

| Content Type | Recommended Chunk Size | Rationale |
|--------------|------------------------|-----------|
| Long-form text | 4KB - 8KB | Balance between call count and size |
| Structured data | 2KB - 4KB | Keep logical units together |
| Comments/replies | 1 per chunk | Natural edit boundaries |
| Images (base64) | 16KB - 32KB | Minimize call overhead |

### Example: Storing an Article

```rust
use soroban_chonk::Chonk;

impl ArticleContract {
    pub fn create_article(env: Env, id: Symbol, content: Bytes) {
        let mut chonk = Chonk::open(&env, id);

        // Automatically chunk at 4KB boundaries
        chonk.write_chunked(content, 4096);
    }

    pub fn append_section(env: Env, id: Symbol, section: Bytes) {
        let mut chonk = Chonk::open(&env, id);
        chonk.push(section);
    }

    pub fn get_chunk(env: Env, id: Symbol, index: u32) -> Option<Bytes> {
        let chonk = Chonk::open(&env, id);
        chonk.get(index)
    }

    pub fn get_article_meta(env: Env, id: Symbol) -> ChonkMeta {
        let chonk = Chonk::open(&env, id);
        chonk.meta().clone()
    }
}
```

---

## Part 2: Progressive Loading Protocol

### Continuation Marker

The contract embeds continuation markers in rendered content:

```markdown
# My Article

This is the introduction and main content that should
render immediately for good UX.

{{continue collection="article" from=1}}
```

The `{{continue}}` tag tells the viewer:
- There's more content to load
- It's in the "article" collection
- Start loading from chunk index 1

### Inline Chunk References

For more control, contracts can embed specific chunk references:

```markdown
# Discussion Thread

{{chunk collection="thread_123" index=0}}

## Comments

{{chunk collection="comments_123" index=0 placeholder="Loading comments..."}}
{{chunk collection="comments_123" index=1 placeholder="Loading more..."}}
{{chunk collection="comments_123" index=2}}
```

### Pagination with Continuation

For paginated content like comments, use page-based continuation:

```markdown
## Comments (1-10 of 47)

Comment 1 content...
Comment 2 content...
...
Comment 10 content...

{{continue collection="comments" page=2 per_page=10 total=47}}
```

### Render Protocol Metadata

For sophisticated cases, the contract can return structured metadata:

```rust
/// Extended render result with continuation info
#[contracttype]
pub struct RenderResult {
    /// The immediate content to display
    pub content: Bytes,
    /// Optional continuation info
    pub continuation: Option<Continuation>,
}

#[contracttype]
pub struct Continuation {
    /// Collection ID for remaining content
    pub collection: Symbol,
    /// Starting index for next fetch
    pub from_index: u32,
    /// Total chunks available
    pub total_chunks: u32,
    /// Suggested batch size
    pub batch_size: u32,
}
```

---

## Part 3: Viewer Integration

### Progressive Loader Hook

```typescript
interface UseProgressiveRenderOptions {
  contractId: string;
  path?: string;
  // Progressive loading options
  progressive?: {
    enabled?: boolean;           // Default: true
    batchSize?: number;          // Default: 3 chunks
    concurrency?: number;        // Default: 2 parallel fetches
    placeholderComponent?: React.ComponentType<PlaceholderProps>;
  };
}

interface UseProgressiveRenderResult {
  // Immediate content (first render)
  content: string | null;
  // All loaded content (updates as chunks arrive)
  fullContent: string | null;
  // Loading states
  isInitialLoading: boolean;
  isLoadingMore: boolean;
  // Progress
  loadedChunks: number;
  totalChunks: number | null;
  progress: number;  // 0-1
  // Control
  loadMore: () => Promise<void>;
  loadAll: () => Promise<void>;
  cancel: () => void;
  // Errors
  error: Error | null;
}

function useProgressiveRender(options: UseProgressiveRenderOptions): UseProgressiveRenderResult;
```

### Loading UX States

```
┌─────────────────────────────────────────────────────────────┐
│  Initial Load (0ms)                                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ████████████████████████████████████████████████   │   │
│  │  ████████  Loading...  ██████████████████████████   │   │
│  │  ████████████████████████████████████████████████   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  First Paint (~300ms) - Immediate content visible           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  # My Article                                        │   │
│  │                                                      │   │
│  │  This is the introduction...                         │   │
│  │  ─────────────────────────────────────────────────   │   │
│  │  ░░░░░░░░ Loading more content... ░░░░░░░░░░░░░░░   │   │
│  │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                            [25% loaded]     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Progressive Load (~600ms) - More content arriving          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  # My Article                                        │   │
│  │                                                      │   │
│  │  This is the introduction...                         │   │
│  │                                                      │   │
│  │  ## Chapter 1                                        │   │
│  │  The story begins...                                 │   │
│  │  ─────────────────────────────────────────────────   │   │
│  │  ░░░░░░░░ Loading more content... ░░░░░░░░░░░░░░░   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                            [50% loaded]     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Complete (~1000ms) - All content loaded                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  # My Article                                        │   │
│  │                                                      │   │
│  │  This is the introduction...                         │   │
│  │                                                      │   │
│  │  ## Chapter 1                                        │   │
│  │  The story begins...                                 │   │
│  │                                                      │   │
│  │  ## Chapter 2                                        │   │
│  │  Meanwhile...                                        │   │
│  │                                                      │   │
│  │  ## Conclusion                                       │   │
│  │  In summary...                                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                            [100% loaded]    │
└─────────────────────────────────────────────────────────────┘
```

### Placeholder Component

```typescript
interface PlaceholderProps {
  type: 'loading' | 'error' | 'pending';
  message?: string;
  progress?: number;
  retry?: () => void;
}

// Default placeholder
function DefaultPlaceholder({ type, message, progress }: PlaceholderProps) {
  if (type === 'loading') {
    return (
      <div className="soroban-chunk-loading">
        <Spinner />
        <span>{message || 'Loading content...'}</span>
        {progress !== undefined && <ProgressBar value={progress} />}
      </div>
    );
  }
  // ... error and pending states
}
```

### Continuation Parser

```typescript
interface ContinuationTag {
  type: 'continue' | 'chunk';
  collection: string;
  index?: number;
  from?: number;
  page?: number;
  perPage?: number;
  total?: number;
  placeholder?: string;
}

function parseContinuationTags(content: string): {
  content: string;           // Content with tags removed
  tags: ContinuationTag[];   // Parsed continuation tags
  positions: number[];       // Where tags were in content
}

function hasContinuation(content: string): boolean;
```

---

## Part 4: SDK Integration (soroban-render-sdk)

### ChonkBuilder

A convenience builder for rendering chunked content:

```rust
use soroban_render_sdk::prelude::*;
use soroban_chonk::Chonk;

pub struct ChonkBuilder<'a> {
    env: &'a Env,
    parts: Vec<Bytes>,
    continuations: Vec<Continuation>,
}

impl<'a> ChonkBuilder<'a> {
    pub fn new(env: &'a Env) -> Self;

    /// Add immediate content (renders right away)
    pub fn immediate(self, content: Bytes) -> Self;

    /// Add a continuation marker for deferred content
    pub fn continue_from(self, collection: Symbol, from_index: u32) -> Self;

    /// Add inline chunk reference
    pub fn chunk(self, collection: Symbol, index: u32) -> Self;

    /// Add chunk with custom placeholder
    pub fn chunk_with_placeholder(
        self,
        collection: Symbol,
        index: u32,
        placeholder: &str
    ) -> Self;

    /// Build the render output
    pub fn build(self) -> Bytes;
}
```

### Render Helper Macros

```rust
/// Macro for continuation marker
#[macro_export]
macro_rules! render_continue {
    ($collection:expr, from = $index:expr) => {
        concat!("{{continue collection=\"", $collection, "\" from=", $index, "}}")
    };
    ($collection:expr, page = $page:expr, per_page = $pp:expr, total = $total:expr) => {
        concat!(
            "{{continue collection=\"", $collection,
            "\" page=", $page,
            " per_page=", $pp,
            " total=", $total, "}}"
        )
    };
}

/// Macro for inline chunk
#[macro_export]
macro_rules! render_chunk {
    ($collection:expr, $index:expr) => {
        concat!("{{chunk collection=\"", $collection, "\" index=", $index, "}}")
    };
    ($collection:expr, $index:expr, placeholder = $ph:expr) => {
        concat!(
            "{{chunk collection=\"", $collection,
            "\" index=", $index,
            " placeholder=\"", $ph, "\"}}"
        )
    };
}
```

### Example: Boards-Style Application

```rust
use soroban_sdk::{contract, contractimpl, Env, Symbol, Bytes, Vec};
use soroban_render_sdk::prelude::*;
use soroban_chonk::Chonk;

#[contract]
pub struct BoardsContract;

#[contractimpl]
impl BoardsContract {
    /// Render a thread with comments
    pub fn render(env: Env, path: Option<String>, _viewer: Option<Address>) -> Bytes {
        let path = path.unwrap_or_default();

        // Parse path: /board/thread_id
        if let Some(thread_id) = Self::parse_thread_path(&path) {
            return Self::render_thread(&env, thread_id);
        }

        Self::render_board_list(&env)
    }

    fn render_thread(env: &Env, thread_id: Symbol) -> Bytes {
        // Get thread metadata
        let thread = Self::get_thread(env, thread_id.clone());
        let comment_count = Self::get_comment_count(env, thread_id.clone());

        // Build response with immediate content + continuation
        let mut builder = MarkdownBuilder::new(env);

        // Immediate content: thread header + body
        builder = builder
            .h1(&thread.title)
            .paragraph(&format!("Posted by {} on {}", thread.author, thread.date))
            .paragraph(&thread.body)
            .hr()
            .h2(&format!("Comments ({})", comment_count));

        if comment_count > 0 {
            // Get first batch of comments (immediate)
            let first_comments = Self::get_comments_batch(env, thread_id.clone(), 0, 5);
            for comment in first_comments.iter() {
                builder = builder.blockquote(&format!(
                    "**{}**: {}",
                    comment.author,
                    comment.body
                ));
            }

            // Add continuation for remaining comments
            if comment_count > 5 {
                builder = builder.raw_str(&format!(
                    "{{{{continue collection=\"comments_{}\" from=5 total={}}}}}",
                    thread_id,
                    comment_count
                ));
            }
        } else {
            builder = builder.paragraph("*No comments yet. Be the first!*");
        }

        // Add comment form
        builder = builder
            .hr()
            .h3("Add a Comment")
            .form_start(&format!("tx:{}?fn=add_comment&thread_id={}",
                env.current_contract_address(), thread_id))
            .textarea("body", "Write your comment...", 4)
            .submit("Post Comment")
            .form_end();

        builder.build()
    }

    /// Fetch a batch of comments (called by viewer for continuation)
    pub fn get_chunk(env: Env, collection: Symbol, index: u32) -> Option<Bytes> {
        // Parse collection name to determine type
        let collection_str = /* convert Symbol to string */;

        if collection_str.starts_with("comments_") {
            let thread_id = /* extract thread_id */;
            let comment = Self::get_comment(env, thread_id, index)?;

            let mut builder = MarkdownBuilder::new(&env);
            builder = builder.blockquote(&format!(
                "**{}**: {}",
                comment.author,
                comment.body
            ));
            Some(builder.build())
        } else {
            None
        }
    }

    /// Get chunk metadata for a collection
    pub fn get_chunk_meta(env: Env, collection: Symbol) -> Option<ChonkMeta> {
        let chonk = Chonk::open(&env, collection);
        if chonk.count() > 0 {
            Some(chonk.meta().clone())
        } else {
            None
        }
    }
}
```

---

## Part 5: Performance Considerations

### Fetch Strategy

The viewer should use an intelligent fetch strategy:

```typescript
interface FetchStrategy {
  // Initial load: prioritize first paint
  initialBatchSize: number;      // Default: 1 (just the render() response)

  // Progressive loading
  backgroundBatchSize: number;   // Default: 3 chunks per request
  maxConcurrentFetches: number;  // Default: 2
  fetchDelay: number;            // Default: 0ms (immediate background fetch)

  // Lazy loading (for below-fold content)
  lazyLoadThreshold: number;     // Default: 2 (chunks before viewport)

  // Retry behavior
  maxRetries: number;            // Default: 3
  retryDelay: number;            // Default: 1000ms
  exponentialBackoff: boolean;   // Default: true
}
```

### Caching

```typescript
interface ChunkCache {
  // Cache fetched chunks
  set(contractId: string, collection: string, index: number, data: string): void;
  get(contractId: string, collection: string, index: number): string | null;

  // TTL-based expiry
  ttl: number;  // Default: 60000ms

  // Size limits
  maxSize: number;  // Default: 10MB
  maxEntries: number;  // Default: 1000

  // Preemptive refresh
  refreshThreshold: number;  // Default: 0.8 (refresh at 80% TTL)
}
```

### Bandwidth Optimization

For mobile/slow connections:

```typescript
interface BandwidthOptimization {
  // Detect connection quality
  useNetworkInfo: boolean;  // Default: true

  // Adjust behavior based on connection
  connectionProfiles: {
    'slow-2g': { batchSize: 1, prefetch: false },
    '2g': { batchSize: 1, prefetch: false },
    '3g': { batchSize: 2, prefetch: true },
    '4g': { batchSize: 3, prefetch: true },
    'wifi': { batchSize: 5, prefetch: true },
  };

  // Data saver mode
  dataSaverMode: boolean;  // Disable prefetch, minimal batches
}
```

---

## Part 6: Error Handling

### Partial Load Recovery

```typescript
interface PartialLoadState {
  // What we have
  loadedChunks: Set<number>;
  totalChunks: number;

  // What failed
  failedChunks: Map<number, Error>;

  // Recovery options
  retryFailed(): Promise<void>;
  skipFailed(): void;
  showPartial(): void;
}
```

### Error Display

```markdown
# My Article

This is the introduction...

## Chapter 1
The story begins...

---
> **Failed to load content**
>
> Some content could not be loaded. [Retry] [Skip]
---

## Conclusion
In summary...
```

---

## Implementation Phases

### Phase 1: soroban-chonk Crate
- [ ] Core storage types (ChonkKey, ChonkMeta)
- [ ] Basic CRUD operations
- [ ] Iterator implementation
- [ ] Unit tests
- [ ] Documentation

### Phase 2: Viewer Continuation Support
- [ ] Continuation tag parser
- [ ] Basic progressive loader
- [ ] Placeholder component
- [ ] Integration with useRender hook
- [ ] Unit tests

### Phase 3: SDK Integration
- [ ] ChonkBuilder
- [ ] Render helper macros
- [ ] Integration tests with viewer

### Phase 4: Advanced Features
- [ ] Caching layer
- [ ] Bandwidth optimization
- [ ] Error recovery UI
- [ ] Performance profiling

---

## Open Questions

1. **Chunk addressing**: Should we support content-addressed chunks (hash-based) for deduplication?

2. **Compression**: Should chunks support compression (e.g., gzip)?

3. **Streaming**: Can we support true streaming for very large content?

4. **Versioning**: How do we handle chunk updates while viewers are loading?

5. **Analytics**: Should we track chunk load patterns for optimization?

---

## References

- [gno.land chonk package](https://github.com/gnolang/gno/tree/master/examples/gno.land/p/n2p5/chonk)
- [Soroban storage documentation](https://soroban.stellar.org/docs/fundamentals-and-concepts/persisting-data)
- [React Suspense for data fetching](https://react.dev/reference/react/Suspense)
