export type WorkspaceRole = 'Owner' | 'Admin' | 'Developer' | 'Finance' | 'Viewer' | 'Agent';

/** Principal kinds for workspace access (user or service account). */
export type PrincipalType = 'user' | 'serviceAccount';

export type MemberBindingStatus =
  | 'active'
  | 'invited'
  | 'inactive'
  | 'pending'
  | 'accepted'
  | 'expired'
  | 'revoked';

/**
 * Role binding on a workspace.
 * One principal → one primary workspace role in v1.
 */
export interface WorkspaceMember {
  id: string;
  email: string;
  name: string;
  role: WorkspaceRole;
  status: MemberBindingStatus;
  joinedAt: number;
  /** user | serviceAccount — Agent maps to serviceAccount */
  principalType?: PrincipalType;
  /** Cognito username / subject once accepted */
  principalId?: string;
  /** When the role binding was last changed */
  roleBoundAt?: number;
  /** Who last set the role (email or username) */
  roleBoundBy?: string;
  /** Invite id that created this pending binding */
  inviteId?: string;
}

export type InviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

/**
 * Pending workspace invitation — tokenized accept link.
 * Stored on workspace until accepted or revoked; not a full member until accept.
 */
export interface TeamInvite {
  id: string;
  workspaceId: string;
  workspaceName?: string;
  email: string;
  role: WorkspaceRole;
  status: InviteStatus;
  createdAt: number;
  expiresAt: number;
  invitedBy: string;
  invitedByEmail?: string;
  /** Opaque accept token (sent in email link; never log full token in UI after create). */
  token: string;
  acceptedAt?: number;
  acceptedBy?: string;
  revokedAt?: number;
  principalType?: PrincipalType;
  note?: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  plan: string;
  ownerId: string;
  createdAt: number;
  members: WorkspaceMember[];
  /** Pending / historical invitations (IAM invite queue) */
  invitations?: TeamInvite[];
  settings?: {
    billingEmail?: string;
    region?: string;
    defaultNetwork?: string;
    defaultBranch?: string;
    requireInviteApproval?: boolean;
    allowMemberProjectCreation?: boolean;
    auditRetentionDays?: number;
  };
}

export type ProjectLifecycle = 'draft' | 'active' | 'paused' | 'archived';
export type ProjectHealth = 'setup_required' | 'healthy' | 'attention' | 'error';

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  description: string;
  purpose: string;
  lifecycle: ProjectLifecycle;
  health: ProjectHealth;
  createdAt: number;
  updatedAt: number;
  owner: string;
  framework?: string;
  branch?: string;
  network: string;
  enabledServices?: string[];
}

export interface Environment {
  id: string;
  projectId: string;
  workspaceId: string;
  name: string;
  type: 'development' | 'staging' | 'production' | 'testnet' | 'mainnet';
  network: string;
  createdAt: number;
}

export type ServiceInstanceStatus = 'draft' | 'needs_configuration' | 'validating' | 'ready' | 'active' | 'error' | 'disabled';

