# Stellar & Soroban Web3 Development Knowledge Base

This document serves as the unified reference guide for Stellar and Soroban development within the ZEXVRO ecosystem. It outlines the core components, transaction flows, storage management, native cryptography host functions, and SDK details.

---

## 1. Core Stellar Architecture & Transaction Flow

The Stellar network is a fast, decentralized, and low-cost ledger for digital assets. 

### Key Concepts:
- **Accounts**: Identified by a public key (Ed25519) starting with `G`, and a secret key starting with `S`. Accounts must be funded with a minimum reserve of native Lumens (XLM) to exist on-chain.
- **Transactions & Operations**: A transaction is a bundle of operations (e.g., payments, managing trustlines, or invoking Soroban contracts) signed by a source account.
- **Trustlines**: In order to hold a non-native asset (e.g., USDC), an account must explicitly create a trustline for that specific asset and issuer.
- **Fees**: Low transaction fees, paid in XLM. The base fee is currently 100 stroops (0.00001 XLM).
- **Horizon API**: The REST gateway server that indexes ledger state and exposes endpoints for checking balances, listening to events, and submitting transactions.

---

## 2. Soroban Smart Contracts (Rust WASM)

Soroban is Stellar's smart contract platform. Soroban contracts are written in Rust and compiled to WebAssembly (WASM).

### Minimal Contract Template:
```rust
#![no_std]
use soroban_sdk::{contract, contractimpl, Env, Symbol, log};

#[contract]
pub struct CounterContract;

#[contractimpl]
impl CounterContract {
    pub fn increment(env: Env, key: Symbol) -> u32 {
        let mut count: u32 = env.storage().instance().get(&key).unwrap_or(0);
        count += 1;
        log!(&env, "Counter incremented: key = {}, count = {}", key, count);
        env.storage().instance().set(&key, &count);
        env.storage().instance().extend_ttl(100, 1000);
        count
    }
}
```

---

## 3. Storage Types and TTL Management

Soroban separates data storage into three types, each with its own pricing, lifecycle, and Time to Live (TTL) parameters. Managing TTL is critical to prevent state expiration.

### A. Instance Storage
- **Use case**: Shared contract metadata, admin address, global settings.
- **Behavior**: Shares the contract instance's lifecycle.
```rust
env.storage().instance().set(&Symbol::new(&env, "admin"), &admin_address);
```

### B. Persistent Storage
- **Use case**: User balances, user profiles, independent asset details.
- **Behavior**: Keys do not expire when the contract is updated, but their TTL must be managed.
```rust
env.storage().persistent().set(&user_address, &balance);
env.storage().persistent().extend_ttl(&user_address, 1000, 5000);
```

### C. Temporary Storage
- **Use case**: Nonces, flash loan locks, short-term states.
- **Behavior**: Automatically purged by validator nodes once TTL expires.
```rust
env.storage().temporary().set(&nonce_key, &true);
```

---

## 4. Cryptographic Host Functions (Protocols 25 & 26)

Stellar introduces native cryptographic host functions in Soroban, allowing cheap verification of zero-knowledge proofs (such as Noir UltraPlonk/UltraHonk) directly from the VM sandbox.

### BN254 Pairings & Hashing:
- **Poseidon2 Hashing**: Optimized SNARK-friendly hashing.
```rust
let hash: BytesN<32> = env.crypto().poseidon2_hash(&inputs);
```
- **BN254 Pairing Checks**: Validates Groth16 or UltraPlonk pairing equation $e(A_1, B_2) \cdot e(C_1, D_2) == 1$ directly.
```rust
let is_valid: bool = env.crypto().bn254_pairing_check(&proof_bytes, &public_inputs);
```

---

## 5. Stellar SDK Integration

### A. JavaScript/TypeScript Stellar SDK
```typescript
import { Server, TransactionBuilder, Networks, Asset, Keypair } from 'stellar-sdk';

const server = new Server('https://horizon-testnet.stellar.org');
const sourceKeys = Keypair.fromSecret('S...');

const tx = new TransactionBuilder(await server.loadAccount(sourceKeys.publicKey()), {
    fee: '100',
    networkPassphrase: Networks.TESTNET
  })
  .addOperation(Operation.payment({
    destination: 'G...',
    asset: Asset.native(),
    amount: '10.0'
  }))
  .setTimeout(30)
  .build();

tx.sign(sourceKeys);
const result = await server.submitTransaction(tx);
```

### B. Python Stellar SDK
```python
from stellar_sdk import Server, Keypair, TransactionBuilder, Network

server = Server("https://horizon-testnet.stellar.org")
kp = Keypair.from_secret("S...")

tx = (
    TransactionBuilder(
        source_account=server.load_account(kp.public_key),
        network_passphrase=Network.TESTNET_NETWORK_PASSPHRASE,
        base_fee=100
    )
    .append_payment_op(destination="G...", amount="10.0", asset_code="XLM")
    .set_timeout(30)
    .build()
)
tx.sign(kp)
response = server.submit_transaction(tx)
```
