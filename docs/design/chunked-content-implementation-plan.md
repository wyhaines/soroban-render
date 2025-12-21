# Chunked Content Implementation Plan

## Overview

This document provides a detailed, step-by-step implementation plan for the chunked content system consisting of:

1. **soroban-chonk** - Standalone Rust crate for chunked storage
2. **soroban-render-sdk changes** - SDK helpers for continuation markers
3. **@soroban-render/core changes** - Viewer progressive loading support

## Directory Structure

```
/media/wyhaines/home/wyhaines/ghq/github.com/wyhaines/
├── soroban-render/           # Existing - viewer and contracts
├── soroban-render-sdk/       # Existing - Rust SDK
└── soroban-chonk/            # NEW - chunked storage crate
```

---

# Phase 1: soroban-chonk Crate

## 1.1 Project Setup

**Location:** `/media/wyhaines/home/wyhaines/ghq/github.com/wyhaines/soroban-chonk`

### Files to Create

```
soroban-chonk/
├── Cargo.toml
├── README.md
├── LICENSE                    # MIT or Apache-2.0
├── .gitignore
├── src/
│   ├── lib.rs                # Main exports
│   ├── types.rs              # ChonkKey, ChonkMeta types
│   ├── chonk.rs              # Core Chonk struct and impl
│   ├── iter.rs               # ChonkIter implementation
│   └── error.rs              # Error types
└── tests/
    └── integration_test.rs   # Integration tests
```

### Cargo.toml

```toml
[package]
name = "soroban-chonk"
version = "0.1.0"
edition = "2021"
license = "MIT OR Apache-2.0"
description = "Chunked content storage for Soroban smart contracts"
repository = "https://github.com/wyhaines/soroban-chonk"
keywords = ["soroban", "stellar", "blockchain", "storage", "chunked"]
categories = ["no-std", "data-structures"]

[lib]
crate-type = ["cdylib", "rlib"]

[features]
default = ["std"]
std = ["soroban-sdk/std"]
testutils = ["soroban-sdk/testutils"]

[dependencies]
soroban-sdk = { version = "22.0.0", default-features = false }

[dev-dependencies]
soroban-sdk = { version = "22.0.0", features = ["testutils"] }

[profile.release]
opt-level = "z"
overflow-checks = true
debug = 0
strip = "symbols"
debug-assertions = false
panic = "abort"
codegen-units = 1
lto = true

[profile.release-with-logs]
inherits = "release"
debug-assertions = true
```

## 1.2 Core Types (src/types.rs)

```rust
use soroban_sdk::{contracttype, Symbol};

/// Storage keys for chunked content
#[derive(Clone)]
#[contracttype]
pub enum ChonkKey {
    /// Metadata for a content collection: collection_id -> ChonkMeta
    Meta(Symbol),
    /// Individual chunk: (collection_id, index) -> Bytes
    Chunk(Symbol, u32),
}

/// Metadata about a chunked content collection
#[derive(Clone, Debug, PartialEq)]
#[contracttype]
pub struct ChonkMeta {
    /// Number of chunks in this collection
    pub count: u32,
    /// Total size in bytes across all chunks
    pub total_bytes: u32,
    /// Version for optimistic locking (incremented on each write)
    pub version: u32,
}

impl ChonkMeta {
    pub fn new() -> Self {
        Self {
            count: 0,
            total_bytes: 0,
            version: 0,
        }
    }
}

impl Default for ChonkMeta {
    fn default() -> Self {
        Self::new()
    }
}
```

## 1.3 Core Implementation (src/chonk.rs)

