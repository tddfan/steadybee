# Steadybee: UI expert and two prospective-user simulations

16 October 2026. Review of the active `prototype/app.html` experience.

## Method and limits

Three independent AI reviewers evaluated the app: one UI/UX expert persona and two prospective-user personas. These are simulations, not interviews with a real expert or customers. The reviewers inspected the current source and README. Live browser access was unavailable; the primary reviewer also inspected existing same-day desktop/phone planning and income-timeline screenshots in `/tmp/steadybee-planning-clean.png`, `/tmp/steadybee-planning-clean-phone.png` and `/tmp/steadybee-timeline-clean.png`. Screenshots support visual observations only; they do not establish interaction success or represent a newly executed browser test.

Implementation facts below were checked against the active source. Predicted confusion and desired features are hypotheses to test with people. No task times, completion rates, customer quotes or willingness-to-pay results were collected. Agreement between the three simulations is not independent evidence of customer demand. No application code was changed in this review.

## Main finding

The app has a useful structure and substantial capability, but users must translate their retirement questions into several forms, dates and chart controls. The strongest next iteration is guided household setup, clearer interpretation of results and reliable continuity between sessions. Additional chart types are a lower priority.

Keep the three-stage journey, explicit example labeling, estimates/needs-review choices, actual take-home entry, exact Flow table, today's-money default, current-plan comparison, Undo/Reset and protected local saving.

## UI expert perspective

| Priority | Current evidence and likely problem | Suggested improvement |
|---|---|---|
| High | **Starting feels destructive.** `Start my own` opens `Clear your picture?`, ending with `Clear everything`. A positive onboarding action becomes a deletion decision. | Give starting a blank personal picture its own wording and transition. Explain replacement of the fictional example; retain a separate clear action for existing personal work. |
| High | **Unsaved personal work is easy to lose.** Saving is optional; the unload warning only runs after encrypted saving has been enabled and changes are pending. The header says `Save picture`, without a persistent explicit tab-only state. | Show `Not saved · this tab only`; offer saving after useful entry and protect unsaved personal work on navigation where browsers permit. Keep saving opt-in. |
| High | **Planning confirmation does not help users check completeness.** `I've checked my starting figures` provides no checklist or direct review summary. | Add a short readiness review with edit links: people/ages, spending, pay end dates, mortgage/debt payments, pension access and forecasts. Separate unknown from confirmed zero. |
| High | **Headline certainty exceeds visible context.** `Covered` and an exact `Accessible before tax` endpoint dominate the result. Qualifications sit in `What counts?` and calculation details. The phone screenshot gives the endpoint considerable space before the chart. | Say `Spending covered under these assumptions`; show the retirement dates, monthly budget and principal assumptions nearby. Label the balance with its endpoint age/date and before-tax basis. Make fictional status visible throughout the example journey. |
| Medium | **Future costs have two scopes.** Recorded dated entries support named recurring and one-off costs, while Planning has a separate unnamed scenario one-off cost. | Provide one discoverable events list/editor with explicit `Recorded plan` or `This scenario only` scope and duplicate cues. |
| Medium | **Mobile editing loses chart context.** Source hides the chart card while `Adjust scenario` is open; users return through `Show results`. | Keep a compact outcome/change summary and a clear results action visible during edits. Test whether the current coverage strip is sufficient. |
| Medium | **Recovery is uneven.** Scenario edits have Undo; asset deletion has no matching undo. Asset validation reports errors at the bottom of the dialog. | Add removal recovery and field-associated errors, moving focus to the first invalid field. |

Sources: `prototype/app.html` welcome, dated-entry and clear dialogs; `prototype/asset-canvas.mjs` start-own, removal and validation handlers; `prototype/planning-view.mjs` confirmation, comparison and mobile adjustment controls; `prototype/picture-storage-view.mjs` status and unload handler; mobile rules in `prototype/asset-canvas.css`.

## Prospective user 1: mid-career household planner

**Persona assumption:** 47, UK employee, time-poor, uses a phone, plans with a partner, has a mortgage, several workplace pensions, cash/ISAs and two children. Wants to explore retirement at 60 and university support.

| Likely usage problem | Feature this persona would likely value |
|---|---|
| Welcome asks only for the first person's name and age. Partner setup is later under `Edit people`, so someone adding a shared home first may miss ownership choices. | Ask `Just you or you and a partner?` during setup; collect both ages and introduce shared ownership immediately. |
| The goal is to retire at 60, but the exact retirement input is a calendar year and the displayed age is approximate. Pay end month is entered elsewhere. | Retirement age/month entry per person, with the resulting final pay month shown explicitly. |
| University support for two children is possible through dated expenses, but the competing Planning one-off field makes the entry route and scope unclear. | A family-events list with multiple named costs, recurring periods, optional templates and visible scenario scope. Improve discovery of existing dated entries rather than describe them as absent. |
| `DC pension`, contributions and pension-access rules require knowledge spread across several forms. | Plain `Workplace/personal pension pot` wording, a short explanation of DC, a statement checklist and explicit current-employer versus old pots. |
| A positive coverage result may conceal forgotten spending or assumed pension access. | A completion checklist and a user-selected weaker-return/higher-cost comparison with clearly stated assumptions. |
| Resuming on another device requires encrypted backup-file handling. | Clear browser-specific saved status and return guidance first; later test demand for secure device transfer, household collaboration and a readable summary. |

