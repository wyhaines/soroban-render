# Testing Renderable Contracts

This guide covers testing strategies for Soroban Render contracts, from unit tests to integration testing with the viewer.

## Unit Testing with soroban-sdk

The Soroban SDK provides a testing framework that runs contracts in a simulated environment.

### Basic Test Setup

```rust
#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::Env;

    #[test]
    fn test_render() {
        let env = Env::default();
        let contract_id = env.register(MyContract, ());
        let client = MyContractClient::new(&env, &contract_id);

        let result = client.render(&None, &None);

        // Verify output
        assert!(result.len() > 0);
    }
}
```

### Converting Bytes to String for Assertions

The render function returns `Bytes`. To make assertions on content, convert to a string:

```rust
#[test]
fn test_render_content() {
    let env = Env::default();
    let contract_id = env.register(HelloContract, ());
    let client = HelloContractClient::new(&env, &contract_id);

    let result = client.render(&None, &None);

    // Convert Bytes to String for assertions
    let mut bytes_vec: [u8; 256] = [0; 256];
    let len = result.len() as usize;
    for i in 0..len {
        if let Some(b) = result.get(i as u32) {
            bytes_vec[i] = b;
        }
    }
    let output = core::str::from_utf8(&bytes_vec[..len]).unwrap();

    // Now assert on string content
    assert!(output.contains("# Hello"));
    assert!(output.contains("World"));
}
```

### Testing with Viewer Address

```rust
#[test]
fn test_render_with_wallet() {
    let env = Env::default();
    let contract_id = env.register(HelloContract, ());
    let client = HelloContractClient::new(&env, &contract_id);

    // Generate a test address
    let viewer = Address::generate(&env);

    // Render with viewer
    let result = client.render(&None, &Some(viewer));

    // Convert and assert
    let output = bytes_to_string(&result);
    assert!(output.contains("Hello, Stellar User"));
}
```

### Testing Path-Based Routing

```rust
#[test]
fn test_render_different_paths() {
    let env = Env::default();
    let contract_id = env.register(TodoContract, ());
    let client = TodoContractClient::new(&env, &contract_id);

    // Test home path
    let home = client.render(&None, &None);
    let home_str = bytes_to_string(&home);
    assert!(home_str.contains("Welcome"));

    // Test about path
    let about_path = String::from_str(&env, "/about");
    let about = client.render(&Some(about_path), &None);
    let about_str = bytes_to_string(&about);
    assert!(about_str.contains("About"));

    // Test tasks path
    let tasks_path = String::from_str(&env, "/tasks");
    let tasks = client.render(&Some(tasks_path), &None);
    let tasks_str = bytes_to_string(&tasks);
    assert!(tasks_str.contains("Connect Your Wallet"));
}
```

### Testing State Changes

```rust
#[test]
fn test_add_and_render_task() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TodoContract, ());
    let client = TodoContractClient::new(&env, &contract_id);

    let user = Address::generate(&env);

    // Add tasks
    client.add_task(&String::from_str(&env, "First task"), &user);
    client.add_task(&String::from_str(&env, "Second task"), &user);

    // Render with the user as viewer
    let tasks_path = String::from_str(&env, "/tasks");
    let output = client.render(&Some(tasks_path), &Some(user));
    let output_str = bytes_to_string(&output);

    // Verify tasks appear in output
    assert!(output_str.contains("First task"));
    assert!(output_str.contains("Second task"));
}
```

### Testing JSON Output

```rust
#[test]
fn test_render_json() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TodoContract, ());
    let client = TodoContractClient::new(&env, &contract_id);

    let user = Address::generate(&env);
    client.add_task(&String::from_str(&env, "Test task"), &user);

    let json_path = String::from_str(&env, "/json");
    let output = client.render(&Some(json_path), &Some(user));
    let output_str = bytes_to_string(&output);

    // Verify JSON structure
    assert!(output_str.contains("\"format\":\"soroban-render-json-v1\""));
    assert!(output_str.contains("\"type\":\"heading\""));
    assert!(output_str.contains("\"type\":\"task\""));
    assert!(output_str.contains("Test task"));
}
```

### Testing Per-User Isolation

```rust
#[test]
fn test_per_user_isolation() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TodoContract, ());
    let client = TodoContractClient::new(&env, &contract_id);

    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);

    // User 1 adds a task
    client.add_task(&String::from_str(&env, "User1 task"), &user1);

    // User 2 adds a task
    client.add_task(&String::from_str(&env, "User2 task"), &user2);

    // User 1 should only see their task
    let user1_tasks = client.get_tasks(&user1);
    assert_eq!(user1_tasks.len(), 1);

    // User 2 should only see their task
    let user2_tasks = client.get_tasks(&user2);
    assert_eq!(user2_tasks.len(), 1);
}
```


## Helper Functions

Create helper functions to reduce test boilerplate:

