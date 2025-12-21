//! # Hello World - Soroban Render
//!
//! The simplest possible renderable Soroban contract.
//! This entire file IS the frontend for this dApp.

#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env, String};
use soroban_render_sdk::prelude::*;

// Declare render support with styles - viewers check this metadata
soroban_render!(markdown, styles);

#[contract]
pub struct HelloContract;

#[contractimpl]
impl HelloContract {
    /// Simple styles for the hello contract
    pub fn styles(env: Env) -> Bytes {
        StyleBuilder::new(&env)
            .rule("h1", "color: #0066cc;")
            .rule("p", "font-size: 1.1rem; line-height: 1.6;")
            .build()
    }

    /// Render the contract UI as Markdown.
    /// This single function provides the entire frontend.
    pub fn render(env: Env, _path: Option<String>, viewer: Option<Address>) -> Bytes {
        match viewer {
            Some(_) => MarkdownBuilder::new(&env)
                .h1("Hello, Stellar User!")
                .paragraph("Your wallet is connected.")
                .paragraph("Welcome to **Soroban Render** - where your smart contract IS your frontend.")
                .build(),
            None => MarkdownBuilder::new(&env)
                .h1("Hello, World!")
                .paragraph("Connect your wallet to see a personalized greeting.")
                .paragraph("This UI is rendered directly from the smart contract.")
                .build(),
        }
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::Env;

    #[test]
    fn test_render_without_wallet() {
        let env = Env::default();
        let contract_id = env.register(HelloContract, ());
        let client = HelloContractClient::new(&env, &contract_id);

        let result = client.render(&None, &None);

        let mut bytes_vec: [u8; 256] = [0; 256];
        let len = result.len() as usize;
        for i in 0..len {
            if let Some(b) = result.get(i as u32) {
                bytes_vec[i] = b;
            }
        }
        let output = core::str::from_utf8(&bytes_vec[..len]).unwrap();

        assert!(output.contains("Hello, World!"));
        assert!(output.contains("Connect your wallet"));
    }

    #[test]
    fn test_render_with_wallet() {
        let env = Env::default();
        let contract_id = env.register(HelloContract, ());
        let client = HelloContractClient::new(&env, &contract_id);

        let viewer = Address::generate(&env);
        let result = client.render(&None, &Some(viewer));

        let mut bytes_vec: [u8; 256] = [0; 256];
        let len = result.len() as usize;
        for i in 0..len {
            if let Some(b) = result.get(i as u32) {
                bytes_vec[i] = b;
            }
        }
        let output = core::str::from_utf8(&bytes_vec[..len]).unwrap();

        assert!(output.contains("Hello, Stellar User!"));
        assert!(output.contains("wallet is connected"));
    }
}
