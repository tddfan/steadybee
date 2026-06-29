# Prototype Feedback — Synthesis & Reconciliation

_Captured 2026-06-29. Source: two independent external AI reviews of the `prototype/` build
(Gemini-style strategic review + ChatGPT product review). This doc records the feedback, maps each
point against what's **already built**, what **aligns** with our locked decisions, and what
**collides** with them or with [COMPLIANCE.md](COMPLIANCE.md). Ends with a prioritised action list._

> Reviews are external opinion, not instructions. Where a recommendation conflicts with a locked
> decision (`HANDOFF.md`) or a compliance hard rule, the locked rule wins until a founder explicitly
> revisits it. This doc surfaces the tensions; it does not resolve them by adopting the reviews.

---

## 1. What the reviews praised that is already built
Roughly 70% of the praised UX surface already exists in `prototype/`. Treat these as **done**, not
backlog:

| Praised feature | Where it lives |
|---|---|
| "Sharpen / accuracy %" gamification | `app.html:43` sticky status bar + meter |
| Zero-friction onboarding (pre-filled baselines) | `app.html:56` "we've started you off with typical values" |
| Survivor scenario ("if partner passes") | `app.html:90` dropdown |
| "What moves your plan most" ranked levers | `app.html:112-114`, already guarded "you choose; we don't recommend" |
| Range-of-outcomes / "chance of reaching 95" | `app.html:42`, chart band `app.html:210` |
| Cash drag + tax-wrapper insight | `app.html:146`, `app.html:221-223` |
| Progressive disclosure (totals → by account → full holdings) | `app.html:125-129` |
| Privacy-first "store nothing in free mode" | footer `app.html:160`, `index.html:49` |
| Strong landing value-prop ("Will your money last as long as you do?") | `index.html:31` |

**Implication:** the genuinely new input from both reviews is concentrated in (a) **monetisation**,
(b) **trust/methodology surfacing**, (c) **data-import friction**, and (d) a few **new feature
ideas** (stress tests, goals, tax). Evaluate those, not the already-shipped UX.

---

## 2. Points that ALIGN with our direction (low/no conflict — good to adopt)

- **Trust needs methodology + assumptions pages (ChatGPT, trust 6/10).** This is not optional polish —
  it's already our own TRUST RULE ("every result traces to inputs + cited sources: BoE, ONS, HMRC")
  and COMPLIANCE green zone ("explaining capital-market assumptions and citing sources"). Build:
  methodology page, assumptions page, Monte-Carlo explainer, inflation/return-source citations, and a
  persistent FCA "illustration, not advice" line. **Adopt — high priority.**
- **Data-entry friction is the retention killer (both reviews).** Consistent with our
  confirm-holdings rule. Direction: statement/CSV upload + platform import (Vanguard, AJ Bell, ii,
  Fidelity, PensionBee), never ticker-by-ticker typing. **Adopt** (note engineering/security weight
  of any Open-Banking / broker-sync path).
