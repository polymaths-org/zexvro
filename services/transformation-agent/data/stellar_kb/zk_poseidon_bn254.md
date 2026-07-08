# Stellar Protocol 25 & 26 Cryptographic Host Functions Reference

Protocol 25 and 26 introduce native cryptographic **Host Functions** to the Stellar Soroban Sandboxed VM. This document details BN254 (alt_bn128) pairing checks, Poseidon2 hashing, and Noir zero-knowledge verifier execution.

---

## 1. Hashing with Poseidon2

Poseidon2 is a SNARK-friendly hashing algorithm designed for minimal gas consumption in arithmetic circuits. In Soroban, you can perform Poseidon2 hashes directly using the native cryptography host functions without compiling the hash code to WASM.

```rust
#![no_std]
use soroban_sdk::{contract, contractimpl, Env, Bytes, BytesN};

#[contract]
pub struct ZkHasher;

#[contractimpl]
impl ZkHasher {
    /// Compute a Poseidon2 hash of inputs.
    pub fn hash_inputs(env: Env, input_data: Bytes) -> BytesN<32> {
        // Invoke native host function for poseidon2 hashing
        let hash = env.crypto().poseidon2_hash(&input_data);
        hash
    }
}
```

---

## 2. Elliptic Curve operations on BN254 (alt_bn128)

To verify zero-knowledge proofs (such as Groth16, Plonk, or UltraHonk), smart contracts must perform operations on the BN254 elliptic curve, including:
* **G1 Addition**: Add two G1 points.
* **G1 Scalar Multiplication**: Multiply a G1 point by a scalar.
* **Pairing Check**: Evaluate pairing equality $e(A_1, B_2) \cdot e(C_1, D_2) == 1$.

In Soroban, these are exposed via `env.crypto().bn254_verify()` or direct host pairing operations.

```rust
use soroban_sdk::{contract, contractimpl, Env, Bytes};

#[contract]
pub struct ZkProofVerifier;

#[contractimpl]
impl ZkProofVerifier {
    /// Verify a Groth16 proof using native BN254 pairings
    pub fn verify_groth16_proof(
        env: Env,
        proof: Bytes,         // Flattened G1/G2 coordinates
        public_inputs: Bytes // Public values to match against proof
    ) -> bool {
        // Enforce native pairing verification on-chain
        let result: bool = env.crypto().bn254_pairing_check(&proof, &public_inputs);
        result
    }
}
```

---

## 3. Noir ZK Circuit & Verifier Contract Integration

Noir is a domain-specific language for writing zero-knowledge circuits. It compiles proofs into UltraPlonk/UltraHonk representations, which are verified on-chain.

### Noir Circuit Example (`main.nr`)
```rust
fn main(x: Field, y: pub Field) {
    // Assert that x is the secret hash preimage of y
    let computed_hash = std::hash::poseidon::hash_1([x]);
    assert(computed_hash == y);
}
```

### Soroban Verifier Contract Structure
When compiling Noir circuits, you export a Solidity or Rust verifier. A typical Soroban Rust verifier wraps the proof bytes and queries the native pairing host functions:

```rust
#[contract]
pub struct NoirVerifier;

#[contractimpl]
impl NoirVerifier {
    pub fn verify(env: Env, proof_bytes: Bytes, public_inputs: Bytes) -> bool {
        // Use native host pairings to run the UltraPlonk verification loop
        env.crypto().bn254_pairing_check(&proof_bytes, &public_inputs)
    }
}
```
