# Stellar Soroban Rust Smart Contracts Reference Guide

Stellar Soroban smart contracts are written in idiomatic Rust and compiled to WebAssembly (WASM). Below are standard templates, design patterns, and storage guidelines.

---

## 1. Minimal Soroban Contract Structure

Every contract requires the `soroban-sdk` crate. The minimal layout includes a contract struct, implementation block, and functions exposing the interface.

```rust
#![no_std]
use soroban_sdk::{contract, contractimpl, Env, Symbol, log};

#[contract]
pub struct IncrementContract;

#[contractimpl]
impl IncrementContract {
    pub fn increment(env: Env, key: Symbol) -> u32 {
        // Retrieve or initialize the counter
        let mut count: u32 = env.storage().instance().get(&key).unwrap_or(0);
        
        count += 1;
        log!(&env, "Counter incremented: key = {}, count = {}", key, count);
        
        // Save the new value
        env.storage().instance().set(&key, &count);
        
        // Extend instance storage TTL (Time to Live)
        env.storage().instance().extend_ttl(100, 1000);
        
        count
    }
}
```

---

## 2. Soroban Storage Options & TTL Management

Soroban separates state into three storage types. You must manage the Time to Live (TTL) of your storage keys to prevent state expiration.

### A. Instance Storage
* **Use case**: Shared contract metadata, admin address, global settings.
* **Property**: Shares lifecycle with the contract instance. If contract TTL is extended, instance keys are extended.

```rust
env.storage().instance().set(&Symbol::new(&env, "admin"), &admin_address);
```

### B. Persistent Storage
* **Use case**: User balances, user accounts, individual asset details.
* **Property**: Independent key-value pairs that do not expire with the contract, but must have their TTL managed independently.

```rust
env.storage().persistent().set(&user_address, &balance);
env.storage().persistent().extend_ttl(&user_address, 1000, 5000);
```

### C. Temporary Storage
* **Use case**: One-time signatures, flash loan locks, temporary state.
* **Property**: Cheap gas fees. Can be deleted by validator nodes once TTL expires without needing manual reclaim.

```rust
env.storage().temporary().set(&nonce, &true);
```

---

## 3. Token Transact & Balance Operations

Soroban contracts call other token contracts (like USDC or native XLM) using the `token::Client` struct.

```rust
use soroban_sdk::{contract, contractimpl, Env, Address, token};

#[contract]
pub struct EscrowContract;

#[contractimpl]
impl EscrowContract {
    pub fn deposit(env: Env, from: Address, token_id: Address, amount: i128) {
        // Enforce signer authorization
        from.require_auth();
        
        let client = token::Client::new(&env, &token_id);
        
        // Transfer funds from user to contract instance address
        client.transfer(&from, &env.current_contract_address(), &amount);
    }
}
```

---

## 4. Soroban Error Handling

Define custom errors using `#[contracterror]` for gas-efficient code returns.

```rust
use soroban_sdk::{contracterror, contractimpl, Env};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    LimitExceeded = 1,
    InsufficientFunds = 2,
}
```
