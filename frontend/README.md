# ZEXVRO Frontend

This is the Vite + React frontend workspace for the ZEXVRO platform dashboard.

It is a Vite + React + TypeScript app using local mock data. No backend, auth, wallet, blockchain, deployment provider, or secrets manager is connected yet.

## Run Locally

```bash
npm install
npm run dev
```

The dev server runs on `http://127.0.0.1:3000/` by default.

## Verify

```bash
npm run lint
npm run build
```

## Current Focus

- Improve platform UI/UX.
- Use local transparent ZEXVRO brand assets.
- Keep dashboard data honest and setup-oriented.
- Treat agent actions as approval-first placeholders.
- Keep light and dark themes usable.
- Keep the overview clean: no default AI Studio labels, no fake network badges, and no live-data claims.

## Important Files

- `index.html` - browser title and app metadata.
- `src/App.tsx` - app shell, sidebar, top bar, command menu, assistant drawer.
- `src/components/dashboard/Overview.tsx` - main workspace dashboard.
- `src/components/services/Services.tsx` - service setup and approval-first configuration UI.
- `src/data/mock.ts` - product-safe placeholder data.
- `src/index.css` - base theme, fonts, focus, and utility styling.
- `public/brand/` - local brand assets used by the app.

## UI Rules

- Keep screens quiet, dark-first, and Cloudflare/Vercel-like.
- Do not show production metrics unless they come from a real integration.
- Do not add personal developer names to user-facing screens.
- Use clear empty states and setup actions instead of dummy data.
- Keep agent actions proposal-only until backend approvals exist.
