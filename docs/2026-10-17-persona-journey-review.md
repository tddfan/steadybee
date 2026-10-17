# Persona journey review — 17 October 2026

## Verdict

The asset overview is easy to scan, and the intended payroll/budget path produces consistent figures in the cases checked. The personal setup journey is not yet safe from misunderstanding: the most discoverable Add income/Add expense buttons create a different kind of entry from the retirement-aware pay and household-budget controls. This can make a plausible-looking retirement result represent something the user did not intend.

This is a simulated persona walkthrough performed by an AI through the running app, not human research, interviews or measured satisfaction. Reactions below are hypotheses inferred from observed interactions. Financial checks cover the named cases; they are not a complete independent audit of every tax rule or simulation assumption.

## Personas and journeys

| Persona | Task and actual route tested | Observed usability | Likely reaction — inferred, not a quotation |
|---|---|---|---|
| Sam, 47, new to planning, mobile 375px | Find Start my own; add cash £10k, ISA £40k, DC pot £150k and loan £5k; use Add income for Monthly salary £3k and Add expense for Living costs £2.5k; confirm Planning; choose retirement at 60; inspect 2050 | Asset forms/totals are clear. Starting a personal picture is hidden under ⋯. Natural entry buttons lead to ongoing dated items; the readiness warning says no regular budget. Salary remains after the chosen retirement age. | Initially comfortable entering balances; then confused about which controls affect the plan. The green result could create false reassurance. |
| Pat, 64, and Jo, 62, approaching retirement, desktop 1280px | New household; cash £30k, ISA £120k, DC £200k; use Pay & pensions for £36k annual take-home ending Dec 2026; Manage categories for £2.5k/month; set growth/inflation to zero; inspect Jan/annual 2027; enter official pension £200/week from Oct 2029 | The intended route reconciles. The first-retirement-month snapshot and exact withdrawal detail explain the bridge. The pay editor has many fields before an actual take-home amount. Official forecast entry is blocked until NI years are provided. | More confidence after seeing spending funded from cash; frustration at having to provide NI data despite already having the forecast. |
| Experienced self-directed planner, using the fictional public example | Adjust synthetic income and pension contributions; inspect tax flags and Table; run 100 paths at zero volatility; reconcile with deterministic closing accessible assets; inspect saving options | Exact figures and separate deductions are useful. The allowance flag behaves correctly. The simulator matches the fixed-return case. Return variability requires specialist knowledge; zero variability still produces a prominent 100% result. | Can verify the math, but needs clearer guidance about model inputs and the meaning of coverage. Would not treat the simulation frequency as a calibrated personal probability. |

## Findings, in fix order

### P1 — Salary entered through Add income continues beyond retirement

Reproduction: start a personal picture; Add income → Monthly salary → £3,000/month → leave end month blank. In Planning choose retirement at 60 and inspect 2050 (Sam approximately 71).

Observed: headline becomes What if Sam retires at 60?, but income still contains approximately £35,941/year in today's money under Shared / other. The slight difference from £36k comes from monthly inflation discounting. The engine applies retirement years to `flow.pay`, while this natural entry route creates a separate ongoing dated income.

Classification: entry/meaning defect with materially misleading planning consequences, not an addition error. Do not infer retirement linkage from a free-text label. Provide an explicit Salary / pension / other-income choice; route salary to the person and retirement-linked pay model. Make ongoing income and its stop condition visible before confirming Planning.

### P1 — Invalid pay edits throw an uncaught error and leave stale figures

Reproduced twice, including a clean example session: open Pay & pensions and reduce a synthetic gross-pay input below its fixed employee contribution. The engine correctly rejects contribution greater than gross pay, but the live editor has already written the invalid value and calls the renderer without handling the cross-field error.

Observed: uncaught `RangeError: Employee pension contribution cannot exceed gross pay in this estimate.` The inline input-error element stays hidden/empty and the income KPI remains at its previous value. Changing the other field to a valid contribution recovers rendering, but users receive no explanation of the failed edit.

Classification: confirmed runtime/validation defect, not a wrong tax formula. Validate the related pay fields together; show the problem next to those fields and clearly identify pending edits. Keep the last valid calculation distinct from the proposed invalid values. Do not silently discard a contribution.

### P1 — Green coverage remains when debt repayments are missing

Observed in the Sam journey: £5,000 loan with no repayment/rate gives a green Covered to age 95 result alongside a warning that some debt has no modelled repayments. The warning is visible; it does not block the reassuring status or require completing the missing payments.

Classification: completeness/confidence problem. A user may interpret all spending covered as including their debt. Use an incomplete-input status, or qualify the headline as covering entered costs only until repayments are supplied. Keep the entered debt balance visible in that warning.

Related presentation issue: the warning shows £1,933 rather than the entered £5,000 because it discounts a nominal held-constant closing balance to today's money at the end of the horizon. The warning does not state this timing clearly. This is a basis/label issue, not proof that the debt total was calculated incorrectly.

### P2 — Recurring expenses entered through Add expense are not the household budget

Observed: Living costs £2,500/month appears in Flow, but Planning readiness says No regular budget entered. Source check confirms the budget and its percentage changes use regular/custom categories, separately from dated entries.

Consequence: a novice can enter their real monthly spending, then see a £0 base budget or adjust a budget control that does not change those entries. Unify regular expense entry or explicitly distinguish baseline budget from a separately dated cost. Readiness should acknowledge both and tell the user what a scenario adjustment affects.

### P2 — Official State Pension forecast unnecessarily requires NI years

Observed: select Use my official weekly forecast, enter £200/week and Oct 2029 start, leave NI years blank. Save is blocked by the required NI-years field, with Please fill in this field and Add qualifying years from your NI record to start.

