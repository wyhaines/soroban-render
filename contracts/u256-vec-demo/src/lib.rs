//! # Vec<U256> Demo - Soroban Render
//!
//! A micro-tutorial demonstrating how to work with Vec<U256> in Soroban contracts.
//!
//! Soroban's Vec is fundamentally different from Rust's standard Vec:
//! - Not backed by contiguous memory (lives in host environment)
//! - No `as_slice()` - you cannot get a `&[U256]` from it
//! - No `map`, `filter`, `collect` - use manual iteration instead
//!
//! This demo shows common patterns for working with these constraints.

#![no_std]
use soroban_render_sdk::prelude::*;
use soroban_sdk::{contract, contractimpl, Address, Bytes, Env, String, Vec, U256};

soroban_render!(markdown, styles);

#[contract]
pub struct U256VecDemo;

#[contractimpl]
impl U256VecDemo {
    /// Styles for the demo
    pub fn styles(env: Env) -> Bytes {
        StyleBuilder::new(&env)
            .root_vars_start()
            .var("primary", "#0066cc")
            .var("code-bg", "#f4f4f4")
            .var("heading", "#333")
            .root_vars_end()
            .rule("h1", "color: var(--heading); border-bottom: 2px solid var(--primary);")
            .rule("h2", "color: var(--primary); margin-top: 1.5rem;")
            .rule("h3", "color: var(--heading); font-size: 1.1rem;")
            .rule("code", "background: var(--code-bg); padding: 2px 6px; border-radius: 3px;")
            .rule("pre", "background: var(--code-bg); padding: 1rem; border-radius: 6px; overflow-x: auto;")
            .rule(".result", "background: #e8f4e8; padding: 0.5rem 1rem; border-left: 3px solid #28a745; margin: 0.5rem 0;")
            .rule(".note", "background: #fff3cd; padding: 0.5rem 1rem; border-left: 3px solid #ffc107; margin: 0.5rem 0;")
            .dark_mode_start()
            .rule_start(":root")
            .prop("--code-bg", "#2d2d2d")
            .prop("--heading", "#e0e0e0")
            .rule_end()
            .rule(".result", "background: #1e3a1e;")
            .rule(".note", "background: #3d3000;")
            .media_end()
            .build()
    }

