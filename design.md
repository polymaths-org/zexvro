# ZEXVRO Design System

This file defines the visual direction for ZEXVRO. It is written for designers, frontend engineers, and coding agents.

Use this as the stable design reference when building the platform UI. Keep `README.md` brand-level, `context.md` product-level, `memory.md` workflow-level, and this file design-level.

## Design Summary

ZEXVRO should feel like a serious developer platform: minimal, dark-first, precise, professional, and easy to understand.

The visual identity comes from the logo and typo-logo:

- Black background.
- White geometric mark.
- Modular node/grid shape.
- Sharp, futuristic wordmark.
- High contrast.
- Minimal decoration.
- Technical but not noisy.

The product UI should combine that identity with a Vercel/Cloudflare-like dashboard experience: calm navigation, clear hierarchy, strong information density, and predictable controls.

## Brand Assets

Primary assets:

- `assets/brand/logo2.png` - preferred README and primary brand lockup.
- `assets/brand/logo.png` - square symbol fallback.
- `assets/brand/typo-logo.png` - wordmark usage.
- `assets/brand/brand-design.png` - brand reference image.

Logo usage:

- Use `logo2.png` for large brand moments and README.
- Use `logo.png` or a cropped symbol for app sidebar, favicon, loading states, and compact spaces.
- Use `typo-logo.png` only when the wordmark has enough horizontal room.
- Do not stretch, recolor, rotate, or place the logo on noisy backgrounds.
- Leave generous empty space around the logo.

## Product Personality

ZEXVRO should feel:

- Professional.
- Minimal.
- Technical.
- Trustworthy.
- Fast.
- Agent-first.
- Enterprise-ready.

ZEXVRO should not feel:

- Crypto-hype.
- Neon arcade.
- Overdecorated.
- Generic template SaaS.
- Purple-only.
- Marketing-first.
- Cartoonish.

## Theme Strategy

ZEXVRO is dark-first, but light theme is required.

The user must be able to switch theme from Settings:

- System.
- Light.
- Dark.

Theme choice should be saved per user/workspace when backend exists. Until then, local storage is acceptable.

Dark theme should be the default for early builds because it matches the brand assets. Light theme must still be polished and usable, not an afterthought.

## Color Tokens

Use neutral surfaces first. Accent color should be restrained.

### Dark Theme

| Token | Hex | Usage |
| --- | --- | --- |
| `background` | `#050505` | App shell background |
| `surface` | `#0A0A0B` | Sidebar and main panels |
| `surface-raised` | `#111113` | Cards, dialogs, popovers |
| `surface-hover` | `#18181B` | Hover and selected low-emphasis states |
| `border` | `#27272A` | Default borders |
| `border-strong` | `#3F3F46` | Focused/active borders |
| `text-primary` | `#FAFAFA` | Main text |
| `text-secondary` | `#A1A1AA` | Secondary text |
| `text-muted` | `#71717A` | Metadata and placeholders |
| `accent` | `#FFFFFF` | Primary action on dark |
| `accent-text` | `#050505` | Text on primary action |
| `brand-purple` | `#7C3AED` | Small Stellar/Web3 accent only |
| `brand-blue` | `#3B82F6` | Links, charts, agent activity |
| `success` | `#22C55E` | Healthy/live |
| `warning` | `#F59E0B` | Needs attention |
| `danger` | `#EF4444` | Failure/destructive |

### Light Theme

| Token | Hex | Usage |
| --- | --- | --- |
| `background` | `#FAFAFA` | App shell background |
| `surface` | `#FFFFFF` | Sidebar and main panels |
| `surface-raised` | `#FFFFFF` | Cards, dialogs, popovers |
| `surface-hover` | `#F4F4F5` | Hover and selected low-emphasis states |
| `border` | `#E4E4E7` | Default borders |
| `border-strong` | `#A1A1AA` | Focused/active borders |
| `text-primary` | `#09090B` | Main text |
| `text-secondary` | `#52525B` | Secondary text |
| `text-muted` | `#71717A` | Metadata and placeholders |
| `accent` | `#09090B` | Primary action on light |
| `accent-text` | `#FFFFFF` | Text on primary action |
| `brand-purple` | `#6D28D9` | Small Stellar/Web3 accent only |
| `brand-blue` | `#2563EB` | Links, charts, agent activity |
| `success` | `#16A34A` | Healthy/live |
| `warning` | `#D97706` | Needs attention |
| `danger` | `#DC2626` | Failure/destructive |

