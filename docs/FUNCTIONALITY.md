# Steadybee — Functionality

Two tiers. The free tier earns trust and creates productive doubt; the paid tier resolves it and
becomes an annual ritual. The unique thread running through both is the **connected engine**:
*today's holdings → shock behaviour → retirement outcome.*

---

## 0. Try-before-you-trust: the "Bella" demo
- A pre-loaded example profile — **"Bella, 60, £400k SIPP, retiring in 5 years"** — lets a visitor
  experience the check-up and scenario sandbox **without uploading anything of their own.**
- Purpose: deliver the "aha" and prove value *before* asking a scam-wary user for their data.
  Directly attacks the #1 conversion killer (trust at upload).

---

## 1. FREE — the Portfolio Check-up (the hook)
**Goal:** an honest, personalised diagnosis in ~2 minutes that ends in *doubt*, not false comfort.

### Inputs (low friction, two paths)
- **CSV upload** for major UK platforms (Hargreaves Lansdown, Vanguard, Interactive Investor), **or**
- **Manual entry** fallback (many older investors have multiple/legacy providers or paper records).
- **Confirm-holdings step:** "We read these holdings — confirm before we calculate." Prevents silent
  parser errors (e.g. accumulation vs income units) and makes trust collaborative.

### What it computes (deterministic, plain-language)
- **Concentration** — true single-bet / sector / geography exposure beneath apparent diversification.
- **Correlation** — how much of the portfolio really moves together (depth view behind "show me why").
- **Fee drag** — total ongoing cost in £/year and its lifetime impact.
- **Drawdown exposure** — money-denominated crash scenario: *"In a 2022 repeat you'd fall ~£136k
  (−34%) vs −21% for a globally diversified portfolio."*

### Output
- One **visceral, money-denominated headline** first (not an abstract 1–100 score).
- A **future teaser (the bridge):** *"These weaknesses could push your retirement from 62 to 65 —
  see your full picture."* Doubt is aimed at the *curable* input (their allocation).
- Soft CTA into the paid report + email capture for nurture.

---

## 2. PAID — the annual Retirement MOT (£99–£150/yr, to be tested)
**Goal:** resolve the doubt with a rigorous, honest prognosis, delivered as a keepable artifact.

### The engine
- **Expected returns from asset allocation × forward capital-market assumptions** (cited: BoE, ONS,
  HMRC) — **never** trailing/past performance. Explicitly **bridges the gap**: "your funds did
  11%/yr last decade; here's why no serious institution assumes that continues."
- **Monte Carlo "will my money last?"** — probability the pot lasts to a chosen age, with confidence
  bands. Honest ranges, never false precision.
- **Sequence-of-returns risk** — the danger of a crash in the first years of drawdown.
- **Crash-scenario timelines** — how a 2008/2022-style shock moves the retirement picture.
- **The connected chain, made visible:** market move → drawdown → withdrawal margin → "money lasts"
  probability → the single factor that drove it.

### The scenario sandbox (compliant by design)
- User-initiated, **illustrative, behavioural levers only at launch:** save more / work longer /
  spend less / delay state pension. "If you worked 2 more years, your probability moves 84%→91%."
- **No recommended allocations or fund picks.** The "life jacket" is exploring levers the user can
  legally pull themselves — not a buy list.

### Inputs handled
- DC pots, contributions, target retirement age.
- **DB pension** — optional, **immutable cash flow, approximate, heavily caveated. No CETV / no
  transfer modelling, ever.**
- **State pension** — amount + age.

### The deliverable: the Retirement MOT Report (the renewal artifact)
- A downloadable, professional PDF: assumptions, risks, the today→future linkage, year-over-year
  comparison, and a plain checklist. Shareable with a spouse. This is what justifies re-buying.
- **Peer benchmark** (grows with the user base): "your concentration / fee drag / resilience vs
  people like you," with year-on-year movement — a reason to return *and* the long-term data moat.

### Ongoing (calm) monitoring
- Low-frequency, **material-change-only** alerts with confidence bands. **Facts only** ("US-tech
  concentration drifted X%→Y%"), never "consider reducing." No weekly anxiety-pinging.

### Later (not v1)
- Household / spouse access + **survivor-income scenarios** (high value for widowed users).
- IHT/legacy planning (65+ premium add-on).
- Broker API auto-sync (only after manual/CSV proves people pay).

---

## Trust & transparency (cross-cutting)
- **Numbers are computed by deterministic, auditable code. Any AI only explains — it never invents
  a figure.** Stated plainly in-product.
- **Show your work:** every result traces to its inputs and assumptions; sources cited; one click to
  the full audit trail for analytical users, hidden by default for the anxious.
- **Privacy, loud and early:** encrypted, deletable any time, never sold; independence ("we sell you
  nothing") front and centre.

## Tech approach
- **Responsive web app, desktop-first** (data entry happens at a computer), mobile-friendly to read.
- Deterministic calculation engine (Python/JS) + PDF report generation. PWA at most; **no native app.**
- UK-only: GBP, ISA/SIPP/GIA, UK tax wrappers, UK data sources.

## Explicitly out of scope (v1)
Native mobile app · broker API integrations · IHT · fund/security recommendations · anything that
constitutes regulated advice.
