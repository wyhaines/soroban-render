#![no_std]

use soroban_sdk::{
    contract, contractimpl, contractmeta, contracttype, Address, Bytes, Env, Map, String, Vec,
};

contractmeta!(key = "render", val = "v1");
contractmeta!(key = "render_formats", val = "markdown,json");

// Storage keys are now per-user using DataKey enum
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Tasks(Address),  // Map<u32, Task> for each user
    NextId(Address), // Next task ID for each user
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
        env.storage().persistent().set(&next_id_key, &(next_id + 1));

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

        tasks.remove(id);
        env.storage().persistent().set(&tasks_key, &tasks);
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

        // Check if JSON format is requested via /json prefix
        if let Some(ref p) = path {
            let path_bytes = Self::string_to_bytes(&env, p);
            let json_prefix = Bytes::from_slice(&env, b"/json");

            // Check for /json prefix
            if path_bytes.len() >= 5 {
                let mut is_json = true;
                for i in 0..5u32 {
                    if path_bytes.get(i) != json_prefix.get(i) {
                        is_json = false;
                        break;
                    }
                }

                if is_json {
                    // Extract subpath after /json (e.g., /json/pending -> /pending)
                    let subpath = if path_bytes.len() > 5 {
                        let mut sub = Bytes::new(&env);
                        for i in 5..path_bytes.len() {
                            if let Some(b) = path_bytes.get(i) {
                                sub.push_back(b);
                            }
                        }
                        Some(sub)
                    } else {
                        None
                    };

                    return Self::render_json(&env, &tasks, subpath, viewer.is_some());
                }
            }
        }

        // Standard markdown rendering
        let filter = if let Some(ref p) = path {
            let path_bytes = Self::string_to_bytes(&env, p);
            let pending_bytes = Bytes::from_slice(&env, b"/pending");
            let completed_bytes = Bytes::from_slice(&env, b"/completed");

            if path_bytes == pending_bytes {
                Some(false)
            } else if path_bytes == completed_bytes {
                Some(true)
            } else {
                let path_len = p.len() as usize;
                if path_len > 6 {
                    let prefix = String::from_str(&env, "/task/");
                    let prefix_bytes = Self::string_to_bytes(&env, &prefix);

                    let mut matches = true;
                    for i in 0..6 {
                        if path_bytes.get(i as u32) != prefix_bytes.get(i as u32) {
                            matches = false;
                            break;
                        }
                    }

                    if matches {
                        if let Some(id_byte) = path_bytes.get(6) {
                            if id_byte >= b'0' && id_byte <= b'9' {
                                let id = (id_byte - b'0') as u32;
                                return Self::render_single_task(&env, &tasks, id);
                            }
                        }
                    }
                }
                None
            }
        } else {
            None
        };

        Self::render_task_list(&env, &tasks, filter, viewer.is_some())
    }

    fn render_task_list(env: &Env, tasks: &Map<u32, Task>, filter: Option<bool>, wallet_connected: bool) -> Bytes {
        let mut parts: Vec<Bytes> = Vec::new(env);

        // Use cross-contract include for header from theme contract
        // This demonstrates composability: including components from another contract
        // Testnet theme contract: CAVPCBMMXSAM5C4URFZPGFE6G5UKW5C5HAMCSW7DM6CILISQM4NQTRVD
        parts.push_back(Bytes::from_slice(env, b"{{include contract=CAVPCBMMXSAM5C4URFZPGFE6G5UKW5C5HAMCSW7DM6CILISQM4NQTRVD func=\"header\"}}\n"));

        // Use theme contract's navigation component
        parts.push_back(Bytes::from_slice(env, b"{{include contract=CAVPCBMMXSAM5C4URFZPGFE6G5UKW5C5HAMCSW7DM6CILISQM4NQTRVD func=\"nav\"}}\n"));

        // Check if wallet is connected
        if !wallet_connected {
            parts.push_back(Bytes::from_slice(env, b"## Connect Your Wallet\n\n"));
            parts.push_back(Bytes::from_slice(env, b"**Please connect your wallet** to view and manage your personal todo list.\n\n"));
            parts.push_back(Bytes::from_slice(env, b"Each user has their own private task list that only they can see and modify.\n\n"));
        } else {
            // Add task form
            parts.push_back(Bytes::from_slice(env, b"## Add Task\n\n"));
            parts.push_back(Bytes::from_slice(env, b"<input name=\"description\" type=\"text\" placeholder=\"Enter task description\" />\n\n"));
            parts.push_back(Bytes::from_slice(env, b"[Add Task](form:add_task)\n\n"));

            // Filter navigation (app-specific)
            parts.push_back(Bytes::from_slice(env, b"## Filter\n\n"));
            parts.push_back(Bytes::from_slice(env, b"[All](render:/) | [Pending](render:/pending) | [Completed](render:/completed)\n\n"));

            parts.push_back(Bytes::from_slice(env, b"## Your Tasks\n\n"));

            let mut has_tasks = false;
            for (_, task) in tasks.iter() {
                // Apply filter
                if let Some(completed_filter) = filter {
                    if task.completed != completed_filter {
                        continue;
                    }
                }

                has_tasks = true;
                let checkbox = if task.completed { b"[x]" } else { b"[ ]" };
                parts.push_back(Bytes::from_slice(env, b"- "));
                parts.push_back(Bytes::from_slice(env, checkbox));
                parts.push_back(Bytes::from_slice(env, b" "));

                if task.completed {
                    parts.push_back(Bytes::from_slice(env, b"~~"));
                    parts.push_back(Self::string_to_bytes(env, &task.description));
                    parts.push_back(Bytes::from_slice(env, b"~~"));
                } else {
                    parts.push_back(Self::string_to_bytes(env, &task.description));
                }

                parts.push_back(Bytes::from_slice(env, b" (#"));
                parts.push_back(Self::u32_to_bytes(env, task.id));
                parts.push_back(Bytes::from_slice(env, b") "));

                // Action buttons
                if !task.completed {
                    parts.push_back(Bytes::from_slice(env, b"[Done](tx:complete_task {\"id\":"));
                    parts.push_back(Self::u32_to_bytes(env, task.id));
                    parts.push_back(Bytes::from_slice(env, b"}) "));
                }
                parts.push_back(Bytes::from_slice(env, b"[Delete](tx:delete_task {\"id\":"));
                parts.push_back(Self::u32_to_bytes(env, task.id));
                parts.push_back(Bytes::from_slice(env, b"})\n"));
            }

            if !has_tasks {
                if filter.is_some() {
                    parts.push_back(Bytes::from_slice(env, b"*No matching tasks.*\n\n"));
                } else {
                    parts.push_back(Bytes::from_slice(env, b"*No tasks yet. Add one above!*\n\n"));
                }
            }
        }

        // Use cross-contract include for footer from theme contract
        parts.push_back(Bytes::from_slice(env, b"{{include contract=CAVPCBMMXSAM5C4URFZPGFE6G5UKW5C5HAMCSW7DM6CILISQM4NQTRVD func=\"footer\"}}"));

        Self::concat_bytes(env, &parts)
    }

    fn render_single_task(env: &Env, tasks: &Map<u32, Task>, id: u32) -> Bytes {
        let mut parts: Vec<Bytes> = Vec::new(env);

        parts.push_back(Bytes::from_slice(env, b"# Task Details\n\n"));

        if let Some(task) = tasks.get(id) {
            let status: &[u8] = if task.completed {
                b"Completed"
            } else {
                b"Pending"
            };

            parts.push_back(Bytes::from_slice(env, b"**ID:** "));
            parts.push_back(Self::u32_to_bytes(env, task.id));
            parts.push_back(Bytes::from_slice(env, b"\n\n"));

            parts.push_back(Bytes::from_slice(env, b"**Description:** "));
            parts.push_back(Self::string_to_bytes(env, &task.description));
            parts.push_back(Bytes::from_slice(env, b"\n\n"));

            parts.push_back(Bytes::from_slice(env, b"**Status:** "));
            parts.push_back(Bytes::from_slice(env, status));
            parts.push_back(Bytes::from_slice(env, b"\n\n"));

            // Action buttons
            if !task.completed {
                parts.push_back(Bytes::from_slice(env, b"[Mark Complete](tx:complete_task {\"id\":"));
                parts.push_back(Self::u32_to_bytes(env, task.id));
                parts.push_back(Bytes::from_slice(env, b"}) | "));
            }
            parts.push_back(Bytes::from_slice(env, b"[Delete](tx:delete_task {\"id\":"));
            parts.push_back(Self::u32_to_bytes(env, task.id));
            parts.push_back(Bytes::from_slice(env, b"})\n\n"));

            parts.push_back(Bytes::from_slice(env, b"[Back to list](render:/)\n"));
        } else {
            parts.push_back(Bytes::from_slice(env, b"*Task not found*\n\n[Back to list](render:/)\n"));
        }

        Self::concat_bytes(env, &parts)
    }

    /// Render footer component - can be included via {{include contract=SELF func="footer"}}
    pub fn render_footer(env: Env, _path: Option<String>, _viewer: Option<Address>) -> Bytes {
        Bytes::from_slice(&env, b"\n---\n\n*Powered by [Soroban Render](https://github.com/wyhaines/soroban-render)*\n")
    }

    /// Render header component - can be included via {{include contract=SELF func="header"}}
    pub fn render_header(env: Env, _path: Option<String>, _viewer: Option<Address>) -> Bytes {
        Bytes::from_slice(&env, b"# Todo List\n\n*A demo app showcasing Soroban Render*\n\n---\n\n")
    }

    fn render_json(env: &Env, tasks: &Map<u32, Task>, subpath: Option<Bytes>, wallet_connected: bool) -> Bytes {
        let mut parts: Vec<Bytes> = Vec::new(env);

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

        // Build JSON document following soroban-render-json-v1 format
        parts.push_back(Bytes::from_slice(env, b"{\"format\":\"soroban-render-json-v1\",\"title\":\"Todo List\",\"components\":["));

        // Heading
        parts.push_back(Bytes::from_slice(env, b"{\"type\":\"heading\",\"level\":1,\"text\":\"Todo List\"},"));

        if !wallet_connected {
            // Show connect wallet message
            parts.push_back(Bytes::from_slice(env, b"{\"type\":\"heading\",\"level\":2,\"text\":\"Connect Your Wallet\"},"));
            parts.push_back(Bytes::from_slice(env, b"{\"type\":\"text\",\"content\":\"Please connect your wallet to view and manage your personal todo list.\"},"));
            parts.push_back(Bytes::from_slice(env, b"{\"type\":\"text\",\"content\":\"Each user has their own private task list that only they can see and modify.\"},"));
        } else {
            // Form for adding tasks
            parts.push_back(Bytes::from_slice(env, b"{\"type\":\"form\",\"action\":\"add_task\",\"fields\":[{\"name\":\"description\",\"type\":\"text\",\"placeholder\":\"Enter task description\",\"required\":true}],\"submitLabel\":\"Add Task\"},"));

            // Navigation
            parts.push_back(Bytes::from_slice(env, b"{\"type\":\"navigation\",\"items\":["));
            parts.push_back(Bytes::from_slice(env, b"{\"label\":\"All\",\"path\":\"/json\""));
            if filter.is_none() {
                parts.push_back(Bytes::from_slice(env, b",\"active\":true"));
            }
            parts.push_back(Bytes::from_slice(env, b"},"));
            parts.push_back(Bytes::from_slice(env, b"{\"label\":\"Pending\",\"path\":\"/json/pending\""));
            if filter == Some(false) {
                parts.push_back(Bytes::from_slice(env, b",\"active\":true"));
            }
            parts.push_back(Bytes::from_slice(env, b"},"));
            parts.push_back(Bytes::from_slice(env, b"{\"label\":\"Completed\",\"path\":\"/json/completed\""));
            if filter == Some(true) {
                parts.push_back(Bytes::from_slice(env, b",\"active\":true"));
            }
            parts.push_back(Bytes::from_slice(env, b"}]},"));

            // Tasks heading
            parts.push_back(Bytes::from_slice(env, b"{\"type\":\"heading\",\"level\":2,\"text\":\"Your Tasks\"},"));

            // Task list as container
            parts.push_back(Bytes::from_slice(env, b"{\"type\":\"container\",\"className\":\"task-list\",\"components\":["));

            let mut task_count = 0u32;
            for (_, task) in tasks.iter() {
                // Apply filter
                if let Some(completed_filter) = filter {
                    if task.completed != completed_filter {
                        continue;
                    }
                }

                if task_count > 0 {
                    parts.push_back(Bytes::from_slice(env, b","));
                }

                // Task component
                parts.push_back(Bytes::from_slice(env, b"{\"type\":\"task\",\"id\":"));
                parts.push_back(Self::u32_to_bytes(env, task.id));
                parts.push_back(Bytes::from_slice(env, b",\"text\":\""));
                parts.push_back(Self::escape_json_string(env, &task.description));
                parts.push_back(Bytes::from_slice(env, b"\",\"completed\":"));
                if task.completed {
                    parts.push_back(Bytes::from_slice(env, b"true"));
                } else {
                    parts.push_back(Bytes::from_slice(env, b"false"));
                }

                // Actions
                parts.push_back(Bytes::from_slice(env, b",\"actions\":["));
                let mut action_count = 0u32;

                if !task.completed {
                    parts.push_back(Bytes::from_slice(env, b"{\"type\":\"tx\",\"method\":\"complete_task\",\"args\":{\"id\":"));
                    parts.push_back(Self::u32_to_bytes(env, task.id));
                    parts.push_back(Bytes::from_slice(env, b"},\"label\":\"Done\"}"));
                    action_count += 1;
                }

                if action_count > 0 {
                    parts.push_back(Bytes::from_slice(env, b","));
                }
                parts.push_back(Bytes::from_slice(env, b"{\"type\":\"tx\",\"method\":\"delete_task\",\"args\":{\"id\":"));
                parts.push_back(Self::u32_to_bytes(env, task.id));
                parts.push_back(Bytes::from_slice(env, b"},\"label\":\"Delete\"}"));

                parts.push_back(Bytes::from_slice(env, b"]}"));
                task_count += 1;
            }

            // If no tasks, add a text component
            if task_count == 0 {
                if filter.is_some() {
                    parts.push_back(Bytes::from_slice(env, b"{\"type\":\"text\",\"content\":\"No matching tasks.\"}"));
                } else {
                    parts.push_back(Bytes::from_slice(env, b"{\"type\":\"text\",\"content\":\"No tasks yet. Add one above!\"}"));
                }
            }

            parts.push_back(Bytes::from_slice(env, b"]},"));
        }

        // Divider and footer
        parts.push_back(Bytes::from_slice(env, b"{\"type\":\"divider\"},"));
        parts.push_back(Bytes::from_slice(env, b"{\"type\":\"text\",\"content\":\"Powered by Soroban Render\"}"));

        // Close components array and document
        parts.push_back(Bytes::from_slice(env, b"]}"));

        Self::concat_bytes(env, &parts)
    }

    fn escape_json_string(env: &Env, s: &String) -> Bytes {
        let input = Self::string_to_bytes(env, s);
        let mut result = Bytes::new(env);

        for i in 0..input.len() {
            if let Some(b) = input.get(i) {
                match b {
                    b'"' => {
                        result.push_back(b'\\');
                        result.push_back(b'"');
                    }
                    b'\\' => {
                        result.push_back(b'\\');
                        result.push_back(b'\\');
                    }
                    b'\n' => {
                        result.push_back(b'\\');
                        result.push_back(b'n');
                    }
                    b'\r' => {
                        result.push_back(b'\\');
                        result.push_back(b'r');
                    }
                    b'\t' => {
                        result.push_back(b'\\');
                        result.push_back(b't');
                    }
                    _ => {
                        result.push_back(b);
                    }
                }
            }
        }

        result
    }

    fn string_to_bytes(env: &Env, s: &String) -> Bytes {
        let mut buf = [0u8; 256];
        let len = s.len() as usize;
        s.copy_into_slice(&mut buf[..len]);
        Bytes::from_slice(env, &buf[..len])
    }

    fn concat_bytes(env: &Env, parts: &Vec<Bytes>) -> Bytes {
        let mut result = Bytes::new(env);
        for part in parts.iter() {
            result.append(&part);
        }
        result
    }

    fn u32_to_bytes(env: &Env, n: u32) -> Bytes {
        if n == 0 {
            return Bytes::from_slice(env, b"0");
        }

        let mut num = n;
        let mut digits: [u8; 10] = [0; 10];
        let mut i = 0;

        while num > 0 {
            digits[i] = b'0' + (num % 10) as u8;
            num /= 10;
            i += 1;
        }

        // Reverse the digits
        let mut result = Bytes::new(env);
        for j in (0..i).rev() {
            result.push_back(digits[j]);
        }
        result
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
    fn test_render_without_wallet() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(TodoContract, ());
        let client = TodoContractClient::new(&env, &contract_id);

        // Render without viewer - should show "connect wallet" message
        let output = client.render(&None, &None);

        let mut bytes_vec: [u8; 1024] = [0; 1024];
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
    fn test_render_with_wallet() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(TodoContract, ());
        let client = TodoContractClient::new(&env, &contract_id);

        let user = Address::generate(&env);

        client.add_task(&String::from_str(&env, "First task"), &user);
        client.add_task(&String::from_str(&env, "Second task"), &user);

        // Render with viewer - should show tasks
        let output = client.render(&None, &Some(user));

        let mut bytes_vec: [u8; 2048] = [0; 2048];
        let len = output.len() as usize;
        for i in 0..len {
            if let Some(b) = output.get(i as u32) {
                bytes_vec[i] = b;
            }
        }
        let output_str = core::str::from_utf8(&bytes_vec[..len]).unwrap();

        // Check for include tags
        assert!(output_str.contains("{{include contract=CAVPCBMMXSAM5C4URFZPGFE6G5UKW5C5HAMCSW7DM6CILISQM4NQTRVD func=\"header\"}}"));
        assert!(output_str.contains("{{include contract=CAVPCBMMXSAM5C4URFZPGFE6G5UKW5C5HAMCSW7DM6CILISQM4NQTRVD func=\"footer\"}}"));
        // Check for task content
        assert!(output_str.contains("First task"));
        assert!(output_str.contains("Second task"));
        assert!(output_str.contains("Your Tasks"));
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
