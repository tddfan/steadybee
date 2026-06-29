# CLAUDE.md — Steadybee project rules

Read this every session. It is the source of truth for how we build Steadybee.
Detailed rules live in the docs linked below; the hard rules are inlined here.

## What Steadybee is
An honest, affordable, once-a-year retirement check-up for UK self-directed investors (45–70,
£150k+). Free personalised "portfolio check-up" → paid annual "Retirement MOT report." Its unique
thread: it connects today's holdings to the future retirement outcome.
Full context: [Vision](docs/VISION.md) · [Strategy](docs/STRATEGY.md) ·
[Functionality](docs/FUNCTIONALITY.md) · [User journey](docs/USER_JOURNEY.md).

## Stack (decided)
- **Engine/backend:** Python 3.12, FastAPI, numpy/pandas.
- **Frontend:** Jinja2 templates + HTMX + Alpine.js + Tailwind CSS (server-rendered; SEO-friendly).
- **PDF:** WeasyPrint. **DB:** Postgres (Supabase). **Payments:** Stripe.
- One language (Python) by default. No React/Next unless explicitly decided later.

## COMPLIANCE GUARDRAILS — hard rules (full detail: [docs/COMPLIANCE.md](docs/COMPLIANCE.md))
Steadybee is **decision-support / educational software, NOT regulated financial or tax advice.**
- **Never recommend buying/selling a specific fund or security.** No buy lists.
- **Never output a "recommended" or "better" allocation.** Scenarios are user-initiated and illustrative.
- **Scenario sandbox = behavioural levers only at launch** (save more / work longer / spend less /
  delay state pension). No portfolio-specific allocation-shift recommendations.
- **DB pensions are immutable cash flows. NEVER calculate a CETV or model transferring out.** Ever.
- **Alerts state facts only** ("concentration rose X%→Y%"), never "consider reducing".
- **No outcome promises.** Sell process, not certainty. Copy: "your assumptions may be overly
  optimistic," never "your plan is lying to you."
- **Every projection shows:** "Illustration, not advice. Current rules, subject to change."
- When in doubt, it's advice — don't ship it. Run new copy/features against the
  [compliance checklist](docs/COMPLIANCE.md#review-checklist).

## SECURITY & PRIVACY — hard rules
- **Never commit secrets.** All keys via `.env` (gitignored). Keep `.env.example` in sync.
- This is financial data: **encrypt user data at rest, support full deletion, GDPR by design.**
- Minimise data collected. Make consent + "delete anytime" explicit in UI.
- Never log raw portfolio holdings or PII.

## TRUST RULES (product integrity)
- **All numbers are computed by deterministic, auditable code. AI explains — it NEVER invents a
  figure.** No LLM-generated numbers in any user-facing output.
- Show your work: every result traces to inputs + cited sources (BoE, ONS, HMRC).
- Confirm-holdings step before any calculation on uploaded/entered data.

## DESIGN RULES (full detail: [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md))
- Audience is 45–70 and anxious: **accessibility-first** (large base font ≥18px, high contrast,
  generous targets, plain language, minimal steps).
- One plain headline + one number leads each screen; depth ("show me why") is hidden by default.
- Warm-but-credible voice ("approachable expertise"). Never childish, never panic-inducing.

## CODING CONVENTIONS
- Type hints everywhere; `ruff` for lint+format; `pytest` for tests.
- Pure calculation logic lives in a framework-free `engine/` package (easy to test + reuse).
- Small, single-purpose modules. Match surrounding style.

## DEFINITION OF DONE
A change is done only when: tests pass (TDD for engine logic), lint clean, compliance checklist
passed for any user-facing copy, verified running (not just claimed), and secrets are not committed.

## WORKFLOW
Use superpowers skills: `brainstorming` before new features, `writing-plans` before building,
`test-driven-development` for engine logic, `verification-before-completion` before claiming done.
