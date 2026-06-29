# Landing Page + Bella Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a fake-door landing page + an interactive "Bella" demo that tests the one unproven
assumption — *will affluent UK investors pay for an annual retirement check-up?* — before building
the full product.

**Architecture:** FastAPI serves server-rendered Jinja2 pages. A framework-free `engine/` package
computes Bella's retirement numbers deterministically (no AI-invented figures). The demo's
behavioural-lever sliders call a small HTMX endpoint that re-runs the engine. A "Reserve your MOT"
CTA captures email + price variant to a table; events are logged to measure the funnel.

**Tech Stack:** Python 3.12, FastAPI, Jinja2, HTMX, Alpine.js, Tailwind CSS, pytest, ruff, Postgres
(SQLite acceptable for the test).

## Global Constraints
- **Compliance (verbatim from [docs/COMPLIANCE.md](../../COMPLIANCE.md)):** no fund recommendations;
  no "recommended/better" allocation; sandbox = behavioural levers only (save more / work longer /
  spend less / delay state pension); NO CETV/DB-transfer modelling; "Illustration, not advice.
  Current rules, subject to change." on every projection; "your assumptions may be overly optimistic"
  not "lying"; independence line present.
- **Trust:** every displayed number computed by `engine/` code; "AI explains, code computes" note shown.
- **Design ([docs/DESIGN_SYSTEM.md](../../DESIGN_SYSTEM.md)):** base font ≥18px; WCAG AA contrast;
  one headline + one number per screen; depth behind "show me why"; calm, warm-but-credible voice.
- **Security:** no secrets in code; `.env` only; never log PII/holdings.
- **Bella demo profile (fixed):** age 60, retire at 65, pot £400,000, 80% global equity / 20% bonds,
  target spend £24,000/yr from 65, state pension £11,500/yr from 67.

---

## File Structure
- `app/main.py` — FastAPI app, routes.
- `app/templates/` — `base.html`, `landing.html`, `demo.html`, partials `_result_card.html`, `_sandbox.html`.
- `app/static/` — Tailwind output CSS, Alpine, htmx.
- `engine/retirement.py` — deterministic sustainability calc + behavioural levers (framework-free).
- `engine/bella.py` — the fixed Bella profile.
- `app/storage.py` — reservations + event logging.
- `tests/test_retirement.py`, `tests/test_levers.py`, `tests/test_reservations.py`.

---

### Task 1: Project scaffold

**Files:**
- Create: `pyproject.toml`, `app/main.py`, `app/templates/base.html`, `tests/__init__.py`

- [ ] **Step 1:** Create `pyproject.toml` with deps (`fastapi`, `uvicorn`, `jinja2`, `pytest`,
      `ruff`, `python-multipart`) and ruff config.
- [ ] **Step 2:** Create minimal `app/main.py`:
```python
from fastapi import FastAPI
app = FastAPI()

@app.get("/healthz")
def healthz() -> dict:
    return {"ok": True}
```
- [ ] **Step 3:** Run `uvicorn app.main:app --reload` and `curl localhost:8000/healthz` → `{"ok":true}`.
- [ ] **Step 4:** Commit: `git add -A && git commit -m "chore: scaffold FastAPI app"`.

---

### Task 2: Engine — retirement sustainability (TDD)

**Files:** Create `engine/retirement.py`; Test `tests/test_retirement.py`

**Interfaces:**
- Produces: `prob_money_lasts(pot: float, annual_spend: float, equity_frac: float, years: int,
  state_pension: float = 0.0, state_pension_age_offset: int = 0, sims: int = 10000, seed: int = 42)
  -> float` — returns probability (0–1) the pot is not exhausted over `years`.