### Color Rules

- Do not build the UI around a single purple palette.
- Use black, white, zinc, and slate neutrals as the base.
- Use purple and blue as small accents for charts, active states, and agent/Web3 details.
- Use semantic colors only for status meaning.
- Never rely on color alone; pair status colors with labels or icons.

## Typography

Use professional product fonts. Prioritize readability over futuristic styling.

Recommended font stack:

- Primary UI: `Inter`, `Geist`, or `Satoshi`.
- Headings: `Geist`, `Inter`, `Sora`, or `Space Grotesk`.
- Code/data: `JetBrains Mono`, `Geist Mono`, or `IBM Plex Mono`.

Default recommendation:

```css
--font-sans: "Geist", "Inter", ui-sans-serif, system-ui, sans-serif;
--font-heading: "Geist", "Inter", ui-sans-serif, system-ui, sans-serif;
--font-mono: "JetBrains Mono", "Geist Mono", ui-monospace, SFMono-Regular, monospace;
```

Typography rules:

- Use normal letter spacing for app UI.
- Do not use negative letter spacing.
- Use uppercase labels only for tiny metadata, not full paragraphs.
- Keep dashboard headings compact.
- Avoid huge hero typography inside the logged-in app.
- Use mono font for hashes, IDs, addresses, API keys, logs, and command snippets.

Suggested scale:

| Role | Size | Weight |
| --- | --- | --- |
| Page title | 24-30px | 600-700 |
| Section heading | 18-20px | 600 |
| Card heading | 14-16px | 600 |
| Body | 14px | 400-500 |
| Metadata | 12-13px | 400-500 |
| Code/logs | 12-13px | 400-500 |

## Layout Rules

- Build an app dashboard first, not a landing page.
- Use a persistent sidebar on desktop.
- Use a top bar for search, workspace, environment, and user controls.
- Use a mobile sheet for navigation.
- Keep content inside clear full-width sections.
- Do not place cards inside cards.
- Keep card radius at 8px or below.
- Use borders more than shadows.
- Keep spacing consistent: 4, 8, 12, 16, 24, 32.
- Avoid large empty marketing-style areas inside the platform.

## Component Style

Use shadcn/ui-compatible primitives.

Core components:

- Button.
- Card.
- Badge.
- Tabs.
- Dialog.
- Sheet.
- Dropdown Menu.
- Command.
- Table.
- Tooltip.
- Progress.
- Scroll Area.
- Separator.
- Avatar.
- Select.
- Input.
- Textarea.
- Switch.
- Checkbox.
- Skeleton.

Component rules:

- Buttons should be compact and clear.
- Primary buttons: black on light, white on dark.
- Secondary buttons: bordered neutral.
- Destructive buttons: red only when action is truly destructive.
- Badges should be small and readable.
- Tables should be dense, sortable-looking, and easy to scan.
- Tooltips should explain icons that are not obvious.
- Cards should represent one object or metric, not page layout decoration.

## Iconography

Use `lucide-react`.

Icon rules:

- Use line icons.
- Keep stroke width consistent.
- Use icons in sidebar, buttons, status chips, and empty states.
- Do not hand-draw SVG icons unless creating a custom brand mark.
- Do not replace familiar icons with text labels in compact controls.

Recommended icons:

- Overview: `LayoutDashboard`.
- Projects: `FolderKanban`.
- Deployments: `Rocket`.
- Services: `Blocks`.
- Agent Studio: `Bot`.
- Analytics: `ChartNoAxesCombined`.
- Team: `Users`.
- Memory: `Brain`.
- Security: `ShieldCheck`.
- Settings: `Settings`.
- API Keys: `KeyRound`.
- Logs: `ScrollText`.