```rust
use soroban_sdk::{Bytes, Env, Symbol};
use crate::types::{ChonkKey, ChonkMeta};
use crate::iter::ChonkIter;

/// A collection of chunked content stored in contract storage
pub struct Chonk<'a> {
    env: &'a Env,
    id: Symbol,
}

impl<'a> Chonk<'a> {
    /// Create or open a chunk collection
    pub fn open(env: &'a Env, id: Symbol) -> Self {
        Self { env, id }
    }

    /// Get the collection ID
    pub fn id(&self) -> &Symbol {
        &self.id
    }

    /// Get metadata for this collection
    pub fn meta(&self) -> ChonkMeta {
        let key = ChonkKey::Meta(self.id.clone());
        self.env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_default()
    }

    /// Get number of chunks
    pub fn count(&self) -> u32 {
        self.meta().count
    }

    /// Get total bytes across all chunks
    pub fn total_bytes(&self) -> u32 {
        self.meta().total_bytes
    }

    /// Check if the collection is empty
    pub fn is_empty(&self) -> bool {
        self.count() == 0
    }

    // ─── Read Operations ───────────────────────────────────

    /// Get a single chunk by index
    pub fn get(&self, index: u32) -> Option<Bytes> {
        let key = ChonkKey::Chunk(self.id.clone(), index);
        self.env.storage().persistent().get(&key)
    }

    /// Get multiple chunks as a Vec
    pub fn get_range(&self, start: u32, count: u32) -> soroban_sdk::Vec<Bytes> {
        let mut result = soroban_sdk::Vec::new(self.env);
        let meta = self.meta();
        let end = core::cmp::min(start + count, meta.count);

        for i in start..end {
            if let Some(chunk) = self.get(i) {
                result.push_back(chunk);
            }
        }
        result
    }

    /// Iterate over all chunks
    pub fn iter(&self) -> ChonkIter {
        ChonkIter::new(self.env, self.id.clone(), self.count())
    }

    /// Assemble all chunks into a single Bytes
    /// Warning: May hit execution limits for very large content
    pub fn assemble(&self) -> Bytes {
        let mut result = Bytes::new(self.env);
        for chunk in self.iter() {
            result.append(&chunk);
        }
        result
    }

    // ─── Write Operations ──────────────────────────────────

    /// Save metadata
    fn save_meta(&self, meta: &ChonkMeta) {
        let key = ChonkKey::Meta(self.id.clone());
        self.env.storage().persistent().set(&key, meta);
    }

    /// Append a chunk to the end, returns the new index
    pub fn push(&self, data: Bytes) -> u32 {
        let mut meta = self.meta();
        let index = meta.count;

        let key = ChonkKey::Chunk(self.id.clone(), index);
        let data_len = data.len();
        self.env.storage().persistent().set(&key, &data);

        meta.count += 1;
        meta.total_bytes += data_len;
        meta.version += 1;
        self.save_meta(&meta);

        index
    }

    /// Replace a specific chunk
    pub fn set(&self, index: u32, data: Bytes) {
        let mut meta = self.meta();
        if index >= meta.count {
            panic!("Index out of bounds");
        }

        let key = ChonkKey::Chunk(self.id.clone(), index);

        // Adjust total_bytes
        if let Some(old_data) = self.env.storage().persistent().get::<_, Bytes>(&key) {
            meta.total_bytes -= old_data.len();
        }
        meta.total_bytes += data.len();
        meta.version += 1;

        self.env.storage().persistent().set(&key, &data);
        self.save_meta(&meta);
    }

    /// Insert a chunk at index (shifts subsequent chunks)
    pub fn insert(&self, index: u32, data: Bytes) {
        let mut meta = self.meta();
        if index > meta.count {
            panic!("Index out of bounds");
        }

        // Shift chunks from end to index
        for i in (index..meta.count).rev() {
            let from_key = ChonkKey::Chunk(self.id.clone(), i);
            let to_key = ChonkKey::Chunk(self.id.clone(), i + 1);
            if let Some(chunk) = self.env.storage().persistent().get::<_, Bytes>(&from_key) {
                self.env.storage().persistent().set(&to_key, &chunk);
            }
        }

        // Insert new chunk
        let key = ChonkKey::Chunk(self.id.clone(), index);
        let data_len = data.len();
        self.env.storage().persistent().set(&key, &data);

        meta.count += 1;
        meta.total_bytes += data_len;
        meta.version += 1;
        self.save_meta(&meta);
    }

    /// Remove a chunk at index (shifts subsequent chunks)
    pub fn remove(&self, index: u32) -> Option<Bytes> {
        let mut meta = self.meta();
        if index >= meta.count {
            return None;
        }

        // Get the chunk being removed
        let key = ChonkKey::Chunk(self.id.clone(), index);
        let removed: Option<Bytes> = self.env.storage().persistent().get(&key);

        // Shift subsequent chunks
        for i in index..(meta.count - 1) {
            let from_key = ChonkKey::Chunk(self.id.clone(), i + 1);
            let to_key = ChonkKey::Chunk(self.id.clone(), i);
            if let Some(chunk) = self.env.storage().persistent().get::<_, Bytes>(&from_key) {
                self.env.storage().persistent().set(&to_key, &chunk);
            }
        }

        // Remove last slot
        let last_key = ChonkKey::Chunk(self.id.clone(), meta.count - 1);
        self.env.storage().persistent().remove(&last_key);

        // Update metadata
        if let Some(ref data) = removed {
            meta.total_bytes -= data.len();
        }
        meta.count -= 1;
        meta.version += 1;
        self.save_meta(&meta);

        removed
    }

    /// Remove all chunks
    pub fn clear(&self) {
        let meta = self.meta();

        // Remove all chunks
        for i in 0..meta.count {
            let key = ChonkKey::Chunk(self.id.clone(), i);
            self.env.storage().persistent().remove(&key);
        }

        // Remove metadata
        let meta_key = ChonkKey::Meta(self.id.clone());
        self.env.storage().persistent().remove(&meta_key);
    }

    // ─── Bulk Operations ───────────────────────────────────

    /// Write content, automatically chunking at specified size
    pub fn write_chunked(&self, content: Bytes, chunk_size: u32) {
        // Clear existing content
        self.clear();

        let content_len = content.len();
        if content_len == 0 {
            return;
        }

        let mut offset = 0u32;
        while offset < content_len {
            let end = core::cmp::min(offset + chunk_size, content_len);
            let chunk = content.slice(offset..end);
            self.push(chunk);
            offset = end;
        }
    }

    /// Append content to last chunk or create new if it would exceed max size
    pub fn append(&self, content: Bytes, max_chunk_size: u32) {
        let meta = self.meta();

        if meta.count == 0 {
            self.push(content);
            return;
        }

        let last_index = meta.count - 1;
        if let Some(last_chunk) = self.get(last_index) {
            let new_len = last_chunk.len() + content.len();
            if new_len <= max_chunk_size {
                // Append to existing chunk
                let mut combined = Bytes::new(self.env);
                combined.append(&last_chunk);
                combined.append(&content);
                self.set(last_index, combined);
            } else {
                // Create new chunk
                self.push(content);
            }
        } else {
            self.push(content);
        }
    }
}
```

## 1.4 Iterator Implementation (src/iter.rs)

```rust
use soroban_sdk::{Bytes, Env, Symbol};
use crate::types::ChonkKey;

/// Iterator over chunks in a Chonk collection
pub struct ChonkIter<'a> {
    env: &'a Env,
    id: Symbol,
    count: u32,
    current: u32,
}

impl<'a> ChonkIter<'a> {
    pub fn new(env: &'a Env, id: Symbol, count: u32) -> Self {
        Self {
            env,
            id,
            count,
            current: 0,
        }
    }
}

impl<'a> Iterator for ChonkIter<'a> {
    type Item = Bytes;

    fn next(&mut self) -> Option<Self::Item> {
        if self.current >= self.count {
            return None;
        }

        let key = ChonkKey::Chunk(self.id.clone(), self.current);
        let result = self.env.storage().persistent().get(&key);
        self.current += 1;
        result
    }
}

impl<'a> ExactSizeIterator for ChonkIter<'a> {
    fn len(&self) -> usize {
        (self.count - self.current) as usize
    }
}
```

## 1.5 Error Types (src/error.rs)

```rust
use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ChonkError {
    /// Index is out of bounds
    IndexOutOfBounds = 1,
    /// Collection not found
    NotFound = 2,
    /// Chunk size exceeds maximum
    ChunkTooLarge = 3,
    /// Operation would exceed storage limits
    StorageLimitExceeded = 4,
}
```

