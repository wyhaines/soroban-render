//! Chunked Content Example Contract
//!
//! Demonstrates progressive content loading using soroban-chonk
//! for chunked storage and continuation markers.

#![no_std]

use soroban_chonk::prelude::*;
use soroban_render_sdk::prelude::*;
use soroban_sdk::{contract, contractimpl, symbol_short, Address, Bytes, Env, String, Symbol};

soroban_render!(markdown);

#[contract]
pub struct ChunkedExampleContract;

#[contractimpl]
impl ChunkedExampleContract {
    /// Initialize with sample comments
    pub fn init(env: Env) {
        let comments = Chonk::open(&env, symbol_short!("comments"));

        // Add 15 sample comments as pre-formatted markdown
        let samples = [
            "> **Alice**: Great post! This is really helpful. (#0)\n\n",
            "> **Bob**: I have a question about the implementation. (#1)\n\n",
            "> **Carol**: Thanks for sharing this information. (#2)\n\n",
            "> **Dave**: This is exactly what I was looking for! (#3)\n\n",
            "> **Eve**: Interesting perspective on the topic. (#4)\n\n",
            "> **Alice**: Could you elaborate on that point? (#5)\n\n",
            "> **Bob**: I agree with the previous comment. (#6)\n\n",
            "> **Carol**: This changed my understanding completely. (#7)\n\n",
            "> **Dave**: Well explained and easy to follow. (#8)\n\n",
            "> **Eve**: Looking forward to more content like this! (#9)\n\n",
            "> **Alice**: Adding another thought here. (#10)\n\n",
            "> **Bob**: This thread is getting interesting. (#11)\n\n",
            "> **Carol**: Great discussion everyone! (#12)\n\n",
            "> **Dave**: One more point to consider. (#13)\n\n",
            "> **Eve**: Thanks for the insightful conversation! (#14)\n\n",
        ];

        for sample in samples {
            comments.push(Bytes::from_slice(&env, sample.as_bytes()));
        }
    }

    /// Main render - shows first 5 comments with continuation for rest
    pub fn render(env: Env, _path: Option<String>, _viewer: Option<Address>) -> Bytes {
        let comments = Chonk::open(&env, symbol_short!("comments"));
        let total = comments.count();

        const IMMEDIATE: u32 = 5;

        let mut builder = MarkdownBuilder::new(&env);

        builder = builder
            .h1("Chunked Content Demo")
            .paragraph("This thread demonstrates progressive content loading.")
            .paragraph("The first 5 comments load immediately. The rest load progressively.")
            .hr()
            .h2("Comments");

        // Show first N comments immediately
        let show = core::cmp::min(IMMEDIATE, total);
        for i in 0..show {
            if let Some(comment) = comments.get(i) {
                builder = builder.raw(comment);
            }
        }

        // Add continuation marker if more exist
        if total > IMMEDIATE {
            builder = builder
                .paragraph("---")
                .continuation("comments", IMMEDIATE, Some(total));
        }

        if total == 0 {
            builder = builder.paragraph("*No comments yet.*");
        }

        builder.hr().paragraph("*Powered by soroban-chonk*").build()
    }

    /// Get a single chunk (called by viewer for progressive loading)
    pub fn get_chunk(env: Env, collection: Symbol, index: u32) -> Option<Bytes> {
        Chonk::open(&env, collection).get(index)
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

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::Env;

    #[test]
    fn test_init() {
        let env = Env::default();
        let contract_id = env.register(ChunkedExampleContract, ());

        env.as_contract(&contract_id, || {
            ChunkedExampleContract::init(env.clone());
            let comments = Chonk::open(&env, symbol_short!("comments"));
            assert_eq!(comments.count(), 15);
        });
    }

    #[test]
    fn test_get_chunk() {
        let env = Env::default();
        let contract_id = env.register(ChunkedExampleContract, ());

        env.as_contract(&contract_id, || {
            ChunkedExampleContract::init(env.clone());
            let chunk = ChunkedExampleContract::get_chunk(env.clone(), symbol_short!("comments"), 0);
            assert!(chunk.is_some());
        });
    }

    #[test]
    fn test_render_has_continuation() {
        let env = Env::default();
        let contract_id = env.register(ChunkedExampleContract, ());

        env.as_contract(&contract_id, || {
            ChunkedExampleContract::init(env.clone());
            let result = ChunkedExampleContract::render(env.clone(), None, None);

            // Check that it contains continuation marker
            let mut buf = [0u8; 2048];
            let len = result.len() as usize;
            for i in 0..len.min(2048) {
                if let Some(b) = result.get(i as u32) {
                    buf[i] = b;
                }
            }
            let s = core::str::from_utf8(&buf[..len.min(2048)]).unwrap_or("");
            assert!(s.contains("{{continue"));
        });
    }
}
