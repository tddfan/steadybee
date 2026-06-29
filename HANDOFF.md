# Steadybee — Session Handoff

_Last updated: 2026-06-28. Read this first when resuming._

## What this is
**Steadybee** — a new app (separate from Vesper). An honest, affordable, **once-a-year retirement
check-up** for UK self-directed investors (45–70, £150k+). Free personalised "portfolio check-up" →
paid annual "Retirement MOT report." Unique thread: **connects today's holdings to the future
retirement outcome.** Domain decided: **steadybee.co.uk** (`.com` is parked; `.co.uk` is fine for a
UK-only product). Brand voice: "approachable expertise" — warm but credible (the bee, dignified).

## Status: PRE-BUILD
Strategy + guardrails + plan written. No app code yet. **Not yet committed to git** (repo initialised).

## Key decisions (locked)
- **Customer (ICP):** anxious/affluent UK DIY investors, 45–70, £150k+. NOT under-35s, traders, crypto,
  index purists, <£20k pots.
- **Business model:** free check-up (diagnosis) → paid **annual MOT report** (prognosis), **£99 vs
  £150/yr to be A/B tested**. Annual ritual, not monthly SaaS.
- **Stack: Python-first** — FastAPI + Jinja2/HTMX/Alpine/Tailwind + numpy engine + WeasyPrint PDF +
  Postgres (Supabase) + Stripe. One language. No React/Next unless revisited.
- **The one unproven assumption everything rests on:** *will affluent UK investors pay AND renew
  (>60%) for an annual check-up?* Test it FIRST via a **fake-door landing page + Bella demo**
  (+ concierge MVP), before building the real engine.
- **Validated** across 4 independent AI expert-panel simulations + persona tests (strong convergence).
- Realistic scale: lifestyle business, ~£250k–£2M ARR (not venture). That's fine — matches the goal.

## Compliance is central (see docs/COMPLIANCE.md)
Decision-support, NOT regulated advice. Hard rules: no fund recommendations / no "better" allocation /
sandbox = behavioural levers only / **never model DB-pension CETV or transfer** / facts-only alerts /
"Illustration, not advice. Current rules, subject to change." / all numbers code-computed (AI explains,
never invents).

## What's been created
- Strategy docs: `docs/VISION.md`, `docs/STRATEGY.md`, `docs/FUNCTIONALITY.md`, `docs/USER_JOURNEY.md`
- Guardrails: `CLAUDE.md` (read every session), `docs/COMPLIANCE.md`, `docs/DESIGN_SYSTEM.md`
- Config: `.gitignore`, `.env.example`
- Build plan: `docs/superpowers/plans/2026-06-28-landing-page-bella-demo.md` (9 tasks, TDD for engine)

## Environment notes
- **superpowers skills installed globally** (`~/.claude/skills/`, 14 skills). Use `brainstorming`
  before new features, `writing-plans` before building, `test-driven-development` for engine logic.
- Working from the Vesper-rooted Claude session; Steadybee lives at `/Users/sanjaysharma/steadybee`.

## NEXT STEP
Execute the landing-page + Bella-demo plan (the fake-door test). Decide execution mode
(subagent-driven vs inline). Consider committing this baseline first.

## Open items to revisit
- Pricing/cadence: annual-only vs also a monthly option (test).
- Is the product really "software" or "an annual report" (concierge MVP will reveal).
- Trademark check on "Steadybee" (UK IPO) before heavy brand investment.