## 1.6 Main Library (src/lib.rs)

```rust
#![no_std]

mod types;
mod chonk;
mod iter;
mod error;

pub use types::{ChonkKey, ChonkMeta};
pub use chonk::Chonk;
pub use iter::ChonkIter;
pub use error::ChonkError;

/// Prelude for convenient imports
pub mod prelude {
    pub use crate::{Chonk, ChonkKey, ChonkMeta, ChonkIter, ChonkError};
}
```

## 1.7 Tests (tests/integration_test.rs)

```rust
#![cfg(test)]

use soroban_chonk::prelude::*;
use soroban_sdk::{symbol_short, Bytes, Env};

#[test]
fn test_empty_chonk() {
    let env = Env::default();
    let chonk = Chonk::open(&env, symbol_short!("test"));

    assert_eq!(chonk.count(), 0);
    assert_eq!(chonk.total_bytes(), 0);
    assert!(chonk.is_empty());
    assert!(chonk.get(0).is_none());
}

#[test]
fn test_push_and_get() {
    let env = Env::default();
    let chonk = Chonk::open(&env, symbol_short!("test"));

    let chunk1 = Bytes::from_slice(&env, b"Hello, ");
    let chunk2 = Bytes::from_slice(&env, b"World!");

    let idx1 = chonk.push(chunk1.clone());
    let idx2 = chonk.push(chunk2.clone());

    assert_eq!(idx1, 0);
    assert_eq!(idx2, 1);
    assert_eq!(chonk.count(), 2);
    assert_eq!(chonk.total_bytes(), 13);

    assert_eq!(chonk.get(0), Some(chunk1));
    assert_eq!(chonk.get(1), Some(chunk2));
    assert!(chonk.get(2).is_none());
}

#[test]
fn test_assemble() {
    let env = Env::default();
    let chonk = Chonk::open(&env, symbol_short!("test"));

    chonk.push(Bytes::from_slice(&env, b"Hello, "));
    chonk.push(Bytes::from_slice(&env, b"World!"));

    let assembled = chonk.assemble();
    assert_eq!(assembled, Bytes::from_slice(&env, b"Hello, World!"));
}

#[test]
fn test_write_chunked() {
    let env = Env::default();
    let chonk = Chonk::open(&env, symbol_short!("test"));

    let content = Bytes::from_slice(&env, b"ABCDEFGHIJ"); // 10 bytes
    chonk.write_chunked(content.clone(), 3);

    assert_eq!(chonk.count(), 4); // 3 + 3 + 3 + 1
    assert_eq!(chonk.get(0), Some(Bytes::from_slice(&env, b"ABC")));
    assert_eq!(chonk.get(1), Some(Bytes::from_slice(&env, b"DEF")));
    assert_eq!(chonk.get(2), Some(Bytes::from_slice(&env, b"GHI")));
    assert_eq!(chonk.get(3), Some(Bytes::from_slice(&env, b"J")));

    let assembled = chonk.assemble();
    assert_eq!(assembled, content);
}

#[test]
fn test_set() {
    let env = Env::default();
    let chonk = Chonk::open(&env, symbol_short!("test"));

    chonk.push(Bytes::from_slice(&env, b"old"));
    chonk.set(0, Bytes::from_slice(&env, b"new_value"));

    assert_eq!(chonk.get(0), Some(Bytes::from_slice(&env, b"new_value")));
    assert_eq!(chonk.total_bytes(), 9);
}

#[test]
fn test_insert() {
    let env = Env::default();
    let chonk = Chonk::open(&env, symbol_short!("test"));

    chonk.push(Bytes::from_slice(&env, b"A"));
    chonk.push(Bytes::from_slice(&env, b"C"));
    chonk.insert(1, Bytes::from_slice(&env, b"B"));

    assert_eq!(chonk.count(), 3);
    assert_eq!(chonk.get(0), Some(Bytes::from_slice(&env, b"A")));
    assert_eq!(chonk.get(1), Some(Bytes::from_slice(&env, b"B")));
    assert_eq!(chonk.get(2), Some(Bytes::from_slice(&env, b"C")));
}

#[test]
fn test_remove() {
    let env = Env::default();
    let chonk = Chonk::open(&env, symbol_short!("test"));

    chonk.push(Bytes::from_slice(&env, b"A"));
    chonk.push(Bytes::from_slice(&env, b"B"));
    chonk.push(Bytes::from_slice(&env, b"C"));

    let removed = chonk.remove(1);

    assert_eq!(removed, Some(Bytes::from_slice(&env, b"B")));
    assert_eq!(chonk.count(), 2);
    assert_eq!(chonk.get(0), Some(Bytes::from_slice(&env, b"A")));
    assert_eq!(chonk.get(1), Some(Bytes::from_slice(&env, b"C")));
}

#[test]
fn test_clear() {
    let env = Env::default();
    let chonk = Chonk::open(&env, symbol_short!("test"));

    chonk.push(Bytes::from_slice(&env, b"A"));
    chonk.push(Bytes::from_slice(&env, b"B"));
    chonk.clear();

    assert!(chonk.is_empty());
    assert_eq!(chonk.count(), 0);
    assert_eq!(chonk.total_bytes(), 0);
}

#[test]
fn test_iter() {
    let env = Env::default();
    let chonk = Chonk::open(&env, symbol_short!("test"));

    chonk.push(Bytes::from_slice(&env, b"A"));
    chonk.push(Bytes::from_slice(&env, b"B"));
    chonk.push(Bytes::from_slice(&env, b"C"));

    let chunks: Vec<Bytes> = chonk.iter().collect();

    assert_eq!(chunks.len(), 3);
    assert_eq!(chunks[0], Bytes::from_slice(&env, b"A"));
    assert_eq!(chunks[1], Bytes::from_slice(&env, b"B"));
    assert_eq!(chunks[2], Bytes::from_slice(&env, b"C"));
}

#[test]
fn test_append() {
    let env = Env::default();
    let chonk = Chonk::open(&env, symbol_short!("test"));

    chonk.append(Bytes::from_slice(&env, b"Hello"), 20);
    assert_eq!(chonk.count(), 1);

    chonk.append(Bytes::from_slice(&env, b", World!"), 20);
    assert_eq!(chonk.count(), 1); // Should append to existing
    assert_eq!(chonk.get(0), Some(Bytes::from_slice(&env, b"Hello, World!")));

    chonk.append(Bytes::from_slice(&env, b" This is a long addition"), 20);
    assert_eq!(chonk.count(), 2); // Should create new chunk
}

#[test]
fn test_get_range() {
    let env = Env::default();
    let chonk = Chonk::open(&env, symbol_short!("test"));

    for i in 0..10 {
        let s = format!("chunk_{}", i);
        chonk.push(Bytes::from_slice(&env, s.as_bytes()));
    }

    let range = chonk.get_range(3, 4);
    assert_eq!(range.len(), 4);
}

#[test]
fn test_multiple_collections() {
    let env = Env::default();

    let chonk_a = Chonk::open(&env, symbol_short!("a"));
    let chonk_b = Chonk::open(&env, symbol_short!("b"));

    chonk_a.push(Bytes::from_slice(&env, b"A content"));
    chonk_b.push(Bytes::from_slice(&env, b"B content"));

    assert_eq!(chonk_a.count(), 1);
    assert_eq!(chonk_b.count(), 1);
    assert_eq!(chonk_a.get(0), Some(Bytes::from_slice(&env, b"A content")));
    assert_eq!(chonk_b.get(0), Some(Bytes::from_slice(&env, b"B content")));
}

#[test]
fn test_version_tracking() {
    let env = Env::default();
    let chonk = Chonk::open(&env, symbol_short!("test"));

    assert_eq!(chonk.meta().version, 0);

    chonk.push(Bytes::from_slice(&env, b"A"));
    assert_eq!(chonk.meta().version, 1);

    chonk.push(Bytes::from_slice(&env, b"B"));
    assert_eq!(chonk.meta().version, 2);

    chonk.set(0, Bytes::from_slice(&env, b"A2"));
    assert_eq!(chonk.meta().version, 3);

    chonk.remove(1);
    assert_eq!(chonk.meta().version, 4);
}
```