```rust
#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    /// Convert Bytes to String for easier assertions
    fn bytes_to_string(bytes: &Bytes) -> String {
        let mut buf: [u8; 4096] = [0; 4096];
        let len = bytes.len() as usize;
        for i in 0..len {
            if let Some(b) = bytes.get(i as u32) {
                buf[i] = b;
            }
        }
        core::str::from_utf8(&buf[..len]).unwrap().to_string()
    }

    /// Set up a contract with mocked auth
    fn setup() -> (Env, TodoContractClient) {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(TodoContract, ());
        let client = TodoContractClient::new(&env, &contract_id);
        (env, client)
    }

    #[test]
    fn test_with_helpers() {
        let (env, client) = setup();
        let user = Address::generate(&env);

        client.add_task(&String::from_str(&env, "Test"), &user);

        let output = client.render(&None, &Some(user.clone()));
        let output_str = bytes_to_string(&output);

        assert!(output_str.contains("Test"));
    }
}
```


## Testing Specific Features

### Testing Alerts/Callouts

```rust
#[test]
fn test_alert_rendering() {
    let env = Env::default();
    let contract_id = env.register(TodoContract, ());
    let client = TodoContractClient::new(&env, &contract_id);

    // Home page should have TIP and WARNING alerts
    let output = client.render(&None, &None);
    let output_str = bytes_to_string(&output);

    assert!(output_str.contains("[!TIP]"));
    assert!(output_str.contains("[!WARNING]"));
    assert!(output_str.contains("Connect your wallet"));
}
```

### Testing Include Tags

```rust
#[test]
fn test_include_tags() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TodoContract, ());
    let client = TodoContractClient::new(&env, &contract_id);

    let user = Address::generate(&env);
    let tasks_path = String::from_str(&env, "/tasks");
    let output = client.render(&Some(tasks_path), &Some(user));
    let output_str = bytes_to_string(&output);

    // Verify include tags are present
    assert!(output_str.contains("{{include contract="));
    assert!(output_str.contains("func=\"header\""));
    assert!(output_str.contains("func=\"footer\""));
}
```

### Testing Transaction Links

```rust
#[test]
fn test_tx_links() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TodoContract, ());
    let client = TodoContractClient::new(&env, &contract_id);

    let user = Address::generate(&env);
    client.add_task(&String::from_str(&env, "Test task"), &user);

    let tasks_path = String::from_str(&env, "/tasks");
    let output = client.render(&Some(tasks_path), &Some(user));
    let output_str = bytes_to_string(&output);

    // Verify transaction links are present
    assert!(output_str.contains("(tx:complete_task"));
    assert!(output_str.contains("(tx:delete_task"));
    assert!(output_str.contains("{\"id\":1}"));
}
```

### Testing Form Links

```rust
#[test]
fn test_form_links() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TodoContract, ());
    let client = TodoContractClient::new(&env, &contract_id);

    let user = Address::generate(&env);
    let tasks_path = String::from_str(&env, "/tasks");
    let output = client.render(&Some(tasks_path), &Some(user));
    let output_str = bytes_to_string(&output);

    // Verify form elements and submit link
    assert!(output_str.contains("<textarea"));
    assert!(output_str.contains("name=\"description\""));
    assert!(output_str.contains("(form:add_task)"));
}
```


## Integration Testing

### Testing with the Viewer

For full integration testing, deploy to a local network and use the viewer:

```bash
# Start local network
pnpm docker:start

# Generate test identity
stellar keys generate alice --network local

# Build and deploy
cd contracts/todo
stellar contract build
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/soroban_render_todo.wasm \
  --source alice \
  --network local

# Start viewer
cd ../..
pnpm dev

# Open http://localhost:5173 and test interactively
```

### Automated Browser Testing

For automated integration tests, you could use Playwright or Cypress:

```javascript
// Example Playwright test
test('renders todo contract', async ({ page }) => {
  await page.goto('http://localhost:5173');

  // Enter contract ID
  await page.fill('input[name="contractId"]', 'CABC...XYZ');
  await page.click('button:has-text("Load")');

  // Verify content loads
  await expect(page.locator('h1')).toContainText('Welcome');
});
```


## Best Practices

### Test Organization

```rust
#[cfg(test)]
mod test {
    use super::*;

    mod render_tests {
        use super::*;

        #[test]
        fn test_home_page() { /* ... */ }

        #[test]
        fn test_about_page() { /* ... */ }
    }

    mod state_tests {
        use super::*;

        #[test]
        fn test_add_task() { /* ... */ }

        #[test]
        fn test_complete_task() { /* ... */ }
    }

    mod auth_tests {
        use super::*;

        #[test]
        fn test_requires_auth() { /* ... */ }
    }
}
```

### What to Test

1. **Content correctness** - Verify expected text appears
2. **Conditional rendering** - Test with/without wallet
3. **State reflection** - Changes appear in output
4. **Link correctness** - render:, tx:, form: links are valid
5. **Route handling** - All paths render correctly
6. **Error states** - Invalid paths, missing data


## Related Documentation

- [Rust SDK Reference](./rust-sdk.md) - API for building testable contracts
- [Examples](./examples.md) - See test examples in real contracts
- [Troubleshooting](./troubleshooting.md) - Common testing issues
