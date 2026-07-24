import { useState } from 'react';
import {
  BookOpen, Terminal, Shield, Cpu, RefreshCw, Layers, ArrowLeft, Search,
  ChevronRight, Users, Wallet, Code, Settings, FileText, Key, Copy, Check, RadioTower
} from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { copyText } from '../../lib/clipboard';

type DocSection = {
  id: string;
  title: string;
  category: string;
  icon: any;
  content: React.ReactNode;
};

function CodeBlock({ code, lang = 'bash' }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative group rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-950 overflow-hidden my-3">
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-zinc-800">
        <span className="text-[9px] font-mono text-zinc-500 uppercase">{lang}</span>
        <button
          onClick={async () => {
            const ok = await copyText(code);
            if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1500); }
            else window.prompt('Copy this value:', code);
          }}
          className="text-zinc-500 hover:text-zinc-300 transition"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
        </button>
      </div>
      <pre className="p-3 text-[11px] font-mono text-zinc-300 leading-relaxed overflow-x-auto whitespace-pre">{code}</pre>
    </div>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-bold text-zinc-900 dark:text-white mt-6 mb-2">{children}</h3>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-zinc-600 dark:text-zinc-400 text-xs leading-relaxed mb-3">{children}</p>;
}

function Callout({ type = 'info', children }: { type?: 'info' | 'warning' | 'tip'; children: React.ReactNode }) {
  const styles = {
    info: 'border-blue-300 bg-blue-50/50 dark:border-blue-800/40 dark:bg-blue-950/10 text-blue-800 dark:text-blue-300',
    warning: 'border-amber-300 bg-amber-50/50 dark:border-amber-800/40 dark:bg-amber-950/10 text-amber-800 dark:text-amber-300',
    tip: 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-800/40 dark:bg-emerald-950/10 text-emerald-800 dark:text-emerald-300',
  };
  return <div className={`rounded-lg border p-3 text-xs leading-relaxed mb-4 ${styles[type]}`}>{children}</div>;
}