## 1.8 README.md

```markdown
# soroban-chonk

Chunked content storage for Soroban smart contracts.

## Overview

`soroban-chonk` provides a simple, efficient way to store large content as a series of chunks in Soroban contract storage. This is useful when:

- Content exceeds single storage entry limits (~64KB)
- You want to enable progressive loading of content
- You need to edit portions of large content without rewriting everything

## Installation

Add to your `Cargo.toml`:

\`\`\`toml
[dependencies]
soroban-chonk = "0.1"
\`\`\`

## Quick Start

\`\`\`rust
use soroban_chonk::prelude::*;
use soroban_sdk::{symbol_short, Bytes, Env};

// Open or create a chunk collection
let chonk = Chonk::open(&env, symbol_short!("article"));

// Add chunks
chonk.push(Bytes::from_slice(&env, b"Introduction..."));
chonk.push(Bytes::from_slice(&env, b"Chapter 1..."));
chonk.push(Bytes::from_slice(&env, b"Chapter 2..."));

// Or auto-chunk large content
let large_content = Bytes::from_slice(&env, &[0u8; 100_000]);
chonk.write_chunked(large_content, 4096); // 4KB chunks

// Read chunks
let first_chunk = chonk.get(0);
let meta = chonk.meta(); // { count: 25, total_bytes: 100000, version: 25 }

// Iterate
for chunk in chonk.iter() {
    // process chunk
}

// Assemble all chunks (be careful with large content!)
let full_content = chonk.assemble();
\`\`\`

## API

### Chonk

| Method | Description |
|--------|-------------|
| `open(env, id)` | Create or open a chunk collection |
| `meta()` | Get metadata (count, total_bytes, version) |
| `count()` | Get number of chunks |
| `is_empty()` | Check if collection is empty |
| `get(index)` | Get a single chunk |
| `get_range(start, count)` | Get multiple chunks |
| `iter()` | Iterate over all chunks |
| `assemble()` | Combine all chunks into one Bytes |
| `push(data)` | Append a chunk |
| `set(index, data)` | Replace a chunk |
| `insert(index, data)` | Insert at position (shifts others) |
| `remove(index)` | Remove at position (shifts others) |
| `clear()` | Remove all chunks |
| `write_chunked(content, size)` | Auto-chunk content |
| `append(content, max_size)` | Smart append |

## Integration with soroban-render

For progressive content loading, see [soroban-render documentation](https://github.com/wyhaines/soroban-render).

## License

MIT OR Apache-2.0
\`\`\`

---

# Phase 2: soroban-render-sdk Changes

## 2.1 Add Continuation Helpers

**File:** `soroban-render-sdk/src/continuation.rs` (NEW)

```rust
//! Helpers for progressive content loading with continuation markers

use soroban_sdk::{Bytes, Env, Symbol};

/// Builder for continuation markers in rendered content
pub struct ContinuationBuilder<'a> {
    env: &'a Env,
}

impl<'a> ContinuationBuilder<'a> {
    pub fn new(env: &'a Env) -> Self {
        Self { env }
    }

    /// Create a continuation marker for remaining chunks
    /// Output: {{continue collection="name" from=5 total=20}}
    pub fn continue_from(&self, collection: &str, from_index: u32, total: Option<u32>) -> Bytes {
        let mut s = alloc::string::String::new();
        s.push_str("{{continue collection=\"");
        s.push_str(collection);
        s.push_str("\" from=");
        s.push_str(&from_index.to_string());
        if let Some(t) = total {
            s.push_str(" total=");
            s.push_str(&t.to_string());
        }
        s.push_str("}}");
        Bytes::from_slice(self.env, s.as_bytes())
    }

    /// Create a chunk reference
    /// Output: {{chunk collection="name" index=3}}
    pub fn chunk_ref(&self, collection: &str, index: u32) -> Bytes {
        let mut s = alloc::string::String::new();
        s.push_str("{{chunk collection=\"");
        s.push_str(collection);
        s.push_str("\" index=");
        s.push_str(&index.to_string());
        s.push_str("}}");
        Bytes::from_slice(self.env, s.as_bytes())
    }

