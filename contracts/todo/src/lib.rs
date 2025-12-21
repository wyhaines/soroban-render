#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Map, String, Vec};
use soroban_render_sdk::prelude::*;

soroban_render!(markdown, json);

// Storage keys
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Tasks(Address),    // Map<u32, Task> for each user
    NextId(Address),   // Next task ID for each user
    UserCount,         // Total unique users
    TotalTasks,        // Total tasks across all users
    HasTasks(Address), // Whether a user has ever had tasks (for counting unique users)
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Task {
    pub id: u32,
    pub description: String,
    pub completed: bool,
    pub owner: Address,
}

#[contract]
pub struct TodoContract;

// Theme contract ID for includes
const THEME_CONTRACT_ID: &str = "CCYEOY2JTOQ2JIMLLERAFNHAVKEKMEJDBOTLN6DIIWBHWEIMUA2T2VY4";

#[contractimpl]
impl TodoContract {
    /// Initialize is no longer needed - storage is created lazily per-user
    pub fn init(_env: Env) {
        // No-op for backwards compatibility
    }

    pub fn add_task(env: Env, description: String, caller: Address) -> u32 {
        caller.require_auth();

        let tasks_key = DataKey::Tasks(caller.clone());
        let next_id_key = DataKey::NextId(caller.clone());
        let has_tasks_key = DataKey::HasTasks(caller.clone());

        let mut tasks: Map<u32, Task> = env
            .storage()
            .persistent()
            .get(&tasks_key)
            .unwrap_or(Map::new(&env));

        let next_id: u32 = env.storage().persistent().get(&next_id_key).unwrap_or(1);

        let task = Task {
            id: next_id,
            description,
            completed: false,
            owner: caller.clone(),
        };

        tasks.set(next_id, task);
        env.storage().persistent().set(&tasks_key, &tasks);
        env.storage()
            .persistent()
            .set(&next_id_key, &(next_id + 1));

        // Update global stats
        let total_tasks: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::TotalTasks)
            .unwrap_or(0);
        env.storage()
            .persistent()
            .set(&DataKey::TotalTasks, &(total_tasks + 1));

        // Track unique users
        let user_has_tasks: bool = env
            .storage()
            .persistent()
            .get(&has_tasks_key)
            .unwrap_or(false);
        if !user_has_tasks {
            env.storage().persistent().set(&has_tasks_key, &true);
            let user_count: u32 = env
                .storage()
                .persistent()
                .get(&DataKey::UserCount)
                .unwrap_or(0);
            env.storage()
                .persistent()
                .set(&DataKey::UserCount, &(user_count + 1));
        }