const DOCS: DocSection[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    category: 'Introduction',
    icon: Terminal,
    content: (
      <div>
        <P>ZEXVRO is an enterprise-grade privacy-first payroll and treasury platform built on the Stellar network. It combines zero-knowledge proofs with traditional payroll workflows to enable private, compliant disbursements.</P>
        <H3>Quick Start</H3>
        <ol className="list-decimal pl-5 text-xs text-zinc-600 dark:text-zinc-400 space-y-2 mb-4">
          <li><strong>Create a Workspace</strong> — Your workspace is your organization's home. All projects, team members, and billing live here.</li>
          <li><strong>Create a Project</strong> — Each project can have different services enabled. Enable the "Privacy Pool" service to access Zer0.</li>
          <li><strong>Fund Your Pool</strong> — Navigate to Zer0 → Dashboard → Fund Pool. Deposit USDC, XLM, or EURC.</li>
          <li><strong>Add Employees</strong> — Go to Zer0 → People → Add Employee. Set their salary, wallet address, and pay frequency.</li>
          <li><strong>Run Payroll</strong> — Use "Pay a Party" to send payments. Toggle shielded mode for ZK-protected transfers.</li>
        </ol>
        <Callout type="tip">You can access the Zer0 suite from any project that has the Privacy Pool service enabled. Look for it in the project sidebar.</Callout>
        <H3>Platform Architecture</H3>
        <CodeBlock lang="text" code={`┌─────────────────────────────────────────────┐
│                  ZEXVRO UI                   │
│  (React + TanStack Router + Zustand)         │
├─────────────┬─────────────┬─────────────────┤
│  Zer0 Suite │  Agent Ops  │  Transform      │
│  - Payroll  │  - Studio   │  - AST Engine   │
│  - ZKPP     │  - Memory   │  - Diff Gen     │
│  - Proofs   │  - Chat     │                 │
├─────────────┴─────────────┴─────────────────┤
│              AWS Lambda Backend              │
│  (Python · DynamoDB · Cognito Auth)          │
├──────────────────────────────────────────────┤
│           Stellar Network (Soroban)          │
│  - Privacy Pool Contract (ZKPP)              │
│  - USDC/XLM/EURC Asset Layer                 │
│  - Stealth Address Resolution                │
└──────────────────────────────────────────────┘`} />
      </div>
    ),
  },
  {
    id: 'payroll',
    title: 'Payroll & Pay a Party',
    category: 'Zer0 Suite',
    icon: Users,
    content: (
      <div>
        <P>The Zer0 payroll system is designed for enterprises that need compliant, private disbursements. It works like traditional payroll software (Gusto, Deel) but with optional privacy features powered by zero-knowledge proofs.</P>
        <H3>Employee Management</H3>
        <P>Navigate to <strong>Zer0 → People</strong> to manage your roster. Each employee record includes:</P>
        <ul className="list-disc pl-5 text-xs text-zinc-600 dark:text-zinc-400 space-y-1 mb-4">
          <li><strong>Name & Email</strong> — Contact information</li>
          <li><strong>Department & Role</strong> — Organizational structure</li>
          <li><strong>Wallet Address</strong> — Stellar public key (G...) for receiving payments</li>
          <li><strong>Salary & Frequency</strong> — Amount and pay schedule (weekly, bi-weekly, monthly)</li>
        </ul>
        <H3>Payment Types</H3>
        <div className="grid gap-2 mb-4">
          {[
            { type: 'Payroll', desc: 'Regular salary disbursement for salaried employees' },
            { type: 'Contractor', desc: 'Invoice-based payment for independent contractors' },
            { type: 'Bonus', desc: 'One-time performance or holiday bonus' },
            { type: 'Reimbursement', desc: 'Expense reimbursement for approved costs' },
            { type: 'One-Time', desc: 'Ad-hoc transfer to any Stellar wallet' },
          ].map(p => (
            <div key={p.type} className="flex gap-2 text-xs p-2 rounded border border-zinc-100 dark:border-zinc-800">
              <span className="font-bold text-zinc-800 dark:text-zinc-200 w-28 shrink-0">{p.type}</span>
              <span className="text-zinc-500">{p.desc}</span>
            </div>
          ))}
        </div>
        <H3>Payment Flow</H3>
        <CodeBlock lang="text" code={`Create Payment → Review Details → Confirm
                                       ↓
              ┌────────────────────────────────────┐
              │  Shielded?                         │
              │  YES → Generate ZK Proof → Verify  │
              │  NO  → Submit Transparent TX       │
              └───────────────┬────────────────────┘
                              ↓
                    Deduct from Pool
                              ↓
                    Record TX Hash
                              ↓
                    Payment Complete ✓`} />
        <Callout type="warning">Ensure your pool has sufficient funds before processing payments. The system will reject payments that exceed the pool balance.</Callout>
      </div>
    ),
  },
  {
    id: 'privacy-pool',
    title: 'Privacy Pool (ZKPP)',
    category: 'Zer0 Suite',
    icon: Shield,
    content: (
      <div>
        <P>The Zero-Knowledge Privacy Pool (ZKPP) enables fully private disbursements where the amount and recipient are hidden from public block explorers while remaining auditable by authorized parties.</P>
        <H3>How It Works</H3>
        <P>When a shielded payment is created, the system generates a zero-knowledge proof that validates the transaction without revealing its contents:</P>
        <CodeBlock lang="text" code={`// Proof Generation Pipeline
1. Compute leaf = Hash(recipient, amount, nonce)
2. Insert leaf into Merkle tree at next index
3. Generate SNARK proof:
   Prove(circuit, {
     private: { recipient, amount, nonce, merkle_path },
     public:  { merkle_root, nullifier_hash }
   })
4. Submit proof + public inputs to Soroban contract
5. Contract verifies: VerifyProof(VK, proof, public_inputs)
6. On success: execute stealth transfer`} />
        <H3>Supported Proof Systems</H3>
        <div className="space-y-2 mb-4">
          {[
            { name: 'Groth16', pros: 'Fastest verification (~130 byte proofs, ~10ms verify)', cons: 'Requires trusted setup ceremony' },
            { name: 'PLONK', pros: 'Universal setup, reusable across circuits', cons: 'Slightly larger proofs (~2KB)' },
            { name: 'Halo2', pros: 'No trusted setup, recursive proofs', cons: 'Slowest prover time' },
          ].map(s => (
            <div key={s.name} className="p-3 rounded-lg border border-zinc-100 dark:border-zinc-800 text-xs">
              <span className="font-bold text-zinc-900 dark:text-white block">{s.name}</span>
              <span className="text-emerald-600 dark:text-emerald-400">✓ {s.pros}</span>
              <span className="text-amber-600 dark:text-amber-400 block">⚠ {s.cons}</span>
            </div>
          ))}
        </div>
        <H3>Compliance & Audit</H3>
        <P>Zer0 implements a <strong>Dual-Key Audit</strong> pattern. Each organization has a symmetric <strong>View Key</strong> that can be shared with authorized auditors (accounting teams, regulators) to decrypt transaction details without exposing them publicly.</P>
        <Callout type="info">View Key holders can see: recipient address, amount, timestamp. They CANNOT modify or cancel transactions.</Callout>
      </div>
    ),
  },
  {
    id: 'api-reference',
    title: 'API Reference',
    category: 'Developer',
    icon: Code,
    content: (
      <div>
        <P>The ZEXVRO backend exposes RESTful API endpoints via AWS Lambda. All requests require a Bearer token obtained from Cognito authentication.</P>
        <H3>Authentication</H3>
        <CodeBlock lang="http" code={`POST /api/auth/login
Content-Type: application/json

{
  "username": "user@example.com",
  "password": "••••••••"
}

→ 200 OK
{
  "token": "eyJ...",
  "expires_in": 3600,
  "user": { "id": "...", "email": "..." }
}`} />
        <H3>Zer0 Endpoints</H3>
        <div className="space-y-1 mb-4 text-xs font-mono">
          {[
            { method: 'GET', path: '/api/zer0/employees', desc: 'List all employees' },
            { method: 'POST', path: '/api/zer0/employees', desc: 'Create employee' },
            { method: 'PUT', path: '/api/zer0/employees/:id', desc: 'Update employee' },
            { method: 'DELETE', path: '/api/zer0/employees/:id', desc: 'Deactivate employee' },
            { method: 'GET', path: '/api/zer0/payments', desc: 'List payments' },
            { method: 'POST', path: '/api/zer0/payments', desc: 'Create payment' },
            { method: 'POST', path: '/api/zer0/payments/:id/process', desc: 'Process payment' },
            { method: 'GET', path: '/api/zer0/proofs', desc: 'List proofs' },
            { method: 'POST', path: '/api/zer0/proofs/:id/verify', desc: 'Re-verify proof' },
            { method: 'GET', path: '/api/zer0/pool', desc: 'Get pool state' },
            { method: 'POST', path: '/api/zer0/pool/deposit', desc: 'Deposit to pool' },
          ].map(ep => (
            <div key={ep.path + ep.method} className="flex items-center gap-2 p-2 rounded border border-zinc-100 dark:border-zinc-800">
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${ep.method === 'GET' ? 'bg-emerald-500/10 text-emerald-600' : ep.method === 'POST' ? 'bg-blue-500/10 text-blue-600' : ep.method === 'PUT' ? 'bg-amber-500/10 text-amber-600' : 'bg-red-500/10 text-red-500'}`}>
                {ep.method}
              </span>
              <span className="text-zinc-800 dark:text-zinc-200 flex-1">{ep.path}</span>
              <span className="text-zinc-400 text-[10px] font-sans">{ep.desc}</span>
            </div>
          ))}
        </div>
        <Callout type="info">All endpoints are rate-limited to 100 requests/minute per token. Bulk operations should use batch endpoints when available.</Callout>
      </div>
    ),
  },
  {
    id: 'wallet-setup',
    title: 'Wallet & Network Setup',
    category: 'Configuration',
    icon: Wallet,
    content: (
      <div>
        <P>Zer0 requires a Stellar network connection to process payments. You can configure the network settings in <strong>Zer0 → Settings → Wallet & Network</strong>.</P>
        <H3>Required Credentials</H3>
        <div className="space-y-3 mb-4">
          {[
            { label: 'Stellar Horizon URL', desc: 'The Horizon API server for your network', example: 'https://horizon-testnet.stellar.org' },
            { label: 'Pool Wallet Address', desc: 'Your organization\'s Stellar public key', example: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXX' },
            { label: 'Soroban RPC URL', desc: 'Required for ZKPP smart contract interactions', example: 'https://soroban-testnet.stellar.org:443' },
            { label: 'Contract Address', desc: 'The deployed ZKPP contract on Soroban', example: 'CDXXXXXXXXXXXXXXXXXXXXXXXX' },
          ].map(c => (
            <div key={c.label} className="p-3 rounded-lg border border-zinc-100 dark:border-zinc-800 text-xs">
              <span className="font-bold text-zinc-900 dark:text-white block">{c.label}</span>
              <span className="text-zinc-500 block">{c.desc}</span>
              <code className="text-[10px] text-blue-500 block mt-1">{c.example}</code>
            </div>
          ))}
        </div>
        <H3>Testnet vs Mainnet</H3>
        <P>For development and testing, use the Stellar testnet. You can fund testnet accounts using the <a href="https://laboratory.stellar.org/#account-creator?network=test" className="text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer">Stellar Laboratory</a>. Switch to mainnet only when you're ready for production use.</P>
        <Callout type="warning">Never commit secret keys to version control. Use environment variables or a secrets manager for sensitive credentials.</Callout>
      </div>
    ),
  },
  {
    id: 'rbac',
    title: 'Roles & Permissions',
    category: 'Configuration',
    icon: Key,
    content: (
      <div>
        <P>ZEXVRO uses Role-Based Access Control (RBAC) to manage team permissions. Each workspace member is assigned a role that determines what actions they can perform.</P>
        <H3>Role Hierarchy</H3>
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="text-left py-2 px-3 text-zinc-500 font-semibold">Role</th>
                <th className="text-center py-2 px-3 text-zinc-500 font-semibold">View</th>
                <th className="text-center py-2 px-3 text-zinc-500 font-semibold">Add Employee</th>
                <th className="text-center py-2 px-3 text-zinc-500 font-semibold">Send Payment</th>
                <th className="text-center py-2 px-3 text-zinc-500 font-semibold">Settings</th>
                <th className="text-center py-2 px-3 text-zinc-500 font-semibold">Manage Team</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {[
                { role: 'Owner', perms: [true, true, true, true, true] },
                { role: 'Admin', perms: [true, true, true, true, true] },
                { role: 'Finance', perms: [true, true, true, false, false] },
                { role: 'Developer', perms: [true, false, false, false, false] },
                { role: 'Viewer', perms: [true, false, false, false, false] },
                { role: 'Agent', perms: [true, false, false, false, false] },
              ].map(r => (
                <tr key={r.role}>
                  <td className="py-2 px-3 font-semibold text-zinc-800 dark:text-zinc-200">{r.role}</td>
                  {r.perms.map((p, i) => (
                    <td key={i} className="py-2 px-3 text-center">{p ? '✅' : '—'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Callout type="tip">The Finance role is specifically designed for payroll administrators who need to manage employees and process payments without access to infrastructure settings.</Callout>
      </div>
    ),
  },
  {
    id: 'agent-ops',
    title: 'Agent Operations',
    category: 'AI & Automation',
    icon: Cpu,
    content: (
      <div>
        <P>ZEXVRO Agent Operations enable AI-powered automation for common tasks. The Morph agent runs in the background, processing requests through natural language commands.</P>
        <H3>Available Agents</H3>
        <ul className="list-disc pl-5 text-xs text-zinc-600 dark:text-zinc-400 space-y-2 mb-4">
          <li><strong>Morph Chat Agent</strong> — Conversational interface for project management, code generation, and system queries.</li>
          <li><strong>Transformation Agent</strong> — AST-based code refactoring engine for automated syntax upgrades.</li>
          <li><strong>Trade Pipeline</strong> — Automated A2A asset swap negotiation with slippage protection.</li>
          <li><strong>Agent Auth</strong> — Identity verification and access token management for inter-agent communication.</li>
        </ul>
        <H3>Agent Memory</H3>
        <P>Each project has a shared memory store where agents persist conversation context, user preferences, and learned patterns. Memory entries can be viewed, edited, or deleted from the Memory screen.</P>
      </div>
    ),
  },
  {
    id: 'nft-service',
    title: 'NFT Collections',
    category: 'Services',
    icon: Layers,
    content: (
      <div>
        <P>
          The NFT Service deploys creator-owned Soroban collection contracts on Stellar testnet.
          Use it for game items, drops, and primary sales with a fixed XLM price.
        </P>
        <H3>What is a collection?</H3>
        <P>
          A collection is one Soroban NFT contract you own. It holds shared metadata (name, logo, description)
          and can mint many token IDs under the same rules.
        </P>
        <H3>What is minting?</H3>
        <P>
          Minting creates a new token ID and assigns ownership on-chain. Creator mint (Mint tab) is free for the
          collection owner wallet. Buyers can also mint via public checkout after primary sale is active.
        </P>
        <H3>What is primary sale?</H3>
        <P>
          Primary sale sets a fixed XLM price on the contract. When live, “Prepare purchase” on the public page
          builds a buyer transaction that pays you and mints the next available token.
        </P>
        <H3>Public page vs dashboard</H3>
        <P>
          The public page is for buyers/players (no login). The collection dashboard is for you: pricing, minting,
          ledger/analytics, SDK snippets, and archive/delete of the API record.
        </P>
        <H3>Integrate into a game</H3>
        <P>
          Use Integrate / SDK panel for popup checkout, branding API, and embed URLs. Pass <code>collectionId</code> from
          your game and listen for postMessage success events after purchase.
        </P>
        <H3>Delete vs archive</H3>
        <P>
          Archive hides the collection from active lists but keeps data. Delete removes the ZEXVRO API record only —
          live Stellar contracts cannot be erased from this UI. Prefer archive for live collections.
        </P>
        <H3>Ledger &amp; analytics</H3>
        <P>
          Ledger lists every recorded mint/purchase with token id, owner, and explorer link. Charts estimate volume and
          revenue from primary-sale unit price × items.
        </P>
        <Callout type="tip">
          Open a project → NFT Collections → create a collection → open its dashboard for Sale, Mint, Ledger, and Integrate.
        </Callout>
      </div>
    ),
  },
  {
    id: 'access-shield',
    title: 'Access Shield (De-pin x402)',
    category: 'Services',
    icon: RadioTower,
    content: (
      <div>
        <P>
          Access Shield is ZEXVRO&apos;s economic edge for HTTP APIs and agent tool-loops.
          The shipping enforcement plane is <strong>De-pin</strong>: an x402 reverse proxy that requires
          exact Stellar testnet USDC per request before origin traffic is released.
        </P>
        <Callout type="info">
          Status: gateway MVP is live (GET/HEAD, exact scheme, probe + paid settle path). Full multi-tenant
          control-plane CRUD is not shipped — routes are configured at gateway boot via JSON.
        </Callout>

        <H3>What problem does it solve?</H3>
        <P>
          Free-tier farming, shared cookies, and unlimited agent loops abuse flat API keys and daily quotas.
          Access Shield makes each call have a price so resale and spam become uneconomic, while legitimate
          paid/agent access stays attributable via payment receipts.
        </P>

        <H3>What is a protected route?</H3>
        <P>
          A provider entry maps a gateway path (e.g. <code>GET /v1/weather</code>) to an upstream URL, a USD price,
          and a Stellar <strong>G-address</strong> recipient. Unpaid clients never see the origin response.
        </P>

        <H3>Unpaid 402 vs paid settle</H3>
        <P>
          Without payment the gateway returns HTTP 402 and a base64 <code>PAYMENT-REQUIRED</code> header.
          With a valid <code>PAYMENT-SIGNATURE</code>, the gateway verifies with a facilitator, claims a replay
          fingerprint, calls upstream once, settles, then releases the body + <code>PAYMENT-RESPONSE</code>.
          Failures withhold the resource (fail closed).
        </P>
        <CodeBlock lang="text" code={`Client → GET /v1/resource
       ← 402 + PAYMENT-REQUIRED

Client → GET /v1/resource + PAYMENT-SIGNATURE
       → facilitator verify
       → upstream (once, buffered)
       → facilitator settle
       ← 200 + body + PAYMENT-RESPONSE`} />

        <H3>Dashboard: Protect, Probe, Integrate</H3>
        <ul className="list-disc pl-5 text-xs text-zinc-600 dark:text-zinc-400 space-y-1 mb-4">
          <li><strong>Overview</strong> — how Access Shield works + live readiness (Gateway / Scheme / Settle / State).</li>
          <li><strong>Routes</strong> — live providers from <code>/status</code>; Probe 402 without spending USDC.</li>
          <li><strong>Protect route</strong> — wizard builds provider JSON + full <code>depin.config.json</code> (copy/download). Apply offline and restart the gateway.</li>
          <li><strong>Integrate</strong> — curl, paid demo client, config, and env snippets (same product pattern as NFT SDK).</li>
        </ul>

        <H3>Config sources (boot only)</H3>
        <P>Priority: <code>DEPIN_CONFIG_JSON</code> → <code>DEPIN_CONFIG_URL</code> → <code>DEPIN_CONFIG_PATH</code> / local file.</P>
        <CodeBlock lang="json" code={`{
  "port": 4102,
  "facilitatorUrl": "https://x402.org/facilitator",
  "providers": [{
    "route": "/v1/weather",
    "method": "GET",
    "upstreamUrl": "https://httpbin.org/get",
    "description": "Sample paid probe",
    "price": "$0.001",
    "recipient": "G...PROVIDER_WITH_USDC_TRUSTLINE",
    "network": "stellar:testnet",
    "timeoutMs": 5000
  }]
}`} />

        <H3>Facilitator &amp; OZ_API_KEY</H3>
        <P>
          Local unpaid probes can use the public x402 facilitator. Real Stellar settle often uses
          OpenZeppelin Channels (<code>https://channels.openzeppelin.com/x402/testnet</code>) with process env
          <code>OZ_API_KEY</code> (Bearer). That key authenticates the payment facilitator — it is not a model API key.
        </P>
        <Callout type="warning">
          <code>payTo</code> / recipient must be a classic G-address with a USDC trustline. Never put the USDC SAC C-address in recipient.
        </Callout>

        <H3>State backend</H3>
        <P>
          Replay and unpaid rate-limit state: prefer <code>DEPIN_STATE_BACKEND=file</code> for production single-instance.
          <code>memory</code> is not multi-instance safe. Shared multi-ok needs a shared volume + <code>DEPIN_SHARED_STATE=1</code>.
        </P>

        <H3>Local smoke</H3>
        <CodeBlock lang="bash" code={`# Root
cp services/depin/depin.config.example.json services/depin/depin.config.json
# set recipient G-address
npm run dev:all

# Unpaid
curl -i http://127.0.0.1:4102/v1/weather
# or dashboard → Routes → Probe 402

# Paid (buyer funded with testnet USDC + OZ key if Channels)
STELLAR_PRIVATE_KEY="$(stellar keys secret zexvro-buyer)" \\
DEPIN_EXPECTED_RECIPIENT="$(stellar keys address zexvro-provider)" \\
npm --prefix services/depin run demo:client`} />

        <H3>Hosted App Runner</H3>
        <P>
          Service URL is configured via <code>VITE_DEPIN_API_URL</code>. Config secret: <code>zexvro/depin/config-json</code>.
          Browser dashboards need CORS allowlist (redeploy with <code>CORS_ALLOWED_ORIGINS</code>).
        </P>

        <H3>MVP limits (honest)</H3>
        <ul className="list-disc pl-5 text-xs text-zinc-600 dark:text-zinc-400 space-y-1 mb-4">
          <li>GET and HEAD only — no streaming, sessions, or mutable POST compute in v1</li>
          <li>No live create/delete provider API — config at boot</li>
          <li>Agent Auth classification and full rate-card policy are roadmap, not this gateway</li>
        </ul>

        <Callout type="tip">
          Open a project → Resource Gateway → De-pin x402 Gateway → Overview for the flow, Protect route to build JSON,
          Routes to Probe 402, Integrate for client snippets.
        </Callout>
      </div>
    ),
  },
  {
    id: 'changelog',
    title: 'Changelog',
    category: 'Updates',
    icon: FileText,
    content: (
      <div>
        <H3>v2.0.0 — Production Zer0 Suite</H3>
        <ul className="list-disc pl-5 text-xs text-zinc-600 dark:text-zinc-400 space-y-1 mb-4">
          <li>Complete rewrite of Zer0 Privacy Pool as multi-screen application</li>
          <li>New People management with full CRUD, search, and filtering</li>
          <li>Multi-step Pay a Party flow with review and confirmation</li>
          <li>Payment History with CSV export and expandable details</li>
          <li>Proof Manager with retry functionality</li>
          <li>Comprehensive Settings with 5 configuration tabs</li>
          <li>Zustand persistence for all data (employees, payments, proofs, pool)</li>
          <li>API client layer with DynamoDB-ready endpoints</li>
        </ul>
        <H3>v2.1.0 — Access Shield product UI</H3>
        <ul className="list-disc pl-5 text-xs text-zinc-600 dark:text-zinc-400 space-y-1 mb-4">
          <li>De-pin dashboard: Overview, Routes, Protect route wizard, Integrate panel</li>
          <li>Config builder export (copy/download depin.config.json) + deploy steps</li>
          <li>Docs topic: Access Shield (De-pin x402)</li>
        </ul>
        <H3>v1.2.0 — Documentation Library</H3>
        <ul className="list-disc pl-5 text-xs text-zinc-600 dark:text-zinc-400 space-y-1 mb-4">
          <li>Added /docs endpoint with interactive documentation</li>
          <li>Code examples with copy-to-clipboard</li>
        </ul>
        <H3>v1.0.0 — Initial Release</H3>
        <ul className="list-disc pl-5 text-xs text-zinc-600 dark:text-zinc-400 space-y-1 mb-4">
          <li>Project creation and management</li>
          <li>Service activation system</li>
          <li>Morph AI agent integration</li>
          <li>Workspace and team management</li>
        </ul>
      </div>
    ),
  },
];

const CATEGORIES = [...new Set(DOCS.map(d => d.category))];

export default function DocsLibrary() {
  const [activeTopic, setActiveTopic] = useState('getting-started');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredDocs = searchQuery
    ? DOCS.filter(d => d.title.toLowerCase().includes(searchQuery.toLowerCase()) || d.category.toLowerCase().includes(searchQuery.toLowerCase()))
    : DOCS;

  const currentTopic = DOCS.find(t => t.id === activeTopic) || DOCS[0];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#050505] text-zinc-900 dark:text-zinc-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white/80 dark:border-zinc-800 dark:bg-[#0A0A0B]/80 backdrop-blur sticky top-0 z-50 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-blue-500" />
              <h1 className="text-sm font-bold text-zinc-900 dark:text-white">Documentation</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search docs…"
                className="h-8 w-64 rounded-lg border border-zinc-200 bg-white pl-9 pr-3 text-xs outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </div>
            <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest bg-zinc-100 dark:bg-zinc-900 px-2 py-0.5 rounded">v2.0</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-7xl w-full mx-auto flex-1 flex gap-0 min-h-0">
        {/* Sidebar */}
        <aside className="w-56 shrink-0 border-r border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-[#070708]/50 p-4 overflow-y-auto hidden lg:block">
          {CATEGORIES.map(cat => (
            <div key={cat} className="mb-4">
              <h4 className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 px-2">{cat}</h4>
              {filteredDocs.filter(d => d.category === cat).map(d => (
                <button
                  key={d.id}
                  onClick={() => { setActiveTopic(d.id); setSearchQuery(''); }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors mb-0.5 ${
                    activeTopic === d.id
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-semibold'
                      : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/30'
                  }`}
                >
                  {d.title}
                </button>
              ))}
            </div>
          ))}
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 p-6 lg:p-8 overflow-y-auto">
          <div className="max-w-3xl">
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 mb-4">
              <span>Docs</span>
              <ChevronRight className="h-2.5 w-2.5" />
              <span>{currentTopic.category}</span>
              <ChevronRight className="h-2.5 w-2.5" />
              <span className="text-zinc-700 dark:text-zinc-300 font-semibold">{currentTopic.title}</span>
            </div>

            <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-6">{currentTopic.title}</h2>

            <div className="prose-sm">
              {currentTopic.content}
            </div>

            {/* Navigation Footer */}
            <div className="flex items-center justify-between mt-12 pt-6 border-t border-zinc-200 dark:border-zinc-800">
              {(() => {
                const idx = DOCS.findIndex(d => d.id === activeTopic);
                const prev = idx > 0 ? DOCS[idx - 1] : null;
                const next = idx < DOCS.length - 1 ? DOCS[idx + 1] : null;
                return (
                  <>
                    {prev ? (
                      <button onClick={() => setActiveTopic(prev.id)} className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition flex items-center gap-1">
                        <ArrowLeft className="h-3 w-3" /> {prev.title}
                      </button>
                    ) : <span />}
                    {next ? (
                      <button onClick={() => setActiveTopic(next.id)} className="text-xs text-blue-500 hover:text-blue-600 transition flex items-center gap-1">
                        {next.title} <ChevronRight className="h-3 w-3" />
                      </button>
                    ) : <span />}
                  </>
                );
              })()}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