## Motion And Animation

Motion should make state changes easier to understand.

Use:

- Framer Motion for panel transitions, active indicators, and state changes.
- Lottie or Rive-style assets for empty states and success states.
- Small pulse animation for live status only.
- Skeleton loading for pending content.

Animation rules:

- Keep animations below 250ms for normal UI transitions.
- Use ease-out for entries and ease-in for exits.
- Do not animate every card constantly.
- Do not use looping background animations.
- Do not use decorative gradient blobs or floating orbs.

Suggested motion:

- Sidebar active item slides or fades.
- Dialogs scale from 98% to 100%.
- Sheets slide from edge.
- Charts fade and rise subtly.
- Buttons depress by 1-2px on click.
- Agent tool-running state shows subtle dots or progress, not loud effects.

## Data Visualization

Use Recharts or a similar React chart library.

Chart style:

- Thin lines.
- Neutral grid.
- Muted axes.
- Clear tooltips.
- Small legends.
- No rainbow palettes.

Suggested chart colors:

- Blue: `#3B82F6`.
- Purple: `#7C3AED`.
- Green: `#22C55E`.
- Amber: `#F59E0B`.
- Zinc: `#71717A`.

Chart rules:

- Every chart needs a title and short summary.
- Do not use 3D charts.
- Do not overload dashboards with more than 2-3 charts per view.
- Use tables when exact comparison matters.

## Settings And Theme UX

Settings must include an Appearance section.

Appearance settings:

- Theme: System / Light / Dark.
- Density: Comfortable / Compact.
- Reduced motion: On / Off.
- Sidebar mode: Expanded / Collapsed.

Theme behavior:

- Respect OS theme when set to System.
- Persist user selection.
- Apply theme instantly.
- Keep logo visible in both themes.
- Use dark logo surfaces or bordered logo containers when needed on light theme.

## Accessibility

- Maintain readable contrast in both themes.
- Provide visible focus rings.
- Use semantic buttons and labels.
- Do not communicate status by color alone.
- Keyboard navigation must work for sidebar, dialogs, command menu, and forms.
- Respect reduced-motion settings.
- Text must not overlap or truncate important information without tooltip/detail access.

## Copywriting

Tone:

- Clear.
- Direct.
- Professional.
- Developer-friendly.

Avoid:

- Crypto hype.
- Overpromising.
- Long explanations in cards.
- Internal jargon unless it is documented.

Preferred wording:

- "Configure"
- "Deploy"
- "Review"
- "Connect"
- "Run scan"
- "Create API key"
- "Invite member"
- "Needs approval"
- "Blocked"
- "Live"

## Agent-First UI Principles

ZEXVRO should make agent work visible and controllable.

Agent UI should show:

- What the agent is doing.
- What context it is using.
- Which files or services it touched.
- Whether an action needs approval.
- What is safe to edit.
- What changed after the action.

Agent UI should not:

- Hide important actions behind vague loading states.
- Pretend an action succeeded before verification.
- Mix secrets into memory or logs.
- Dump raw context into the UI without structure.

## Do Not Do

- Do not make the product look like a generic crypto wallet.
- Do not use heavy neon gradients.
- Do not use beige, brown, or warm editorial palettes.
- Do not use large rounded pill-heavy UI everywhere.
- Do not use random decorative blobs.
- Do not use dark blue/slate as the entire visual identity.
- Do not make the light theme feel unfinished.
- Do not place the dashboard inside a large decorative card.
- Do not explain every service at length in the main UI.

## Marketing Design

Product UI and marketing UI share brand DNA but different jobs. Dashboard = operator clarity. Marketing = narrative, trust, and conversion.

### Split (Accepted)