- [ ] **Step 1: Write failing test**
```python
from engine.retirement import prob_money_lasts

def test_huge_pot_small_spend_always_lasts():
    p = prob_money_lasts(pot=1_000_000, annual_spend=10_000, equity_frac=0.4, years=30)
    assert p > 0.99

def test_tiny_pot_big_spend_usually_fails():
    p = prob_money_lasts(pot=50_000, annual_spend=40_000, equity_frac=0.8, years=30)
    assert p < 0.20

def test_deterministic_with_seed():
    a = prob_money_lasts(pot=400_000, annual_spend=24_000, equity_frac=0.8, years=30, seed=1)
    b = prob_money_lasts(pot=400_000, annual_spend=24_000, equity_frac=0.8, years=30, seed=1)
    assert a == b
```
- [ ] **Step 2:** Run `pytest tests/test_retirement.py -v` → FAIL (module/function missing).
- [ ] **Step 3: Minimal implementation** — Monte Carlo with documented forward assumptions
      (equity μ≈5%/σ≈15%, bonds μ≈2.5%/σ≈6% real; sourced placeholders to be replaced with cited
      BoE/CMA values later). Use `numpy.random.default_rng(seed)`. Each sim: for each year, draw a
      blended return, subtract real spend (net of state pension once age offset reached), stop if
      pot ≤ 0; count survivals.
- [ ] **Step 4:** Run `pytest tests/test_retirement.py -v` → PASS.
- [ ] **Step 5:** Commit: `feat: deterministic retirement sustainability engine`.

---

### Task 3: Engine — behavioural levers (TDD)

**Files:** Modify `engine/retirement.py`; Test `tests/test_levers.py`

**Interfaces:**
- Produces: `apply_levers(base: dict, extra_saving: float = 0, delay_years: int = 0,
  spend_reduction: float = 0, defer_state_pension_years: int = 0) -> dict` returning adjusted
  inputs for `prob_money_lasts`. **Behavioural levers only — no allocation changes (compliance).**

- [ ] **Step 1: Write failing test**
```python
from engine.retirement import apply_levers, prob_money_lasts

BASE = dict(pot=400_000, annual_spend=24_000, equity_frac=0.8, years=30)

def test_working_longer_improves_odds():
    base_p = prob_money_lasts(**BASE)
    adj = apply_levers(BASE, delay_years=2, extra_saving=10_000)
    better_p = prob_money_lasts(**adj)
    assert better_p > base_p

def test_spending_less_improves_odds():
    base_p = prob_money_lasts(**BASE)
    adj = apply_levers(BASE, spend_reduction=4_000)
    assert prob_money_lasts(**adj) > base_p
```
- [ ] **Step 2:** Run `pytest tests/test_levers.py -v` → FAIL.
- [ ] **Step 3:** Implement `apply_levers`: `delay_years` adds savings + reduces drawdown years;
      `spend_reduction` lowers `annual_spend`; `extra_saving` raises `pot`; deferral shifts state
      pension. Pure function, no allocation edits.
- [ ] **Step 4:** Run `pytest tests/test_levers.py -v` → PASS.
- [ ] **Step 5:** Commit: `feat: behavioural levers for demo sandbox`.

---

### Task 4: Bella profile + demo data endpoint

**Files:** Create `engine/bella.py`; Modify `app/main.py`

- [ ] **Step 1:** Create `engine/bella.py` with the fixed profile (Global Constraints) + a
      `bella_inputs()` returning the dict for `prob_money_lasts`.
- [ ] **Step 2:** Add `GET /api/demo` returning computed results: baseline probability, headline
      concentration ("80% in global equity, heavily US-tech weighted"), and an illustrative 2022-style
      drawdown figure — all from `engine/`. Include the `illustration_not_advice` flag.
- [ ] **Step 3:** Verify `curl localhost:8000/api/demo` returns code-computed numbers (not hardcoded).
- [ ] **Step 4:** Commit: `feat: Bella demo data endpoint`.

---

### Task 5: Bella demo UI (verify in browser)

**Files:** Create `app/templates/demo.html`, `_result_card.html`, `_sandbox.html`; Modify `app/main.py`

- [ ] **Step 1:** `GET /demo` renders: a result card (one headline + one number + "show me why")
      and the sandbox with four sliders (save more / work longer / spend less / delay state pension).
- [ ] **Step 2:** Sliders POST to `POST /api/demo/scenario` (HTMX) → re-runs `apply_levers` +
      `prob_money_lasts` → swaps the probability readout. Add Alpine for instant slider labels.
- [ ] **Step 3:** Add required notices: "Illustration, not advice. Current rules, subject to change.",
      "AI explains, code computes.", independence line. **No allocation lever. No buy advice.**