        next_id
    }

    pub fn complete_task(env: Env, id: u32, caller: Address) {
        caller.require_auth();

        let tasks_key = DataKey::Tasks(caller.clone());
        let mut tasks: Map<u32, Task> = env
            .storage()
            .persistent()
            .get(&tasks_key)
            .unwrap_or(Map::new(&env));

        if let Some(mut task) = tasks.get(id) {
            task.completed = true;
            tasks.set(id, task);
            env.storage().persistent().set(&tasks_key, &tasks);
        }
    }

    pub fn delete_task(env: Env, id: u32, caller: Address) {
        caller.require_auth();

        let tasks_key = DataKey::Tasks(caller.clone());
        let mut tasks: Map<u32, Task> = env
            .storage()
            .persistent()
            .get(&tasks_key)
            .unwrap_or(Map::new(&env));

        // Only decrement if task exists
        if tasks.get(id).is_some() {
            tasks.remove(id);
            env.storage().persistent().set(&tasks_key, &tasks);

            // Decrement global task count
            let total_tasks: u32 = env
                .storage()
                .persistent()
                .get(&DataKey::TotalTasks)
                .unwrap_or(0);
            if total_tasks > 0 {
                env.storage()
                    .persistent()
                    .set(&DataKey::TotalTasks, &(total_tasks - 1));
            }
        }
    }

    /// Get global stats
    pub fn get_stats(env: Env) -> (u32, u32) {
        let total_tasks: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::TotalTasks)
            .unwrap_or(0);
        let user_count: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::UserCount)
            .unwrap_or(0);
        (total_tasks, user_count)
    }

    /// Get tasks for a specific user
    pub fn get_tasks(env: Env, user: Address) -> Vec<Task> {
        let tasks_key = DataKey::Tasks(user);
        let tasks: Map<u32, Task> = env
            .storage()
            .persistent()
            .get(&tasks_key)
            .unwrap_or(Map::new(&env));

        let mut result: Vec<Task> = Vec::new(&env);
        for (_, task) in tasks.iter() {
            result.push_back(task);
        }
        result
    }

    /// Get a specific task for a user
    pub fn get_task(env: Env, id: u32, user: Address) -> Option<Task> {
        let tasks_key = DataKey::Tasks(user);
        let tasks: Map<u32, Task> = env
            .storage()
            .persistent()
            .get(&tasks_key)
            .unwrap_or(Map::new(&env));

        tasks.get(id)
    }

    pub fn render(env: Env, path: Option<String>, viewer: Option<Address>) -> Bytes {
        // Get tasks for the viewer (if connected)
        let tasks: Map<u32, Task> = if let Some(ref user) = viewer {
            let tasks_key = DataKey::Tasks(user.clone());
            env.storage()
                .persistent()
                .get(&tasks_key)
                .unwrap_or(Map::new(&env))
        } else {
            Map::new(&env)
        };

        let wallet_connected = viewer.is_some();

        // Use the Router for clean path matching
        Router::new(&env, path)
            .handle(b"/", |_| Self::render_home(&env, wallet_connected))
            .or_handle(b"/about", |_| Self::render_about(&env))
            .or_handle(b"/tasks", |_| {
                Self::render_task_list(&env, &tasks, None, wallet_connected)
            })
            .or_handle(b"/tasks/pending", |_| {
                Self::render_task_list(&env, &tasks, Some(false), wallet_connected)
            })
            .or_handle(b"/pending", |_| {
                Self::render_task_list(&env, &tasks, Some(false), wallet_connected)
            })
            .or_handle(b"/tasks/completed", |_| {
                Self::render_task_list(&env, &tasks, Some(true), wallet_connected)
            })
            .or_handle(b"/completed", |_| {
                Self::render_task_list(&env, &tasks, Some(true), wallet_connected)
            })
            .or_handle(b"/task/{id}", |req| {
                let id = req.get_var_u32(b"id").unwrap_or(0);
                Self::render_single_task(&env, &tasks, id)
            })
            .or_handle(b"/json", |_| {
                Self::render_json(&env, &tasks, None, wallet_connected)
            })
            .or_handle(b"/json/*", |req| {
                Self::render_json(&env, &tasks, req.get_wildcard(), wallet_connected)
            })
            .or_default(|_| Self::render_home(&env, wallet_connected))
    }

    fn render_home(env: &Env, wallet_connected: bool) -> Bytes {
        let mut md = MarkdownBuilder::new(env)
            .include(THEME_CONTRACT_ID, "header")
            .render_link("Home", "/")
            .text(" | ")
            .render_link("Tasks", "/tasks")
            .text(" | ")
            .render_link("About", "/about")
            .newline()
            .newline()
            .hr()
            .h2("Welcome to the Soroban Render Demo")
            .paragraph(
                "This is a **fully functional todo application** where the entire user interface is defined by the smart contract itself.",
            )
            .tip(
                "This entire UI is generated by the smart contract's `render()` function. The markdown you see, including this callout, comes directly from the blockchain!",
            )
            .h3("What makes this special?")
            .list_item(
                "**Self-contained UI**: The contract's `render()` function returns this markdown you're reading",
            )
            .list_item("**Interactive elements**: Forms and buttons trigger real blockchain transactions")
            .list_item("**Per-user storage**: Each wallet has its own private task list")
            .list_item(
                "**Composability**: This app includes header/footer components from a separate theme contract",
            )
            .newline();

        if wallet_connected {
            md = md
                .note("Your wallet is connected! You're ready to create and manage tasks.")
                .h3("Get Started")
                .paragraph("Head over to [Tasks](render:/tasks) to manage your todo list.");
        } else {
            md = md
                .warning(
                    "Connect your wallet (button in top-right) to create and manage your personal todo list.",
                )
                .h3("Get Started")
                .paragraph("Each user has their own private task list stored on the blockchain.");
        }

        md.include(THEME_CONTRACT_ID, "footer").build()
    }

    fn render_about(env: &Env) -> Bytes {
        // Get stats
        let total_tasks: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::TotalTasks)
            .unwrap_or(0);
        let user_count: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::UserCount)
            .unwrap_or(0);

        MarkdownBuilder::new(env)
            .include(THEME_CONTRACT_ID, "header")
            .render_link("Home", "/")
            .text(" | ")
            .render_link("Tasks", "/tasks")
            .text(" | ")
            .render_link("About", "/about")
            .newline()
            .newline()
            .hr()
            .h2("About Soroban Render")
            .paragraph(
                "Soroban Render is a community convention for building **self-contained, renderable dApps** on Stellar's Soroban smart contract platform.",
            )
            .info(
                "Inspired by [Gno.land's Render() function](https://docs.gno.land/users/explore-with-gnoweb/#viewing-rendered-content), Soroban Render allows smart contracts to define their own user interface.",
            )
            .h3("Live Stats")
            .columns_start()
            .raw_str("**Total Tasks**\n\n# ")
            .number(total_tasks)
            .raw_str("\n\ntasks stored on-chain\n")
            .column_separator()
            .raw_str("**Unique Users**\n\n# ")
            .number(user_count)
            .raw_str("\n\nwallets with tasks\n")
            .columns_end()
            .h3("How It Works")
            .columns_start()
            .raw_str("**1. Contract Renders UI**\n\nThe `render(path, viewer)` function returns markdown or JSON describing the interface.\n")
            .column_separator()
            .raw_str("**2. Special Protocols**\n\n`render:` for navigation, `tx:` for transactions, `form:` for form submissions.\n")
            .column_separator()
            .raw_str("**3. Universal Viewer**\n\nAny contract implementing `render()` can be viewed with the same generic viewer.\n")
            .columns_end()
            .h3("Learn More")
            .list_item("[View the source code on GitHub](https://github.com/wyhaines/soroban-render)")
            .list_item("[Soroban Documentation](https://soroban.stellar.org/docs)")
            .list_item("[Stellar Developer Portal](https://developers.stellar.org)")
            .newline()
            .include(THEME_CONTRACT_ID, "footer")
            .build()
    }

    fn render_task_list(
        env: &Env,
        tasks: &Map<u32, Task>,
        filter: Option<bool>,
        wallet_connected: bool,
    ) -> Bytes {
        let mut md = MarkdownBuilder::new(env)
            .include(THEME_CONTRACT_ID, "header")
            .render_link("Home", "/")
            .text(" | ")
            .render_link("Tasks", "/tasks")
            .text(" | ")
            .render_link("About", "/about")
            .newline()
            .newline()
            .hr();

        if !wallet_connected {
            md = md
                .h2("Connect Your Wallet")
                .paragraph(
                    "**Please connect your wallet** to view and manage your personal todo list.",
                )
                .paragraph(
                    "Each user has their own private task list that only they can see and modify.",
                );
        } else {
            // Add task form
            md = md
                .h2("Add Task")
                .textarea("description", 2, "What needs to be done?")
                .form_link("Add Task", "add_task")
                .h2("Filter")
                .render_link("All", "/tasks")
                .text(" | ")
                .render_link("Pending", "/tasks/pending")
                .text(" | ")
                .render_link("Completed", "/tasks/completed")
                .newline()
                .newline()
                .h2("Your Tasks");

            let mut has_tasks = false;
            for (_, task) in tasks.iter() {
                // Apply filter
                if let Some(completed_filter) = filter {
                    if task.completed != completed_filter {
                        continue;
                    }
                }

                has_tasks = true;

                // Use checkbox pattern
                md = md.checkbox(task.completed, "");

                if task.completed {
                    md = md
                        .raw_str("~~")
                        .text_string(&task.description)
                        .raw_str("~~");
                } else {
                    md = md.text_string(&task.description);
                }

                md = md.text(" (#").number(task.id).text(") ");

                // Action buttons
                if !task.completed {
                    md = md.tx_link_id("Done", "complete_task", task.id).text(" ");
                }
                md = md.tx_link_id("Delete", "delete_task", task.id).newline();
            }

            if !has_tasks {
                if filter.is_some() {
                    md = md.paragraph("*No matching tasks.*");
                } else {
                    md = md.paragraph("*No tasks yet. Add one above!*");
                }
            }
        }

        md.include(THEME_CONTRACT_ID, "footer").build()
    }

    fn render_single_task(env: &Env, tasks: &Map<u32, Task>, id: u32) -> Bytes {
        let mut md = MarkdownBuilder::new(env).h1("Task Details");

        if let Some(task) = tasks.get(id) {
            let status = if task.completed {
                "Completed"
            } else {
                "Pending"
            };

            md = md
                .raw_str("**ID:** ")
                .number(task.id)
                .newline()
                .newline()
                .raw_str("**Description:** ")
                .text_string(&task.description)
                .newline()
                .newline()
                .raw_str("**Status:** ")
                .text(status)
                .newline()
                .newline();

            // Action buttons
            if !task.completed {
                md = md
                    .tx_link_id("Mark Complete", "complete_task", task.id)
                    .text(" | ");
            }
            md = md
                .tx_link_id("Delete", "delete_task", task.id)
                .newline()
                .newline()
                .render_link("Back to list", "/");
        } else {
            md = md
                .paragraph("*Task not found*")
                .render_link("Back to list", "/");
        }

        md.build()
    }

    /// Render footer component - can be included via {{include contract=SELF func="footer"}}
    pub fn render_footer(env: Env, _path: Option<String>, _viewer: Option<Address>) -> Bytes {
        MarkdownBuilder::new(&env)
            .hr()
            .paragraph("*Powered by [Soroban Render](https://github.com/wyhaines/soroban-render)*")
            .build()
    }

    /// Render header component - can be included via {{include contract=SELF func="header"}}
    pub fn render_header(env: Env, _path: Option<String>, _viewer: Option<Address>) -> Bytes {
        MarkdownBuilder::new(&env)
            .h1("Todo List")
            .paragraph("*A demo app showcasing Soroban Render*")
            .hr()
            .build()
    }

    fn render_json(
        env: &Env,
        tasks: &Map<u32, Task>,
        subpath: Option<Bytes>,
        wallet_connected: bool,
    ) -> Bytes {
        // Determine filter from subpath
        let filter = if let Some(ref sp) = subpath {
            let pending_bytes = Bytes::from_slice(env, b"/pending");
            let completed_bytes = Bytes::from_slice(env, b"/completed");
            if *sp == pending_bytes {
                Some(false)
            } else if *sp == completed_bytes {
                Some(true)
            } else {
                None
            }
        } else {
            None
        };

        let mut doc = JsonDocument::new(env, "Todo List").heading(1, "Todo List");

        if !wallet_connected {
            doc = doc
                .heading(2, "Connect Your Wallet")
                .text("Please connect your wallet to view and manage your personal todo list.")
                .text("Each user has their own private task list that only they can see and modify.");
        } else {
            // Form for adding tasks
            doc = doc
                .form("add_task")
                .text_field("description", "Enter task description", true)
                .submit("Add Task");

            // Navigation
            doc = doc
                .nav_start()
                .nav_item("All", "/json", filter.is_none(), true)
                .nav_item("Pending", "/json/pending", filter == Some(false), false)
                .nav_item("Completed", "/json/completed", filter == Some(true), false)
                .nav_end();

            // Count completed vs pending for chart
            let mut completed_count = 0u32;
            let mut pending_count = 0u32;
            for (_, task) in tasks.iter() {
                if task.completed {
                    completed_count += 1;
                } else {
                    pending_count += 1;
                }
            }

            // Add pie chart if there are tasks
            if completed_count > 0 || pending_count > 0 {
                doc = doc
                    .pie_chart_start("Task Status")
                    .pie_slice("Completed", completed_count, "#22c55e", true)
                    .pie_slice("Pending", pending_count, "#eab308", false)
                    .pie_chart_end();
            }

            // Tasks heading
            doc = doc.heading(2, "Your Tasks").container_start("task-list");

            let mut task_count = 0u32;
            for (_, task) in tasks.iter() {
                // Apply filter
                if let Some(completed_filter) = filter {
                    if task.completed != completed_filter {
                        continue;
                    }
                }

                // Build task with actions
                let mut task_builder = doc.task_string(task.id, &task.description, task.completed);

                if !task.completed {
                    task_builder = task_builder.tx_action("complete_task", task.id, "Done");
                }
                task_builder = task_builder.tx_action("delete_task", task.id, "Delete");

                doc = task_builder.end();
                task_count += 1;
            }

            // If no tasks, add a text component
            if task_count == 0 {
                doc = if filter.is_some() {
                    doc.text("No matching tasks.")
                } else {
                    doc.text("No tasks yet. Add one above!")
                };
            }

            doc = doc.container_end();
        }

        // Divider and footer
        doc.divider()
            .text("Powered by Soroban Render")
            .build()
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    #[test]
    fn test_add_and_get_task() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(TodoContract, ());
        let client = TodoContractClient::new(&env, &contract_id);

        let user = Address::generate(&env);

        // Add a task (init is no longer required)
        let task_id = client.add_task(&String::from_str(&env, "Buy groceries"), &user);
        assert_eq!(task_id, 1);

        // Get the task (now requires user address)
        let task = client.get_task(&1, &user);
        assert!(task.is_some());
        let task = task.unwrap();
        assert_eq!(task.id, 1);
        assert_eq!(task.completed, false);
    }

    #[test]
    fn test_complete_task() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(TodoContract, ());
        let client = TodoContractClient::new(&env, &contract_id);

        let user = Address::generate(&env);

        client.add_task(&String::from_str(&env, "Test task"), &user);

        // Complete the task
        client.complete_task(&1, &user);

        let task = client.get_task(&1, &user).unwrap();
        assert_eq!(task.completed, true);
    }

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

        // User 1 cannot see User 2's task
        let task = client.get_task(&1, &user2);
        assert!(task.is_some()); // User 2's task #1 exists
        let task = client.get_task(&1, &user1);
        assert!(task.is_some()); // User 1's task #1 also exists (different storage)
    }

    #[test]
    fn test_render_home_without_wallet() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(TodoContract, ());
        let client = TodoContractClient::new(&env, &contract_id);

        // Render home page without viewer
        let output = client.render(&None, &None);

        let mut bytes_vec: [u8; 2048] = [0; 2048];
        let len = output.len() as usize;
        for i in 0..len {
            if let Some(b) = output.get(i as u32) {
                bytes_vec[i] = b;
            }
        }
        let output_str = core::str::from_utf8(&bytes_vec[..len]).unwrap();

        // Check for home page content
        assert!(output_str.contains("Welcome to the Soroban Render Demo"));
        // Check for TIP alert explaining the concept
        assert!(output_str.contains("[!TIP]"));
        // Check for WARNING alert about wallet connection
        assert!(output_str.contains("[!WARNING]"));
        assert!(output_str.contains("Connect your wallet"));
    }

    #[test]
    fn test_render_tasks_without_wallet() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(TodoContract, ());
        let client = TodoContractClient::new(&env, &contract_id);

        // Render tasks page without viewer - should show "connect wallet" message
        let tasks_path = String::from_str(&env, "/tasks");
        let output = client.render(&Some(tasks_path), &None);

        let mut bytes_vec: [u8; 2048] = [0; 2048];
        let len = output.len() as usize;
        for i in 0..len {
            if let Some(b) = output.get(i as u32) {
                bytes_vec[i] = b;
            }
        }
        let output_str = core::str::from_utf8(&bytes_vec[..len]).unwrap();

        assert!(output_str.contains("Connect Your Wallet"));
        assert!(output_str.contains("personal todo list"));
    }

    #[test]
    fn test_render_tasks_with_wallet() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(TodoContract, ());
        let client = TodoContractClient::new(&env, &contract_id);

        let user = Address::generate(&env);

        client.add_task(&String::from_str(&env, "First task"), &user);
        client.add_task(&String::from_str(&env, "Second task"), &user);

        // Render tasks page with viewer - should show tasks
        let tasks_path = String::from_str(&env, "/tasks");
        let output = client.render(&Some(tasks_path), &Some(user));

        let mut bytes_vec: [u8; 2048] = [0; 2048];
        let len = output.len() as usize;
        for i in 0..len {
            if let Some(b) = output.get(i as u32) {
                bytes_vec[i] = b;
            }
        }
        let output_str = core::str::from_utf8(&bytes_vec[..len]).unwrap();

        // Check for include tags
        assert!(output_str.contains("{{include contract=CCYEOY2JTOQ2JIMLLERAFNHAVKEKMEJDBOTLN6DIIWBHWEIMUA2T2VY4 func=\"header\"}}"));
        assert!(output_str.contains("{{include contract=CCYEOY2JTOQ2JIMLLERAFNHAVKEKMEJDBOTLN6DIIWBHWEIMUA2T2VY4 func=\"footer\"}}"));
        // Check for task content
        assert!(output_str.contains("First task"));
        assert!(output_str.contains("Second task"));
        assert!(output_str.contains("Your Tasks"));
    }

    #[test]
    fn test_render_about() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(TodoContract, ());
        let client = TodoContractClient::new(&env, &contract_id);

        let user = Address::generate(&env);

        // Add some tasks to generate stats
        client.add_task(&String::from_str(&env, "Task 1"), &user);
        client.add_task(&String::from_str(&env, "Task 2"), &user);

        // Render about page
        let about_path = String::from_str(&env, "/about");
        let output = client.render(&Some(about_path), &None);

        let mut bytes_vec: [u8; 3072] = [0; 3072];
        let len = output.len() as usize;
        for i in 0..len {
            if let Some(b) = output.get(i as u32) {
                bytes_vec[i] = b;
            }
        }
        let output_str = core::str::from_utf8(&bytes_vec[..len]).unwrap();

        // Check for about page content
        assert!(output_str.contains("About Soroban Render"));
        // Stats now shown in columns with heading
        assert!(output_str.contains(":::columns"));
        assert!(output_str.contains("Total Tasks"));
        assert!(output_str.contains("2")); // The number
        assert!(output_str.contains("Unique Users"));
        assert!(output_str.contains("1")); // The number
        // Check for INFO alert
        assert!(output_str.contains("[!INFO]"));
    }

    #[test]
    fn test_render_json_with_wallet() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(TodoContract, ());
        let client = TodoContractClient::new(&env, &contract_id);

        let user = Address::generate(&env);

        client.add_task(&String::from_str(&env, "First task"), &user);
        client.add_task(&String::from_str(&env, "Second task"), &user);

        // Complete one task to have mixed stats
        client.complete_task(&1, &user);

        // Render JSON format with viewer
        let json_path = String::from_str(&env, "/json");
        let output = client.render(&Some(json_path), &Some(user));

        let mut bytes_vec: [u8; 2048] = [0; 2048];
        let len = output.len() as usize;
        for i in 0..len {
            if let Some(b) = output.get(i as u32) {
                bytes_vec[i] = b;
            }
        }
        let output_str = core::str::from_utf8(&bytes_vec[..len]).unwrap();

        // Check JSON structure
        assert!(output_str.contains("\"format\":\"soroban-render-json-v1\""));
        assert!(output_str.contains("\"type\":\"heading\""));
        assert!(output_str.contains("\"type\":\"form\""));
        assert!(output_str.contains("\"type\":\"navigation\""));
        assert!(output_str.contains("\"type\":\"task\""));
        assert!(output_str.contains("First task"));
        assert!(output_str.contains("Second task"));
        // Check for pie chart
        assert!(output_str.contains("\"type\":\"chart\""));
        assert!(output_str.contains("\"chartType\":\"pie\""));
        assert!(output_str.contains("\"label\":\"Completed\""));
        assert!(output_str.contains("\"label\":\"Pending\""));
    }

    #[test]
    fn test_render_json_without_wallet() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(TodoContract, ());
        let client = TodoContractClient::new(&env, &contract_id);

        // Render JSON without viewer
        let json_path = String::from_str(&env, "/json");
        let output = client.render(&Some(json_path), &None);

        let mut bytes_vec: [u8; 1024] = [0; 1024];
        let len = output.len() as usize;
        for i in 0..len {
            if let Some(b) = output.get(i as u32) {
                bytes_vec[i] = b;
            }
        }
        let output_str = core::str::from_utf8(&bytes_vec[..len]).unwrap();

        // Should show connect wallet message
        assert!(output_str.contains("Connect Your Wallet"));
        // Should NOT show form or navigation
        assert!(!output_str.contains("\"type\":\"form\""));
    }
}
