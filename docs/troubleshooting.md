# Troubleshooting

Common issues and solutions when building Soroban Render contracts.

## Build Errors

### "render function not found"

**Symptom:** The viewer shows "Contract does not support render" or fails to detect the contract.

**Causes and Solutions:**

1. **Missing metadata declaration**
   ```rust
   // Add this at the module level
   soroban_render!(markdown);
   ```

2. **Wrong function signature**
   ```rust
   // Correct signature
   pub fn render(env: Env, path: Option<String>, viewer: Option<Address>) -> Bytes

   // Common mistakes:
   pub fn render(env: &Env, ...) -> Bytes  // Wrong: &Env instead of Env
   pub fn render(env: Env, ...) -> String  // Wrong: String instead of Bytes
   fn render(...)  // Wrong: not public
   ```

3. **Not exported in contractimpl**
   ```rust
   #[contractimpl]
   impl MyContract {
       pub fn render(...) -> Bytes { ... }  // Must be inside #[contractimpl]
   }
   ```

### "cannot find macro soroban_render"

**Symptom:** Compilation fails with "cannot find macro `soroban_render` in this scope"

**Solution:** Import from the prelude:
```rust
use soroban_render_sdk::prelude::*;

soroban_render!(markdown);
```

### "MarkdownBuilder not found"

**Symptom:** "cannot find type `MarkdownBuilder` in this scope"

**Solutions:**

1. Import from prelude:
   ```rust
   use soroban_render_sdk::prelude::*;
   ```

2. Or enable the feature:
   ```toml
   [dependencies]
   soroban-render-sdk = { ..., features = ["markdown"] }
   ```

### "Router not found"

**Symptom:** "cannot find type `Router` in this scope"

**Solution:** Enable the router feature:
```toml
[dependencies]
soroban-render-sdk = { ..., features = ["router"] }
```

Or use default features (includes router):
```toml
soroban-render-sdk = { git = "..." }
```


## Runtime Errors

### String Truncation

**Symptom:** Long strings are cut off at 256 characters.

**Cause:** The SDK uses a 256-byte buffer for `String` to `Bytes` conversion.

**Solution:** For long content, break it into multiple parts:
```rust
// Instead of one long string:
.paragraph("Very long text...")

// Use multiple parts:
.text("First part of text...")
.text("Second part of text...")
```

### Empty Output

**Symptom:** `render()` returns empty Bytes.

**Causes:**

1. **Forgot to call `.build()`**
   ```rust
   // Wrong - returns builder, not Bytes
   MarkdownBuilder::new(&env).h1("Title")

   // Correct
   MarkdownBuilder::new(&env).h1("Title").build()
   ```

2. **Path matching failed**
   ```rust
   // Check your default handler
   Router::new(&env, path)
       .handle(b"/", |_| render_home())
       .or_default(|_| render_home())  // Don't forget this!
   ```

### Router Not Matching Paths

**Symptom:** Routes don't match expected paths.

**Causes and Solutions:**

1. **Missing leading slash**
   ```rust
   // Wrong
   .handle(b"tasks", ...)

   // Correct
   .handle(b"/tasks", ...)
   ```

2. **Route order (first-match wins)**
   ```rust
   // Wrong order - /task/{id} catches /task/new
   .handle(b"/task/{id}", ...)
   .or_handle(b"/task/new", ...)  // Never matches!

   // Correct order
   .handle(b"/task/new", ...)
   .or_handle(b"/task/{id}", ...)
   ```

3. **Trailing slash mismatch**
   ```rust
   // These are different:
   .handle(b"/tasks", ...)   // Matches /tasks
   .handle(b"/tasks/", ...)  // Matches /tasks/
   ```


## Contract Size Issues

### "Contract too large"

**Symptom:** Deployment fails with size-related errors. Soroban contracts have a 64KB limit.

**Solutions:**

1. **Use feature flags to include only what you need**
   ```toml
   [dependencies]
   soroban-render-sdk = {
       git = "...",
       default-features = false,
       features = ["markdown"]  # Only markdown, no json or router
   }
   ```

2. **Minimize string constants**
   ```rust
   // Instead of repeated long strings, factor them out
   const FOOTER: &str = "Powered by Soroban Render";

   .paragraph(FOOTER)
   ```

3. **Use release profile optimizations**
   ```toml
   [profile.release]
   opt-level = "z"  # Optimize for size
   lto = true
   ```

4. **Remove debug symbols**
   ```toml
   [profile.release]
   debug = false
   ```


## Viewer Issues

### "Network error"

**Symptom:** Viewer can't connect to the contract.

**Solutions:**

1. Check network configuration matches your deployment
2. Verify the contract ID is correct
3. Ensure the RPC endpoint is accessible

### Includes Not Resolving

**Symptom:** `{{include contract=... func="..."}}` tags appear literally instead of being replaced.

**Causes:**

1. **Theme contract not deployed**
   - Deploy the theme contract and update the contract ID

2. **Wrong function name**
   ```rust
   // Include specifies "header"
   .include(THEME_ID, "header")

   // Contract must have render_header (render_ prefix is added)
   pub fn render_header(...) -> Bytes
   ```

3. **Include resolution disabled in viewer**
   - Check viewer settings for include resolution

### Forms Not Submitting

**Symptom:** Form submit buttons don't trigger transactions.

**Causes:**

1. **Wallet not connected**
   - Forms require a connected wallet for auth

2. **Wrong action name**
   ```rust
   // form_link action must match contract method
   .form_link("Submit", "add_task")  // Calls add_task method

   // Method must exist and require auth
   pub fn add_task(env: Env, description: String, caller: Address) {
       caller.require_auth();
       // ...
   }
   ```


## JSON Format Issues

### Invalid JSON Output

**Symptom:** JSON viewer shows parsing errors.

**Causes:**

1. **Missing build() call**
2. **Nested builders not completed**
   ```rust
   // Wrong - form not completed
   doc.form("action")
       .text_field("name", "placeholder", true)
       // Missing .submit()!

   // Correct
   doc.form("action")
       .text_field("name", "placeholder", true)
       .submit("Submit")  // Completes the form
   ```

3. **Unescaped special characters in dynamic content**
   ```rust
   // SDK handles escaping, but verify dynamic content:
   .text_string(&user_input)  // Automatically escaped
   ```


## Testing Issues

### Tests Hang

**Symptom:** `cargo test` hangs indefinitely.

**Solution:** Ensure you're not waiting for network in tests. Use `env.mock_all_auths()`:
```rust
#[test]
fn test_something() {
    let env = Env::default();
    env.mock_all_auths();  // Add this
    // ...
}
```

### Auth Errors in Tests

**Symptom:** "Auth not authorized" errors in tests.

**Solution:**
```rust
env.mock_all_auths();  // Mock all auth for testing
```


## Getting Help

If you're still stuck:

1. Check the [example contracts](https://github.com/wyhaines/soroban-render/tree/main/contracts) for working patterns
2. Review the [Rust SDK Reference](./rust-sdk.md) for correct API usage
3. Open an issue at [GitHub](https://github.com/wyhaines/soroban-render/issues)


## Related Documentation

- [Rust SDK Reference](./rust-sdk.md) - Correct API usage
- [Testing](./testing.md) - Testing patterns
- [Best Practices](./best-practices.md) - Avoid common pitfalls
