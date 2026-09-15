export type ChainType =
  | 'stellar'
  | 'ethereum'
  | 'base'
  | 'arbitrum'
  | 'optimism'
  | 'polygon'
  | 'bnb'
  | 'avalanche'
  | 'tron'
  | 'sonic'
  | 'gnosis'
  | 'filecoin'
  | 'berachain'
  | 'celo'
  | 'sei'
  | 'zksync'
  | 'linea'
  | 'scroll'
  | 'blast'
  | 'mantle'
  | 'monad'
  | 'solana'
  | 'sui'
  | 'aptos'
  | 'near'
  | 'cosmos'
  | 'injective'
  | 'polkadot'
  | 'cardano'
  | 'algorand'
  | 'tezos'
  | 'ton'
  | 'starknet';
export type NetworkType = 'pubnet' | 'testnet' | 'mainnet' | 'sepolia';
export type LanguageType =
  | 'Rust (Soroban)'
  | 'Rust (Anchor)'
  | 'Rust (CosmWasm)'
  | 'Rust (Near)'
  | 'Solidity'
  | 'Vyper'
  | 'Cairo (Starknet)'
  | 'Move'
  | 'Aiken (Cardano)'
  | 'PyTeal (Algorand)'
  | 'SmartPy (Tezos)'
  | 'FunC (TON)'
  | 'ink! (Polkadot)';

export interface FunctionArgument {
  name: string;
  type: string;
  description: string;
  optional?: boolean;
}

export interface FunctionError {
  code: string;
  name: string;
  description: string;
}

export interface FunctionStateAccess {
  type: 'read' | 'write' | 'read-write';
  key: string;
  description: string;
}

export interface ContractFunction {
  id: string;
  name: string;
  signature: string;
  visibility: 'public' | 'external' | 'view' | 'pure';
  isStateChanging: boolean;
  requiresAuth: boolean;
  gasEstimate: number; // in gas / CPU instructions
  gasRating: 'A+' | 'A' | 'B' | 'C';
  storageWrites: number;
  storageReads: number;
  eventsEmitted: string[];
  docExcerpt: string;
  fullDocs: string;
  sourceLines: [number, number]; // start and end line in primary file
  sourceSlice: string;
  arguments: FunctionArgument[];
  returns: string;
  errors: FunctionError[];
  stateAccess: FunctionStateAccess[];
  securityNotes: string[];
}

export interface CrossChainDiff {
  targetChain: string;
  targetNetwork: string;
  targetLanguage: string;
  targetSignature: string;
  targetContractName: string;
  sorobanCode: string;
  evmCode: string;
  gasComparison: {
    soroban: string;
    evm: string;
    note: string;
  };
  stateModelDiff: string;
  authModelDiff: string;
}

export interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size?: string;
  lastCommitMessage: string;
  lastCommitTime: string;
  content?: string;
  language?: string;
  children?: FileItem[];
}

export interface CommitHistoryItem {
  hash: string;
  message: string;
  author: string;
  authorAvatar: string;
  timestamp: string;
  contractIdVersion: string;
  changesSummary: string;
  diffSnippet: string;
}

export interface ForkItem {
  id: string;
  contractId: string;
  owner: string;
  name: string;
  chain: ChainType;
  network: NetworkType;
  stars: number;
  forkedAt: string;
  description: string;
  changes: string;
}

export interface DiscussionComment {
  id: string;
  author: string;
  authorAvatar: string;
  role: 'Maintainer' | 'Auditor' | 'Community' | 'Author';
  createdAt: string;
  content: string;
  upvotes: number;
}

export interface DiscussionThread {
  id: string;
  title: string;
  category: 'Q&A' | 'Audit Note' | 'Usage' | 'Optimization';
  author: string;
  authorAvatar: string;
  createdAt: string;
  commentsCount: number;
  comments: DiscussionComment[];
}

export interface SmartContract {
  id: string;
  contractId: string; // e.g. CA3D... or 0x88e6...
  name: string;
  owner: string;
  ownerAvatar: string;
  description: string;
  tagline: string;
  chain: ChainType;
  network: NetworkType;
  language: LanguageType;
  license: string;
  verified: boolean;
  visibility: 'public' | 'private';
  stars: number;
  forksCount: number;
  likes: number;
  updatedAt: string;
  createdAt: string;
  tags: string[];
  wasmSize?: string;
  bytecodeHash: string;
  compilerVersion: string;
  primaryBranch: string;
  branches: string[]; // networks or versions: ['pubnet/v2.1', 'testnet/v2.2-rc']
  readme: string;
  files: FileItem[];
  functions: ContractFunction[];
  crossChainDiffs?: Record<string, CrossChainDiff>;
  history: CommitHistoryItem[];
  forks: ForkItem[];
  discussions: DiscussionThread[];
  callGraph: {
    nodes: Array<{ id: string; label: string; type: 'function' | 'storage' | 'external' }>;
    edges: Array<{ from: string; to: string; label?: string }>;
  };
  relatedContractIds: string[];
}

export interface StudioFile {
  name: string;
  path: string;
  content: string;
  language?: string;
  type?: 'file' | 'dir';
  isModified?: boolean;
}

export interface StudioProject {
  id: string;
  name: string;
  chain: ChainType;
  network: NetworkType;
  contractIdMock?: string;
  files: StudioFile[];
  activeFilePath: string;
  lastSaved: string;
  openTabs?: string[];
  compilerStatus?: string;
  language?: string;
}

export interface InvokeResult {
  status: 'success' | 'failed';
  returnValue: string;
  gasConsumed: number;
  authApproved: string[];
  events: Array<{ topic: string; data: string }>;
  storageDelta: Array<{ key: string; prev: string; next: string }>;
  traceLogs: string[];
}

export interface NotificationItem {
  id: string;
  type: 'fork' | 'like' | 'discussion' | 'audit';
  title: string;
  description: string;
  time: string;
  read: boolean;
  contractId: string;
  link: string;
}

export interface ContractCollection {
  id: string;
  slug?: string;
  title: string;
  description: string;
  curator: string;
  contractsCount: number;
  contractIds: string[];
  tags: string[];
}
