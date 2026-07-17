# Captcha UX critique: ZEXVRO vs hCaptcha vs reCAPTCHA

Sources: design review agents (2026-07-18) + current Gate implementation.

## Comparison

| | hCaptcha | reCAPTCHA v2 | ZEXVRO Gate |
| --- | --- | --- | --- |
| Trust | Known brand, privacy story | Default of the web | New; must earn trust via honesty + polish |
| Speed | Soft checkbox first | Soft / often invisible | Always full puzzle today |
| A11y | Audio + mature ARIA | Audio (mixed quality) | Audio type + dialog; needs more |
| Mobile | Touch-tuned | OK | Fixed 360×456; improve on short screens |
| Abuse | Risk engine + farms | Behavioral graph | Casual bots; crypto for agents |
| Embed DX | One script | One script | Multi-step API + modal (stronger dual-channel) |
| Brand fit | Neutral | Google chrome | Zinc modal fits ZEXVRO |

## Shipped now

- Footer tools: **Reload (↻)** · **Info (ℹ)** · **Report (⚑)** + **Verify**
- `POST /v1/captcha/report` with reason codes
- Info panel + report form inside modal body (no second window)
- Reload issues a fresh challenge + captcha

## Top problems remaining

1. Always-hard puzzle (no soft “Continue” before challenge)
2. Too many challenge types for one mental model
3. Photo bank uneven quality vs Google traffic photos
4. Mobile short-viewport / keyboard overlap risk
5. Accessibility depth (focus trap, screen reader live regions)
6. Error feedback still somewhat vague on verify fail
7. Host co-branding (“Protected by ZEXVRO”) not yet
8. No auto-reload after report submit (SDK returns to same challenge)

## Recommended next improvements (priority)

1. Soft gate: risk-free users get one-tap confirm; puzzle only when needed  
2. Collapse default UX to 3 hero types: image_select, odd_one_out, audio  
3. Auto-load new challenge after report  
4. Attempts remaining chip (“5 left”)  
5. Host logo slot + “Protected by ZEXVRO”  
6. Responsive cell size 88–100px on narrow screens  
7. Better photo bank curation (drop ambiguous tiles)  
8. Keyboard focus trap + `aria-live` status  

## Do not copy from competitors

- Surveillance “I’m not a robot” checkbox as the brand  
- Free-labor endless labeling vibe without honesty  
- Cross-site tracking as trust signal  
- Claiming farm immunity we don’t have  
- Toy neon skins  

## Agent path (unchanged)

Agents never use this UI. Test guide: [agent_auth_local_agent_test.md](./agent_auth_local_agent_test.md).

## Implemented premium UX (2026-07-18)

- Soft gate: one-tap **Continue** when risk is low (SDK); escalates to puzzle on failure
- Hero default types: `image_select`, `odd_one_out`, `audio`
- Attempts chip (“N left”) + friendlier fail copy
- Co-brand header: host name/logo + “Protected by ZEXVRO”
- Fluid motion: modal enter, tile hover, shake on fail, checkmark success (~480ms)
- A11y: focus trap, `aria-live`, `aria-pressed` tiles, keyboard focus rings
- Mobile: `100dvh` clamp, safe-area padding, slightly smaller cells with reference image
- Photo-only tiles + reference example (prior work)
