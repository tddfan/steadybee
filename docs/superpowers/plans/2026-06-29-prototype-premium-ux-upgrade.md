# Prototype Premium UX Upgrade Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or
> subagent-driven-development) to implement this plan task-by-task. Steps use checkbox (`- [ ]`)
> syntax for tracking. Run the [compliance checklist](../../COMPLIANCE.md#review-checklist) on any
> user-facing copy before ticking a task done.

**Goal:** Upgrade the Steadybee prototype toward ProjectionLab-grade UX — without losing its unique
portfolio-level risk focus and without crossing from decision-support into regulated advice. Four
improvements: (1) Parallel Realities comparison, (2) cash-flow waterfall, (3) UK drawdown-sequencing
explorer, (4) reduced data-entry friction with the "Sharpen" gamification center-stage.

**Architecture:** Stay on the decided stack — **Alpine.js + HTMX over server-rendered Jinja2**, with
the deterministic **Python `engine/`** as the single source of truth for every number. **No React.**
The dual-timeline chart (Feature 1) is the only feature that might warrant a small reactive island;
default to Alpine and island only if interaction proves too heavy.

**Decisions locked (founder-approved 2026-06-29):**
- **Framework:** stay Alpine/HTMX; do **not** introduce React unless Feature 1 forces it.
- **Client recompute strategy:** pilot **Pyodide/WASM** for Feature 1 so the *same* Python engine runs
  client-side for buttery drag feedback (server re-validates on save). Everywhere else use
  **debounced HTMX → engine** (~150ms). **Never** hand-port the projection math into JS — two engines
  = two truths = trust/compliance failure.
- **Build order:** Feature 4 → Feature 1 → Feature 2 → Feature 3 (compliance-gated, last).

## Global Constraints
- **Compliance ([docs/COMPLIANCE.md](../../COMPLIANCE.md)):** no fund recommendations; no
  "recommended/better/optimal" allocation or sequence; scenarios are user-initiated + illustrative;
  sandbox = behavioural levers only; **NO CETV / DB-transfer modelling — DB & State pension are fixed,
  locked cash flows**; "Illustration, not advice. Current rules, subject to change." on every
  projection and tax figure; alerts/labels state facts only (never "consider…").
- **Trust:** every displayed number computed by `engine/` code (or the Pyodide-compiled same engine);
  every result traceable to inputs + cited sources (BoE/ONS/HMRC) via a "why?" disclosure.
- **Design ([docs/DESIGN_SYSTEM.md](../../DESIGN_SYSTEM.md)):** base font ≥18px; WCAG AA contrast; one
  headline + one number per screen-moment; depth hidden behind "show me why"; the Sharpen bar is the
  only persistent global chrome.
- **Security:** no secrets; never log PII/holdings; client parsing of pasted statements stays local.

---

## Shared State Core (framework-agnostic — build once, used by F1–F4)
Normalize everything around one serializable `Plan` shape; scenarios are named instances, never
parallel ad-hoc variables. Mirrors the server Pydantic model.

```
Plan = { id, label, locked, people[], household{spendMonthly,inflation,expReturn},
         survivor, levers{}, portfolio{} }
AppState = { plans: {id->Plan}, baselineId, compareId, activeId }
```
Projections are **derived, never stored**: one pure `project(toEngineInput(plan))` (reuse the existing
prototype `project()` overrides shape `{rb,sd,cb,radj,fb}`), memoized on the serialized plan. In Alpine
this is an `Alpine.store('plans', …)` with `get baseProj()/get compProj()` getters.

---

## Feature 4 — Reduce Data-Entry Friction (FIRST: pure Alpine/JS, no compliance risk)
The reward loop: every committed field visibly moves the Sharpen meter ("level up", not tax-return).
- [ ] `pulseSharpen(delta)`: animate the accuracy bar fill (spring ease) + a `+N%` that floats up off
      the bar; `navigator.vibrate(8)` on mobile. Fire on every accuracy increase.
- [ ] Milestone unlocks at 60/80/95%: the existing locked portfolio cards (`app.html:150-156`)
      *sharpen into focus* — animate `filter: blur(4px)` → 0 with a one-line "🔓 Concentration unlocked".
- [ ] Ticker/fund entry: local fuzzy search (Fuse.js ~6kb) over a bundled list of common UK-available
      tickers/ISINs — no network per keystroke. Selection auto-fills asset class/region/currency/type
      (feeds FX + concentration) and bumps Sharpen. Entered holdings render as removable chips; Enter commits.
- [ ] Account sizes: tap-to-edit number that doubles as a slider; "≈" prefix signals "estimate is fine".
- [ ] Paste-a-statement: textarea that regex-parses pasted broker tables → draft chips → **confirm
      step** (required before any calc anyway) → engine computes.
- [ ] Optimistic UI: meter updates instantly client-side; engine reconciles authoritative numbers async.

## Feature 1 — Parallel Realities (Lock Baseline + clone Scenario B)
- [ ] State: `cloneScenario(fromId,label)` = `structuredClone` + new id + `locked:false`;
      `lockBaseline()` freezes the active plan as the reference.
- [ ] Dual timeline on ONE chart: baseline = muted dashed reference; Scenario B = brand teal solid;
      the **filled delta band between them is the story** (green where B improves runway, amber where
      worse). Reuse the existing SVG `pth()` path + band polygon technique from `recompute()`.
- [ ] One floating delta chip (not a table): "Scenario B: money lasts +4 yrs · chance of reaching 95
      +17pp". Panel labelled "Compare scenarios — illustrative, you choose; we don't recommend."
- [ ] Pilot Pyodide here for sub-16ms drag recompute; server re-validates on save.

## Feature 2 — Cash-Flow Waterfall (ship simple first, Sankey later)
- [ ] Lead with a **layered cascade** (Tailwind + SVG flex bars, reusing `.minibar`/`.bar-fill`):
      gross income → tax/NI → essential → discretionary → into wrappers (ISA/SIPP nested). Each row is
      real text + `aria-label` with the number. Degrades to stacked rows on mobile.
- [ ] Each row has a "why?" disclosure → methodology/citation drawer (HMRC bands). Tax rows carry
      "based on current rules, subject to change". Describe the flow only — never "you'd save £X by…".
- [ ] Defer true Sankey behind a "show full flow" reveal: `d3-sankey` (vanilla) or `@nivo/sankey`
      (if React island). NOT Recharts (no first-class Sankey).

## Feature 3 — UK Drawdown Sequencing Explorer (LAST — compliance-gated) ⚠️
**Must pass the compliance checklist + ideally a UK compliance professional before ship.** Design as an
*illustrative, user-driven mechanics explorer*, NOT an optimizer.
- [ ] Vertical "drawdown stack" the user drags to reorder (sortablejs). **State Pension + DB render
      locked (🔒, `draggable=false`) as fixed/immutable cash flows** — never reorderable, never a CETV.
- [ ] Draggable layers (personal allowance / 25% tax-free cash / SIPP crystallisation / ISA) update a
      live "lifetime tax ≈ £X · money lasts to Y" via debounced engine call — showing the consequence
      of *their* ordering. **No "Optimal order" button, no "recommended/best" badge, no auto-sort.**
- [ ] Each layer: "how is this taxed?" educational disclosure + HMRC citation (green-zone education).
- [ ] Persistent "Illustration, not advice. Based on current rules, subject to change."

---

## Open / deferred
- Pyodide bundle size + load strategy (lazy-load on first scenario interaction).
- Bundled ticker list source + refresh cadence (no per-keystroke network).
- Whether Feature 1 ever justifies a React island (decide after the Alpine build).
