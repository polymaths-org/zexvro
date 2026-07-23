# ZEXVRO Arcade (Web2 → Web3 Morph demo)

Lakebed capsule: a tiny **browser clicker game**. Morph migrates it to Web3 by wiring:

- **Gate** — captcha / anti-bot on score submit  
- **NFT** — skins / victory badge (Stellar testnet)  
- **De-pin** (optional) — paid “power tip”

## Why Lakebed

- One **shareable URL** for demo day  
- `npx lakebed deploy` **updates the same app** for everyone after Morph patches  
- Guest auth works out of the box  

## Local

```bash
cd demos/arcade
npx lakebed dev
# open the printed localhost URL
```

## Hosted (share this)

**Live Web2 baseline:** https://bright-meadow-20f31c35f5.lakebed.app  

`lakebed.json` binds this repo to deploy `dep_Q-J7XNn4TArtHcf6`. Every:

```bash
cd demos/arcade
npx lakebed@0.0.29 deploy
```

updates **the same URL** for everyone after Morph patches.

```bash
npx lakebed auth login          # once (for claim / stable domain / server env)
npx lakebed claim               # claim so deploy does not expire
npx lakebed domains add zexvro-arcade.lakebed.app   # optional stable name
```

Anonymous deploys expire; claim for demo-day permanence.

## Layout

```
server/index.ts   # scores, (later) Gate verify hooks, tip endpoint
client/index.tsx  # game UI
shared/game.ts    # types + helpers
```

## Morph target

From `services/morph`:

```bash
./bin/morph
# "Migrate demos/arcade to ZEXVRO: Gate on scores + NFT skin unlock"
```

Then redeploy Lakebed.

## Mode flag

The client reads `gameMode` from the server (`web2` | `web3`).  
Morph should flip config + UI when services are wired — so the **same URL** can show the migration story.
