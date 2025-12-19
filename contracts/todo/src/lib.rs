#![no_std]

use soroban_sdk::{
    contract, contractimpl, contractmeta, contracttype, symbol_short, Address, Bytes, Env, Map,
    String, Symbol, Vec,
};

contractmeta!(key = "render", val = "v1");
contractmeta!(key = "render_formats", val = "markdown");

const TASKS: Symbol = symbol_short!("tasks");
const NEXT_ID: Symbol = symbol_short!("next_id");

#[contracttype]
#[derive(Clone, Debug)]
pub struct Task {
    pub id: u32,
    pub description: String,
    pub completed: bool,
    pub created_by: Address,
}

#[contract]
pub struct TodoContract;

#[contractimpl]
impl TodoContract {
    pub fn init(env: Env) {
        let tasks: Map<u32, Task> = Map::new(&env);
        env.storage().persistent().set(&TASKS, &tasks);
        env.storage().persistent().set(&NEXT_ID, &1u32);
    }

    pub fn add_task(env: Env, description: String, caller: Address) -> u32 {
        caller.require_auth();

        let mut tasks: Map<u32, Task> = env
            .storage()
            .persistent()
            .get(&TASKS)
            .unwrap_or(Map::new(&env));

        let next_id: u32 = env.storage().persistent().get(&NEXT_ID).unwrap_or(1);

        let task = Task {
            id: next_id,
            description,
            completed: false,
            created_by: caller,
        };

        tasks.set(next_id, task);
        env.storage().persistent().set(&TASKS, &tasks);
        env.storage().persistent().set(&NEXT_ID, &(next_id + 1));

        next_id
    }

    pub fn complete_task(env: Env, id: u32, caller: Address) {
        caller.require_auth();

        let mut tasks: Map<u32, Task> = env
            .storage()
            .persistent()
            .get(&TASKS)
            .unwrap_or(Map::new(&env));

        if let Some(mut task) = tasks.get(id) {
            task.completed = true;
            tasks.set(id, task);
            env.storage().persistent().set(&TASKS, &tasks);
        }
    }

    pub fn delete_task(env: Env, id: u32, caller: Address) {
        caller.require_auth();

        let mut tasks: Map<u32, Task> = env
            .storage()
            .persistent()
            .get(&TASKS)
            .unwrap_or(Map::new(&env));

        tasks.remove(id);
        env.storage().persistent().set(&TASKS, &tasks);
    }

    pub fn get_tasks(env: Env) -> Vec<Task> {
        let tasks: Map<u32, Task> = env
            .storage()
            .persistent()
            .get(&TASKS)
            .unwrap_or(Map::new(&env));

        let mut result: Vec<Task> = Vec::new(&env);
        for (_, task) in tasks.iter() {
            result.push_back(task);
        }
        result
    }

    pub fn get_task(env: Env, id: u32) -> Option<Task> {
        let tasks: Map<u32, Task> = env
            .storage()
            .persistent()
            .get(&TASKS)
            .unwrap_or(Map::new(&env));

        tasks.get(id)
    }

    pub fn render(env: Env, path: Option<String>, _viewer: Option<Address>) -> Bytes {
        let tasks: Map<u32, Task> = env
            .storage()
            .persistent()
            .get(&TASKS)
            .unwrap_or(Map::new(&env));

        if let Some(ref p) = path {
            let path_len = p.len() as usize;
            if path_len > 6 {
                let prefix = String::from_str(&env, "/task/");
                let prefix_bytes = Self::string_to_bytes(&env, &prefix);
                let path_bytes = Self::string_to_bytes(&env, p);

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
        }

        Self::render_task_list(&env, &tasks)
    }

    fn render_task_list(env: &Env, tasks: &Map<u32, Task>) -> Bytes {
        let mut parts: Vec<Bytes> = Vec::new(env);

        parts.push_back(Bytes::from_slice(env, b"# Todo List\n\n"));
        parts.push_back(Bytes::from_slice(env, b"## Tasks\n\n"));

        let mut has_tasks = false;
        for (_, task) in tasks.iter() {
            has_tasks = true;
            let checkbox = if task.completed { b"[x]" } else { b"[ ]" };
            parts.push_back(Bytes::from_slice(env, b"- "));
            parts.push_back(Bytes::from_slice(env, checkbox));
            parts.push_back(Bytes::from_slice(env, b" "));
            parts.push_back(Self::string_to_bytes(env, &task.description));
            parts.push_back(Bytes::from_slice(env, b" (#"));
            parts.push_back(Self::u32_to_bytes(env, task.id));
            parts.push_back(Bytes::from_slice(env, b")\n"));
        }

        if !has_tasks {
            parts.push_back(Bytes::from_slice(env, b"*No tasks yet. Add one below!*\n\n"));
        }

        parts.push_back(Bytes::from_slice(env, b"\n---\n*Powered by Soroban Render*\n"));

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

            parts.push_back(Bytes::from_slice(env, b"[Back to list](/)\n"));
        } else {
            parts.push_back(Bytes::from_slice(env, b"*Task not found*\n\n[Back to list](/)\n"));
        }

        Self::concat_bytes(env, &parts)
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

        // Initialize
        client.init();

        // Add a task
        let task_id = client.add_task(&String::from_str(&env, "Buy groceries"), &user);
        assert_eq!(task_id, 1);

        // Get the task
        let task = client.get_task(&1);
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

        client.init();
        client.add_task(&String::from_str(&env, "Test task"), &user);

        // Complete the task
        client.complete_task(&1, &user);

        let task = client.get_task(&1).unwrap();
        assert_eq!(task.completed, true);
    }

    #[test]
    fn test_render() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(TodoContract, ());
        let client = TodoContractClient::new(&env, &contract_id);

        let user = Address::generate(&env);

        client.init();
        client.add_task(&String::from_str(&env, "First task"), &user);
        client.add_task(&String::from_str(&env, "Second task"), &user);

        // Render the UI
        let output = client.render(&None, &None);

        // Convert to string and check content
        let mut bytes_vec: [u8; 1024] = [0; 1024];
        let len = output.len() as usize;
        for i in 0..len {
            if let Some(b) = output.get(i as u32) {
                bytes_vec[i] = b;
            }
        }
        let output_str = core::str::from_utf8(&bytes_vec[..len]).unwrap();
        assert!(output_str.contains("# Todo List"));
        assert!(output_str.contains("First task"));
        assert!(output_str.contains("Second task"));
    }
}