export interface ServiceInstance {
  id: string;
  projectId: string;
  environmentId: string;
  workspaceId: string;
  serviceId: string;
  name: string;
  status: ServiceInstanceStatus;
  config: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface ServiceDefinition {
  id: string;
  name: string;
  description: string;
  category: 'privacy' | 'transformation' | 'trade' | 'auth' | 'nft' | 'depin';
  status: 'available' | 'beta' | 'coming_soon';
}

export type DeploymentStatus = 'pending' | 'building' | 'deploying' | 'live' | 'failed' | 'cancelled';

export interface Deployment {
  id: string;
  projectId: string;
  environmentId: string;
  workspaceId: string;
  serviceInstanceId: string;
  status: DeploymentStatus;
  commitHash: string;
  commitMessage: string;
  author: string;
  createdAt: number;
  duration: number | null;
}

/* ─── Zer0 Privacy & Payroll Types ─── */

export type Zer0EmployeeStatus = 'active' | 'invited' | 'inactive' | 'terminated';
export type Zer0PaymentType = 'payroll' | 'contractor' | 'bonus' | 'reimbursement' | 'one-time';
export type Zer0PaymentStatus = 'draft' | 'pending_approval' | 'approved' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type Zer0ProofStatus = 'queued' | 'generating' | 'verified' | 'failed';
export type Zer0ProofSystem = 'Groth16' | 'PLONK' | 'Halo2';
export type Zer0Currency = 'USDC' | 'XLM' | 'EURC';
export type Zer0PayFrequency = 'weekly' | 'bi-weekly' | 'monthly' | 'one-time';
/** Contact tag in Wallets directory (payees / team) */
export type Zer0ContactTag = 'employee' | 'contractor' | 'vendor' | 'freelancer' | 'partner' | 'other';

export interface Zer0Employee {
  id: string;
  projectId: string;
  name: string;
  email: string;
  /** @deprecated prefer contactTag — kept for payroll/API compat */
  role: string;
  /** @deprecated optional grouping — free-form notes often used instead */
  department: string;
  walletAddress: string;
  /**
   * Optional Zer0 stealth meta-address (z0st1…).
   * When set + stealth pays enabled, withdrawals go to a fresh one-time G… address
   * derived from this meta — not the long-term walletAddress.
   */
  stealthMetaAddress?: string;
  salary: number;
  currency: Zer0Currency;
  frequency: Zer0PayFrequency;
  status: Zer0EmployeeStatus;
  startDate: number;
  createdAt: number;
  updatedAt: number;
  /** Wallets directory tag (employee / contractor / …) */
  contactTag?: Zer0ContactTag;
  /** Custom label when contactTag === 'other' */
  customTag?: string;
  /** Optional phone / chat / social handle */
  contactInfo?: string;
  /** Free-form notes */
  notes?: string;
}

export interface Zer0Payment {
  id: string;
  projectId: string;
  employeeId: string | null;
  recipientName: string;
  recipientWallet: string;
  amount: number;
  currency: Zer0Currency;
  type: Zer0PaymentType;
  status: Zer0PaymentStatus;
  shielded: boolean;
  memo: string;
  proofId: string | null;
  txHash: string | null;
  lastError: string | null;
  createdAt: number;
  processedAt: number | null;
  approvedBy: string | null;
  /**
   * Payee stealth meta (z0st1…) captured at create time.
   * Used at settle so ad-hoc/custom recipients still get one-time receives
   * even without an employeeId row.
   */
  recipientStealthMeta?: string | null;
  /**
   * Explicit per-payment stealth intent.
   * false = never use stealth for this pay (even if workspace stealth is on / employee has meta).
   * true = try stealth when meta is available.
   * undefined = fall back to workspace settings.stealthPaymentsEnabled (legacy).
   */
  useStealth?: boolean | null;
  /**
   * Optional per-payment privacy knobs (delay / decoys).
   * When set, override workspace settings for this settle only.
   */
  privacyOverrides?: {
    privacyDelaySec?: number;
    privacyJitterSec?: number;
    decoyDepositsEnabled?: boolean;
    decoyDepositCount?: number;
    batchDepositThenWithdraw?: boolean;
    postPayDecoyEnabled?: boolean;
  } | null;
  /** True when this pay used a one-time stealth receive address */
  stealth?: boolean;
  /** On-chain one-time G… destination (if stealth) */
  stealthOneTimeAddress?: string | null;
  /** Ephemeral pubkey published off-chain for recipient scan */
  stealthEphemeralPub?: string | null;
}

export interface Zer0Proof {
  id: string;
  projectId: string;
  paymentId: string;
  proofSystem: Zer0ProofSystem;
  status: Zer0ProofStatus;
  verificationKey: string | null;
  proofData: string | null;
  generationTimeMs: number | null;
  createdAt: number;
  verifiedAt: number | null;
}

export interface Zer0PoolState {
  balances: Record<Zer0Currency, number>;
  totalDeposited: number;
  totalWithdrawn: number;
  totalPaymentsProcessed: number;
  lastUpdated: number;
}

export interface Zer0SecurityEvent {
  id: string;
  type:
    | 'payment_blocked'
    | 'limit_hit'
    | 'approval_required'
    | 'decoy_sent'
    | 'delay_applied'
    | 'payment_completed'
    | 'payment_failed'
    | 'batch_window';
  message: string;
  paymentId?: string;
  createdAt: number;
}

/** Privacy profile for private payroll settles */
export type Zer0PrivacyPreset = 'ultra_fast' | 'fast' | 'balanced' | 'secured' | 'custom';

export interface Zer0Settings {
  proofSystem: Zer0ProofSystem;
  complianceThreshold: number;
  merkleDepth: number;
  requireValidatorSig: boolean;
  paymentApprovalRequired: boolean;
  /** Auto-require approval when amount (XLM units) exceeds complianceThreshold */
  enforceThresholdApproval: boolean;
  paymentWorkflow: 'manual' | 'approval' | 'auto';
  settlementMode: 'stellar' | 'manual_review';
  allowTransparentPayments: boolean;
  exportFormat: 'csv' | 'json';
  proofRetryLimit: number;
  webhookUrl: string;
  defaultCurrency: Zer0Currency;
  timezone: string;
  walletAddress: string;
  horizonUrl: string;
  sorobanRpcUrl: string;
  contractAddress: string;
  obfuscateOrgName: boolean;
  proxyOrgName: string;
  /**
   * Privacy profile. Presets lock delay/decoy/stealth knobs;
   * `custom` unlocks free-form tuning below.
   */
  privacyPreset: Zer0PrivacyPreset;
  /** Min seconds to wait after all deposits before any withdraw (timing privacy) */
  privacyDelaySec: number;
  /** Extra random 0..jitter seconds added to delay */
  privacyJitterSec: number;
  /** Deposit extra unused notes to grow anonymity set */
  decoyDepositsEnabled: boolean;
  decoyDepositCount: number;
  /** Max XLM settled via shielded pays per UTC day (0 = off) */
  dailySpendLimitXlm: number;
  /** Prefer batching: deposit all notes, delay once, then withdraw all */
  batchDepositThenWithdraw: boolean;
  /**
   * How many on-chain pool units (notes) per private payment.
   * On-chain denomination is fixed (e.g. 10 XLM); total = units × denom.
   * Each unit needs ~2 Freighter signatures (bundled deposit + withdraw).
   */
  shieldedUnitsPerPay: number;
  /**
   * When true, always use Freighter popups (debug).
   * When false, use treasury auto-sign if VITE_TREASURY_SECRET is set.
   */
  preferFreighterSigning: boolean;
  /**
   * When true (default), private pays to employees with a stealth meta-address
   * withdraw to a fresh one-time Stellar account instead of their long-term G….
   */
  stealthPaymentsEnabled: boolean;
  /**
   * After private settle, auto-create a small decoy deposit note that is NOT withdrawn
   * (grows anonymity set). Requires browser path / funder — server settle may skip.
   */
  postPayDecoyEnabled: boolean;
}
