//! Soroban Render Homepage
//!
//! A portal contract that lists all example contracts with live demo links.

#![no_std]

use soroban_render_sdk::prelude::*;
use soroban_sdk::{contract, contractimpl, contracttype, Address, Bytes, Env, String, Vec};

soroban_render!(markdown);

/// Demo contract info stored on-chain
#[contracttype]
#[derive(Clone)]
pub struct DemoInfo {
    pub name: String,
    pub description: String,
    pub contract_id: String,
    pub features: String,
}

#[contracttype]
pub enum DataKey {
    Demos,
    ViewerUrl,
    Network,
}

/// Convert a Soroban String to Bytes
fn string_to_bytes(env: &Env, s: &String) -> Bytes {
    let len = s.len() as usize;
    let mut buf = [0u8; 256]; // Max 256 chars for demo strings
    s.copy_into_slice(&mut buf[..len]);
    Bytes::from_slice(env, &buf[..len])
}

#[contract]
pub struct HomepageContract;

#[contractimpl]
impl HomepageContract {
    /// Initialize with demo contracts
    pub fn init(env: Env, viewer_url: String, network: String) {
        env.storage().persistent().set(&DataKey::ViewerUrl, &viewer_url);
        env.storage().persistent().set(&DataKey::Network, &network);

        let demos: Vec<DemoInfo> = Vec::new(&env);
        env.storage().persistent().set(&DataKey::Demos, &demos);
    }

    /// Add a demo contract
    pub fn add_demo(
        env: Env,
        name: String,
        description: String,
        contract_id: String,
        features: String,
    ) {
        let mut demos: Vec<DemoInfo> = env
            .storage()
            .persistent()
            .get(&DataKey::Demos)
            .unwrap_or(Vec::new(&env));

        demos.push_back(DemoInfo {
            name,
            description,
            contract_id,
            features,
        });

        env.storage().persistent().set(&DataKey::Demos, &demos);
    }

    /// Clear all demos
    pub fn clear_demos(env: Env) {
        let demos: Vec<DemoInfo> = Vec::new(&env);
        env.storage().persistent().set(&DataKey::Demos, &demos);
    }

    /// Render the homepage
    pub fn render(env: Env, _path: Option<String>, _viewer: Option<Address>) -> Bytes {
        let viewer_url: String = env
            .storage()
            .persistent()
            .get(&DataKey::ViewerUrl)
            .unwrap_or(String::from_str(&env, "https://wyhaines.github.io/soroban-render/"));

        let network: String = env
            .storage()
            .persistent()
            .get(&DataKey::Network)
            .unwrap_or(String::from_str(&env, "testnet"));

        let demos: Vec<DemoInfo> = env
            .storage()
            .persistent()
            .get(&DataKey::Demos)
            .unwrap_or(Vec::new(&env));

        let mut builder = MarkdownBuilder::new(&env);

        builder = builder
            .h1("Soroban Render Demos")
            .paragraph("Welcome! These demos showcase what's possible when smart contracts render their own UI.")
            .paragraph("Each demo below is a live Soroban contract. Click to explore.")
            .hr();

        if demos.is_empty() {
            builder = builder
                .h2("No demos configured")
                .paragraph("Use `add_demo` to register demo contracts.");
        } else {
            for demo in demos.iter() {
                // Build "## Name" header
                builder = builder
                    .raw_str("## ")
                    .raw(string_to_bytes(&env, &demo.name))
                    .newline()
                    .newline()
                    .raw(string_to_bytes(&env, &demo.description))
                    .newline()
                    .newline()
                    .raw_str("**Features:** ")
                    .raw(string_to_bytes(&env, &demo.features))
                    .newline()
                    .newline();

                // Build the viewer URL with contract and network params
                // Format: [View Live Demo]({viewer_url}?contract={contract_id}&network={network})
                builder = builder
                    .raw_str("[View Live Demo](")
                    .raw(string_to_bytes(&env, &viewer_url))
                    .raw_str("?contract=")
                    .raw(string_to_bytes(&env, &demo.contract_id))
                    .raw_str("&network=")
                    .raw(string_to_bytes(&env, &network))
                    .raw_str(")")
                    .newline()
                    .newline()
                    .hr();
            }
        }

        builder = builder
            .h2("About Soroban Render")
            .paragraph("Soroban Render lets smart contracts define their own UI. No separate frontend needed.")
            .list_item("Contracts return Markdown or JSON from `render()`")
            .list_item("Any compatible viewer can display them")
            .list_item("Interactive: navigation, transactions, forms")
            .list_item("Composable: contracts can include UI from other contracts")
            .newline()
            .link("GitHub Repository", "https://github.com/wyhaines/soroban-render")
            .text(" | ")
            .link("Documentation", "https://github.com/wyhaines/soroban-render/tree/main/docs")
            .newline()
            .newline()
            .hr()
            .paragraph("*This page is itself a Soroban contract.*");

        builder.build()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::Env;

    #[test]
    fn test_init_and_render() {
        let env = Env::default();
        let contract_id = env.register(HomepageContract, ());

        env.as_contract(&contract_id, || {
            HomepageContract::init(
                env.clone(),
                String::from_str(&env, "https://example.com/viewer/"),
                String::from_str(&env, "testnet"),
            );

            let result = HomepageContract::render(env.clone(), None, None);
            assert!(!result.is_empty());
        });
    }

    #[test]
    fn test_add_demo() {
        let env = Env::default();
        let contract_id = env.register(HomepageContract, ());

        env.as_contract(&contract_id, || {
            HomepageContract::init(
                env.clone(),
                String::from_str(&env, "https://example.com/"),
                String::from_str(&env, "testnet"),
            );

            HomepageContract::add_demo(
                env.clone(),
                String::from_str(&env, "Todo App"),
                String::from_str(&env, "A full-featured todo list"),
                String::from_str(&env, "CABC123"),
                String::from_str(&env, "Routing, forms, CRUD"),
            );

            let result = HomepageContract::render(env.clone(), None, None);

            let mut buf = [0u8; 2048];
            let len = result.len() as usize;
            for i in 0..len.min(2048) {
                if let Some(b) = result.get(i as u32) {
                    buf[i] = b;
                }
            }
            let s = core::str::from_utf8(&buf[..len.min(2048)]).unwrap_or("");
            assert!(s.contains("Todo App"));
            assert!(s.contains("CABC123"));
        });
    }
}
