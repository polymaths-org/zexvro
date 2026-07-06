# ZEXVRO UI Prototype

This is the extracted frontend prototype for the ZEXVRO platform dashboard.

It is a Vite + React + TypeScript app using local mock data. No backend, auth, wallet, blockchain, deployment provider, or secrets manager is connected yet.

## Run Locally

```bash
npm install
npm run dev
```

## Current Focus

- Improve platform UI/UX.
- Use local transparent ZEXVRO brand assets.
- Keep dashboard data honest and setup-oriented.
- Treat agent actions as approval-first placeholders.
- Keep light and dark themes usable.

## Important Files

- `src/App.tsx` - app shell, sidebar, top bar, command menu, assistant drawer.
- `src/components/dashboard/Overview.tsx` - main workspace dashboard.
- `src/data/mock.ts` - product-safe placeholder data.
- `src/index.css` - base theme, fonts, focus, and utility styling.
- `public/brand/` - local brand assets used by the app.

