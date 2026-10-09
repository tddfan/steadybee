# Steadybee — full retirement preview review

9 October 2026 · Fictional experience prototype · Founder feedback and simulated critique

## Product decision: the whole retirement picture

The founder’s latest feedback is that the landing preview makes Steadybee look like a bridge calculator, while prospective users need to understand retirement spending into later life. The bridge is an important stage within that wider job. The product question is: “What funds each stage of my retirement, what changes if I stop or reduce work, and which years are not covered under my assumptions?”

The accompanying willingness-to-pay critique is substantially accepted. A personal information organiser and fictional playground are not yet a paid personal decision product. Production priorities are verified calculations on the user’s own entered information, spendable income after supported tax treatment, understandable withdrawal sources, phased work and adverse-return/inflation cases. Interactive personal levers come after those calculations reconcile. A one-off decision pass is the lead offer hypothesis; the suggested £39–£79 price and B2B feasibility ratings are research stimuli, not validated demand or commercial forecasts.

A universal cash → ISA → pension withdrawal order is not an agreed recommendation. Future supported illustrations must compare explicit user-selected withdrawal policies, account owners, access rules, gross/net income and tax assumptions. “25% tax-free” is subject to applicable allowances and scheme/protected rights, and State Pension start dates/amounts require individual confirmation. Neither a tax-free allowance nor a disclaimer establishes correctness. Monte Carlo is not a release requirement by itself: first implement transparent adverse cases with disclosed assumptions; any later probabilities need a validated method and limitations.

### Acceptance requirements

| ID | Requirement | Current status |
|---|---|---|
| LIFE-01 | Discovery previews work, pension access, later income, spending coverage and remaining money through an explicit endpoint. Both access and later shortfalls remain visible. | Implemented in the fictional landing preview |
| LIFE-02 | Ages 90 / 95 / 100 change actual annual rows, totals, chart limits and assumptions. Landing starts at 95; existing direct workspace defaults remain 90. | Implemented, with shared calculations |
| LIFE-03 | Income and withdrawals are annual flows; savings and pension pots are year-end balances. Income used is capped at spending; surplus is not counted twice. | Implemented, two chart views and year inspector |
| LIFE-04 | All alternatives share the selected endpoint. The endpoint and authored choice carry into workspace, refresh, temporary deployment restoration, brief and CSV. | Implemented |
| LIFE-05 | Bridge zoom is optional; returning to all years restores the chosen endpoint. A zero early gap never hides a later shortfall. | Implemented |
| LIFE-06 | Name whose age sets a household endpoint and show the partner’s corresponding age. Do not imply death, survivor or inheritance modelling. | Implemented in example workspace; survivor mechanics remain production work |
| PROD-NEXT | The same full-period experience works on the user’s own information with validated, supported personal cash flows, tax/access rules, phased earnings and explicit adverse cases. | Not connected; highest-value next workstream |

The planning endpoint is an assumption, not a prediction of death. Production scope must separately specify spending phases, major/care costs, inflation/returns, fees, eligible pension/DB details and household survivor changes before describing a personal “complete” forecast. Unsupported features remain visible. Current fictional income stays constant in real pounds and uses authored net amounts; no actual UK tax, changing-market or survivor calculations have been added.

### Implemented preview and consistent handoff

The hero now says “Your whole retirement picture” and opens with annual spending coverage from Alex age 52 to 95. A separate view shows savings outside pensions and invested pension balances, with shortfall years shaded. A chosen year exposes income used, savings withdrawals, pension withdrawals, annual shortfall, available/locked pension balances and cumulative unpaid spending.

Milestones show stepping back, assumed pension access, later income and the chosen endpoint with age and year. The before-access amount and later shortfall start/period are separate. Retire-at-58 and part-time choices still expose later shortfalls. Household and already-retired examples are linked from the hero area; each receives the selected endpoint.

