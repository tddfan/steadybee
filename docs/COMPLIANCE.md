# Steadybee — Compliance Guardrails

Steadybee is **decision-support and educational software — NOT regulated financial or tax advice.**
The founder is not FCA-authorised. The "decision-support, not advice" position only holds with
strict discipline; it erodes under conversion pressure. This doc is the standing reference and the
**review checklist** for any new copy or feature. (Summary lives in [CLAUDE.md](../CLAUDE.md).)

> This document is internal guidance, not legal advice. Before launch, have the model and key copy
> reviewed by a UK compliance professional.

## The line: education vs advice (FCA judges substance, not labels)
The more we map *their specific portfolio* to a *specific action with a superior outcome*, the more
it looks like a personal recommendation — regardless of disclaimers.

### Green zone (allowed)
- Showing their holdings, concentration, correlation, fees.
- Running deterministic, illustrative scenarios the **user initiates**.
- Explaining capital-market assumptions and citing sources.
- Generic education ("what sequence-of-returns risk is").

### Red zone (forbidden)
- "Recommended allocation" / "optimal portfolio" / "you should hold X".
- "Buy/sell this fund" — any buy list.
- Pre-filled or default allocation *changes* presented as improvements.
- Mapping their portfolio to a specific asset-class shift with a "better outcome".
- Anything implying suitability for *them* specifically.

## Hard rules
1. **No fund/security recommendations. No buy lists. Ever.**
2. **No recommended/"better" allocations.** Scenarios are user-initiated and illustrative only.
3. **Scenario sandbox = behavioural levers only at launch:** save more, work longer, spend less,
   delay state pension. Defer allocation-shift levers (highest legal risk).
4. **DB pensions = immutable cash flows. NEVER calculate a CETV or model transferring out.**
   (UK DB-transfer advice is the most regulated, most-litigated area in UK finance.)
5. **Alerts state facts only:** "concentration rose X%→Y%". Never "consider reducing exposure".
6. **No outcome promises.** Sell *process*, not certainty.
7. **Tax:** "based on current rules, subject to future government changes" on every tax figure.
8. **DB/State pension inputs:** optional, explicitly approximate, heavily caveated.

## Required language
- Diagnosis framing: "your assumptions **may be overly optimistic**" — NOT "your plan is lying to you".
- Every projection: **"Illustration, not advice. Current rules, subject to change."**
- Independence, stated openly: "We sell no products, take no commissions, and never sell your data."

## Financial-promotion rules (Consumer Duty)
All marketing must be **fair, clear, and not misleading**. No exaggerated claims, no implying other
advisers are incompetent, no "hidden truths" hype. Evidence any factual claim.

## Review checklist (run for ANY new user-facing copy or feature)
- [ ] No recommendation to buy/sell a specific fund/security?
- [ ] No "recommended/better/optimal" allocation presented?
- [ ] Any scenario is user-initiated and labelled illustrative?
- [ ] Sandbox levers are behavioural only (no portfolio-specific allocation advice)?
- [ ] No CETV / DB-transfer modelling anywhere?
- [ ] Alerts/statements are facts-only (no "consider…")?
- [ ] Tax figures carry "current rules, subject to change"?
- [ ] DB/state pension inputs marked optional + approximate?
- [ ] "Illustration, not advice" present on projections?
- [ ] Marketing copy fair, clear, not misleading; no exaggeration?
- [ ] All displayed numbers computed by code (no AI-invented figures)?

If any box is unchecked, do not ship — fix or escalate.
