pragma circom 2.0.0;

include "./circomlib/circuits/poseidon.circom";

// Merkle proof verification for a binary tree
template MerkleProof(depth) {
    signal input leaf;
    signal input path_elements[depth];
    signal input path_indices[depth];
    signal output root;

    component hashers[depth];
    signal level_hashes[depth + 1];
    signal swap[depth];

    level_hashes[0] <== leaf;

    for (var i = 0; i < depth; i++) {
        // Constrain path_indices is binary (0 or 1)
        path_indices[i] * (1 - path_indices[i]) === 0;

        // swap = path_indices * (sibling - current)
        // If index=0: swap=0, left=current, right=sibling
        // If index=1: swap=(sibling-current), left=sibling, right=current
        swap[i] <== path_indices[i] * (path_elements[i] - level_hashes[i]);

        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== level_hashes[i] + swap[i];
        hashers[i].inputs[1] <== path_elements[i] - swap[i];
        level_hashes[i + 1] <== hashers[i].out;
    }

    root <== level_hashes[depth];
}

// Withdraw circuit: proves knowledge of a deposit secret without revealing it
// Public inputs:  [root, nullifier_hash]
// Private inputs: [secret, nullifier, path_elements[depth], path_indices[depth]]
template Withdraw(depth) {
    signal input root;
    signal input nullifier_hash;

    signal input secret;
    signal input nullifier;
    signal input path_elements[depth];
    signal input path_indices[depth];

    // 1. commitment = Poseidon(secret, nullifier)
    component commitment_hasher = Poseidon(2);
    commitment_hasher.inputs[0] <== secret;
    commitment_hasher.inputs[1] <== nullifier;

    // 2. Verify Merkle inclusion
    component merkle = MerkleProof(depth);
    merkle.leaf <== commitment_hasher.out;
    for (var i = 0; i < depth; i++) {
        merkle.path_elements[i] <== path_elements[i];
        merkle.path_indices[i] <== path_indices[i];
    }

    // Constrain: computed root == public root
    root === merkle.root;

    // 3. nullifier_hash = Poseidon(nullifier)
    component nullifier_hasher = Poseidon(1);
    nullifier_hasher.inputs[0] <== nullifier;

    // Constrain: computed nullifier_hash == public nullifier_hash
    nullifier_hash === nullifier_hasher.out;
}

component main {public [root, nullifier_hash]} = Withdraw(20);
