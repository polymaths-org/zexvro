export type UserRole = 'student' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  username: string;
  avatarUrl: string;
  role: UserRole;
  xp: number;
  streakDays: number;
  completedLabsCount: number;
  githubConnected: boolean;
}

export type LabDifficulty = 'Introductory' | 'Intermediate' | 'Advanced';

export type LabCategory =
  | 'Smart Contracts'
  | 'DeFi Protocols'
  | 'NFTs & Digital Assets'
  | 'DAOs & Governance'
  | 'Cross-chain & L2s'
  | 'ZK & Privacy';

export type LabTaskType =
  | 'task'
  | 'heading'
  | 'text'
  | 'code'
  | 'accordion'
  | 'callout'
  | 'image'
  | 'divider'
  | 'quote'
  | 'embed'
  | 'table'
  | 'steps'
  | 'repo'
  | 'redirect';

export type CalloutVariant = 'info' | 'tip' | 'warning' | 'success';

export type TaskFlagType = 'none' | 'checkbox' | 'flag' | 'code' | 'repo';

export interface LabTask {
  id: string;
  type?: LabTaskType; // element type; 'task' is a verifiable checkbox step
  title: string;
  description: string;
  hint?: string;
  language?: string; // for 'code' elements
  verificationCommand?: string;
  expectedOutput?: string;
  isCompleted?: boolean;
  // Task completion style: how a student proves this step.
  // 'checkbox' = just tick it; 'flag' = enter a secret flag / answer; 'code' = run a command / paste output.
  flagType?: TaskFlagType;
  expectedFlag?: string; // the correct answer/flag for 'flag' type
  // Extended element properties
  calloutVariant?: CalloutVariant; // for 'callout' type
  imageUrl?: string; // for 'image' type
  imageCaption?: string;
  embedUrl?: string; // for 'embed' type (YouTube, Loom, etc.)
  tableHeaders?: string[]; // for 'table' type
  tableRows?: string[][]; // for 'table' type
  steps?: Array<{ title: string; description: string }>; // for 'steps' type
  accordionOpen?: boolean; // default open state for 'accordion'
  // 'repo' submission element
  repoHint?: string; // e.g. "git@github.com:you/my-contract"
  // 'redirect' button element
  redirectUrl?: string; // target link opened on click
  buttonColor?: string; // hex background color for the button
}

// A lab page groups content elements + tasks. The page heading is the page title.
export interface LabPage {
  id: string;
  title: string;
  elements: LabTask[];
}

// Progression rules gate how a learner moves through the lab pages.
// Currently supported: unlock the NEXT page once a chosen task is completed.
export type LabRuleType = 'unlock-next-page-on-task';

export interface LabRule {
  id: string;
  type: LabRuleType;
  // The task that must be completed to satisfy this rule.
  sourcePageId: string; // page containing the gating task
  sourceTaskId: string; // the task that must be checked
  // Optional human-friendly label (auto-derived in the editor).
  label?: string;
}

export interface Lab {
  id: string;
  title: string;
  slug: string;
  description: string;
  category: LabCategory;
  difficulty: LabDifficulty;
  durationMinutes: number;
  xpReward: number;
  badgeId?: string;
  badgeName?: string;
  badgeIconUrl?: string;
  isPublished: boolean;
  featured?: boolean;
  tags: string[];
  tasks: LabTask[];
  pages?: LabPage[]; // multi-page content (preferred). When present, runners render pages, else tasks.
  overviewMarkdown: string;
  initialCode?: string;
  initialTerminalCommand?: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  bannerUrl?: string; // 1:1 banner image (square data URL or public URL)
  accessCode?: string; // required access code to enter the lab ('infinite'/'' = no gate)
  password?: string; // alias for accessCode (pin) set from management details
  timeLimitMinutes?: number | null; // null = no time limit (infinite)
  moduleId?: string; // linked module
  status?: 'draft' | 'published' | 'closed';
  completions?: number; // number of completions
  enrolledCount?: number; // number of enrolled learners
  editors?: string[]; // GitHub usernames allowed to edit/manage this lab
  rules?: LabRule[]; // progression rules (e.g. unlock next page after a task)
  credential?: LabCredential; // per-lab badge + certificate design
}

// --- Credential canvas design (per-lab) ---
export interface CredentialElement {
  id: string;
  kind: 'text' | 'icon' | 'logo' | 'qr' | 'shape' | 'line';
  x: number; // % of canvas width
  y: number; // % of canvas height
  size: number; // font size (text) or icon/logo size in px of the 512px canvas
  color: string;
  text?: string;
  bold?: boolean;
  italic?: boolean;
  align: 'left' | 'center' | 'right';
  width?: number; // % of canvas width for text blocks
  shape?: 'rect' | 'circle' | 'hex';
}

export interface LabCredential {
  awardOn?: string;
  badge?: {
    background: string;
    accent: string;
    icon: string; // icon key
    dotgrid?: boolean;
    elements: CredentialElement[];
  };
  certificate?: {
    background: string;
    borderColor: string;
    accent: string;
    logoUrl?: string;
    qrUrl?: string;
    elements: CredentialElement[];
  };
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  category: LabCategory;
  iconName: string; // Lucide icon or custom SVG identifier
  color: string;
  imageUrl?: string; // custom badge image (overrides icon/color)
  earnedAt?: string;
  xpBonus: number;
  awardOn?: string; // 'completion' | 'page:N' — when the badge is granted
}

export interface Certificate {
  id: string;
  certificateNumber: string;
  studentId: string;
  studentName: string;
  labTitle: string;
  category: LabCategory;
  issuedAt: string;
  verificationUrl: string;
  qrCodeUrl?: string;
  instructorName: string;
  design?: NonNullable<LabCredential['certificate']>;
}

export interface UserLabProgress {
  labId: string;
  startedAt: string;
  completedAt?: string;
  currentTaskIndex: number;
  completedTaskIds: string[];
  scorePercent: number;
  terminalLogs: string[];
  codeSnippet?: string;
  isCompleted: boolean;
}

export interface LearningPath {
  id: string;
  title: string;
  description: string;
  category: LabCategory;
  badgeName: string;
  labIds: string[];
  totalLabs: number;
  estimatedHours: number;
  level: LabDifficulty;
}

// --- New types for todo.md §4, §5, §6, §8 ---

export type SubmissionStatus = 'pending' | 'for_review' | 'passed' | 'rejected';

export interface Submission {
  id: string;
  labId: string;
  userId: string;
  userName?: string;
  labTitle?: string;
  status: SubmissionStatus;
  score?: number;
  submittedAt: string;
  reviewedBy?: string;
  reviewNote?: string;
  repoUrl?: string; // repo submission link
  type?: 'repo' | 'lab'; // what was submitted
}

// Live runner progress shared between the lab workbench and its progress sidebar.
export interface LabRunProgress {
  completedTaskIds: string[];
  currentPageId: string | null;
  timeLeftSeconds: number | null;
  startedAt: string;
}

export interface CertificateTemplate {
  id: string;
  name: string;
  template: Record<string, any>;
  fields: string[];
  published: boolean;
}

export interface Module {
  id: string;
  name: string;
  description: string;
  coverImage?: string;
  labIds: string[];
  gate?: { unlockAfter: number };
}
