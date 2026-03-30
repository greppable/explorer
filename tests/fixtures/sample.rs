use std::collections::HashMap;
use std::fmt;

pub struct UserService {
    pub db_path: String,
    limit: i32,
}

pub trait Greeter {
    fn greet(&self, name: &str) -> String;
}

impl UserService {
    pub fn new(db_path: String) -> Self {
        UserService { db_path, limit: 10 }
    }

    pub fn get_user(&self, user_id: i32) -> Option<HashMap<String, String>> {
        None
    }

    fn validate(&self, data: &str) -> bool {
        true
    }
}

impl Greeter for UserService {
    fn greet(&self, name: &str) -> String {
        format!("Hello, {}", name)
    }
}

pub fn create_service(path: String) -> UserService {
    UserService::new(path)
}

fn helper() -> bool {
    true
}

pub const MAX_RETRIES: i32 = 3;

pub enum Status {
    Active,
    Inactive,
    Pending,
}
