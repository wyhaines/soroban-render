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
    /// Based on Stellar Design System (https://design-system.stellar.org/)
    pub fn styles(env: Env) -> Bytes {
        StyleBuilder::new(&env)
            .comment("Soroban Render Theme - Stellar Design System")
            .newline()
            // Stellar Design System CSS Variables
            .root_vars_start()
            // Stellar Lilac/Purple - Primary accent
            .var("sds-clr-lilac-09", "#7857e1")
            .var("sds-clr-lilac-10", "#6b4ad1")
            .var("sds-clr-lilac-11", "#5a3dab")
            // Stellar Grays
            .var("sds-clr-gray-02", "#f8f8f8")
            .var("sds-clr-gray-03", "#f3f3f3")
            .var("sds-clr-gray-06", "#e2e2e2")
            .var("sds-clr-gray-09", "#8f8f8f")
            .var("sds-clr-gray-11", "#6f6f6f")
            .var("sds-clr-gray-12", "#171717")
            // Semantic mappings
            .var("primary", "var(--sds-clr-lilac-09)")
            .var("primary-hover", "var(--sds-clr-lilac-10)")
            .var("success", "#30a46c")
            .var("warning", "#ffc53d")
            .var("danger", "#e5484d")
            .var("text", "var(--sds-clr-gray-12)")
            .var("text-muted", "var(--sds-clr-gray-11)")
            .var("bg", "#ffffff")
            .var("bg-muted", "var(--sds-clr-gray-03)")
            .var("border", "var(--sds-clr-gray-06)")
            .var("font-family", "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif")
            .var("font-mono", "'Inconsolata', 'Monaco', 'Menlo', monospace")
            .root_vars_end()
            .newline()
            // Base element styles
            .rule("body", "font-family: var(--font-family); color: var(--text); background: var(--bg); line-height: 1.6;")
            .rule("h1", "font-size: 1.875rem; font-weight: 600; border-bottom: 1px solid var(--border); padding-bottom: 0.75rem; margin: 0 0 1rem 0; letter-spacing: -0.02em;")
            .rule("h2", "font-size: 1.5rem; font-weight: 600; margin: 2rem 0 1rem 0; letter-spacing: -0.01em;")
            .rule("h3", "font-size: 1.25rem; font-weight: 600; margin: 1.5rem 0 0.75rem 0;")
            .rule("h4", "font-size: 1.125rem; font-weight: 500; margin: 1.25rem 0 0.5rem 0;")
            .rule("a", "color: var(--primary); text-decoration: none; transition: color 100ms ease-out;")
            .rule("a:hover", "color: var(--primary-hover); text-decoration: underline;")
            .rule("code", "font-family: var(--font-mono); background: var(--bg-muted); padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.9em; color: var(--sds-clr-lilac-11);")
            .rule("pre", "background: var(--bg-muted); padding: 1rem; border-radius: 6px; overflow-x: auto; border: 1px solid var(--border);")
            .rule("pre code", "background: transparent; padding: 0; color: inherit; font-size: 0.875rem;")
            .rule("blockquote", "margin: 1rem 0; padding: 0.75rem 1rem; border-left: 3px solid var(--primary); background: var(--sds-clr-gray-02); border-radius: 0 4px 4px 0;")
            .rule("hr", "border: none; border-top: 1px solid var(--border); margin: 2rem 0;")
            .build()
    }

    /// Dark mode variant - Stellar Design System dark theme
    pub fn styles_dark(env: Env) -> Bytes {
        StyleBuilder::new(&env)
            .comment("Soroban Render Theme - Stellar Dark Mode")
            .dark_mode_start()
            .rule_start(":root")
            // Adjusted lilac for dark mode
            .prop("--sds-clr-lilac-09", "#9176e8")
            .prop("--sds-clr-lilac-10", "#a28fec")
            .prop("--sds-clr-lilac-11", "#b7ace8")
            // Inverted grays for dark theme
            .prop("--sds-clr-gray-02", "#1c1c1c")
            .prop("--sds-clr-gray-03", "#232323")
            .prop("--sds-clr-gray-06", "#3e3e3e")
            .prop("--sds-clr-gray-09", "#8f8f8f")
            .prop("--sds-clr-gray-11", "#b4b4b4")
            .prop("--sds-clr-gray-12", "#eeeeee")
            // Semantic colors
            .prop("--text", "#eeeeee")
            .prop("--text-muted", "#b4b4b4")
            .prop("--bg", "#0f0f0f")
            .prop("--bg-muted", "#232323")
            .prop("--border", "#3e3e3e")
            // Adjusted semantic colors for dark mode
            .prop("--success", "#46bd6e")
            .prop("--danger", "#f56565")
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