| Surface | Goal | Layout / motion |
| --- | --- | --- |
| Logged-in app (`frontend/` dashboard) | Operate services | Dense, sidebar, borders > shadows, ≤250ms UI motion |
| In-app welcome (`frontend/src/marketing/`) | Brand handoff into console | Single glass panel, short brand intro, one CTA |
| Public landing (`landing/zexvro/`) | Explain platform + waitlist | Full-bleed hero, service showcase, team, waitlist |
| Product cinema (`frontend/public/marketing/`) | Make create/mint/boot feel premium | Short loops, silent-safe, brand loader, no hype text spam |
| Pitch / presentation (`presentation/`) | Founder demo + captions | Dark frame, Montserrat captions, logo corner, restrained lower-thirds |

### Marketing personality

Should feel:

- Cinematic but controlled.
- High contrast black / white / zinc.
- Modular (cubes, grid, glass) consistent with the mark.
- Technical confidence without crypto carnival.

Should not feel:

- Neon arcade or meme-coin.
- Beige editorial / warm lifestyle.
- Generic purple SaaS gradient walls.
- Dashboard chrome (sidebars, dense tables) on the public landing.

### Landing visual system

- **Background:** near-black (`#050505` / pure black) with glass panels, subtle border `white/10–12`, soft inset highlight.
- **Glass:** `backdrop-blur` + low white fill; keep readable contrast for body copy.
- **Hero:** oversized wordmark / mark energy is OK; product app still avoids huge hero type inside dashboard.
- **Accents:** one narrow accent per section (service hologram tints from `landing/zexvro/src/data/services.ts` are illustrative only — do not flood the page).
- **3D / shaders:** optional on landing; always provide image fallbacks and respect reduced motion.
- **CTAs:** primary = solid white on dark / solid black on light; secondary = bordered glass.
- **Typography:** Inter / Geist / Satoshi for UI; Montserrat Bold–Black acceptable for pitch captions only.
- **Radius:** landing may use larger radius (16–24px) on marketing cards; dashboard stays ≤8px.

### Brand intro and loaders

- Brand intro video: logo assembly / platform boot — short, silent-friendly, ends on solid brand frame.
- Loading GIFs: prefer transparent / no-bg variants for overlays (`zexvro-laoding-ani-nobg.gif` naming is historical; do not rename in product without updating imports).
- NFT / Zer0 cinema: mission-brief → fuel/assemble (optional) → launch/settle; keep stages product-accurate.

### Presentation / caption rules

- Captions: high-contrast white (or near-white) with soft shadow; avoid thin gray type.
- Prefer Montserrat ExtraBold / Black for short lower-thirds; do not cover faces or key UI.
- Corner logo: small symbol or wordmark; never stretch.
- Export both full render and `_preview` when files are large.
- Do not burn inaccurate product claims into captions.

### Marketing copy rules

- Lead with developer outcome: privacy, deploy, migrate, pay-per-request, agent-ready.
- Service names: **Zer0**, **Morph**, **REQWID**, **NFTo**, **DEDSEC**. A2A Trade is out of MVP.
- Status language: “available,” “in progress,” “coming,” “planned” — match `context.md`.
- Banned: “guaranteed detection,” “multi-chain,” “print money,” empty “revolutionary.”

### Social / export assets

| Use | Asset |
| --- | --- |
| README / large lockup | `assets/brand/logo2.png` |
| Avatar / favicon / corner | `assets/brand/logo.png` |
| Horizontal wordmark | `assets/brand/typo-logo.png` |
| Brand board reference | `assets/brand/brand-design.png` |
| Shareable kit | `marketing.zip` (see `docs/marketing.md`) |

### Do not (marketing)

- Do not reuse dashboard density patterns as the whole landing page.
- Do not invent sixth-plus services not in the MVP map.
- Do not put secrets, env files, or private wallet material in public kits.
- Do not claim Cloudflare/AWS production status without a recorded deploy in `memory.md`.

## Implementation Notes

For Tailwind/shadcn builds, map the design tokens into CSS variables and support `.dark`.

Use this file when creating:

- `tailwind.config.ts`.
- `src/index.css`.
- shadcn theme variables.
- dashboard components.
- theme settings.
- chart styles.
- app layout.
- landing marketing sections (`landing/zexvro/`).
- brand intro / cinema overlays.
- pitch caption styles.

