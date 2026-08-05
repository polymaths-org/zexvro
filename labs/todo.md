# ZEXVRO Labs — Claude Work Plan (Frontend / UI / Operations)

## Scope (IMPORTANT)
- ZEXVRO Labs is a **web3 education platform only** — every lab, module, cert,
  badge, and dashboard is web3-related. No non-web3 content, categories, or
  "AI Mentor" side features.
- Treat every feature below through the web3 lens (labs on Solidity, Stellar,
  Midnight, wallets, DeFi, dApps, chains, security, etc.).

> **Contract:** Claude owns frontend, dashboards, admin panel, UI/UX creativity,
> client-side logic, and operations handling. **Paris owns backend integration**
> (Pages Functions, DynamoDB, OAuth/session, submissions/certs storage).
> Claude designs the data shapes it needs and Paris wires the endpoints.
> Every UI must be paired with a crisp "what endpoint / shape I expect" note
> so Paris can land the backend without Claude guessing.

## Rules

- Build on the existing `labs/` codebase (Vite + React + TS). Root dir `labs/src`.
- Follow `design.md` (colors, type: DM Sans / Space Grotesk / JetBrains Mono).
- No dummy data beyond `src/data/mockData.ts` (backend-driven). If the backend
  isn't ready, render loading/empty states — never fake it.
- Every screen: responsive, keyboard-accessible, dark-themed, ZEXVRO branded.
- Don't touch `functions/`, `server.ts`, `wrangler.jsonc` (Paris), unless asked.
- No secrets/env in FE.
- Each ticket: plan/log commits + update `memory.md` handoff at end of the day.

---

## 1. UI foundation (Claude: do, Paris: confirm event flow / deployment)

- [ ] Global shell polish: consistent sidebar (dividers already in), header,
      breadcrumbs, focus states, transitions.
- [ ] Design system: shared Button / Input / Card / Badge / Switch / Tag
      components in `components/ui/`.
- [ ] Accessibility: contrast, ARIA labels, keyboard nav on modals.

## 2. Dashboard (Claude)

- [ ] Home metrics: XP, level, streak, completed labs, next lab.
- [ ] Continue-learning row (in-progress labs), Recommended labs (curation),
      Recent certs/badges.
- [ ] Active learning journey progress (modules).
- [ ] Admin dashboard view (when admin): recent submissions, usage, module
      stats, users.
- [ ] Fill states / error states (per endpoint).

## 3. Catalog / Explore (Claude)

- [ ] Lab cards polish: gold / done / draft states, completions,
      access-lock vs open.
- [ ] Filters: by module, difficulty, tag, completion status; search.
- [ ] Module grouping view (read side of "Module maker").
- [ ] Badge previews earned.

## 4. Lab Player / Lab View (Claude + Paris verify)

- [ ] Fix the checkbox / task-check interaction (check item stays checked,
      persists via endpoint).
- [ ] Redesign content elements: heading, text, code para (copyable,
      line-highlight), checkboxes.
- [ ] Progress bar by tasks; next/prev navigation; autosave.
- [ ] Submission flow UI: submit -> Pending -> Live feedback,
      "View submission" for student, reviewer for admin.
- [ ] Remove old "Console" view + AI Mentor from surface (or gut "Console"
      into a clean tab) — **get confirmation which**.
- [ ] More content element UI (see #7).

## 5. Admin panel (Claude)

- [ ] Lab Manager list: all labs, create/edit/delete, publish/draft/close,
      set module, set access (public + access code), time limit.
- [ ] Content builder UI: live preview canvas on the right, element palette
      (heading/text/code/task + next), drag-to-reorder, element props inspector.
- [ ] Submission Manager: table of submissions per lab (student, status,
      graded), grade/pass/reject, notes.
- [ ] User / enrollment access controls (per lab, per module).
- [ ] Review approval queue.

## 6. Editors (Claude UI + data editor; Paris persists)

- [ ] Certificate editor: live preview, fields (student name, lab, date),
      signature / fonts / border, template colors.
- [ ] Badge editor: icon picker, colors, label, points, XP weight,
      "grant on completion" rule.
- [ ] Module editor: name, description, cover image, pick labs, order,
      gating (unlock after x).

## 7. More elements + components (Claude builds)

- [ ] New content elements: accordion, callout / tip, image, divider / spacer,
      quote, embed (video/img), table, inline steps.
- [ ] Rich-text toolbar for text elements (bold / list / link / code span).
- [ ] Code para enhancements: copy button, line numbers, diff, syntax highlight.

## 8. Operations dashboard (Claude)

- [ ] Group dashboard: today's active users, submission counts by state,
      recent events stream.
- [ ] Filters: by lab/module/state/user; export CSV of submissions.
- [ ] Enrollment / compliance view (who needs access to a lab/module).

---

## Backend handoff (Paris) — the interface Claude expects

Deliver the JSON contract for each screen. Claude should not hand-write the
endpoints. See existing `functions/` `/api` routes.

### Data shapes Claude expects

- User (exists) + optional `enrollments` / `groupId`.
- Lab: `{ id, status: draft|published|closed, moduleId?, access: open|code,
  accessCode?, timeLimitMinutes, bannerUrl, elements[], tasks[] with
  required + done[] }`.
- Submission: `{ labId, userId, status: failed|for_review|passed|rejected,
  score?, submittedAt, reviewedBy?, reviewNote? }` (state machine for #4).
- Certificate template entity: `{ id, name, template, fields, published }`.
- Badge entity: `{ id, icon, label, xp, awardOn, color }`.
- Module entity: `{ id, name, description, coverImage, labIds, gate }`.