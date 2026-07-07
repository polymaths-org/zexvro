# Google AI Studio Prompt: ZEXVRO Frontend Platform UI

Use this prompt in Google AI Studio to generate the first ZEXVRO frontend UI.

```text
You are a senior frontend engineer and product designer. Build the first usable frontend for ZEXVRO, a unified Web3 PaaS with a clean Vercel/Cloudflare-like interface.

Do not build a marketing landing page. Build the actual logged-in platform dashboard as the first screen.

PROJECT IDENTITY
- Product name: ZEXVRO.
- Category: Unified Web3 PaaS.
- Design direction: clean, simple, professional, understandable, developer-first.
- Visual references: Vercel dashboard, Cloudflare dashboard, Linear, Stripe, and modern enterprise SaaS.
- Avoid crypto clutter. Avoid hype. Avoid heavy gradients, glassmorphism, random decorative blobs, and noisy Web3 visuals.
- The UI should feel calm, sharp, fast, and credible.

BRAND ASSETS
Use these assets. If working in a new environment, download them first:

wget -O public/brand/typo-logo.png https://i.ibb.co/YB3xGr1t/typo-logo.png
wget -O public/brand/logo.png https://i.ibb.co/TMJZX8wK/Logo.png

If the repo already contains local assets, prefer:
- assets/brand/logo2.png as the primary app logo if available.
- assets/brand/logo.png as fallback.
- assets/brand/typo-logo.png for brand wordmark contexts.

TECH STACK
Generate a Vite + React + TypeScript app.

Use:
- React.
- TypeScript.
- Vite.
- Tailwind CSS.
- shadcn/ui components.
- lucide-react icons.
- Framer Motion for page transitions and micro-interactions.
- Lottie or Rive-style animation support for status and empty-state animations.
- Recharts for charts and dashboard graphs.
- TanStack Table if building complex tables.
- Mock data only. No real backend calls.

Do not implement real blockchain transactions, wallets, auth, or cloud deploys yet. Mock those flows with realistic data and clear UI states.

APP STRUCTURE
Create a full platform shell:

1. Persistent left sidebar.
2. Top command/search bar.
3. Workspace switcher.
4. Main dashboard content area.
5. Right-side contextual panel on wide screens.
6. Responsive mobile navigation.
7. Dark mode and light mode support.

SIDEBAR STRUCTURE
The sidebar should be dense, organized, and scan-friendly.

Top:
- ZEXVRO logo.
- Workspace switcher: "Polymaths Lab" with environment badge "Testnet".
- Global command/search button with keyboard hint.

Primary navigation:
- Overview
- Projects
- Deployments
- Services
- Agent Studio
- Analytics
- Team
- Memory
- Security
- Settings

Services group:
- Privacy Pool
- Transformation Agent
- A-2-A Trade Pipeline
- Agent Authentication
- NFT Service
- De-pin

Infrastructure group:
- Databases
- Hosting
- Connectors
- Secrets
- API Keys
- Logs

Footer:
- Network state: not connected yet; show network setup as a placeholder only.
- Usage indicator.
- User avatar and account menu.

Use lucide icons for every navigation item. Use active states, hover states, collapsed sidebar behavior, and mobile drawer behavior.

CORE SCREENS TO BUILD
Build the UI for these screens with routed or state-based navigation. It is acceptable to keep everything client-side with mock data.

1. Overview Dashboard
- Header: "Overview" with workspace, environment, and status actions.
- KPI cards:
  - Active services
  - Testnet operations
  - Agent runs
  - Privacy jobs
  - Deployment health
  - Monthly usage
- Main graph: platform activity over time.
- Secondary graph: service usage by category.
- Recent activity timeline.
- Active incidents/status strip.
- Quick actions:
  - Create project
  - Run transformation scan
  - Create API key
  - Invite teammate
  - Open agent

2. Projects
- Table/list of projects with status, service usage, region, network, last deployment, owner.
- Filters: status, owner, service, environment.
- Project cards on mobile.
- Empty state with Lottie/Rive-style animation.
- New project modal with name, environment, network, and starter template.

3. Deployments
- Deployment pipeline view with stages:
  - Source
  - Build
  - Verify
  - Deploy
  - Monitor
- Timeline of deployments.
- Status chips: Live, Building, Failed, Pending.
- Log preview panel.
- Rollback button, disabled until item selected.
- Animated progress indicator for active deployment.

4. Services
- Service catalog grid for the six MVP services.
- Each service card should show:
  - Icon
  - Owner alias
  - Status
  - Short non-technical purpose
  - Setup progress
  - Last activity
- Service detail side panel when a card is clicked.
- Setup checklist:
  - Configure project
  - Connect identity
  - Generate API key
  - Run test request
  - Review logs
- Keep service details high level. Do not write long explanations.

5. Agent Studio
- Main agent chat/workbench layout.
- Left panel: agent modes:
  - Transform codebase
  - Deploy project
  - Explain architecture
  - Create service config
  - Review security
- Center: conversation area with realistic assistant messages.
- Right panel: agent memory/context:
  - Workspace memory
  - CLI context
  - Recent repository scans
  - Safe actions
  - Pending approvals
- Include an approval card before any sensitive action.
- Include a mock "repository scan" result with file tree and risk summary.
- Use animations for agent thinking, tool running, and completed steps.

6. Analytics
- Charts:
  - Requests over time
  - Agent runs by type
  - Service adoption
  - Error rate
  - Latency percentile
  - Usage by workspace member
- Use Recharts with professional styling.
- Include date range selector and export button.

7. Team And Collaboration
- Member list with role, status, last active, services owned.
- Invite member modal.
- Role selector:
  - Owner
  - Admin
  - Developer
  - Viewer
  - Agent
- Collaboration feed:
  - Comments
  - Handoffs
  - Decisions
  - Blockers
- Add a "handoff note" composer that follows this structure:
  - Current state
  - Next step
  - Files to inspect
  - Do not touch
  - Owner needed

8. Memory
- Agent-first shared memory UI.
- Sections:
  - Active decisions
  - Active blockers
  - Recent handoffs
  - Service ownership
  - Change history
- Make it clear this is not a chat log dump.
- Include filters by service, owner, date, and decision label.
- Add a "New memory entry" modal using the fields:
  - Service or area
  - Files changed
  - Summary
  - Decisions
  - Follow-ups
  - Blockers
  - Verification

9. Security
- API keys table.
- Secrets placeholder.
- Audit log.
- Authentication status.
- Human/agent access policy preview.
- Risk cards and permission review.

10. Settings
- Workspace settings.
- Network settings.
- Brand settings.
- Billing placeholder.
- Feature flags.
- Environment variables placeholder, with clear warning not to expose secrets.

VISUAL SYSTEM
Use a polished SaaS dashboard style:

- Background: neutral light/dark surfaces.
- Cards: subtle border, 8px radius max, minimal shadows.
- Typography: clear hierarchy, no oversized marketing type inside dashboard.
- Layout: dense but breathable.
- Color: mostly neutral with restrained accent colors.
- Accent colors can include black, white, zinc/slate neutrals, electric blue, Stellar-like purple, and small green/orange/red semantic states.
- Avoid a one-color purple-only UI.
- Avoid decorative gradient blobs or orb backgrounds.
- Use status chips, badges, segmented controls, tabs, dropdowns, command menus, and tooltips.

COMPONENT REQUIREMENTS
Use shadcn/ui patterns for:

- Button
- Card
- Badge
- Tabs
- Dialog
- Sheet
- Dropdown Menu
- Command
- Table
- Tooltip
- Progress
- Scroll Area
- Separator
- Avatar
- Select
- Input
- Textarea
- Switch
- Checkbox
- Skeleton

Use lucide-react icons. Do not hand-draw icons.

INTERACTION REQUIREMENTS
- Sidebar can collapse and expand.
- Mobile sidebar opens as a sheet.
- Cards have subtle hover states.
- Tables have sortable-looking headers and row hover.
- Dialogs and sheets animate in/out.
- Command menu opens with a visible button; optionally support Cmd/Ctrl+K.
- Quick action buttons trigger modals or state changes.
- Service cards open a detail side panel.
- Deployment rows open log preview.
- Agent actions require approval for sensitive operations.
- Memory entry modal validates required fields visually.

ANIMATION REQUIREMENTS
Use animation carefully. It should support clarity, not distract.

Include:
- Page transition fade/slide.
- Sidebar active indicator animation.
- Chart entrance animation.
- Button press feedback.
- Loading skeletons.
- Lottie/Rive-style animation placeholders for:
  - Empty projects
  - Agent running tools
  - Successful deployment
  - No incidents
- Small pulse animation for live status.

Do not animate every card constantly. Avoid noisy looping background animation.

MOCK DATA REQUIREMENTS
Create realistic mock data for:

- Workspace.
- Projects.
- Deployments.
- Services.
- Agent runs.
- Team members.
- Memory entries.
- Analytics.
- Security/audit log.

Use the developer aliases:
- Paris / paris-29
- Rushi / Wraient
- Nabil / n4bi10p

Service names:
- Zero-Knowledge Privacy Pool
- Transformation Agent
- A-2-A Trade Pipeline
- Captcha-like Agent Authentication Service
- NFT Service
- De-pin

RESPONSIVE REQUIREMENTS
- Desktop: full sidebar, top bar, main content, optional right panel.
- Tablet: narrower sidebar or collapsed sidebar.
- Mobile: top app bar + sheet navigation; dashboard cards stack cleanly.
- No text overlap.
- No horizontal scrolling on mobile.
- Tables become cards or horizontally controlled scroll areas.

ACCESSIBILITY REQUIREMENTS
- Use semantic HTML.
- All buttons have accessible names.
- Color is not the only status indicator.
- Keyboard focus states are visible.
- Dialogs and sheets are keyboard accessible.
- Charts should have labels or textual summaries.

FILES AND IMPLEMENTATION
Generate a complete runnable app.

Preferred structure:

src/
  app/
  components/
    layout/
    dashboard/
    services/
    agent/
    memory/
    analytics/
    team/
    security/
    settings/
  data/
    mock.ts
  lib/
    utils.ts
  styles/

If shadcn/ui setup is required, include exact install commands and component add commands.

Expected commands:

npm create vite@latest . -- --template react-ts
npm install
npm install framer-motion lucide-react recharts lottie-react
npx shadcn@latest init
npx shadcn@latest add button card badge tabs dialog sheet dropdown-menu command table tooltip progress scroll-area separator avatar select input textarea switch checkbox skeleton

OUTPUT EXPECTATIONS
- Provide the final code.
- Include setup commands.
- Include run command.
- Use mock data only.
- Do not require paid APIs.
- Do not require a backend.
- Do not add real secrets.
- Do not explain individual services in long marketing text. Keep service copy compact and dashboard-focused.
- Prioritize a complete, polished UI over backend behavior.
```
