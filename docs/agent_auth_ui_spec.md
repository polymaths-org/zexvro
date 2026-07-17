# ZEXVRO Gate — UI Spec (painless + good looking)

Align with `design.md`: calm zinc surfaces, dark-first, one primary CTA.

## Widget states

| State | UI |
| --- | --- |
| idle | No chrome (invisible path) |
| checking | 16px spinner, no copy |
| challenge | Modal ≤360px: “Confirm you’re here” |
| ready | Host enables submit |
| error | Soft red text + Retry |

## Copy (never)

- captcha, robot, bot fight, puzzle

## Copy (prefer)

- Continue
- Confirm you’re here
- Agent verified
- Policy blocked this action

## Dashboard tabs (shipped stub)

1. Overview — Gate API reachability, channels, header  
2. Keys — site/secret + quickstart snippet  
3. Policies — action × mode  
4. Agents — registered keys  
5. Events — pass / challenged / denied  

## Agent empty state

Explain: agents never open human modal; they sign challenges programmatically.
