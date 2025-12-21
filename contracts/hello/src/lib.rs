//! # Hello World - Soroban Render
//!
//! The simplest possible renderable Soroban contract.
//! This entire file IS the frontend for this dApp.

#![no_std]
use soroban_sdk::{contract, contractimpl, contractmeta, Address, Bytes, Env, String, Vec};

// Declare render support - viewers check this metadata
contractmeta!(key = "render", val = "v1");
contractmeta!(key = "render_formats", val = "markdown");

#[contract]
pub struct HelloContract;

#[contractimpl]
impl HelloContract {
    /// Render the contract UI as Markdown.
    /// This single function provides the entire frontend.
    pub fn render(env: Env, _path: Option<String>, viewer: Option<Address>) -> Bytes {
        let mut parts: Vec<Bytes> = Vec::new(&env);

        match viewer {
            Some(_) => {
                parts.push_back(Bytes::from_slice(&env, b"# Hello, Stellar User!\n\n"));
                parts.push_back(Bytes::from_slice(&env, b"Your wallet is connected.\n\n"));
                parts.push_back(Bytes::from_slice(&env, b"Welcome to **Soroban Render** - where your smart contract IS your frontend."));
            }
            None => {
                parts.push_back(Bytes::from_slice(&env, b"# Hello, World!\n\n"));
                parts.push_back(Bytes::from_slice(&env, b"Connect your wallet to see a personalized greeting.\n\n"));
                parts.push_back(Bytes::from_slice(&env, b"This UI is rendered directly from the smart contract."));
            }
        };

        Self::concat_bytes(&env, &parts)
    }

    fn concat_bytes(env: &Env, parts: &Vec<Bytes>) -> Bytes {
        let mut result = Bytes::new(env);
        for part in parts.iter() {
            result.append(&part);
        }
        result
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;

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
