# ZEXVRO — Continuation & Dashboard Re-Engineering Instructions for Codex

> **READ THIS ENTIRE FILE BEFORE WRITING ANY CODE.**
> The current dashboard design has irrelevant Web2-style "Deployments" and "Hosting" tabs that make no sense for a Web3 PaaS. You must **re-engineer and redesign both the Main Dashboard and the Project Dashboard** to be purely Web3, execution-driven, and agent-centric.

---

## 1. STRATEGIC DASHBOARD REDESIGN GOALS

1. **Remove Web2 Deployment Clutter**:
   - Get rid of standard web page hosting / Git deployment screens (e.g. commits, build logs, Vercel-like build queues).
   - ZEXVRO is a Web3 PaaS for running *services and agents*, not hosting static HTML.
   - Replace "Deployments" with **Executions & Agent Runs**.
   - Instead of complex multi-stage build workflows, provide a simple **Run / Execute** mechanism for triggering agents and Web3 pipelines.
2. **Re-align with ZEXVRO's 6 MVP Services**:
   - Both dashboards must focus directly on ZK privacy pools, A-2-A trading pipelines, agent authentication telemetry, and Morph codebase transformations.
3. **Workspace vs. Project Separation**:
   - **Workspace**: Top-level administrative home (Projects list, Team invites, Audit Log, Workspace Settings).
   - **Project**: The environment/namespace where you configure and run ZEXVRO Web3 services.

---

## 2. NEW SIDEBAR AND ROUTING STRUCTURE

You must update `frontend/src/components/layout/DashboardLayout.tsx` and `frontend/src/routes/router.tsx` to match this simplified Web3-first hierarchy.

### A. Main (Workspace) Dashboard Navigation
For route `/dashboard/w/$workspaceId`:

| Section | Route Path | Purpose |
|---|---|---|
| **Overview** | `/overview` | Workspace status, active services summary, agent status |
| **Projects** | `/projects` | List/create environments (e.g. "Staging", "Production") |
| **Team Management** | `/team` | Invite members, accept status, manage roles |
| **Workspace Audits** | `/audit` | Audit ledger of all workspace, wallet, and agent actions |
| **Settings** | `/settings` | Workspace name, plan, global configurations |

*Deprecated/Removed from Workspace Level:*
- `Deployments` (Web2 style)
- `Instances`
- `Transactions` (handled under the Zer0 Service itself)
- `Payroll` (handled under the Zer0 Service itself)

---

### B. Project Dashboard Navigation
For route `/dashboard/w/$workspaceId/p/$projectId`:

| Section | Route Path | Purpose |
|---|---|---|
| **Overview** | `/overview` | Running Web3 services dashboard, quick actions, metrics |
| **Services Manager** | `/services` | Grid catalog to enable/disable the 6 MVP services |
| **Executions & Runs** | `/executions` | Log of agent runs, transaction executions, pipeline triggers |
| **Shared Memory** | `/memory` | Shared context registry (CLI sync values) |
| **Project Settings** | `/settings` | API keys, wallet connections, project name |

*Enabled Service-local sub-tabs (only visible when enabled in Services Manager):*
- **Zer0 Privacy Pool** (`/zer0`): Dashboard, Employees/Payees, Pay Party, Payroll History, ZK Proofs, Settings.
- **Morph Agent** (`/transformation`): Codebase tree, run migrations, interactive chat.
- **A-2-A Trade Pipeline** (`/trade`): Trade negotiation console, active negotiation logs, wallet rules.
- **Agent Auth Service** (`/agent-auth`): Classification stats, HDM marketplace settings, API credentials.
- **NFT Studio** (`/nft`): Minting studio, collection deployment, asset metadata.
- **De-pin Node Monitor** (`/depin`): Local node connection and health status.

---

## 3. DETAILED COMPONENT RE-ENGINEERING TASK LIST

### Task 1: Clean Up Routing & Navigation
* **File**: `frontend/src/routes/router.tsx`
  - Remove references to `ProjectEnvironments`, `ProjectDeployments`, `ProjectLogs`, `WorkspaceDeployments`, `WorkspaceInstances`.
  - Add `/dashboard/w/$workspaceId/p/$projectId/executions` route pointing to an executions logger component.
  - Simplify route trees so only clean, Web3-meaningful components remain.
* **File**: `frontend/src/components/layout/DashboardLayout.tsx`
  - Update `SIDEBAR_CATEGORIES` to match the Workspace navigation defined above.
  - Update `dynamicProjectCategories` to match the Project navigation defined above.
  - Remove all Web2/Vercel-like terminology from sidebars, tooltips, and headers.

### Task 2: Redesign Project Overview
* **File**: `frontend/src/components/project/ProjectOverview.tsx`
  - Design a dense dashboard that highlights the state of the 6 Web3 services.
  - Include service badges showing: `Running`, `Configuring`, or `Inactive`.
  - Add a **"Run / Trigger Service"** control panel:
    - Quick-trigger a Morph code inspection run.
    - Initiate a payroll execution run via ZK Privacy Pool.
    - Start an A-2-A trade negotiation execution.
  - Remove mock charts showing CPU usage, memory, bandwidth, or page views.
  - Replace them with Web3 metrics:
    - *ZK Pool Total Value Locked (TVL)* (USDC, XLM, EURC balances).
    - *Agent Auth requests processed* (Human vs. Bot classification rates).
    - *Morph CLI Synchronization status* (Connected, Sync time, CLI memory size).