- **Stress tests ("markets fall 30%", "inflation stays at 5%") (ChatGPT #5).** Squarely in the
  COMPLIANCE green zone (user-initiated, illustrative). Low risk, high engagement. **Adopt.**
- **State-pension forecast integration (ChatGPT #1).** Aligns; treat the input as optional +
  explicitly approximate + caveated (COMPLIANCE hard rule 8). **Adopt with caveats.**
- **Portfolio analytics as the differentiator (both reviews).** Matches our unique thread
  ("connects today's holdings to the future outcome"). Already the locked positioning. **Aligned.**
- **Sharper homepage one-liner (ChatGPT).** Our hero is already strong ("Will your money last as long
  as you do?"); the suggested "see in 2 minutes if your money lasts for life" is the same spirit.
  Minor copy iteration, fair/clear/not-misleading. **Aligned.**

---

## 3. Points that COLLIDE with locked decisions (founder decision required — do NOT silently adopt)

### 3a. Monthly freemium SaaS (£5–15/mo) — both reviews' favourite
This is the **opposite of a locked decision**. `HANDOFF.md`: "paid **annual** MOT report… £99 vs
£150/yr… **Annual ritual, not monthly SaaS**," and the single riskiest assumption the whole business
rests on is *annual renewal >60%*.

- **Why it matters:** two *independent* reviewers converged on monthly. That convergence is a real
  signal worth weighing — but flipping to monthly changes the entire product cadence, the engagement
  model, and the thing we planned to fake-door test first.
- **Recommendation:** keep annual as the primary bet; **add monthly to the A/B/pricing test** rather
  than adopting it by default. Decision is the founder's, not mine.

### 3b. B2B / white-label to advisers & "advisers love visual tools" (both reviews)
We deliberately scoped this as a **consumer-first lifestyle business** (~£250k–£2M ARR), not a
venture-scale B2B play. More importantly, selling into IFAs/wealth managers puts Steadybee **inside a
regulated advice process** — a materially larger compliance surface than consumer decision-support.

- **Recommendation:** park as a *future* optionality, not an MVP path. Revisit only after the
  consumer renewal assumption is validated, and only with UK compliance counsel.

### 3c. "Make it actionable" → "raise your chance to 89% by retiring one year later" (ChatGPT's #1 recommendation)
**This is the single most important flag in either review.** ChatGPT's headline advice — turn
"65% chance of success" into *"you can raise your chance to 89% by retiring one year later or
investing £250 more per month"* — is, phrased that way, **close to a personal recommendation and an
outcome promise**, which our COMPLIANCE doc puts in the red zone:
- Hard rule 6: *No outcome promises.*
- Green/red line: *mapping their specific situation to a specific action with a superior outcome looks
  like a personal recommendation regardless of disclaimers.*

The **compliant version of the same instinct is what we already ship**: rank the behavioural levers
by impact and let the user choose ("What moves your plan most… you choose; we don't recommend",
`app.html:112-114`). Keep showing *the user's own what-if results*; never phrase them as
"you can/should raise your chance by doing X." **Do not adopt the verbatim framing.**

---

## 4. Compliance pass on the marketplace / lead-gen / tax ideas

- **Lead-gen / "have a planner validate your plan for £250" / pension-consolidation leads
  (both reviews).** Introducing or arranging client access to advisers for a fee can stray into FCA
  *arranging/introducing* territory, and ChatGPT itself notes it "could reduce trust if overdone."
  Conflicts with our stated independence ("we sell nothing, take no commissions"). **Treat as
  compliance-review-gated; not an MVP feature.**
- **Tax optimisation — ISA allowance, pension tax relief, withdrawal sequencing (ChatGPT #4).**
  *Amber.* Generic education and illustrative allowance figures are fine (we already do "using ISA
  allowance could help (illustrative)", `app.html:221`) **provided** every tax figure carries
  "based on current rules, subject to change" (hard rule 7). But a personalised **withdrawal
  sequence** recommended for *them* edges into advice — keep it illustrative/educational, never
  "do this sequence."
- **Goal planning — university fees, second home, inheritance (ChatGPT #3).** Mostly green
  (user-initiated cash-flow scenarios). Keep illustrative; avoid anything that reads as a suitability
  judgement.
- **"Built with guidance from financial planners" (ChatGPT trust idea).** Only usable if literally
  true and evidenced (financial-promotion rule: fair, clear, not misleading). Don't claim it
  speculatively.
- **DB pensions:** neither review suggested CETV/transfer modelling — good. The hard prohibition
  stands regardless.

---

## 5. Copy fixes applied in this pass (low-risk, compliance-motivated)
- Standardised the projection tile label **"success (reach 95)" → "chance of reaching 95"** across
  `app.html`, `household.html`, `lab.html`, matching the status-bar wording already in `app.html:42`.
  Rationale: "success" labels an outcome as success and brushes against hard rule 6 (no outcome
  promises); "chance of reaching 95" is purely factual/probabilistic.

---

## 6. Prioritised action list (for a future build phase)

**Now / cheap & aligned**
1. Methodology + assumptions + Monte-Carlo explainer pages with cited sources (BoE/ONS/HMRC) — trust
   AND compliance requirement.
2. Persistent inline "Illustration, not advice. Current rules, subject to change." near every
   projection (currently footer-only).
3. Stress-test levers ("markets fall 30%", "inflation 5%") — green-zone, high engagement.

**Next / needs design + engineering**
4. Statement/CSV upload to kill holdings-entry friction; platform import later (security-heavy).
5. State-pension forecast input (optional, approximate, caveated).
6. Real stochastic engine (seeded, auditable numpy Monte Carlo) so "chance of reaching 95" is
   genuinely computed, not a UI placeholder — satisfies TRUST RULE (code-computed, AI never invents).

**Founder decisions (do not adopt unilaterally)**
7. Pricing cadence: keep annual primary; **add monthly to the A/B test** (don't switch by default).
8. B2B/white-label to advisers: park until consumer renewal is validated + compliance counsel.
9. Lead-gen marketplace: compliance-review-gated; weigh against independence positioning.

**Explicitly rejected**
10. ChatGPT's "you can raise your chance to 89% by doing X" framing — replaced by our existing
    user-chooses lever ranking. Do not implement verbatim (red-zone: recommendation + outcome promise).
