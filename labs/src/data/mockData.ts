import { Lab, Badge, Certificate, User, Submission, Module } from '../types';

// Guest baseline — the server returns the real authenticated profile from GitHub.
export const initialUser: User = {
  id: '',
  name: 'Guest',
  email: '',
  username: 'guest',
  avatarUrl: '',
  role: 'student',
  xp: 0,
  streakDays: 0,
  completedLabsCount: 0,
  githubConnected: false,
};

// No dummy badge catalog — the earnable badges come ONLY from the per-lab
// credential designs made in the admin Credential tab. Badges are derived at
// render time from each lab's `credential.badge` (see lib/badges.ts).
export const sampleBadges: Badge[] = [];

export const sampleCertificates: Certificate[] = [];

// Dev-only seed labs (Web3-focused). Production content lives in DynamoDB.
export const sampleLabs: Lab[] = [
  {
    id: 'lab_solidity_101',
    title: 'Solidity Fundamentals: Your First Smart Contract',
    slug: 'solidity-fundamentals-first-contract',
    description: 'Write, compile, and deploy a Solidity smart contract to a local Hardhat testnet. Learn state variables, functions, events, and gas optimization basics.',
    category: 'Smart Contracts',
    difficulty: 'Introductory',
    durationMinutes: 40,
    xpReward: 350,
    badgeId: 'badge_solidity_dev',
    badgeName: 'Solidity Developer',
    badgeIconUrl: 'Code2',
    isPublished: true,
    featured: true,
    tags: ['Solidity', 'Hardhat', 'EVM', 'Smart Contracts', 'Ethereum'],
    author: 'ZEXVRO Labs Team',
    createdAt: '2026-08-01',
    updatedAt: '2026-08-04',
    status: 'published',
    initialCode: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ZexvroGreeter {
    string public greeting;
    address public owner;

    event GreetingChanged(string newGreeting, address changedBy);

    constructor(string memory _greeting) {
        greeting = _greeting;
        owner = msg.sender;
    }

    function setGreeting(string memory _greeting) external {
        greeting = _greeting;
        emit GreetingChanged(_greeting, msg.sender);
    }
}`,
    initialTerminalCommand: 'npx hardhat compile',
    overviewMarkdown: `
# Overview

In this hands-on lab you will write your first Solidity smart contract, compile it with Hardhat, deploy it to a local testnet, and interact with it through the console.

### Learning Objectives:
1. Understand Solidity syntax: state variables, functions, modifiers, events.
2. Compile contracts with \`npx hardhat compile\`.
3. Deploy to a local Hardhat network node.
4. Call contract functions and verify state changes.
`,
    tasks: [
      {
        id: 'task_s1',
        type: 'heading',
        title: 'Getting Started',
        description: 'Set up your development environment and understand the contract structure.',
      },
      {
        id: 'task_s2',
        type: 'task',
        title: 'Task 1: Compile the Solidity contract',
        description: 'Run `npx hardhat compile` to compile the ZexvroGreeter contract and verify there are no errors.',
        hint: 'Type `npx hardhat compile` in the terminal. You should see "Compiled 1 Solidity file successfully".',
        verificationCommand: 'npx hardhat compile',
        expectedOutput: 'Compiled 1 Solidity file successfully',
      },
      {
        id: 'task_s3',
        type: 'task',
        title: 'Task 2: Deploy to local testnet',
        description: 'Start a local Hardhat node and deploy the contract using the deployment script.',
        hint: 'Run `npx hardhat node` in one tab, then `npx hardhat run scripts/deploy.ts --network localhost`.',
        verificationCommand: 'npx hardhat run scripts/deploy.ts',
        expectedOutput: 'Contract deployed to:',
      },
      {
        id: 'task_s4',
        type: 'task',
        title: 'Task 3: Interact with the contract',
        description: 'Call `setGreeting("Hello Web3!")` on the deployed contract and verify the state change by reading the greeting.',
        hint: 'Use the Hardhat console: `npx hardhat console --network localhost` and call `contract.setGreeting("Hello Web3!")`.',
        verificationCommand: 'npx hardhat console',
        expectedOutput: 'Hello Web3!',
      },
    ],
  },
  {
    id: 'lab_defi_amm',
    title: 'Building a DeFi AMM with Uniswap V3 Patterns',
    slug: 'defi-amm-uniswap-v3',
    description: 'Implement a constant product automated market maker (AMM) from scratch, add liquidity pools, and execute token swaps on a Foundry testnet.',
    category: 'DeFi Protocols',
    difficulty: 'Intermediate',
    durationMinutes: 60,
    xpReward: 450,
    badgeId: 'badge_defi_architect',
    badgeName: 'DeFi Architect',
    badgeIconUrl: 'ArrowLeftRight',
    isPublished: true,
    featured: true,
    tags: ['DeFi', 'AMM', 'Uniswap', 'Foundry', 'Liquidity Pools'],
    author: 'ZEXVRO DeFi Guild',
    createdAt: '2026-08-02',
    updatedAt: '2026-08-04',
    status: 'published',
    initialCode: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract SimpleAMM {
    IERC20 public tokenA;
    IERC20 public tokenB;
    uint256 public reserveA;
    uint256 public reserveB;

    constructor(address _tokenA, address _tokenB) {
        tokenA = IERC20(_tokenA);
        tokenB = IERC20(_tokenB);
    }

    function addLiquidity(uint256 amountA, uint256 amountB) external {
        tokenA.transferFrom(msg.sender, address(this), amountA);
        tokenB.transferFrom(msg.sender, address(this), amountB);
        reserveA += amountA;
        reserveB += amountB;
    }

    function swap(address _tokenIn, uint256 _amountIn) external returns (uint256 amountOut) {
        // x * y = k  (constant product formula)
        // Implement swap logic here
    }
}`,
    initialTerminalCommand: 'forge build',
    overviewMarkdown: `
# Overview

Build a decentralized exchange from first principles. You'll implement the constant product formula (x × y = k) that powers Uniswap-style AMMs.

### Prerequisites:
- Basic Solidity knowledge (variables, functions, events).
- Understanding of ERC-20 token standard.

### What you'll build:
- Liquidity pool with add/remove functionality.
- Swap function using constant product formula.
- Price impact calculation and slippage protection.
`,
    tasks: [
      {
        id: 'task_d1',
        type: 'task',
        title: 'Task 1: Build the AMM contracts',
        description: 'Run `forge build` to compile the SimpleAMM contract and its ERC-20 dependencies.',
        hint: 'Type `forge build` in the terminal. All contracts should compile without errors.',
        verificationCommand: 'forge build',
        expectedOutput: 'Compiler run successful',
      },
      {
        id: 'task_d2',
        type: 'task',
        title: 'Task 2: Implement the swap function',
        description: 'Complete the `swap()` function using the constant product formula: amountOut = (reserveOut × amountIn) / (reserveIn + amountIn).',
        hint: 'Calculate the output amount, update reserves, and transfer tokens to the caller.',
        verificationCommand: 'forge test --match-test testSwap',
        expectedOutput: 'PASS',
      },
      {
        id: 'task_d3',
        type: 'task',
        title: 'Task 3: Run the full test suite',
        description: 'Execute `forge test -vvv` to run all AMM tests including liquidity and swap scenarios.',
        hint: 'Type `forge test -vvv` to see detailed test output with traces.',
        verificationCommand: 'forge test',
        expectedOutput: 'Test result: ok',
      },
    ],
  },
  {
    id: 'lab_nft_721',
    title: 'Minting & Managing ERC-721 NFT Collections',
    slug: 'nft-erc721-collections',
    description: 'Create an ERC-721 NFT contract with on-chain metadata, mint functions, royalty support (EIP-2981), and list on a testnet marketplace.',
    category: 'NFTs & Digital Assets',
    difficulty: 'Intermediate',
    durationMinutes: 50,
    xpReward: 400,
    badgeId: 'badge_nft_creator',
    badgeName: 'NFT Creator',
    badgeIconUrl: 'Palette',
    isPublished: true,
    featured: true,
    tags: ['NFT', 'ERC-721', 'IPFS', 'Metadata', 'OpenSea'],
    author: 'ZEXVRO Labs Team',
    createdAt: '2026-08-03',
    updatedAt: '2026-08-04',
    status: 'published',
    initialCode: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ZexvroNFT is ERC721, ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;
    uint256 public constant MAX_SUPPLY = 10000;
    uint256 public mintPrice = 0.01 ether;

    constructor() ERC721("ZEXVRO Collection", "ZXNFT") Ownable(msg.sender) {}

    function mint(string memory uri) external payable {
        require(msg.value >= mintPrice, "Insufficient payment");
        require(_nextTokenId < MAX_SUPPLY, "Max supply reached");
        uint256 tokenId = _nextTokenId++;
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, uri);
    }
}`,
    initialTerminalCommand: 'npx hardhat compile',
    overviewMarkdown: `
# Overview

Build a production-grade NFT collection contract. You'll implement minting, metadata management, royalties, and learn how to list your NFTs on testnet marketplaces.

### Prerequisites:
- Solidity basics (state variables, functions).
- Understanding of the ERC-721 standard.
`,
    tasks: [
      {
        id: 'task_n1',
        type: 'task',
        title: 'Task 1: Compile the NFT contract',
        description: 'Run `npx hardhat compile` to build the ZexvroNFT contract with OpenZeppelin dependencies.',
        hint: 'Type `npx hardhat compile` and verify successful compilation.',
        verificationCommand: 'npx hardhat compile',
        expectedOutput: 'Compiled',
      },
      {
        id: 'task_n2',
        type: 'task',
        title: 'Task 2: Deploy and mint your first NFT',
        description: 'Deploy the contract to a local network and mint an NFT with a metadata URI pointing to IPFS.',
        hint: 'Use `npx hardhat run scripts/deploy.ts` then call `contract.mint(metadataUri, { value: ethers.parseEther("0.01") })`.',
        verificationCommand: 'npx hardhat run',
        expectedOutput: 'NFT minted',
      },
      {
        id: 'task_n3',
        type: 'task',
        title: 'Task 3: Verify ownership and metadata',
        description: 'Call `ownerOf(0)` and `tokenURI(0)` to confirm the NFT belongs to you and points to valid metadata.',
        hint: 'Use the Hardhat console to query the contract.',
        verificationCommand: 'ownerOf',
        expectedOutput: 'tokenURI',
      },
    ],
  },
  {
    id: 'lab_zk_circuits',
    title: 'ZK-SNARK Circuits with Circom & SnarkJS',
    slug: 'zk-snark-circom-snarkjs',
    description: 'Build a zero-knowledge proof circuit using Circom, generate a trusted setup, create proofs, and verify them on-chain with a Solidity verifier contract.',
    category: 'ZK & Privacy',
    difficulty: 'Advanced',
    durationMinutes: 75,
    xpReward: 550,
    badgeId: 'badge_zk_engineer',
    badgeName: 'ZK Engineer',
    badgeIconUrl: 'ShieldCheck',
    isPublished: true,
    featured: false,
    tags: ['ZK-SNARK', 'Circom', 'SnarkJS', 'Zero Knowledge', 'Privacy'],
    author: 'ZEXVRO ZK Research',
    createdAt: '2026-08-04',
    updatedAt: '2026-08-04',
    status: 'published',
    initialCode: `// circuit.circom — Simple age verification circuit
pragma circom 2.1.6;

template AgeCheck() {
    signal input age;
    signal input threshold;
    signal output isOldEnough;

    // Compute: is age >= threshold?
    component greaterEq = GreaterEqThan(8);
    greaterEq.in[0] <== age;
    greaterEq.in[1] <== threshold;
    isOldEnough <== greaterEq.out;
}

component main {public [threshold]} = AgeCheck();`,
    initialTerminalCommand: 'circom circuit.circom --r1cs --wasm --sym',
    overviewMarkdown: `
# Overview

Zero-knowledge proofs let you prove a statement is true without revealing the underlying data. In this lab you'll build a ZK circuit that proves age eligibility without revealing the actual age.

### Prerequisites:
- Basic understanding of cryptographic proofs.
- Node.js installed for SnarkJS.

### What you'll learn:
- Circom circuit syntax and constraints.
- Trusted setup ceremony (Powers of Tau).
- Proof generation and on-chain verification.
`,
    tasks: [
      {
        id: 'task_z1',
        type: 'task',
        title: 'Task 1: Compile the Circom circuit',
        description: 'Run `circom circuit.circom --r1cs --wasm --sym` to compile the circuit and generate the constraint system.',
        hint: 'Type the circom compile command. You should see R1CS, WASM, and SYM files generated.',
        verificationCommand: 'circom circuit.circom',
        expectedOutput: 'Written successfully',
      },
      {
        id: 'task_z2',
        type: 'task',
        title: 'Task 2: Generate the trusted setup',
        description: 'Run the Powers of Tau ceremony and generate the proving/verification keys using SnarkJS.',
        hint: 'Run `snarkjs groth16 setup circuit.r1cs pot_final.ptau circuit_final.zkey`.',
        verificationCommand: 'snarkjs groth16 setup',
        expectedOutput: 'zkey file generated',
      },
      {
        id: 'task_z3',
        type: 'task',
        title: 'Task 3: Generate and verify a proof',
        description: 'Create a proof for age=25, threshold=18 and verify it passes the on-chain verifier contract.',
        hint: 'Run `snarkjs groth16 prove` then `snarkjs groth16 verify`.',
        verificationCommand: 'snarkjs groth16 verify',
        expectedOutput: 'OK',
      },
    ],
  },
];

// Sample modules for the module editor (§6)
export const sampleModules: Module[] = [
  {
    id: 'mod_solidity_basics',
    name: 'Solidity & Smart Contract Basics',
    description: 'Learn the fundamentals of Solidity programming and smart contract development on Ethereum.',
    labIds: ['lab_solidity_101', 'lab_nft_721'],
    gate: { unlockAfter: 0 },
  },
  {
    id: 'mod_defi',
    name: 'DeFi Protocol Development',
    description: 'Build decentralized finance applications from AMMs to lending protocols.',
    labIds: ['lab_defi_amm'],
    gate: { unlockAfter: 1 },
  },
];

// No dummy submissions — real submissions come from the backend and from lab
// completions. Dummy rows would show fake users (Alice Nakamoto, ...) in the
// admin roster, so we start empty.
export const sampleSubmissions: Submission[] = [];