    /// Create a chunk reference with placeholder
    /// Output: {{chunk collection="name" index=3 placeholder="Loading..."}}
    pub fn chunk_ref_with_placeholder(
        &self,
        collection: &str,
        index: u32,
        placeholder: &str,
    ) -> Bytes {
        let mut s = alloc::string::String::new();
        s.push_str("{{chunk collection=\"");
        s.push_str(collection);
        s.push_str("\" index=");
        s.push_str(&index.to_string());
        s.push_str(" placeholder=\"");
        s.push_str(placeholder);
        s.push_str("\"}}");
        Bytes::from_slice(self.env, s.as_bytes())
    }

    /// Create a paginated continuation
    /// Output: {{continue collection="name" page=2 per_page=10 total=47}}
    pub fn continue_page(
        &self,
        collection: &str,
        page: u32,
        per_page: u32,
        total: u32,
    ) -> Bytes {
        let mut s = alloc::string::String::new();
        s.push_str("{{continue collection=\"");
        s.push_str(collection);
        s.push_str("\" page=");
        s.push_str(&page.to_string());
        s.push_str(" per_page=");
        s.push_str(&per_page.to_string());
        s.push_str(" total=");
        s.push_str(&total.to_string());
        s.push_str("}}");
        Bytes::from_slice(self.env, s.as_bytes())
    }
}

/// Extension trait for MarkdownBuilder to add continuation support
pub trait ContinuationExt {
    /// Add a continuation marker
    fn continuation(self, collection: &str, from_index: u32, total: Option<u32>) -> Self;

    /// Add a chunk reference
    fn chunk(self, collection: &str, index: u32) -> Self;

    /// Add a chunk reference with placeholder
    fn chunk_placeholder(self, collection: &str, index: u32, placeholder: &str) -> Self;
}
```

## 2.2 Update MarkdownBuilder

**File:** `soroban-render-sdk/src/markdown.rs`

Add to MarkdownBuilder:
```rust
impl<'a> MarkdownBuilder<'a> {
    // ... existing methods ...

    /// Add a continuation marker for progressive loading
    pub fn continuation(self, collection: &str, from_index: u32, total: Option<u32>) -> Self {
        let cont = ContinuationBuilder::new(self.env);
        let marker = cont.continue_from(collection, from_index, total);
        self.raw(marker)
    }

    /// Add a chunk reference
    pub fn chunk_ref(self, collection: &str, index: u32) -> Self {
        let cont = ContinuationBuilder::new(self.env);
        let marker = cont.chunk_ref(collection, index);
        self.raw(marker)
    }

    /// Add a chunk reference with loading placeholder
    pub fn chunk_ref_placeholder(self, collection: &str, index: u32, placeholder: &str) -> Self {
        let cont = ContinuationBuilder::new(self.env);
        let marker = cont.chunk_ref_with_placeholder(collection, index, placeholder);
        self.raw(marker)
    }
}
```

## 2.3 Update Exports

**File:** `soroban-render-sdk/src/lib.rs`

```rust
pub mod continuation;
pub use continuation::{ContinuationBuilder, ContinuationExt};
```

**File:** `soroban-render-sdk/src/prelude.rs`

```rust
pub use crate::continuation::{ContinuationBuilder, ContinuationExt};
```

---

# Phase 3: @soroban-render/core Viewer Changes

## 3.1 Create Continuation Parser

**File:** `packages/soroban-render/src/parsers/continuation.ts` (NEW)

```typescript
/**
 * Types for continuation/chunk tags
 */
export interface ContinuationTag {
  type: 'continue';
  collection: string;
  from?: number;
  page?: number;
  perPage?: number;
  total?: number;
  position: number;  // Position in original content
}

export interface ChunkTag {
  type: 'chunk';
  collection: string;
  index: number;
  placeholder?: string;
  position: number;
}

export type ProgressiveTag = ContinuationTag | ChunkTag;

export interface ParsedContent {
  /** Content with tags replaced by placeholders */
  content: string;
  /** All progressive loading tags found */
  tags: ProgressiveTag[];
  /** Whether any progressive tags were found */
  hasProgressive: boolean;
}

// Regex patterns
const CONTINUE_PATTERN = /\{\{continue\s+collection="([^"]+)"(?:\s+from=(\d+))?(?:\s+page=(\d+))?(?:\s+per_page=(\d+))?(?:\s+total=(\d+))?\s*\}\}/g;
const CHUNK_PATTERN = /\{\{chunk\s+collection="([^"]+)"\s+index=(\d+)(?:\s+placeholder="([^"]*)")?\s*\}\}/g;

/**
 * Parse content for continuation and chunk tags
 */
export function parseProgressiveTags(content: string): ParsedContent {
  const tags: ProgressiveTag[] = [];
  let resultContent = content;

  // Find all continuation tags
  let match: RegExpExecArray | null;
  CONTINUE_PATTERN.lastIndex = 0;
  while ((match = CONTINUE_PATTERN.exec(content)) !== null) {
    tags.push({
      type: 'continue',
      collection: match[1],
      from: match[2] ? parseInt(match[2], 10) : undefined,
      page: match[3] ? parseInt(match[3], 10) : undefined,
      perPage: match[4] ? parseInt(match[4], 10) : undefined,
      total: match[5] ? parseInt(match[5], 10) : undefined,
      position: match.index,
    });
  }

  // Find all chunk tags
  CHUNK_PATTERN.lastIndex = 0;
  while ((match = CHUNK_PATTERN.exec(content)) !== null) {
    tags.push({
      type: 'chunk',
      collection: match[1],
      index: parseInt(match[2], 10),
      placeholder: match[3],
      position: match.index,
    });
  }

  // Sort by position
  tags.sort((a, b) => a.position - b.position);

  // Replace tags with placeholders (in reverse order to preserve positions)
  for (let i = tags.length - 1; i >= 0; i--) {
    const tag = tags[i];
    const placeholder = tag.type === 'chunk' && (tag as ChunkTag).placeholder
      ? `<div class="soroban-chunk-placeholder" data-collection="${tag.collection}" data-index="${(tag as ChunkTag).index}">${(tag as ChunkTag).placeholder}</div>`
      : `<div class="soroban-chunk-placeholder" data-collection="${tag.collection}" data-index="${tag.type === 'chunk' ? (tag as ChunkTag).index : 'continue'}"></div>`;

    const tagMatch = tag.type === 'continue'
      ? content.match(CONTINUE_PATTERN)?.[0]
      : content.match(CHUNK_PATTERN)?.[0];

    if (tagMatch) {
      resultContent = resultContent.replace(tagMatch, placeholder);
    }
  }

  return {
    content: resultContent,
    tags,
    hasProgressive: tags.length > 0,
  };
}

