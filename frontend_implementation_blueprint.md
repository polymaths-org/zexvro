# ZEXVRO — Detailed Frontend Re-Engineering Implementation Blueprint

Use this blueprint in combination with `continue.md` to re-engineer the frontend application. 

---

## 1. FILE-BY-FILE TOUCH Checklist

### 1. `frontend/src/routes/router.tsx`
* **Goal**: Strip out all Web2 routes and replace with Web3-first execution routes.
* **Modifications**:
  - Remove imports of Web2 pages: `WorkspaceDeployments`, `WorkspaceInstances`, `ProjectEnvironments`, `ProjectDeployments`, `ProjectLogs`.
  - Delete their route variables and corresponding route declarations in the main route tree.
  - Add a route for **Project Executions**:
    ```typescript
    const projExecutionsRoute = createRoute({
      getParentRoute: () => projectLayoutRoute,
      path: 'executions',
      component: ProjectExecutions, // Point to the new executions panel
    });
    ```
  - Map `/dashboard/w/$workspaceId/p/$projectId/executions` cleanly in the export.
  - Simplify routing so only Workspace overview, Projects index, and the 6 Web3-specific service sub-routes exist.

---

### 2. `frontend/src/components/layout/DashboardLayout.tsx`
* **Goal**: Align the sidebar menu and header options with pure Web3 executions.
* **Modifications**:
  - Locate `SIDEBAR_CATEGORIES` (around line 180-250) and strip out:
    - `Compute & Deploy` group.
    - `Deployments`, `Instances`, `Transactions`, `Payroll` from the workspace list.
  - Replace them with a simplified list under **Workspace Management**:
    - `Overview` (Icon: Home) -> `/dashboard/w/$workspaceId/overview`
    - `Projects / Environments` (Icon: Folder) -> `/dashboard/w/$workspaceId/projects`
    - `Team & Invites` (Icon: Users) -> `/dashboard/w/$workspaceId/team`
    - `Audit Log` (Icon: ShieldCheck) -> `/dashboard/w/$workspaceId/audit`
    - `Settings` (Icon: Settings) -> `/dashboard/w/$workspaceId/settings`
  - Locate `dynamicProjectCategories` (around line 350-420) and update project-level categories:
    - **Core**:
      - `Overview` (Icon: Activity) -> `/dashboard/w/$workspaceId/p/$projectId/overview`
      - `Executions & Runs` (Icon: PlayCircle/Terminal) -> `/dashboard/w/$workspaceId/p/$projectId/executions`
      - `Shared Memory` (Icon: Database) -> `/dashboard/w/$workspaceId/p/$projectId/memory`
      - `Settings` (Icon: Settings) -> `/dashboard/w/$workspaceId/p/$projectId/settings`
    - **Services Manager**:
      - `Services Grid` (Icon: Grid) -> `/dashboard/w/$workspaceId/p/$projectId/services`
      - *Enabled services* (ZK Privacy Pool, Morph, A-2-A Trade, Agent Auth, NFT, De-pin) dynamically show under the menu.

---

### 3. `frontend/src/components/project/ProjectOverview.tsx`
* **Goal**: Replace the CPU, Memory, and Vercel-style deployment widgets with Web3 statistics and service status indicators.
* **Modifications**:
  - Remove all mock charts and references to system resources.
  - Add a **Service Grid Overview** card displaying all 6 services with status pills:
    - `Morph Transformation Agent` -> Status: `Active` / `Synced`
    - `Zero-Knowledge Privacy Pool` -> Status: `Configured` (USDC pool balance: $54,320.00)
    - `A-2-A Trade Pipeline` -> Status: `Idle` / `Awaiting offers`
    - `Agent Auth Service` -> Status: `Running` (Classification accuracy: 98.4%)
    - `NFT Studio` -> Status: `Inactive`
    - `De-pin Node Monitor` -> Status: `Inactive`
  - Add a **"Quick Execution Console"** widget:
    - Dropdown: Select Service Run (e.g. "Trigger Morph Code Scan", "Initiate ZK Payroll Settlement", "Execute A2A Trade Pipeline").
    - Action: A single, premium **"Run Execution"** button. Clicking this should navigate to `/executions` and trigger a live execution logs stream.
  - Add **Web3 Key Metrics Grid** (using clean HSL gradients/borders):
    - **ZK TVL**: `$54,320.00 USDC`
    - **Active Agents**: `3`
    - **Auth Requests/Min**: `1,420 req`
    - **Morph CLI State**: `Connected (Revision #f29da)`

---

### 4. `frontend/src/components/project/ProjectExecutions.tsx` [NEW FILE]
* **Goal**: Create the central control center for running and monitoring Web3 and agent actions.
* **Implementation Details**:
  - Create a stateful table of executions:
    ```typescript
    interface Execution {
      id: string;
      serviceName: string;
      action: string;
      triggeredBy: string;
      duration: string;
      status: 'success' | 'running' | 'failed';
      timestamp: string;
      logs: string[];
    }
    ```
  - Default runs table preloaded with clean executions (e.g. `ZK-PAYROLL-04`, `MORPH-SCAN-89`, `A2A-TRADE-12`).
  - Add a **"Trigger Execution"** modal:
    - Choose a service pipeline.
    - Set execution inputs (e.g. code directory, wallet path, threshold rules).
    - Click **"Launch Run"** -> instantly adds a `running` row to the table.
  - Add a side-draw panel/modal showing **Live stdout / Logs** of the clicked execution with terminal styling (monospaced font, black background, green/cyan text, autoscrolling).

---

### 5. `frontend/src/components/project/ProjectSettings.tsx`
* **Goal**: Re-align project settings to Web3 configuration rather than hosting/hosting provider config.
* **Modifications**:
  - Remove sections like: "Custom Domains", "Build Command", "Output Directory", "Root Directory".
  - Replace with:
    - **Web3 Wallet Credentials**: Input fields for public key, Stellar network selection (Testnet / Public), and gas limit.
    - **Morph CLI Registry**: Token keys to authenticate the CLI agent syncing loop.
    - **API Keys**: Project credentials for integrating the Captcha-like Agent Authentication SDK.

---

### 6. `frontend/src/components/workspace/WorkspaceOverview.tsx`
* **Goal**: Redesign the workspace summary to avoid general system resources.
* **Modifications**:
  - Display list of workspace projects with links.
  - Display active team members and invite status count.
  - Show workspace audit feed summary.
  - Remove all general cloud instances monitoring widgets.

---

## 2. API INTEGRATION PROTOCOLS

To sync state correctly with AWS DynamoDB tables, use the exact API endpoints mapped in the Lambda.

* **Authorization Headers**:
  - Ensure every request includes the standard Cognito user pool JWT in the authorization headers:
    `Authorization: Bearer <ID_Token_Or_Access_Token>`
* **Zustand Store Sync**:
  - Ensure `awsSync.ts` handles:
    - Fetching and pushing active workspaces (`GET/POST /api/workspaces`).
    - Fetching and pushing projects (`GET/POST /api/projects`).
    - Fetching and bulk uploading employees (`GET/POST /api/employees` & `/api/employees/bulk`).
    - Fetching and posting payroll runs (`GET/POST /api/payroll/runs`).