- [ ] **Step 4: Verify** with preview tools: `preview_start`, `preview_screenshot` (desktop+mobile via
      `preview_resize`), move a slider via `preview_click`, `preview_snapshot` to confirm the
      probability updates. Check contrast/font size against the design system.
- [ ] **Step 5:** Commit: `feat: interactive Bella demo`.

---

### Task 6: Landing page (verify in browser)

**Files:** Create `app/templates/landing.html`; Modify `app/main.py`

- [ ] **Step 1:** `GET /` renders sections: hero (headline + "try the demo" + "reserve your MOT"),
      the problem, how it works (3 steps), independence/trust, pricing (A/B £99 vs £150 — see Task 8),
      FAQ, trust footer (privacy, disclaimers, sources). Plain language; one primary CTA above the fold.
- [ ] **Step 2:** Wire CTAs → `/demo` and the reserve form (Task 7).
- [ ] **Step 3: Verify** with preview tools (desktop + mobile screenshots; check headings, contrast,
      tap targets). Run the [compliance checklist](../../COMPLIANCE.md#review-checklist) against all copy.
- [ ] **Step 4:** Commit: `feat: fake-door landing page`.

---

### Task 7: Reservation capture (TDD)

**Files:** Create `app/storage.py`; Modify `app/main.py`; Test `tests/test_reservations.py`

**Interfaces:**
- Produces: `save_reservation(email: str, price_variant: str) -> int` (returns row id);
  `count_reservations() -> int`.

- [ ] **Step 1: Write failing test**
```python
from app.storage import save_reservation, count_reservations

def test_reservation_saved(tmp_path, monkeypatch):
    monkeypatch.setenv("DB_PATH", str(tmp_path / "t.sqlite"))
    before = count_reservations()
    save_reservation("a@b.com", "p150")
    assert count_reservations() == before + 1
```
- [ ] **Step 2:** Run `pytest tests/test_reservations.py -v` → FAIL.
- [ ] **Step 3:** Implement SQLite-backed storage (email, price_variant, created_at). Validate email.
      Never log the email value.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Add `POST /reserve` (HTMX form) → `save_reservation` → thank-you partial.
- [ ] **Step 6:** Commit: `feat: MOT reservation capture`.

---

### Task 8: Funnel analytics + price A/B

**Files:** Modify `app/main.py`, `app/storage.py`; Test add to `tests/test_reservations.py`

- [ ] **Step 1:** Assign a price variant (`p99`/`p150`) per visitor (cookie, 50/50) and render it
      on the landing/pricing section.
- [ ] **Step 2:** Log events: `page_view`, `demo_opened`, `scenario_used`, `reserve_clicked`,
      `reserved` (with variant). Store to an `events` table. No PII in events.
- [ ] **Step 3:** Test: a reservation logs a `reserved` event with the correct variant.
- [ ] **Step 4:** Add `GET /admin/metrics` (basic-auth) showing the funnel + per-variant conversion.
- [ ] **Step 5:** Commit: `feat: funnel analytics and price A/B`.

---

### Task 9: Compliance + accessibility final pass

- [ ] **Step 1:** Run the full [compliance checklist](../../COMPLIANCE.md#review-checklist) over every
      page and string. Fix any red-zone language.
- [ ] **Step 2:** Verify accessibility: font sizes, contrast, keyboard nav, focus states (preview tools).
- [ ] **Step 3:** `verification-before-completion`: run `pytest`, `ruff check`, start the app, screenshot
      both pages, confirm `/api/demo` numbers come from `engine/`. Paste evidence.
- [ ] **Step 4:** Commit: `chore: compliance + a11y pass`.

---

## Self-Review notes
- **Spec coverage:** landing page ✓ (T6), Bella demo + sandbox ✓ (T4/T5), behavioural-levers-only ✓
  (T3, enforced), reserve/pre-sale ✓ (T7), price A/B ✓ (T8), assumption metrics ✓ (T8), compliance ✓
  (T9, plus Global Constraints). DB-transfer/CETV: explicitly excluded — no task creates it.
- **Trust rule:** all demo numbers from `engine/` (T2–T4); no hardcoded/AI figures.
- **Out of scope (correctly):** real CSV upload, full MOT report, Stripe charge (reservations only),
  user accounts — deferred until the assumption is validated.