### Task 3: Implement the "Executions & Runs" Panel
* **File**: Create/Update `frontend/src/components/project/ProjectExecutions.tsx`
  - Displays a clean history table of service and agent execution instances.
  - Fields: `Execution ID`, `Service`, `Triggered By` (User email or Platform Agent), `Action` (e.g. "ZK Payroll Run", "Morph Code Migrator"), `Duration`, `Status` (Success, Executing, Failed), `Timestamp`.
  - Clicking an execution reveals a slide-out panel with live terminal-like stdout logs (fetched from the backend Lambda).
  - Add a big, clean **"New Execution"** button at the top to select an agent pipeline to run instantly.

### Task 4: Connect Workspace Audits to DynamoDB
* **File**: `frontend/src/components/project/ProjectAudit.tsx` and `frontend/src/components/workspace/WorkspaceActivity.tsx`
  - Query audit events from AWS DynamoDB.
  - Log audit records for security-relevant actions:
    - "Workspace Created"
    - "Member Invited: user@test.com"
    - "A2A Trade Rules Modified"
    - "ZK Privacy Pool Funded: 5000 USDC"
    - "API Credentials Rotated"

### Task 5: Zero-Knowledge Privacy Pool & Payroll UI Redesign
* **File**: `frontend/src/components/workspace/Payroll.tsx` (Now purely embedded under Project Zer0 sub-path)
  - Must look like enterprise-grade payroll apps (Gusto/Deel style).
  - Four sub-tabs:
    1. **Employees Directory**: Table with Name, Email, Wallet address, Salary, Department, Frequency, Status. Add CSV parsing/import & manual input.
    2. **Payroll Runs**: Trigger new run (computes ZK proof, generates transaction payload).
    3. **Payment History**: Status badges (Draft, Processing, Settled).
    4. **Pool Settings**: Connected wallet keys (provided by user).
  - **No dummy data**: Store must pull and push state via `employeeApi` and `payrollApi` routes to AWS DynamoDB.

---

## 4. CURRENT AWS INFRASTRUCTURE STATE

```
AWS Account ID: 290294660486
Region: us-east-1
Auth: AWS CLI is authenticated as root. You have FULL permissions.
```

### Existing AWS Resources

| Resource | Name/ID | Details |
|---|---|---|
| Cognito User Pool | `us-east-1_vyONcitBD` | Client ID: `7qmkq33si9qk8pgo6ebi3qantm` |
| API Gateway (HTTP) | `qkuostruh3` | Endpoint: `https://qkuostruh3.execute-api.us-east-1.amazonaws.com` |
| Lambda | `zexvro-agent-backend` | Python 3.12, Handler: `lambda_function.lambda_handler` |
| DynamoDB | `zexvro-device-codes` | PK: `device_code` (S) — for CLI device auth |
| DynamoDB | `zexvro-user-memory` | PK: `username` (S) — blob storage for user state |
| DynamoDB | `zexvro-workspaces` | PK: `ownerId` (S), SK: `workspaceId` (S) — **CREATED** |
| DynamoDB | `zexvro-projects` | PK: `workspaceId` (S), SK: `projectId` (S) — **CREATED** |
| DynamoDB | `zexvro-employees` | PK: `workspaceId` (S), SK: `employeeId` (S) — **CREATED** |
| DynamoDB | `zexvro-payroll-runs` | PK: `workspaceId` (S), SK: `runId` (S) — **CREATED** |
| SES | Enabled, sandbox mode | 200 emails/day, no verified identities yet |

### Internal Routing
All routes route to `zexvro-agent-backend` Lambda through API Gateway's `ANY /{proxy+}` route. You do not need to register routes in AWS API Gateway console; simply code the routing logic within `scratch_lambda/lambda_function.py`.

---

## 5. LAMBDA CODE DESIGN (Python 3.12)

Your Lambda handler in `scratch_lambda/lambda_function.py` must support the following REST endpoints:

```
GET/POST /api/workspaces          -> CRUD workspaces in table 'zexvro-workspaces'
POST     /api/workspaces/{id}/invite -> Write member to workspace, send SES email
GET/POST /api/projects             -> CRUD projects in table 'zexvro-projects'
GET/POST /api/employees            -> CRUD employees in table 'zexvro-employees'
POST     /api/employees/bulk       -> Process CSV employee arrays
GET/POST /api/payroll/runs         -> CRUD payroll records in 'zexvro-payroll-runs'
POST     /api/invite/send          -> Send HTML invitation email using SES
```

Make sure the Lambda handles exceptions gracefully: if SES throws a Sandbox limitation error (e.g. trying to send to an unverified email address), return a clean JSON error response to the frontend rather than throwing a raw 500 error.

---

## 6. CRITICAL MISTAKES TO AVOID

1. **NO LOCAL STORAGE persist**: All data must be fetched and saved to DynamoDB tables.
2. **NO WEB2 CPU/BANDWIDTH CHARTS**: Remove charts showing CPU, RAM, or generic HTTP bandwidth. Use Web3 metrics only.
3. **NO MULTI-STAGE DUMMY BUILD QUEUES**: Remove mock "Building commit x3fd..." timers. Provide instantaneous execution logs for run executions.
4. **DON'T BREAK COGNITO LOGIN**: Ensure the authentication header (`Authorization: Bearer <token>`) is retained and used by all API methods.
5. **KEEP THE UI DENSE AND PREMIUM**: Neutral dark surfaces, vibrant accents, smooth hover triggers. No browser-default styles.
