# ZEXVRO Pages And Completion Map

Last updated: 2026-07-15

This file is for the next model and team members. It explains which pages work, which pages are partial, where data is stored, and what must be finished.

## Data Policy

- Business data should not use browser localStorage.
- Current routed app business data is backed by AWS DynamoDB tables or the DynamoDB-backed `/api/memory` document.
- Remaining browser storage is limited to Cognito/session handoff (`zexvro_user_session`) and UI preferences (`zexvro_ui`).
- `/api/memory` is a temporary AWS-backed catch-all for settings, executions, Zer0 pool/settings/proofs/payments, and shared memory until dedicated tables exist.

## AWS Data Sources

| Area | Source | Status |
| --- | --- | --- |
| Auth/session | Cognito plus frontend session handoff | Working, local session handoff still required |
| Workspaces | `zexvro-workspaces` via `/api/workspaces` | Working partial |
| Projects | `zexvro-projects` via `/api/projects` | Working partial |
| Employees/payees | `zexvro-employees` via `/api/employees` | Working |
| Payroll runs | `zexvro-payroll-runs` via `/api/payroll/runs` | Working |
| Payroll roles/departments | `zexvro-payroll-taxonomy` via `/api/payroll/taxonomy` | Working |
| Shared memory | `zexvro-user-memory` via `/api/memory` | Working temporary |
| Executions/runs | `zexvro-user-memory` key `projectExecutions:<projectId>` | Partial temporary |
| Zer0 settings/pool/payments/proofs | `zexvro-user-memory` via `awsSync.ts` | Partial temporary |
| Audits | Derived frontend feed only | Needs dedicated table/API |
| Stellar wallet/on-chain balances | Stubbed `stellar` API in frontend | Not live |

## Workspace Pages

| Page | Route | Status | Data source | Completion | Notes |
| --- | --- | --- | --- | --- | --- |
| Marketing | `/` | Working | Static frontend | 80% | Copy now positions ZEXVRO as a Web2 to Web3 service platform. |
| Dashboard redirect | `/dashboard` | Working partial | AWS store after auth | 70% | Redirects to first workspace once AWS sync hydrates. Needs empty account onboarding polish. |
| Workspace Overview | `/dashboard/w/$workspaceId/overview` | Working partial | AWS workspaces/projects/employees plus AWS memory fallback | 75% | Web3 service overview. Removed Web2 deployment focus. |
| Projects | `/dashboard/w/$workspaceId/projects` | Working | `zexvro-projects` | 80% | Creates customer migration projects. Service enablement is stored on project records. |
| New Project | `/dashboard/w/$workspaceId/projects/new` | Working | `zexvro-projects` | 80% | Wizard opens directly. Needs validation polish. |
| Team | `/dashboard/w/$workspaceId/team` | Partial | `zexvro-workspaces` members | 65% | Invite writes to AWS. Role updates/removal still need backend persistence endpoints. |
| Audit Log | `/dashboard/w/$workspaceId/audit` | Partial | Derived frontend state | 35% | Needs real audit DynamoDB table and Lambda routes. |
| Workspace Settings | `/dashboard/w/$workspaceId/settings` | Working partial | `zexvro-workspaces` | 70% | Actual workspace options. Needs deeper org/security policy persistence. |
| Services Manager | `/dashboard/w/$workspaceId/services` | Partial | Frontend service catalog, project enabled services | 55% | Shows catalog. Needs workspace-level service policy and backend service instance API. |
| Morph Agent | `/dashboard/w/$workspaceId/agent` | Partial | Agent chat API plus AWS memory settings | 60% | Provider settings now load/save through `/api/memory`. Chat backend still depends on proxy/backend availability. |
| Shared Memory | `/dashboard/w/$workspaceId/memory` | Working partial | `/api/memory` key `workspaceMemory:<workspaceId>` | 70% | No browser persistence. Needs dedicated memory schema and search API. |
| Security | `/dashboard/w/$workspaceId/security` | UI partial | Frontend-derived/static | 35% | Needs real security events, policies, and AWS API. |
| Analytics | `/dashboard/w/$workspaceId/analytics` | UI partial | Frontend-derived/static | 35% | Needs service telemetry API. |