/**
 * Check if content has any progressive loading tags
 */
export function hasProgressiveTags(content: string): boolean {
  CONTINUE_PATTERN.lastIndex = 0;
  CHUNK_PATTERN.lastIndex = 0;
  return CONTINUE_PATTERN.test(content) || CHUNK_PATTERN.test(content);
}
```

## 3.2 Create Progressive Loader

**File:** `packages/soroban-render/src/utils/progressiveLoader.ts` (NEW)

```typescript
import type { SorobanClient } from '../types';
import type { ProgressiveTag, ChunkTag, ContinuationTag } from '../parsers/continuation';

export interface ProgressiveLoaderOptions {
  contractId: string;
  client: SorobanClient;
  batchSize?: number;
  maxConcurrent?: number;
  onChunkLoaded?: (collection: string, index: number, content: string) => void;
  onProgress?: (loaded: number, total: number) => void;
  onError?: (error: Error, tag: ProgressiveTag) => void;
}

export interface LoadResult {
  collection: string;
  index: number;
  content: string;
}

/**
 * Progressive content loader for chunked content
 */
export class ProgressiveLoader {
  private options: Required<ProgressiveLoaderOptions>;
  private loadedChunks: Map<string, string> = new Map();
  private pendingLoads: Map<string, Promise<string>> = new Map();
  private aborted = false;

  constructor(options: ProgressiveLoaderOptions) {
    this.options = {
      batchSize: 3,
      maxConcurrent: 2,
      onChunkLoaded: () => {},
      onProgress: () => {},
      onError: () => {},
      ...options,
    };
  }

  /**
   * Create cache key for a chunk
   */
  private cacheKey(collection: string, index: number): string {
    return `${collection}:${index}`;
  }

  /**
   * Load a single chunk from the contract
   */
  private async loadChunk(collection: string, index: number): Promise<string> {
    const key = this.cacheKey(collection, index);

    // Return cached if available
    if (this.loadedChunks.has(key)) {
      return this.loadedChunks.get(key)!;
    }

    // Return pending if already loading
    if (this.pendingLoads.has(key)) {
      return this.pendingLoads.get(key)!;
    }

    // Start new load
    const loadPromise = (async () => {
      try {
        // Call contract's get_chunk function
        const result = await this.options.client.simulateCall(
          this.options.contractId,
          'get_chunk',
          { collection, index }
        );

        const content = result ? this.decodeChunk(result) : '';
        this.loadedChunks.set(key, content);
        this.options.onChunkLoaded(collection, index, content);
        return content;
      } finally {
        this.pendingLoads.delete(key);
      }
    })();

    this.pendingLoads.set(key, loadPromise);
    return loadPromise;
  }

  /**
   * Decode chunk bytes to string
   */
  private decodeChunk(data: unknown): string {
    if (typeof data === 'string') return data;
    if (data instanceof Uint8Array) {
      return new TextDecoder().decode(data);
    }
    if (Array.isArray(data)) {
      return new TextDecoder().decode(new Uint8Array(data));
    }
    return String(data);
  }

