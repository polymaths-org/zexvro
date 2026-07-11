# ZEXVRO Frontend

This is the Vite + React + TypeScript workspace for the ZEXVRO platform dashboard. Cognito authentication, Morph CLI status polling, and the NFT collection API are connected; unfinished product areas still use honest placeholders.

## Run Locally

```bash
npm install
npm run dev
```

The dev server prefers `http://127.0.0.1:3000/` and selects the next free port when needed.

For NFT development, start the frontend and the local testnet API together:

```bash
npm run dev:stack
```

This reads the `zexvro-provider` secret from Stellar CLI at runtime and never writes it to the frontend or an environment file. `npm run dev` starts only Vite and expects the NFT API to already be listening on port `4101`.

The NFT browser client calls `/api/nft`. During development, Vite proxies that path to `http://127.0.0.1:4101`; see [`../services/nft-service/README.md`](../services/nft-service/README.md) for the local testnet backend command. Only public addresses belong in `VITE_*` variables. Stellar secret keys and Pinata credentials remain server-side.

Within the routed dashboard, NFT collections live at `/dashboard/w/:workspaceId/p/:projectId/nft` and collection creation is nested under `/nft/collections/new`.

## Verify

```bash
npm run lint
npm test
npm run build
npm run test:e2e
```

## Current Focus

- Improve platform UI/UX.
- Use local transparent ZEXVRO brand assets.
- Keep dashboard data honest and setup-oriented.
- Treat agent actions as approval-first placeholders.
- Keep light and dark themes usable.
- Keep the overview clean: no default AI Studio labels, no fake network badges, and no live-data claims.

## Branch Caveat

The `updates-routing-and-zer0` branch is not a finished or fully polished frontend. It includes routing and Zer0 prototype work, but still contains dummy data, placeholder flows, unfinished screens, and UI areas that need refinement before production use.

## Important Files

- `index.html` - browser title and app metadata.
- `src/App.tsx` - app shell, sidebar, top bar, command menu, assistant drawer.
- `src/components/dashboard/Overview.tsx` - main workspace dashboard.
- `src/components/services/Services.tsx` - service setup and approval-first configuration UI.
- `src/services/nft/` - authenticated collection upload, deployment, listing, and browser-draft migration UI.
- `src/data/mock.ts` - product-safe placeholder data.
- `src/index.css` - base theme, fonts, focus, and utility styling.
- `public/brand/` - local brand assets used by the app.

## UI Rules

- Keep screens quiet, dark-first, and Cloudflare/Vercel-like.
- Do not show production metrics unless they come from a real integration.
- Do not add personal developer names to user-facing screens.
- Use clear empty states and setup actions instead of dummy data.
- Keep agent actions proposal-only until backend approvals exist.