    /// Render the tutorial
    pub fn render(env: Env, _path: Option<String>, _viewer: Option<Address>) -> Bytes {
        let mut md = MarkdownBuilder::new(&env);

        // Title and intro
        md = md
            .h1("Working with Vec<U256> in Soroban")
            .div_start("note")
            .text("Soroban's Vec is not Rust's standard Vec. It's a handle to data in the Soroban host environment, so you cannot convert it to a slice. This tutorial shows the patterns you need.")
            .div_end()
            .newline();

        // =====================================================================
        // Section 1: Creating and Adding Elements
        // =====================================================================
        md = md
            .h2("1. Creating and Adding Elements")
            .raw_str("```rust\n")
            .raw_str("let mut nums: Vec<U256> = Vec::new(&env);\n")
            .raw_str("nums.push_back(U256::from_u32(&env, 100));\n")
            .raw_str("nums.push_back(U256::from_u32(&env, 200));\n")
            .raw_str("nums.push_back(U256::from_u32(&env, 300));\n")
            .raw_str("```\n\n");

        // Demo: create and show elements
        let mut nums: Vec<U256> = Vec::new(&env);
        nums.push_back(U256::from_u32(&env, 100));
        nums.push_back(U256::from_u32(&env, 200));
        nums.push_back(U256::from_u32(&env, 300));

        md = md.div_start("result").text("Elements: ");
        for (i, n) in nums.iter().enumerate() {
            if i > 0 {
                md = md.text(", ");
            }
            md = md.raw(u256_to_bytes(&env, &n));
        }
        md = md
            .text(" (length: ")
            .number(nums.len())
            .text(")")
            .div_end()
            .newline();

        // =====================================================================
        // Section 2: Iteration (the primary access pattern)
        // =====================================================================
        md = md
            .h2("2. Iteration (Primary Access Pattern)")
            .paragraph("Since you can't get a slice, iteration is how you access elements:")
            .raw_str("```rust\n")
            .raw_str("let mut total = U256::from_u32(&env, 0);\n")
            .raw_str("for n in nums.iter() {\n")
            .raw_str("    total = total.add(&n);\n")
            .raw_str("}\n")
            .raw_str("```\n\n");

        let mut total = U256::from_u32(&env, 0);
        for n in nums.iter() {
            total = total.add(&n);
        }

        md = md
            .div_start("result")
            .text("Sum of 100 + 200 + 300 = ")
            .raw(u256_to_bytes(&env, &total))
            .div_end()
            .newline();

        // =====================================================================
        // Section 3: Index-Based Access
        // =====================================================================
        md = md
            .h2("3. Index-Based Access")
            .paragraph("Use get(index) which returns Option<T>:")
            .raw_str("```rust\n")
            .raw_str("for i in 0..nums.len() {\n")
            .raw_str("    if let Some(val) = nums.get(i) {\n")
            .raw_str("        // use val\n")
            .raw_str("    }\n")
            .raw_str("}\n")
            .raw_str("```\n\n");

        let mut indexed: Vec<U256> = Vec::new(&env);
        indexed.push_back(U256::from_u32(&env, 10));
        indexed.push_back(U256::from_u32(&env, 20));
        indexed.push_back(U256::from_u32(&env, 30));

        md = md.div_start("result");
        for i in 0..indexed.len() {
            if let Some(val) = indexed.get(i) {
                md = md
                    .text("nums.get(")
                    .number(i)
                    .text(") = ")
                    .raw(u256_to_bytes(&env, &val));
                if i < indexed.len() - 1 {
                    md = md.text(" | ");
                }
            }
        }
        md = md.div_end().newline();

        // =====================================================================
        // Section 4: Finding Elements (no filter/find methods)
        // =====================================================================
        md = md
            .h2("4. Finding Elements")
            .paragraph("No find() or filter() - use manual loops:")
            .raw_str("```rust\n")
            .raw_str("let threshold = U256::from_u32(&env, 100);\n")
            .raw_str("let mut found: Option<U256> = None;\n")
            .raw_str("for n in search.iter() {\n")
            .raw_str("    if n.gt(&threshold) {\n")
            .raw_str("        found = Some(n);\n")
            .raw_str("        break;\n")
            .raw_str("    }\n")
            .raw_str("}\n")
            .raw_str("```\n\n");

        let mut search: Vec<U256> = Vec::new(&env);
        search.push_back(U256::from_u32(&env, 50));
        search.push_back(U256::from_u32(&env, 150));
        search.push_back(U256::from_u32(&env, 250));

        let threshold = U256::from_u32(&env, 100);
        let mut found: Option<U256> = None;
        for n in search.iter() {
            if n.gt(&threshold) {
                found = Some(n);
                break;
            }
        }

        md = md.div_start("result").text("First element > 100 in [50, 150, 250]: ");
        md = match found {
            Some(val) => md.raw(u256_to_bytes(&env, &val)),
            None => md.text("None"),
        };
        md = md.div_end().newline();

        // =====================================================================
        // Section 5: Transforming (no map)
        // =====================================================================
        md = md
            .h2("5. Transforming Elements")
            .paragraph("No map() - build a new Vec manually:")
            .raw_str("```rust\n")
            .raw_str("let two = U256::from_u32(&env, 2);\n")
            .raw_str("let mut doubled: Vec<U256> = Vec::new(&env);\n")
            .raw_str("for n in input.iter() {\n")
            .raw_str("    doubled.push_back(n.mul(&two));\n")
            .raw_str("}\n")
            .raw_str("```\n\n");

        let mut input: Vec<U256> = Vec::new(&env);
        input.push_back(U256::from_u32(&env, 5));
        input.push_back(U256::from_u32(&env, 10));
        input.push_back(U256::from_u32(&env, 15));

        let two = U256::from_u32(&env, 2);
        let mut doubled: Vec<U256> = Vec::new(&env);
        for n in input.iter() {
            doubled.push_back(n.mul(&two));
        }

        md = md.div_start("result").text("Input [5, 10, 15] doubled: [");
        for (i, n) in doubled.iter().enumerate() {
            if i > 0 {
                md = md.text(", ");
            }
            md = md.raw(u256_to_bytes(&env, &n));
        }
        md = md.text("]").div_end().newline();

        // =====================================================================
        // Section 6: Counting with Conditions
        // =====================================================================
        md = md
            .h2("6. Counting with Conditions")
            .raw_str("```rust\n")
            .raw_str("let mut count: u32 = 0;\n")
            .raw_str("for n in nums.iter() {\n")
            .raw_str("    if n.gt(&threshold) {\n")
            .raw_str("        count += 1;\n")
            .raw_str("    }\n")
            .raw_str("}\n")
            .raw_str("```\n\n");

        let mut countable: Vec<U256> = Vec::new(&env);
        countable.push_back(U256::from_u32(&env, 50));
        countable.push_back(U256::from_u32(&env, 150));
        countable.push_back(U256::from_u32(&env, 250));
        countable.push_back(U256::from_u32(&env, 75));

        let thresh = U256::from_u32(&env, 100);
        let mut count: u32 = 0;
        for n in countable.iter() {
            if n.gt(&thresh) {
                count += 1;
            }
        }

        md = md
            .div_start("result")
            .text("Count of elements > 100 in [50, 150, 250, 75]: ")
            .number(count)
            .div_end()
            .newline();

        // =====================================================================
        // Summary
        // =====================================================================
        md = md
            .h2("Summary")
            .list_item("Vec::new(&env) - always needs the environment")
            .list_item("push_back(val) - add elements")
            .list_item("get(i) returns Option<T> - no panicking indexing")
            .list_item("iter() - the main way to process elements")
            .list_item("No map, filter, collect - use manual loops")
            .list_item("Cannot convert to &[T] - data lives in host, not WASM memory, so data format can't support direct `as_slice()` operation")
            .newline()
            .hr()
            .paragraph("This page is a live Soroban contract demonstrating these patterns.");

        md.build()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::Env;

    #[test]
    fn test_render() {
        let env = Env::default();
        let contract_id = env.register(U256VecDemo, ());
        let client = U256VecDemoClient::new(&env, &contract_id);

        let result = client.render(&None, &None);
        assert!(!result.is_empty());

        // Verify key content is present
        let mut bytes_vec: [u8; 4096] = [0; 4096];
        let len = (result.len() as usize).min(4096);
        for i in 0..len {
            if let Some(b) = result.get(i as u32) {
                bytes_vec[i] = b;
            }
        }
        let output = core::str::from_utf8(&bytes_vec[..len]).unwrap();

        assert!(output.contains("Vec<U256>"));
        assert!(output.contains("Sum of 100 + 200 + 300 = 600"));
        assert!(output.contains("First element > 100"));
    }

    #[test]
    fn test_styles() {
        let env = Env::default();
        let contract_id = env.register(U256VecDemo, ());
        let client = U256VecDemoClient::new(&env, &contract_id);

        let styles = client.styles();
        assert!(!styles.is_empty());
    }
}