Consequence: people with an official forecast but no NI record cannot complete the straightforward route. Make NI years required for the simplified/NI-record illustration only; keep official amount/date entry independent. After entering 35 NI years to proceed in this test, the £866.67 monthly result was correct.

### P2 — Pay editor asks users to understand too much at once

Observed: the two-person pay editor displays base salary, bonus, two employee-pension methods, two employer-pension methods, actual yearly take-home and end month for each person, plus explanatory text.

Proposed fix: start with Gross salary / Take-home choice, annual/monthly choice and person; reveal pension contribution details only for the appropriate route. Keep actual take-home clearly separate from modelled gross. Do not silently overwrite one with the other.

### P2 — Simulation input and zero-variability result need stronger context

Observed: return variability is blank and required, with only an example placeholder; a user needs to know a defensible assumption. With zero entered, all paths are identical and the result displays 100%, as mathematically expected in the tested funded case. Experimental/conditional-model qualifications are present, but zero variability is not explicitly called a deterministic check near the headline.

Proposed fix: show a zero-variability label beside the result and explain the input inline on request. Do not invent or present a calibrated allocation assumption. Keep model frequency separate from a real-world probability; seek actual-user comprehension testing before using the percentage as the leading outcome.

### P3 — Personal setup and secondary actions are harder to discover

Observed: Start my own is under ⋯, while the example dominates the initial screen. Edit People is beside the owner pills, which is logically placed, but a gear icon alone may not communicate person editing to a new user.

Proposed fix: a compact visible Start my picture action for example mode, and an explicit accessible/visible Edit people label where space permits. Existing no-account/local-saving explanations are clear when opened.

### P3 — Simulation rerun message appears before a first run

Observed: the fresh personal journey already shows Inputs changed. Run again to update the ranges before a simulation has ever been run. Normal setup changes cause this message.

Proposed fix: show the rerun prompt only after results existed or an active run was invalidated. Before a first run, retain a neutral empty state.

## Independent arithmetic and consistency checks

| Check | Independent expectation | App observation | Result |
|---|---|---|---|
| Sam totals | £200,000 assets − £5,000 debt = £195,000; cash + ISA £50,000 | £200,000 / −£5,000 / £195,000 / £50,000 | Pass |
| Monthly remainder | £3,000 − £2,500 = £500 | +£500 | Pass |
| Pat first retirement month | Jan 2027: £0 household income; £2,500 spending; £2,500 cash withdrawal | Same snapshot | Pass |
| Pat closing 2027, zero growth | £350,000 + 3×£500 surplus in Oct–Dec 2026 − 12×£2,500 spending = £321,500 | £321,500 assets; £30,000 cash withdrawn during 2027 | Pass |
| Official pension conversion | £200×52÷12 = £866.67/month; below standard allowance in this isolated case | £866.67 from Oct 2029 | Pass |
| £110k gross; £10k employee net-pay pension | Allowance £12,570; annual Income Tax £27,432; NI £4,210.60; net £68,357.40/year = £5,696.45/month | Gross flow £9,166.67 less £3,470.22 deductions = £5,696.45; additional £100 rent is separate | Pass |
| £110k gross; no employee pension | Allowance £7,570; annual Income Tax £33,432; NI £4,210.60; net £72,357.40/year = £6,029.78/month | Allowance flag £7,570; gross flow less deductions matches net | Pass |
| Zero-volatility simulation | Identical lower/median/upper and deterministic closing accessible amount | All three £971,246; main projection £971,246; 100/100 paths funded | Pass, conditional on this test model |

Payroll oracle used separate arithmetic, rather than importing the app estimator. Diagram deductions can differ by a penny from independently rounding annual tax/12 because the flow explicitly reconciles rounded gross, net and pension amounts; this is not a material tax error.

Sources checked for the payroll oracle: [HMRC Income Tax](https://www.gov.uk/income-tax-rates) and [2026–27 employer thresholds](https://www.gov.uk/guidance/rates-and-thresholds-for-employers-2026-to-2027). Cases assume England/Wales/Northern Ireland, employee category A and the app's net-pay pension convention. This does not validate Scottish tax, salary sacrifice, relief-at-source, annual tax reconciliation, or actual payslip deductions.

## Verification and limits

- Current version reviewed: `fb56b18`.
- Live browser journeys at 375×812 and 1280×900. No page-level horizontal overflow in the inspected states. Temporary, unsaved test households only; no real records changed and no external pension login performed.
- Console check found the pay-validation exception above; the separate near-retirement journey produced no browser errors.
- Existing 164 regression tests passed. That does not cover the semantic journey defects above: correct calculations can still use unintended input categories.
- Saving options were inspected and their device-only encryption/passphrase explanation was clear. No new encrypted personal picture was saved during this walkthrough; encrypted round-trip coverage comes from the regression tests.
- No app implementation was changed in this review. Findings remain open.
- Screenshots: `journey-salary-after-retirement.png` shows covered status alongside missing-repayment warning; `journey-official-forecast-blocked.png` shows the official forecast form blocked on NI years. A third screenshot, `journey-pay-validation-error.png`, records the invalid pay editor. All are in this chat's visualization artifact directory.

Recommended next step: fix entry semantics, pay-edit validation and incomplete-data coverage status before further visual polishing or presenting simulation frequency as the main result. Then repeat these same three journeys with actual prospective users, observing whether they can explain what stops at retirement and what the percentage means.

## Subsequent fixes in the landing / saved-scenario pass

The uncaught pay-edit error now shows local cross-field validation and keeps the last valid model until the pending fields are corrected. Official forecast mode no longer requires NI years. A direct personal-start CTA on the landing page improves setup discovery. The simulation rerun prompt stays neutral before a first run. The generic salary/budget entry semantics and incomplete-repayment coverage findings remain follow-ups.
