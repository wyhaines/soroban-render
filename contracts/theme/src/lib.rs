#![no_std]
use soroban_sdk::{contract, contractimpl, contractmeta, Address, Bytes, Env, String};

// Metadata for render support
contractmeta!(key = "render", val = "v1");
contractmeta!(key = "render_formats", val = "markdown");

#[contract]
pub struct ThemeContract;

#[contractimpl]
impl ThemeContract {
    /// Initialize the contract (no-op for theme components)
    pub fn init(_env: Env) {}

    /// Main render function - returns available components list
    pub fn render(env: Env, _path: Option<String>, _viewer: Option<Address>) -> Bytes {
        let output = "# Soroban Render Theme Components

This contract provides reusable UI components for Soroban Render apps.

## Available Components

- `render_header` - App header with branding
- `render_footer` - App footer with credits
- `render_nav` - Navigation component

## Usage

Include these in your contract's render output:

```
{{include contract=THEME_CONTRACT_ID func=\"header\"}}
{{include contract=THEME_CONTRACT_ID func=\"nav\"}}
{{include contract=THEME_CONTRACT_ID func=\"footer\"}}
```
";
        Bytes::from_slice(&env, output.as_bytes())
    }

    /// Render header component
    pub fn render_header(env: Env, _path: Option<String>, _viewer: Option<Address>) -> Bytes {
        let output = "# Soroban App

*Built with Soroban Render*

---

";
        Bytes::from_slice(&env, output.as_bytes())
    }

    /// Render footer component
    pub fn render_footer(env: Env, _path: Option<String>, _viewer: Option<Address>) -> Bytes {
        let output = "
---

*Powered by [Soroban Render](https://github.com/wyhaines/soroban-render)* | Built on [Stellar](https://stellar.org)
";
        Bytes::from_slice(&env, output.as_bytes())
    }

    /// Render navigation component
    pub fn render_nav(env: Env, _path: Option<String>, _viewer: Option<Address>) -> Bytes {
        let output = "[Home](render:/) | [Tasks](render:/tasks) | [About](render:/about)

";
        Bytes::from_slice(&env, output.as_bytes())
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

        let mut buf: [u8; 256] = [0; 256];
        let len = result.len() as usize;
        for i in 0..len {
            if let Some(b) = result.get(i as u32) {
                buf[i] = b;
            }
        }
        let result_str = core::str::from_utf8(&buf[..len]).unwrap();
        assert!(result_str.contains("# Soroban App"));
    }

    #[test]
    fn test_render_footer() {
        let env = Env::default();
        let result = ThemeContract::render_footer(env.clone(), None, None);

        let mut buf: [u8; 256] = [0; 256];
        let len = result.len() as usize;
        for i in 0..len {
            if let Some(b) = result.get(i as u32) {
                buf[i] = b;
            }
        }
        let result_str = core::str::from_utf8(&buf[..len]).unwrap();
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
