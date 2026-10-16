# Local Electron iteration

Use the Electron app for tool and browser changes. Its preload bridge, utility-process Core,
and embedded `WebContentsView` are part of the behavior being tested. Opening the renderer
alone in a normal browser does not provide `window.morphic` or the embedded browser host.

Requires Node 22+ and npm, plus a graphical desktop for Electron tests.

```sh
cd /home/wraient/Projects/zexvro-morphic/MORPHIC/desktop
npm ci
npm run build
npm test
npm run test:e2e
npm run dev:local
```

`dev:local` uses `.dev-profile/` in this checkout, separate from the installed app and the
temporary profiles created by each e2e test. Override it with `MORPHIC_USER_DATA` if needed.
Renderer edits update through Vite; Core/main changes rebuild and restart Electron, and
preload changes reload the renderer. Restart `dev:local` after changing runtime configuration.

## Model connection

Create an ignored `desktop/.env.local` for runtime configuration:

```dotenv
VROAI_URL=http://localhost:3000
MORPHIC_PROVIDER=vroai
```

The URL must serve VROAI's `POST {prompt}` → `{success: true, response: "..."}` contract.
An OpenAI-compatible `/v1` endpoint cannot be used as a VROAI URL directly.
Alternatively, use OpenRouter at runtime:

```dotenv
MORPHIC_PROVIDER=openrouter
OPENROUTER_API_KEY=your-key
OPENROUTER_MODEL=provider/model-id
```

For an OpenAI-compatible gateway, also set `OPENROUTER_BASE_URL` to its `/v1` URL.
This checkout's `.env.local` uses `http://127.0.0.1:8787/v1` (opencode-cc), with
`OPENROUTER_MODEL=deepseek-v4.1-flash-free,space-bunny-free,cat-jam-free`. Custom gateways
try individual model requests in that order, with back-off on rate/network failures.
The original release endpoint configuration is preserved separately in ignored
`.env.release.local` (0600), using the Morph endpoint with model `auto`. To manually test
that configuration, run `node --env-file=.env.release.local scripts/dev-local.mjs`.
The existing provider adapter supports native tools. Big Pickle is excluded by user preference.

On this laptop, `~/.config/hypr/windowrules.lua` places Morph windows floating, centered at
1920×1080 on workspace 12 without changing the active workspace. This is a local desktop rule.

Use runtime variables for keys; `MAIN_VITE_*` values become part of compiled output.
The Advanced settings service URL overrides the VROAI URL for that profile.
Without a working model endpoint the window opens, but live chat cannot answer.

## Test loop

- `npm test`: Core behavior with scripted model/browser fixtures; quick feedback on tool calls.
- `npm run build`: TypeScript and production compilation.
- `npm run test:e2e -- e2e/browser.spec.ts`: actual Electron browser task, approval before
  booking on a local fixture website, MCP connection, and opening animation.
- `npm run test:e2e`: all Electron flows, including chat, memory, onboarding, and settings.
- `npx playwright test e2e/browser.spec.ts`: reuse the last build when only test code changed.

E2E uses a fake VROAI, a local website and temporary app profiles; it requires no keys and
makes no real bookings. It proves app wiring and scripted behavior, not real model quality.
Screenshots are in `test-results/shots/`; failures retain Playwright traces under `test-results/`.
Use `npx playwright show-trace <trace.zip>` to inspect a failure.

Start changes in `src/core/tools.ts` (tools/schema), `protocol.ts` and `model.ts` (tool-call
parsing/provider), `browser-task.ts` and `agent.ts` (task loop), or
`src/main/browser-host.ts` (page snapshots and actions). Add focused behavior coverage for
changed tool/browser semantics, then run the corresponding Electron flow.

## Harness trials and opt-in coding

See [HARNESS.md](HARNESS.md) for architecture, measured trial notes, limitations and the
multi-site live-model suite. `npm run eval:harness -- --models=cat-jam-free --cases=settings,coding`
builds the app and runs against local opencode-cc with isolated profiles.

To enable coding tools in a development profile, set `MORPHIC_WORKSPACE_ROOT` to the intended
absolute directory and `MORPHIC_CHECK_COMMAND` to a JSON argv array, for example
`["/usr/bin/node","check.mjs"]`. No shell syntax is interpreted. Edits require review and a
current read hash; checks execute only the configured command. This is opt-in and not an OS
sandbox. Leave these variables unset for normal browser-only iteration.
