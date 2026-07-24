# PromptWars / EDGERUN — live demo script (Wraient 911)

## Clean state
- Workspace: **Wraient 911's Workspace** (`ws_mrpzc6fy_pov06z`)
- Project: **PromptWars** only (`proj_1784832360566_e17ff89b`) — REQWID + NFTo enabled
- GitHub: https://github.com/Wraient/promptwars  
  - `main` = Web2 (offline TERA)  
  - `web3` = Morph migrate (Gate captcha + NFT checkout)
- Live Web3: https://promptwars-web3.vercel.app  
- Console: https://console.zexvro.in  

## 5-minute demo flow

### 1) Console home (30s)
1. Open https://console.zexvro.in and sign in as wraient.
2. Workspace **Wraient 911's Workspace** → one project **PromptWars**.
3. Open project → Services: **REQWID** + **NFTo** on.

### 2) Morph assistant (1 min)
1. Open Morph dock (or Morph Agent).
2. Ask: *How do I add captcha with REQWID?*
3. Click **Do this next** button → jumps to REQWID (or projects if workspace-scoped).
4. Ask: *How do I buy ZCR credits?* → **Open credits**.

### 3) REQWID (1 min)
1. Project → **REQWID**.
2. Show site **PromptWars EDGERUN Web3** / siteKey `zk_live_…` (public).
3. Mention captcha protects token pack purchase on the game.

### 4) Web2 game (1 min)
1. Open GitHub `main` or serve local `demos/spacewar/web2`.
2. Play: kills give TERA, market spends TERA — **no wallet**.

### 5) Morph CLI Web2→Web3 (1–2 min)
```bash
curl -fsSL https://raw.githubusercontent.com/polymaths-org/zexvro/main/scripts/install-morph.sh | bash
export PATH="$HOME/.local/bin:$PATH"
morph login
morph use ws_mrpzc6fy_pov06z proj_1784832360566_e17ff89b
# clone web2 only if needed:
# git clone -b main https://github.com/Wraient/promptwars.git /tmp/promptwars && cd /tmp/promptwars
cd /path/to/promptwars   # web2 tree
morph bind
# already migrated on branch web3 — show:
# morph migrate --site-key zk_live_xmzawHoaxJXkULlg7fwwWM_u --origin https://console.zexvro.in
```

### 6) Live Web3 game (1–2 min)
1. Open https://promptwars-web3.vercel.app
2. Buy TERA pack → **Gate captcha** (images) → then **ZEXVRO checkout**.
3. Freighter Testnet: unlock, allow site, sign (human only).
4. Pack credits after success / claim.

### 7) Shared memory (30s)
1. Workspace or project → **Shared memory**.
2. Log decision: *Captcha on token.purchase before NFT checkout*.
3. Show open blockers board + resolve.

## URLs cheat sheet
| What | URL |
| --- | --- |
| Console | https://console.zexvro.in |
| Web3 game | https://promptwars-web3.vercel.app |
| Web2 source | https://github.com/Wraient/promptwars (main) |
| Web3 source | https://github.com/Wraient/promptwars/tree/web3 |
| Gate API | https://api.zexvro.in/gate/health |
| Morph install | `curl -fsSL https://raw.githubusercontent.com/polymaths-org/zexvro/main/scripts/install-morph.sh \| bash` |

## Notes
- Freighter signs checkout; Morph never auto-signs.
- Demo Gate siteKey is public; secret stays server-side only.
- Morph CLI uses stamped branding + optional morph-engine binary (no re-brand spam).
