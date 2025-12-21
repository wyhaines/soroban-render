#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env, String};
use soroban_render_sdk::prelude::*;

// Metadata for render support with styles
soroban_render!(markdown, styles);

#[contract]
pub struct ThemeContract;

#[contractimpl]
impl ThemeContract {
    /// Initialize the contract (no-op for theme components)
    pub fn init(_env: Env) {}

    /// Base theme styles with CSS variables
    pub fn styles(env: Env) -> Bytes {
        StyleBuilder::new(&env)
            .comment("Soroban Render Theme - Base Styles")
            .newline()
            // CSS Variables
            .root_vars_start()
            .var("primary", "#0066cc")
            .var("primary-hover", "#0052a3")
            .var("success", "#22c55e")
            .var("warning", "#eab308")
            .var("danger", "#dc3545")
            .var("text", "#333333")
            .var("text-muted", "#666666")
            .var("bg", "#ffffff")
            .var("bg-muted", "#f5f5f5")
            .var("border", "#e0e0e0")
            .var("font-family", "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif")
            .root_vars_end()
            .newline()
            // Base element styles
            .rule("body", "font-family: var(--font-family); color: var(--text); background: var(--bg); line-height: 1.6;")
            .rule("h1", "font-size: 2rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; margin: 0 0 1rem 0;")
            .rule("h2", "font-size: 1.5rem; margin: 1.5rem 0 0.75rem 0;")
            .rule("h3", "font-size: 1.25rem; margin: 1.25rem 0 0.5rem 0;")
            .rule("a", "color: var(--primary); text-decoration: none;")
            .rule("a:hover", "text-decoration: underline;")
            .rule("code", "background: var(--bg-muted); padding: 0.125rem 0.375rem; border-radius: 3px;")
            .rule("pre", "background: var(--bg-muted); padding: 1rem; border-radius: 4px; overflow-x: auto;")
            .rule("hr", "border: none; border-top: 1px solid var(--border); margin: 1.5rem 0;")
            .build()
    }

    /// Dark mode variant
    pub fn styles_dark(env: Env) -> Bytes {
        StyleBuilder::new(&env)
            .comment("Soroban Render Theme - Dark Mode")
            .dark_mode_start()
            .rule_start(":root")
            .prop("--primary", "#66b3ff")
            .prop("--primary-hover", "#99ccff")
            .prop("--text", "#e0e0e0")
            .prop("--text-muted", "#a0a0a0")
            .prop("--bg", "#1a1a1a")
            .prop("--bg-muted", "#2a2a2a")
            .prop("--border", "#404040")
            .rule_end()
            .media_end()
            .build()
    }

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