This persona already benefits from approximate values, actual take-home pay, named scheduled expenses, separate retirement controls and undo/reset. The chief risk is discovery and comprehension, not an absence of all required calculations.

## Prospective user 2: approaching retirement

**Persona assumption:** 61, UK DIY planner with moderate spreadsheet confidence, married, DC savings and a small defined benefit pension. Wants to stop work at 63 while their spouse continues working.

| Likely usage problem | Feature this persona would likely value |
|---|---|
| A DB pension statement gives gross annual benefits and scheme terms. The active app lacks structured DB capture; generic dated income asks for an after-tax amount without an owner selector. | Dedicated DB pension income entry with owner, gross annual benefit, start date and supported escalation/survivor details. Treat this as income; do not model transfers. Show unsupported scheme terms explicitly. |
| A whole-year retirement scenario is too coarse when several months of salary matter. | Exact retirement month per person and a visible explanation of salary/contribution end dates. |
| The headline shows coverage and a distant closing balance, but does not lead with how the first retirement years are funded. | A retirement bridge summary: spending, regular pension/pay income, withdrawals and lowest accessible balance between retirement and pension start dates. |
| `Accessible before tax` may be read as money available to spend now. | `Investment balance at [age/date], before withdrawal tax`, beside a plain purchasing-power explanation. Distinguish recurring income from withdrawals and explain excluded property/locked pensions. |
| Budget changes are year/percentage entries rather than recognizable household stages. A monthly amount input already exists, but separately scheduled costs and debt remain outside it. | Named stages such as `I retire`, `Partner retires` and `Later retirement`, showing total included costs and ongoing debt. |
| Comparing options with a spouse requires repeatedly changing the same scenario; a printable report is absent from the active app. | Named saved scenarios and a printable household summary showing inputs, differences, gaps and assumptions. |

This persona already benefits from official State Pension forecast entry, ownership separation, today's-money values, explicit first gaps and withdrawal/tax details. The missing DB workflow and retirement-bridge explanation matter more than extra visualizations.

## Suggested order of work

1. **Remove immediate friction:** fix the Start my own transition; show tab-only/saved state; improve removal recovery and field errors.
2. **Guide people to a credible first plan:** couple setup, statement guidance and a targeted completeness review.
3. **Answer the retirement question directly:** exact retirement timing, plain coverage context and a bridge summary. Keep key assumptions beside the result.
4. **Make comparisons useful:** named scenarios and one visible event list with recorded/scenario scope; preserve multiple dated costs already supported.
5. **Extend the retirement offer:** structured DB income, an explicit stress comparison and printable summaries. These require calculation/design work and validation of their own; avoid presenting deterministic stress results as probabilities.

Secure cross-device access and collaboration should follow evidence of need and an explicit privacy design. More chart types are not a priority from this review. Existing saving, one-off/recurring entries, partner retirement controls and exact monthly budget entry should be improved rather than rebuilt as supposedly missing features.

## Real-user validation script

Recruit one person resembling each persona and a practicing UI/accessibility reviewer. Use fictional figures or redacted statements and avoid collecting unnecessary financial data. Run unassisted tasks before explaining controls:

1. Explain whose figures the example shows, then start a personal household with a partner and jointly owned home/mortgage.
2. Enter pay from a monthly payslip and two pension statements. Explain which amounts are gross/net and where contributions go.
3. Schedule university support for two children, or a home repair, without duplicating the expense. State whether it changes the recorded plan or only a scenario.
4. Set different retirement dates for both people. Explain exactly when each salary stops.
5. Explain `Covered`, the closing balance, today's money and a case with a funding gap despite positive pension/property balances. Identify what funds the years before pensions begin.
6. On a phone, change spending, inspect the effect, undo and recover the original plan.
7. Save, close and resume. Explain where the data is stored, how another device could open it and what happens if the passphrase is lost.

Record actual completion, assistance needed, errors, hesitation and participants' own explanations. Ask which feature they would use for a concrete upcoming decision and what they would use instead. With two participants, findings remain exploratory; do not report population percentages or claim demand has been validated.

No new automated tests were needed for this documentation-only review. Live interaction and assistive-technology testing remain outstanding.