## Project Pages

| Page | Route | Status | Data source | Completion | Notes |
| --- | --- | --- | --- | --- | --- |
| Project Overview | `/dashboard/w/$workspaceId/p/$projectId/overview` | Working partial | AWS projects/employees plus AWS memory Zer0 state | 70% | Web3 service status board with no CPU/RAM/Web2 build charts. |
| Executions & Runs | `/dashboard/w/$workspaceId/p/$projectId/executions` | Partial | `/api/memory` key `projectExecutions:<projectId>` | 55% | AWS-backed temporary history. Needs dedicated executions table, runner API, and live log streaming. |
| Project Services | `/dashboard/w/$workspaceId/p/$projectId/services` | Partial | Service catalog plus project enabled services | 55% | Needs durable service instances API and service-specific config persistence. |
| Project Morph Agent | `/dashboard/w/$workspaceId/p/$projectId/agent` and `/agents` | Partial | Agent chat API plus AWS memory settings | 60% | Needs project-scoped repository ingestion and audit trail. |
| Project Shared Memory | `/dashboard/w/$workspaceId/p/$projectId/memory` | Working partial | `/api/memory` key `projectMemory:<projectId>` | 70% | No local persistence. Needs dedicated query/filter backend. |
| Project Members | `/dashboard/w/$workspaceId/p/$projectId/members` and `/team` | UI partial | Frontend/project/workspace state | 45% | Needs project membership table or workspace role scoping. |
| Project Audit | `/dashboard/w/$workspaceId/p/$projectId/audit` | UI partial | Frontend-derived/static | 35% | Needs audit DynamoDB table/API. |
| Project Security | `/dashboard/w/$workspaceId/p/$projectId/security` | UI partial | Frontend-derived/static | 35% | Needs policies and findings API. |
| Project Analytics | `/dashboard/w/$workspaceId/p/$projectId/analytics` | UI partial | Frontend-derived/static | 35% | Needs telemetry API. |
| Project Settings | `/dashboard/w/$workspaceId/p/$projectId/settings` | Working partial | `zexvro-projects` plus form state | 65% | Web3 wallet/API settings UI exists. Needs secrets handling and validation. |

## Zer0 Pages

| Page | Route | Status | Data source | Completion | Notes |
| --- | --- | --- | --- | --- | --- |
| Zer0 Dashboard | `/dashboard/w/$workspaceId/zer0` and `/dashboard/w/$workspaceId/p/$projectId/zer0` | Partial | Employees table plus AWS memory pool/payments/settings | 60% | Balances are zero until wallet is configured. Stellar balance call is stubbed. |
| Employees / Payees | `/zer0/people` | Working partial | `zexvro-employees` plus hydrated store | 75% | Create/update/delete uses AWS. Role/department choices here are still fixed lists; Payroll manager uses taxonomy API. |
| Payroll Runs | `/zer0/payroll` | Working | Employees, payroll runs, taxonomy DynamoDB tables | 85% | No dummy payroll history. Roles manager, department manager, and history sorting are included. |
| Pay a Party | `/zer0/pay` | Partial | AWS memory via Zer0 store sync | 55% | Creates payment intent in store and syncs to `/api/memory`. Needs dedicated payments table and live Stellar submission. |
| Payment History | `/zer0/history` | Partial | AWS memory payments | 60% | Empty unless real payments are created. Payroll screen has richer role/department sorting. Needs dedicated payments API. |
| Proof Management | `/zer0/proofs` | Partial | AWS memory proofs | 50% | Proof generation is UI/store level. Needs real proof worker/contracts. |
| Zer0 Settings | `/zer0/settings` | Partial | AWS memory settings via `awsSync.ts` | 65% | Actual wallet/network/workflow/compliance options. Needs secure backend secret strategy and live Stellar validation. |

