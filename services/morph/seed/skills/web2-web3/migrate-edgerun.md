# EDGERUN / promptwars migrate recipe

When the project is EDGERUN-style (`index.html` + `js/game.js` + TERA market):

```bash
morph login
morph use <workspaceId>
morph bind
morph migrate \
  --origin https://console.zexvro.in \
  --gate-url https://api.zexvro.in/gate \
  --collection <collectionId> \
  --site-key <gatePublicSiteKey>
```

Then create Gate site if needed:

- MCP `gate_create_site` with morph login Bearer (Cognito)
- Or dashboard → record public `siteKey` only

Captcha action: `token.purchase` on TERA pack buy before NFT checkout popup.
