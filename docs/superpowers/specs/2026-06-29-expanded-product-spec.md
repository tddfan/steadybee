# Steadybee — expanded product spec (2026-06-29)

Approved direction: go thorough. Pro/ProjectionLab-style planner is the paid product; the calm
check-up stays the free hook. Add household planning and port Vesper's planner-relevant brain.

## Tiers
- **Free — calm check-up** (`plan.html`): one answer, ~5 levers, the X-ray. The hook. Stores nothing.
- **Pro — thorough planner** (`lab.html` single, `household.html` couple): KPIs, sliders, multiple
  charts, full lever toolkit, "what moves your plan most", ported Vesper depth. £199/yr.

## Household model (two people + roll-up)
- Per person: age, retirement age, pot(s), monthly contribution, **state pension (£/yr + age)**,
  **DB pension (£/yr)**. Household: one monthly spending figure (inflated), combined pot.
- Spending begins at first retirement; each person's state pension + DB switch on at their own age.
- **Survivor scenario:** from a chosen death age — spending ×0.65, drop the deceased's state pension
  + contributions, DB continues at ~50% (spousal). Surfaces the widow(er) risk.
- View toggle: You / Partner / Household. Chart shows both retirement markers.
- Tax (illustrative): two ISA + two SIPP allowances, two personal allowances → household efficiency.

## Ported Vesper capabilities (planner-fit only)
INCLUDE: portfolio risk depth (vol, VaR, **forward EWMA VaR**, drawdown, beta) · **regime/market
conditions as a "stress-test now" panel** (sequence-risk made real) · cash-drag quantifier ·
**dated snapshots → annual-MOT tracking** · allocation-efficiency (frontier, *illustrative*) ·
CGT / tax-loss-harvesting (*illustrative*).
EXCLUDE (don't fit a planner / advice-adjacent trade signals): rotation/opportunity radar, momentum
signals, daily up/down predictor.

## Lever toolkit (model consequences; never recommend)
Save (contributions, lump sums, max ISA/SIPP + relief, carry-forward) · Timing (retire later, phased/
part-time, defer state pension) · Spend (less, flexible/down-year cuts) · Costs (fees, cash drag) ·
Allocation (risk level / glide-path, illustrative) · Tax wrappers (ISA/SIPP/GIA withdrawal order,
Bed-&-ISA, CGT allowance) · Home (downsize, equity release, clear mortgage) · Guarantees (partial
annuity) · Events (windfalls; big expenses/care) · Legacy (gifting / IHT, illustrative).

## "What moves your plan most" (the compliant "maximise")
Run each lever independently, **rank by impact** on the outcome ("work 2 more years: +4 yrs;
flexible spending: +3; fees: +0.5"). Factual sensitivity ranking — NOT a recommendation. User chooses.

## Compliance lane (hard — stricter as we expand)
Decision-support, NOT advice. No fund/buy recs · no "recommended/optimal" allocation · sandbox &
rankings are illustrative, user-initiated · **no DB transfer / CETV** · tax & IHT are illustrations
with "current rules, subject to change" · drawdown-order shown as illustration, never advised ·
"illustration, not advice" everywhere · numbers computed by code, AI only explains.

## Build sequence (increments — don't ship all at once)
1. **Household two-person Pro view + "what moves your plan most"** ← this increment.
2. Tax-wrapper levers (ISA/SIPP/withdrawal order) + home/annuity levers.
3. Ported Vesper risk depth + "stress-test now" regime panel.
4. Annual-MOT tracking (snapshots/compare).
5. IHT/legacy illustration (Premium add-on).

## Out of scope (now)
Real deterministic engine + live prices (numbers illustrative in prototype); full Vesper port;
real auth/payments.