The fixture engine extends the existing ledger without changing any earlier row. Version 2026-10-09.3 adds explicit supported endpoints and provenance; original age-90 arithmetic stays unchanged. Workspace, brief and CSV evaluate the same endpoint. Authored choice/example URLs are synchronised so a normal refresh retains the named selection and endpoint. Custom unsaved scenarios still require the disclosed save/backup workflow.

### Fictional full-period results

| Alex choice | Early access shortfall | First later shortfall | Unpaid spending through 90 | Through 95 | Through 100 |
|---|---|---|---:|---:|---:|
| Retire at 55 | Ages 57–59: £106,777.19 | Age 81 / 2055 | £335,863.92 | £455,863.92 | £575,863.92 |
| Retire at 58 | £0 | Age 83 / 2057 | £187,743.14 | £307,743.14 | £427,743.14 |
| Part-time £24k/year, ages 55–59; ends at 60 | £0 | Age 82 / 2056 | £206,570.33 | £326,570.33 | £446,570.33 |

These are sums of uncovered annual spending in today’s pounds, not amounts to contribute now. All three illustrative choices end with £0 assets at these endpoints while later pension income still covers part of spending. Later covered years do not repay earlier gaps, and the ledger assumes no borrowing, deficit interest or automatic spending reduction.

### Review feedback and fixes

Three existing simulated reviewers represented six hypothetical perspectives: early/DC and spreadsheet planners, household planner and less-involved spouse, retired income-led and privacy/low-need users. Advik checked the extended ledger; Aarav independently checked browser behaviour and reconciled exports. These are model-generated critiques, not customer interviews.

Initial review required the full-period view to lead, real endpoint recalculation, a visible later shortfall even when the bridge is closed, separate income/balance semantics, explicit part-time duration and visible household/retired routes. The second source review found the core concerns addressed. It also replaced “Try a longer life” with “Test spending through age 100” and derived the restored coverage period from ledger rows instead of hardcoded ages.

Browser testing found the taller rotated decorative backing card caused horizontal overflow on narrow phones. Mobile rotation was removed, narrow shortfall numbers resized and chart controls stacked at 320px. The reviews continue to treat payment as conditional on reliable personal modelling and benefit over existing workarounds; a low-need user may rationally remain a non-buyer.

### Verification and delivery

**60 checks passed:** 30 state/fixture + 9 update + 21 browser checks. The new checks cover unchanged ledger prefixes, actual 90/95/100 recalculation, funding/asset reconciliation, both shortfall periods, selected endpoint and authored-choice handoff, normal refresh, removal without resurrection, temporary restoration, brief and CSV. The shared endpoint is excluded from alternative-change copy and retained in assumptions/provenance. Phone layouts and charts were inspected at 320/375px and desktop1440px: no horizontal overflow, 13px SVG tick labels, readable shortfall figures. The existing one-page household brief check passed; chart and planning controls remain outside print output. JavaScript syntax, Git whitespace and the eight-page static build passed. Source and visual reviews found no remaining material blocker in the reviewed tasks. These checks do not certify financial-model accuracy, broad accessibility or customer comprehension.

### Evidence limits and next decision

The revision demonstrates a clearer full retirement timeline and preserves the scope separation between personal intake and fictional results. It does not prove retirement affordability, real-user comprehension, willingness to pay, demand for the proposed price or B2B sales feasibility. The next production milestone is supported personal annual cash flow, followed by observed human tasks and fulfilled paid commitments within that scope.

Current rules sources checked for the domain caveats: [GOV.UK pension tax-free cash](https://www.gov.uk/tax-on-pension/tax-free), [GOV.UK lump-sum allowance](https://www.gov.uk/tax-on-your-private-pension/lump-sum-allowance), and [FCA cash-flow modelling](https://www.fca.org.uk/firms/undertaking-cashflow-modelling-demonstrate-suitability-retirement-related-advice). The published example engine does not apply those rules.

