#![no_std]

use soroban_sdk::{
    contract, contractimpl, contractmeta, contracttype, Address, Bytes, Env, Map, String, Vec,
};

contractmeta!(key = "render", val = "v1");
contractmeta!(key = "render_formats", val = "markdown,json");

// Storage keys
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Tasks(Address),  // Map<u32, Task> for each user
    NextId(Address), // Next task ID for each user
    UserCount,       // Total unique users
    TotalTasks,      // Total tasks across all users
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
        env.storage().persistent().set(&next_id_key, &(next_id + 1));

        // Update global stats
        let total_tasks: u32 = env.storage().persistent().get(&DataKey::TotalTasks).unwrap_or(0);
        env.storage().persistent().set(&DataKey::TotalTasks, &(total_tasks + 1));

        // Track unique users
        let user_has_tasks: bool = env.storage().persistent().get(&has_tasks_key).unwrap_or(false);
        if !user_has_tasks {
            env.storage().persistent().set(&has_tasks_key, &true);
            let user_count: u32 = env.storage().persistent().get(&DataKey::UserCount).unwrap_or(0);
            env.storage().persistent().set(&DataKey::UserCount, &(user_count + 1));
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
            let total_tasks: u32 = env.storage().persistent().get(&DataKey::TotalTasks).unwrap_or(0);
            if total_tasks > 0 {
                env.storage().persistent().set(&DataKey::TotalTasks, &(total_tasks - 1));
            }
        }
    }

    /// Get global stats
    pub fn get_stats(env: Env) -> (u32, u32) {
        let total_tasks: u32 = env.storage().persistent().get(&DataKey::TotalTasks).unwrap_or(0);
        let user_count: u32 = env.storage().persistent().get(&DataKey::UserCount).unwrap_or(0);
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

        // Route based on path
        let path_bytes = if let Some(ref p) = path {
            Self::string_to_bytes(&env, p)
        } else {
            Bytes::from_slice(&env, b"/")
        };

        // Check routes
        let home_bytes = Bytes::from_slice(&env, b"/");
        let tasks_bytes = Bytes::from_slice(&env, b"/tasks");
        let about_bytes = Bytes::from_slice(&env, b"/about");
        let pending_bytes = Bytes::from_slice(&env, b"/pending");
        let completed_bytes = Bytes::from_slice(&env, b"/completed");
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

        // Additional route patterns
        let tasks_pending_bytes = Bytes::from_slice(&env, b"/tasks/pending");
        let tasks_completed_bytes = Bytes::from_slice(&env, b"/tasks/completed");

        // Route to appropriate page
        if path_bytes == home_bytes {
            return Self::render_home(&env, viewer.is_some());
        } else if path_bytes == about_bytes {
            return Self::render_about(&env);
        } else if path_bytes == tasks_bytes {
            return Self::render_task_list(&env, &tasks, None, viewer.is_some());
        } else if path_bytes == tasks_pending_bytes || path_bytes == pending_bytes {
            return Self::render_task_list(&env, &tasks, Some(false), viewer.is_some());
        } else if path_bytes == tasks_completed_bytes || path_bytes == completed_bytes {
            return Self::render_task_list(&env, &tasks, Some(true), viewer.is_some());
        }

        // Check for /task/:id pattern
        let task_prefix = Bytes::from_slice(&env, b"/task/");
        if path_bytes.len() > 6 {
            let mut matches = true;
            for i in 0..6u32 {
                if path_bytes.get(i) != task_prefix.get(i) {
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

        // Default to home
        Self::render_home(&env, viewer.is_some())
    }

    fn render_home(env: &Env, wallet_connected: bool) -> Bytes {
        let mut parts: Vec<Bytes> = Vec::new(env);

        // Header from theme contract
        parts.push_back(Bytes::from_slice(env, b"{{include contract=CCYEOY2JTOQ2JIMLLERAFNHAVKEKMEJDBOTLN6DIIWBHWEIMUA2T2VY4 func=\"header\"}}\n"));

        // Navigation
        parts.push_back(Bytes::from_slice(env, b"[Home](render:/) | [Tasks](render:/tasks) | [About](render:/about)\n\n"));

        parts.push_back(Bytes::from_slice(env, b"---\n\n"));

        parts.push_back(Bytes::from_slice(env, b"## Welcome to the Soroban Render Demo\n\n"));

        parts.push_back(Bytes::from_slice(env, b"This is a **fully functional todo application** where the entire user interface is defined by the smart contract itself.\n\n"));

        // Alert callout for key information
        parts.push_back(Bytes::from_slice(env, b"> [!TIP]\n> This entire UI is generated by the smart contract's `render()` function. The markdown you see, including this callout, comes directly from the blockchain!\n\n"));

        parts.push_back(Bytes::from_slice(env, b"### What makes this special?\n\n"));

        parts.push_back(Bytes::from_slice(env, b"- **Self-contained UI**: The contract's `render()` function returns this markdown you're reading\n"));
        parts.push_back(Bytes::from_slice(env, b"- **Interactive elements**: Forms and buttons trigger real blockchain transactions\n"));
        parts.push_back(Bytes::from_slice(env, b"- **Per-user storage**: Each wallet has its own private task list\n"));
        parts.push_back(Bytes::from_slice(env, b"- **Composability**: This app includes header/footer components from a separate theme contract\n\n"));

        if wallet_connected {
            parts.push_back(Bytes::from_slice(env, b"> [!NOTE]\n> Your wallet is connected! You're ready to create and manage tasks.\n\n"));
            parts.push_back(Bytes::from_slice(env, b"### Get Started\n\n"));
            parts.push_back(Bytes::from_slice(env, b"Head over to [Tasks](render:/tasks) to manage your todo list.\n\n"));
        } else {
            parts.push_back(Bytes::from_slice(env, b"> [!WARNING]\n> Connect your wallet (button in top-right) to create and manage your personal todo list.\n\n"));
            parts.push_back(Bytes::from_slice(env, b"### Get Started\n\n"));
            parts.push_back(Bytes::from_slice(env, b"Each user has their own private task list stored on the blockchain.\n\n"));
        }

        // Footer from theme contract
        parts.push_back(Bytes::from_slice(env, b"{{include contract=CCYEOY2JTOQ2JIMLLERAFNHAVKEKMEJDBOTLN6DIIWBHWEIMUA2T2VY4 func=\"footer\"}}"));

        Self::concat_bytes(env, &parts)
    }

    fn render_about(env: &Env) -> Bytes {
        let mut parts: Vec<Bytes> = Vec::new(env);

        // Header from theme contract
        parts.push_back(Bytes::from_slice(env, b"{{include contract=CCYEOY2JTOQ2JIMLLERAFNHAVKEKMEJDBOTLN6DIIWBHWEIMUA2T2VY4 func=\"header\"}}\n"));

        // Navigation
        parts.push_back(Bytes::from_slice(env, b"[Home](render:/) | [Tasks](render:/tasks) | [About](render:/about)\n\n"));

        parts.push_back(Bytes::from_slice(env, b"---\n\n"));

        parts.push_back(Bytes::from_slice(env, b"## About Soroban Render\n\n"));

        parts.push_back(Bytes::from_slice(env, b"Soroban Render is a community convention for building **self-contained, renderable dApps** on Stellar's Soroban smart contract platform.\n\n"));

        // Info callout about the project
        parts.push_back(Bytes::from_slice(env, b"> [!INFO]\n> Inspired by [Gno.land's Render() function](https://docs.gno.land/users/explore-with-gnoweb/#viewing-rendered-content), Soroban Render allows smart contracts to define their own user interface.\n\n"));

        // Get stats
        let total_tasks: u32 = env.storage().persistent().get(&DataKey::TotalTasks).unwrap_or(0);
        let user_count: u32 = env.storage().persistent().get(&DataKey::UserCount).unwrap_or(0);

        // Stats in columns
        parts.push_back(Bytes::from_slice(env, b"### Live Stats\n\n"));
        parts.push_back(Bytes::from_slice(env, b":::columns\n"));
        parts.push_back(Bytes::from_slice(env, b"**Total Tasks**\n\n"));
        parts.push_back(Bytes::from_slice(env, b"# "));
        parts.push_back(Self::u32_to_bytes(env, total_tasks));
        parts.push_back(Bytes::from_slice(env, b"\n\ntasks stored on-chain\n"));
        parts.push_back(Bytes::from_slice(env, b"|||\n"));
        parts.push_back(Bytes::from_slice(env, b"**Unique Users**\n\n"));
        parts.push_back(Bytes::from_slice(env, b"# "));
        parts.push_back(Self::u32_to_bytes(env, user_count));
        parts.push_back(Bytes::from_slice(env, b"\n\nwallets with tasks\n"));
        parts.push_back(Bytes::from_slice(env, b":::\n\n"));

        parts.push_back(Bytes::from_slice(env, b"### How It Works\n\n"));

        // Features in columns
        parts.push_back(Bytes::from_slice(env, b":::columns\n"));
        parts.push_back(Bytes::from_slice(env, b"**1. Contract Renders UI**\n\nThe `render(path, viewer)` function returns markdown or JSON describing the interface.\n"));
        parts.push_back(Bytes::from_slice(env, b"|||\n"));
        parts.push_back(Bytes::from_slice(env, b"**2. Special Protocols**\n\n`render:` for navigation, `tx:` for transactions, `form:` for form submissions.\n"));
        parts.push_back(Bytes::from_slice(env, b"|||\n"));
        parts.push_back(Bytes::from_slice(env, b"**3. Universal Viewer**\n\nAny contract implementing `render()` can be viewed with the same generic viewer.\n"));
        parts.push_back(Bytes::from_slice(env, b":::\n\n"));

        parts.push_back(Bytes::from_slice(env, b"### Learn More\n\n"));

        parts.push_back(Bytes::from_slice(env, b"- [View the source code on GitHub](https://github.com/wyhaines/soroban-render)\n"));
        parts.push_back(Bytes::from_slice(env, b"- [Soroban Documentation](https://soroban.stellar.org/docs)\n"));
        parts.push_back(Bytes::from_slice(env, b"- [Stellar Developer Portal](https://developers.stellar.org)\n\n"));

        // Footer from theme contract
        parts.push_back(Bytes::from_slice(env, b"{{include contract=CCYEOY2JTOQ2JIMLLERAFNHAVKEKMEJDBOTLN6DIIWBHWEIMUA2T2VY4 func=\"footer\"}}"));

        Self::concat_bytes(env, &parts)
    }

    fn render_task_list(env: &Env, tasks: &Map<u32, Task>, filter: Option<bool>, wallet_connected: bool) -> Bytes {
        let mut parts: Vec<Bytes> = Vec::new(env);

        // Header from theme contract
        parts.push_back(Bytes::from_slice(env, b"{{include contract=CCYEOY2JTOQ2JIMLLERAFNHAVKEKMEJDBOTLN6DIIWBHWEIMUA2T2VY4 func=\"header\"}}\n"));

        // Navigation
        parts.push_back(Bytes::from_slice(env, b"[Home](render:/) | [Tasks](render:/tasks) | [About](render:/about)\n\n"));

        parts.push_back(Bytes::from_slice(env, b"---\n\n"));

        // Check if wallet is connected
        if !wallet_connected {
            parts.push_back(Bytes::from_slice(env, b"## Connect Your Wallet\n\n"));
            parts.push_back(Bytes::from_slice(env, b"**Please connect your wallet** to view and manage your personal todo list.\n\n"));
            parts.push_back(Bytes::from_slice(env, b"Each user has their own private task list that only they can see and modify.\n\n"));
        } else {
            // Add task form
            parts.push_back(Bytes::from_slice(env, b"## Add Task\n\n"));
            parts.push_back(Bytes::from_slice(env, b"<textarea name=\"description\" rows=\"2\" placeholder=\"What needs to be done?\"></textarea>\n\n"));
            parts.push_back(Bytes::from_slice(env, b"[Add Task](form:add_task)\n\n"));

            // Filter navigation (app-specific)
            parts.push_back(Bytes::from_slice(env, b"## Filter\n\n"));
            parts.push_back(Bytes::from_slice(env, b"[All](render:/tasks) | [Pending](render:/tasks/pending) | [Completed](render:/tasks/completed)\n\n"));

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
        parts.push_back(Bytes::from_slice(env, b"{{include contract=CCYEOY2JTOQ2JIMLLERAFNHAVKEKMEJDBOTLN6DIIWBHWEIMUA2T2VY4 func=\"footer\"}}"));

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
                parts.push_back(Bytes::from_slice(env, b"{\"type\":\"chart\",\"chartType\":\"pie\",\"title\":\"Task Status\",\"data\":["));
                parts.push_back(Bytes::from_slice(env, b"{\"label\":\"Completed\",\"value\":"));
                parts.push_back(Self::u32_to_bytes(env, completed_count));
                parts.push_back(Bytes::from_slice(env, b",\"color\":\"#22c55e\"},"));
                parts.push_back(Bytes::from_slice(env, b"{\"label\":\"Pending\",\"value\":"));
                parts.push_back(Self::u32_to_bytes(env, pending_count));
                parts.push_back(Bytes::from_slice(env, b",\"color\":\"#eab308\"}"));
                parts.push_back(Bytes::from_slice(env, b"]},"));
            }

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
        assert!(output_str.contains("# 2"));  // The number shown as heading
        assert!(output_str.contains("Unique Users"));
        assert!(output_str.contains("# 1"));  // The number shown as heading
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