  /**
   * Load chunks for all tags
   */
  async loadTags(tags: ProgressiveTag[]): Promise<LoadResult[]> {
    const results: LoadResult[] = [];
    const { batchSize, maxConcurrent } = this.options;

    // Expand continuation tags into chunk tags
    const expandedTags = await this.expandContinuations(tags);

    // Load in batches with concurrency limit
    for (let i = 0; i < expandedTags.length && !this.aborted; i += batchSize * maxConcurrent) {
      const batch = expandedTags.slice(i, i + batchSize * maxConcurrent);
      const batchPromises = batch.map(async (tag) => {
        if (this.aborted) return null;
        try {
          const content = await this.loadChunk(tag.collection, tag.index);
          return { collection: tag.collection, index: tag.index, content };
        } catch (error) {
          this.options.onError(error as Error, tag);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter((r): r is LoadResult => r !== null));

      this.options.onProgress(results.length, expandedTags.length);
    }

    return results;
  }

  /**
   * Expand continuation tags into individual chunk tags
   */
  private async expandContinuations(tags: ProgressiveTag[]): Promise<ChunkTag[]> {
    const chunkTags: ChunkTag[] = [];

    for (const tag of tags) {
      if (tag.type === 'chunk') {
        chunkTags.push(tag as ChunkTag);
      } else {
        // Continuation tag - need to get chunk count
        const cont = tag as ContinuationTag;
        const total = cont.total ?? await this.getChunkCount(cont.collection);
        const from = cont.from ?? 0;

        for (let i = from; i < total; i++) {
          chunkTags.push({
            type: 'chunk',
            collection: cont.collection,
            index: i,
            position: cont.position,
          });
        }
      }
    }

    return chunkTags;
  }

  /**
   * Get total chunk count for a collection
   */
  private async getChunkCount(collection: string): Promise<number> {
    try {
      const result = await this.options.client.simulateCall(
        this.options.contractId,
        'get_chunk_meta',
        { collection }
      );
      return (result as { count: number })?.count ?? 0;
    } catch {
      return 0;
    }
  }

  /**
   * Abort all pending loads
   */
  abort(): void {
    this.aborted = true;
  }

  /**
   * Reset loader state
   */
  reset(): void {
    this.aborted = false;
    this.loadedChunks.clear();
    this.pendingLoads.clear();
  }
}
```

## 3.3 Create useProgressiveRender Hook

**File:** `packages/soroban-render/src/hooks/useProgressiveRender.ts` (NEW)

```typescript
import { useState, useEffect, useCallback, useRef } from 'react';
import { parseProgressiveTags, type ParsedContent } from '../parsers/continuation';
import { ProgressiveLoader, type LoadResult } from '../utils/progressiveLoader';
import type { SorobanClient } from '../types';

export interface UseProgressiveRenderOptions {
  contractId: string;
  client: SorobanClient;
  initialContent: string;
  enabled?: boolean;
  batchSize?: number;
  maxConcurrent?: number;
}

export interface UseProgressiveRenderResult {
  /** Content with loaded chunks inserted */
  content: string;
  /** Initial content before progressive loading */
  initialContent: string;
  /** Whether initial content is loading */
  isInitialLoading: boolean;
  /** Whether additional chunks are loading */
  isLoadingMore: boolean;
  /** Number of loaded chunks */
  loadedChunks: number;
  /** Total chunks to load (if known) */
  totalChunks: number | null;
  /** Progress 0-1 */
  progress: number;
  /** Any errors that occurred */
  errors: Error[];
  /** Manually trigger loading remaining chunks */
  loadMore: () => Promise<void>;
  /** Load all remaining chunks */
  loadAll: () => Promise<void>;
  /** Cancel pending loads */
  cancel: () => void;
}

export function useProgressiveRender(
  options: UseProgressiveRenderOptions
): UseProgressiveRenderResult {
  const { contractId, client, initialContent, enabled = true, batchSize = 3, maxConcurrent = 2 } = options;

  const [content, setContent] = useState(initialContent);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadedChunks, setLoadedChunks] = useState(0);
  const [totalChunks, setTotalChunks] = useState<number | null>(null);
  const [errors, setErrors] = useState<Error[]>([]);

  const loaderRef = useRef<ProgressiveLoader | null>(null);
  const parsedRef = useRef<ParsedContent | null>(null);

  // Parse content for progressive tags
  useEffect(() => {
    parsedRef.current = parseProgressiveTags(initialContent);
    setContent(parsedRef.current.content);

    if (parsedRef.current.hasProgressive) {
      // Estimate total chunks from tags
      const tags = parsedRef.current.tags;
      let estimated = 0;
      for (const tag of tags) {
        if (tag.type === 'chunk') {
          estimated++;
        } else if (tag.total) {
          estimated += tag.total - (tag.from ?? 0);
        }
      }
      setTotalChunks(estimated > 0 ? estimated : null);
    }
  }, [initialContent]);

  // Create loader
  useEffect(() => {
    loaderRef.current = new ProgressiveLoader({
      contractId,
      client,
      batchSize,
      maxConcurrent,
      onChunkLoaded: (collection, index, chunkContent) => {
        setContent(prev => {
          // Replace placeholder with actual content
          const placeholder = `<div class="soroban-chunk-placeholder" data-collection="${collection}" data-index="${index}"></div>`;
          return prev.replace(placeholder, chunkContent);
        });
        setLoadedChunks(prev => prev + 1);
      },
      onProgress: (loaded, total) => {
        setLoadedChunks(loaded);
        setTotalChunks(total);
      },
      onError: (error) => {
        setErrors(prev => [...prev, error]);
      },
    });

    return () => {
      loaderRef.current?.abort();
    };
  }, [contractId, client, batchSize, maxConcurrent]);

  // Auto-load if enabled
  useEffect(() => {
    if (enabled && parsedRef.current?.hasProgressive && loaderRef.current) {
      setIsLoadingMore(true);
      loaderRef.current.loadTags(parsedRef.current.tags).finally(() => {
        setIsLoadingMore(false);
      });
    }
  }, [enabled, initialContent]);

  const loadMore = useCallback(async () => {
    if (!loaderRef.current || !parsedRef.current?.hasProgressive) return;
    setIsLoadingMore(true);
    try {
      await loaderRef.current.loadTags(parsedRef.current.tags);
    } finally {
      setIsLoadingMore(false);
    }
  }, []);

  const loadAll = useCallback(async () => {
    return loadMore();
  }, [loadMore]);

  const cancel = useCallback(() => {
    loaderRef.current?.abort();
    setIsLoadingMore(false);
  }, []);

  const progress = totalChunks ? loadedChunks / totalChunks : 0;

  return {
    content,
    initialContent,
    isInitialLoading: false,
    isLoadingMore,
    loadedChunks,
    totalChunks,
    progress,
    errors,
    loadMore,
    loadAll,
    cancel,
  };
}
```

## 3.4 Update useRender Hook

**File:** `packages/soroban-render/src/hooks/useRender.ts`

Add progressive loading integration:

```typescript
// In UseRenderOptions interface, add:
progressive?: {
  enabled?: boolean;
  batchSize?: number;
  maxConcurrent?: number;
  autoLoad?: boolean;
};

// In UseRenderResult interface, add:
progressiveLoading?: {
  isLoadingMore: boolean;
  loadedChunks: number;
  totalChunks: number | null;
  progress: number;
  loadMore: () => Promise<void>;
  cancel: () => void;
};
```

## 3.5 Update Exports

**File:** `packages/soroban-render/src/index.ts`

```typescript
// Add exports
export { parseProgressiveTags, hasProgressiveTags } from './parsers/continuation';
export type { ContinuationTag, ChunkTag, ProgressiveTag, ParsedContent } from './parsers/continuation';
export { ProgressiveLoader } from './utils/progressiveLoader';
export type { ProgressiveLoaderOptions, LoadResult } from './utils/progressiveLoader';
export { useProgressiveRender } from './hooks/useProgressiveRender';
export type { UseProgressiveRenderOptions, UseProgressiveRenderResult } from './hooks/useProgressiveRender';
```

---

# Phase 4: Example Contract

## 4.1 Create Boards-Style Example

**File:** `soroban-render/contracts/boards-example/` (NEW directory)

A simple example demonstrating progressive loading with threads and comments.

```rust
// contracts/boards-example/src/lib.rs
#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env, String, Symbol, Bytes, Vec};
use soroban_render_sdk::prelude::*;
use soroban_chonk::prelude::*;

soroban_render!(markdown);

#[contract]
pub struct BoardsExample;

#[contractimpl]
impl BoardsExample {
    /// Initialize with sample data
    pub fn init(env: Env) {
        // Create a sample thread with comments
        let thread_id = symbol_short!("thread1");
        let comments_collection = symbol_short!("cmts_1");

        // Store thread body
        env.storage().persistent().set(&thread_id, &String::from_str(&env,
            "This is an example thread demonstrating progressive loading of comments."
        ));

        // Store comments in chunks
        let chonk = Chonk::open(&env, comments_collection);
        for i in 0..20 {
            let comment = format_comment(&env, i);
            chonk.push(comment);
        }
    }

