# ZEXVRO Labs — SPPU Session Stats Report

> **Status:** Session concluded — platform now in maintenance.
> **Generated:** 2026-08-09 · **Source:** live Firestore snapshot (`scripts/labs-stats.mjs`)

The SPPU lab session has wrapped up. These figures were read directly from the
live Firestore collections (users, labs, submissions, certificates, lab_ideas)
by `scripts/labs-stats.mjs`. Re-run that script to refresh the numbers.

---

## At a glance

| Metric | Value |
| --- | --- |
| Session | SPPU Web3 lab (`SPPU · ZEXVRO Labs`) |
| Status | Concluded / under maintenance |
| **Users on platform** | **132** |
| **Enrolled in the lab** | **~302** |
| Active learners (≥ 1 submission) | 33 |
| Completions (certificate holders) | 34 |
| Labs in catalog | 1 (published) |
| Submissions received | 37 |
| Submissions passed | 1 |
| Submissions for review | 36 |
| Submissions rejected | 0 |
| Certificates issued | 41 |
| Badges earned | 0 |
| Curated project ideas | 60 (all taken) |
| Generated | 2026-08-09 |

---

## Engagement

| Metric | Value |
| --- | --- |
| Total users registered | 132 |
| **Enrolled in the SPPU lab** | **~302** |
| Active learners (≥ 1 submission) | 33 |
| Unique submitters | 33 |
| Certificates issued | 41 |
| Completed learners (cert holder) | 34 |
| Project ideas claimed | 60 / 60 |

---

## Outcomes & quality

| Metric | Value |
| --- | --- |
| Pass rate (passed / submitted) | 3% (1 / 37) |
| Average score | 236 |
| Labs published | 1 |
| Labs draft | 0 |
| Submissions pending review | 36 |
| Submissions rejected | 0 |

> Fastest actionable bottleneck: 36 of 37 submissions are still **for review**.
> Grading those will move the pass rate and unlock the remaining certificates.

---

## Curated project idea pool (SPPU)

- Total ideas seeded: **60** (from `Project Idea list - SPPU - Sheet1.csv`)
- Ideas claimed during the session: **60 / 60** — the pool is fully exhausted.

> Generation uses `scripts/seed-lab-ideas.mjs` into the Firestore `lab_ideas`
> collection. All ideas were claimed, so the prompt-builder "Random Project Idea"
> button has nothing left to draw from.

## Enrollment

- Enrolled in the SPPU lab (`lab.enrolledCount`, what the Labs page shows): **~302**
- Active learners (≥ 1 submission): **33**
- Certificate holders (finished): **34**

> Enrollment (~302) is far higher than submissions (37) — most enrolled learners
> haven't submitted yet, and 36 submitted ones are still awaiting review.

---

## Post-session actions

- [ ] Re-run `node scripts/labs-stats.mjs` after any grading to refresh totals.
- [ ] Grade the 36 pending submissions to finalize pass rate + certificates.
- [ ] Confirm session is closed for new submissions.
- [ ] Keep `/dev` under-maintenance page live until the platform reopens.

---

_Generated for the SPPU lab wrap-up via `scripts/labs-stats.mjs`. Firestore
collections queried: `users`, `labs`, `submissions`, `certificates`, `badges`,
`lab_ideas`._