#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env, String};
use soroban_render_sdk::prelude::*;

// Metadata for render support
soroban_render!(markdown);

#[contract]
pub struct ThemeContract;

#[contractimpl]
impl ThemeContract {
    /// Initialize the contract (no-op for theme components)
    pub fn init(_env: Env) {}

    /// Main render function - returns available components list
    pub fn render(env: Env, _path: Option<String>, _viewer: Option<Address>) -> Bytes {
        MarkdownBuilder::new(&env)
            .h1("Soroban Render Theme Components")
            .paragraph("This contract provides reusable UI components for Soroban Render apps.")
            .h2("Available Components")
            .list_item("`render_header` - App header with branding")
            .list_item("`render_footer` - App footer with credits")
            .list_item("`render_nav` - Navigation component")
            .h2("Usage")
            .paragraph("Include these in your contract's render output:")
            .raw_str("```\n{{include contract=THEME_CONTRACT_ID func=\"header\"}}\n{{include contract=THEME_CONTRACT_ID func=\"nav\"}}\n{{include contract=THEME_CONTRACT_ID func=\"footer\"}}\n```\n")
            .build()
    }

    /// Render header component
    pub fn render_header(env: Env, _path: Option<String>, _viewer: Option<Address>) -> Bytes {
        MarkdownBuilder::new(&env)
            .h1("Todo List Demo")
            .paragraph("**This entire UI is rendered from a Soroban smart contract.**")
            .paragraph("The contract defines its own interface using markdown with embedded forms and action links. The [Soroban Render Viewer](https://wyhaines.github.io/soroban-render/) fetches and displays it.")
            .link("View Source on GitHub", "https://github.com/wyhaines/soroban-render")
            .newline().newline()
            .hr()
            .build()
    }

    /// Render footer component
    pub fn render_footer(env: Env, _path: Option<String>, _viewer: Option<Address>) -> Bytes {
        MarkdownBuilder::new(&env)
            .hr()
            .h3("How This Works")
            .paragraph("This UI comes directly from the smart contract's `render()` function. The contract returns markdown with special protocols (`render:`, `tx:`, `form:`) that enable navigation and transactions. No separate frontend deployment needed - the contract IS the app.")
            .paragraph("*Powered by [Soroban Render](https://github.com/wyhaines/soroban-render)* | Built on [Stellar](https://stellar.org)")
            .build()
    }

    /// Render navigation component
    pub fn render_nav(env: Env, _path: Option<String>, _viewer: Option<Address>) -> Bytes {
        MarkdownBuilder::new(&env)
            .render_link("Home", "/")
            .text(" | ")
            .render_link("Tasks", "/tasks")
            .text(" | ")
            .render_link("About", "/about")
            .newline().newline()
            .build()
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::Env;

    #[test]
    fn test_render_header() {
        let env = Env::default();
        let result = ThemeContract::render_header(env.clone(), None, None);

        let mut buf: [u8; 512] = [0; 512];
        let len = result.len() as usize;
        for i in 0..len {
            if let Some(b) = result.get(i as u32) {
                buf[i] = b;
            }
        }
        let result_str = core::str::from_utf8(&buf[..len]).unwrap();
        assert!(result_str.contains("# Todo List Demo"));
        assert!(result_str.contains("rendered from a Soroban smart contract"));
    }

    #[test]
    fn test_render_footer() {
        let env = Env::default();
        let result = ThemeContract::render_footer(env.clone(), None, None);

        let mut buf: [u8; 512] = [0; 512];
        let len = result.len() as usize;
        for i in 0..len {
            if let Some(b) = result.get(i as u32) {
                buf[i] = b;
            }
        }
        let result_str = core::str::from_utf8(&buf[..len]).unwrap();
        assert!(result_str.contains("How This Works"));
        assert!(result_str.contains("Powered by"));
    }

    #[test]
    fn test_render_nav() {
        let env = Env::default();
        let result = ThemeContract::render_nav(env.clone(), None, None);

        let mut buf: [u8; 256] = [0; 256];
        let len = result.len() as usize;
        for i in 0..len {
            if let Some(b) = result.get(i as u32) {
                buf[i] = b;
            }
        }
        let result_str = core::str::from_utf8(&buf[..len]).unwrap();
        assert!(result_str.contains("[Home]"));
        assert!(result_str.contains("[Tasks]"));
    }
}