## MVP Service Pages

| Page | Route | Status | Data source | Completion | Notes |
| --- | --- | --- | --- | --- | --- |
| Morph Transformation | `/transformation` | Partial | UI/service component and agent backend | 55% | Needs real repository scan execution wiring. |
| A-2-A Trade Pipeline | `/trade` | UI partial | Frontend component | 35% | Needs protocol, wallet policy, and settlement API. |
| Agent Auth Service (ZEXVRO Gate) | `/agent-auth` | Plan + Phase 1 API scaffold | `services/agent-auth`, `docs/agent_auth_implementation_plan.md` | 45% | Dual-channel capability API scaffolded; WebAuthn, Dynamo, dashboard live wire remaining. |
| NFT Studio | `/nft` (project scope under `/dashboard/w/.../p/.../nft`) | Working partial | Cognito NFT API (`services/nft-service`), Soroban collection contract, local JSON or Dynamo records, local/S3/Pinata media | 88% | Create/deploy/sale/mint/public buy/inventory/archive; **auto token IDs**; **Integrate SDK** copy panel; embed checkout at `/nft/embed/checkout`. Live production needs hosted API + Freighter E2E recorded. |
| Public NFT collection | `/nft/collections/$collectionId` | Working partial | Public NFT API | 85% | Buyer prepare/sign/submit; no manual token ID. |
| NFT embed checkout | `/nft/embed/checkout` | Working partial | Public NFT API + Freighter | 75% | Game popup surface; partner origins need `CORS_ALLOWED_ORIGINS`. |
| De-pin Gateway | `/depin` (project scope under `/dashboard/w/.../p/.../depin`) | Working partial | Local/managed De-pin gateway (`services/depin`) via Vite proxy | 80% | Health/status, unpaid 402 probe, exact x402 settle path verified on testnet. Multi-instance file backend; managed config. Product narrative expanding toward **Access Shield** (see `docs/access_shield.md`)—UI still gateway-focused. |
| Docs | `/docs` | Working partial | Static docs component | 60% | Needs current service documentation and integration examples (Access Shield + NFT SDK still mostly in repo MD). |

## Legacy Or Removed Pages

| Page | Status | Notes |
| --- | --- | --- |
| Workspace Deployments | Removed from active nav | File remains for now but should not be presented as a core Web3 workflow. |
| Workspace Instances | Removed from active nav | File remains for now. Replace only if a Web3 service instance API is built. |
| Workspace Transactions | Removed from active nav | Transactions belong under Zer0 or service-specific pages. |
| Project Deployments | Removed from active nav | Web2 build/deploy concept replaced by Executions & Runs. |
| Project Environments | Removed from active nav | Project creation still uses customer environments concept. Dedicated env UI is legacy. |
| Project Logs | Removed from active nav | Execution logs should live under Executions & Runs. |
| Old `DashboardApp.tsx` | Inactive legacy shell | `main.tsx` uses TanStack Router. Legacy local workspace persistence was neutralized, but the file should eventually be deleted or archived. |

## Highest Priority Follow-Ups

1. Add dedicated DynamoDB tables and Lambda routes for audit events, executions, service instances, Zer0 payments, Zer0 proofs, and Zer0 settings.
2. Replace frontend `stellar` stubs with backend-mediated Stellar/Soroban integration once credentials and contract IDs are available.
3. Persist project role/member management with a project membership table or workspace-role scoping.
4. Add service telemetry APIs for Analytics and Security pages.
5. Remove unused legacy dashboard and Web2 deployment components once routes are fully stable.
6. Nabil: record Cognito/Freighter NFT smoke (auto IDs + SDK); commit pending polish when ready; Access Shield control-plane UI remains proposed.
7. Team: review `docs/access_shield.md` for big-tech anti-abuse positioning; coordinate Agent Auth (Rushi) with De-pin economic gate (Nabil).
