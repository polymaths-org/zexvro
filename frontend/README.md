# ZEXVRO Frontend

This is the Vite + React + TypeScript workspace for the ZEXVRO platform dashboard. Cognito authentication, Morph CLI status polling, the NFT collection API, and the De-pin gateway status screen are connected; unfinished product areas still use honest placeholders.

## Run Locally

From the repository root:

```bash
cp .env.example .env
npm run dev
```

This starts the frontend and NFT API together with one root environment file.
Use `npm run dev:all` from the root when the De-pin gateway should run too.

Frontend-only development still works from this folder:

```bash
npm install
npm run dev
```

The dev server prefers `http://127.0.0.1:3000/` and selects the next free port when needed.

For legacy Nabil-service development from the frontend folder, start the frontend, local NFT testnet API, and De-pin gateway together:

```bash
npm run dev:stack
```

The root `npm run dev` command is now preferred. It reads the `zexvro-provider` secret from Stellar CLI at runtime and never writes it to the frontend or an environment file. `npm run dev` inside this folder starts only Vite and expects the NFT API on port `4101` and De-pin gateway on port `4102` when those screens are tested.

The NFT browser client calls `/api/nft`; the De-pin browser client calls `/api/depin`. During development, Vite proxies those paths to `http://127.0.0.1:4101` and `http://127.0.0.1:4102`; see [`../services/nft-service/README.md`](../services/nft-service/README.md) and [`../services/depin/README.md`](../services/depin/README.md) for service-local commands. Only public addresses belong in `VITE_*` variables. Stellar secret keys, Pinata credentials, and upstream provider secrets remain server-side.

Within the routed dashboard, NFT collections live at `/dashboard/w/:workspaceId/p/:projectId/nft` and collection creation is nested under `/nft/collections/new`. The De-pin gateway screen lives at `/dashboard/w/:workspaceId/p/:projectId/depin`.

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
- `src/services/depin/` - De-pin gateway health, manifest, and unpaid x402 probe client.
- `src/data/mock.ts` - product-safe placeholder data.
- `src/index.css` - base theme, fonts, focus, and utility styling.
- `public/brand/` - local brand assets used by the app.

## UI Rules

- Keep screens quiet, dark-first, and Cloudflare/Vercel-like.
- Do not show production metrics unless they come from a real integration.
- Do not add personal developer names to user-facing screens.
- Use clear empty states and setup actions instead of dummy data.
- Keep agent actions proposal-only until backend approvals exist.