    /// Main render function
    pub fn render(env: Env, path: Option<String>, _viewer: Option<Address>) -> Bytes {
        let thread_id = symbol_short!("thread1");
        let comments_collection = symbol_short!("cmts_1");

        // Get thread body
        let body: String = env.storage().persistent()
            .get(&thread_id)
            .unwrap_or(String::from_str(&env, "Thread not found"));

        // Get comment count
        let chonk = Chonk::open(&env, comments_collection);
        let comment_count = chonk.count();

        // Build response
        let mut builder = MarkdownBuilder::new(&env);
        builder = builder
            .h1("Example Thread")
            .paragraph(&body.to_string())
            .hr()
            .h2(&format!("Comments ({})", comment_count));

        // Show first 5 comments immediately
        let immediate_count = core::cmp::min(5, comment_count);
        for i in 0..immediate_count {
            if let Some(comment) = chonk.get(i) {
                builder = builder.raw(comment);
            }
        }

        // Add continuation for remaining comments
        if comment_count > 5 {
            builder = builder.continuation("cmts_1", 5, Some(comment_count));
        }

        builder.build()
    }

    /// Get a single comment chunk
    pub fn get_chunk(env: Env, collection: Symbol, index: u32) -> Option<Bytes> {
        let chonk = Chonk::open(&env, collection);
        chonk.get(index)
    }

    /// Get chunk metadata
    pub fn get_chunk_meta(env: Env, collection: Symbol) -> Option<ChonkMeta> {
        let chonk = Chonk::open(&env, collection);
        if chonk.count() > 0 {
            Some(chonk.meta())
        } else {
            None
        }
    }
}

fn format_comment(env: &Env, index: u32) -> Bytes {
    let builder = MarkdownBuilder::new(env);
    builder
        .blockquote(&format!("**User{}**: This is comment #{}", index % 10, index))
        .build()
}
```

---

# Phase 5: Documentation

## 5.1 Update Main Documentation

**Files to update:**
- `soroban-render/docs/progressive-loading.md` (NEW)
- `soroban-render/docs/rust-sdk.md` (add continuation section)
- `soroban-render/README.md` (mention progressive loading)
- `soroban-render-sdk/README.md` (add chonk integration)

## 5.2 API Documentation

Generate rustdoc for soroban-chonk with comprehensive examples.

---

# Implementation Checklist

## Phase 1: soroban-chonk (Days 1-2)
- [ ] Create project structure
- [ ] Implement types.rs (ChonkKey, ChonkMeta)
- [ ] Implement chonk.rs (core Chonk struct)
- [ ] Implement iter.rs (ChonkIter)
- [ ] Implement error.rs
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Create README.md
- [ ] Run `cargo test`
- [ ] Run `cargo clippy`
- [ ] Run `cargo fmt`

## Phase 2: soroban-render-sdk (Day 2)
- [ ] Create continuation.rs
- [ ] Update markdown.rs with continuation methods
- [ ] Update lib.rs exports
- [ ] Update prelude.rs exports
- [ ] Add tests for continuation builders
- [ ] Update documentation

## Phase 3: @soroban-render/core (Days 2-3)
- [ ] Create parsers/continuation.ts
- [ ] Create utils/progressiveLoader.ts
- [ ] Create hooks/useProgressiveRender.ts
- [ ] Update hooks/useRender.ts
- [ ] Update index.ts exports
- [ ] Add unit tests
- [ ] Test with viewer app

## Phase 4: Example & Testing (Day 3)
- [ ] Create boards-example contract
- [ ] Deploy to local network
- [ ] Test progressive loading end-to-end
- [ ] Performance testing with large content

## Phase 5: Documentation (Day 3-4)
- [ ] Create progressive-loading.md
- [ ] Update existing docs
- [ ] Generate API docs
- [ ] Add examples to READMEs

---

# Build Commands

```bash
# Phase 1: soroban-chonk
cd /media/wyhaines/home/wyhaines/ghq/github.com/wyhaines/soroban-chonk
cargo build
cargo test
cargo clippy
cargo fmt --check

# Phase 2: soroban-render-sdk
cd /media/wyhaines/home/wyhaines/ghq/github.com/wyhaines/soroban-render-sdk
cargo build
cargo test

# Phase 3: @soroban-render/core
cd /media/wyhaines/home/wyhaines/ghq/github.com/wyhaines/soroban-render
pnpm install
pnpm --filter @soroban-render/core build
pnpm --filter @soroban-render/core test

# Phase 4: Example contract
cd /media/wyhaines/home/wyhaines/ghq/github.com/wyhaines/soroban-render/contracts/boards-example
cargo build --target wasm32-unknown-unknown --release
```

---

# Testing Strategy

## Unit Tests
- ChonkMeta serialization/deserialization
- Chonk CRUD operations
- Iterator behavior
- Continuation tag parsing
- Progressive loader chunk assembly

## Integration Tests
- Full contract deployment with chunked content
- Viewer progressive loading with real contract calls
- Error handling and recovery
- Large content performance

## Manual Testing
- Deploy example contract
- Verify progressive loading in viewer
- Test with slow network simulation
- Verify placeholder behavior
