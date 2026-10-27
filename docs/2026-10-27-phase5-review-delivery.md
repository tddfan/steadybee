# Phase 5: goal-aware review

Built on `codex/asset-constellation-demo`; Phase 4 goal entry is included in the same branch change.

## Behaviour

- Plan stores a main goal and quarterly/annual review cycle with explicitly completed review dates. Chart inspection and review completion do not create baseline versions. Later financial inputs, goals and assumptions are identified as changes since review.
- The review compares the estimated closing net assets for the current month with the original frozen output for that same month. A balance difference is not labelled investment performance. Dates outside overlapping coverage stay unavailable.
- Goal comparisons use a shared, explicitly dated purchasing-power basis. Blank targets are unknown; zero is valid. Outside-horizon dates never borrow a later balance. Spending checkpoints include scheduled household costs, exclude debt service and disclose partial month coverage.
- The version 3 AI request contains anonymous goal type/person/date/amount, current and candidate goal checkpoints, cash/reserve assumptions, dated baseline difference and opening-year ISA input checks. Names, IDs, notes, goal labels and completed-review history are excluded. The consent view displays the data before any external request. Older request formats remain accepted.
- AI selects only supplied, already calculated candidate IDs. Response copy is reviewed and numeric effects come from the engine. The deterministic review works without the AI service.
- Lifeline shows baseline, current and temporary scenario paths together. Zoom, date and money-display controls preserve preview state. Changed financial inputs discard a stale preview. Apply/Discard/Undo preserve the original observations and frozen baseline; preview state is excluded from autosave.
- Opening controls no longer silently inserts an unchanged 100% spending phase.

## Supported rules and limits

The ISA input check covers the overall 2026–27 subscription limit from GOV.UK, distinguishes missing values from a recorded zero and stops showing headroom for stale/unsupported records. It does not assess eligibility, flexible replacements or subtype rules. The displayed unused amount is not a quantified tax saving. Pension annual allowances/taper/MPAA/carry-forward, dividends, realised gain/loss allowance use and survivor cash flow remain unassessed.

- https://www.gov.uk/individual-savings-accounts/overview
- https://www.gov.uk/individual-savings-accounts/how-isas-work

## Deployment

Deploy `netlify/functions/planning-analysis.mjs` with the frontend to enable goal-aware AI. Availability reports supported request versions. An older function produces an explicit update message before financial data is sent. No keys or account permissions are changed by this work. The local bridge still requires the configured authenticated AI service.

## Verification

Focused deterministic tests cover goal arithmetic, price basis, missing/zero targets, horizon boundaries, ISA dates, immutable baselines, review history, anonymous AI validation and protected server behaviour. Synthetic browser journeys cover account reload, 375px layout, AI unavailable, three-path preview, date/zoom persistence and Apply/Discard/Undo. No live household or AI provider requests are made by these tests.

Verified 27 October 2026: 86 focused tests and nine browser journeys passed. After adding blank-date/invalid-amount form guards, the nine affected calculation/AI tests and both Phase 5 browser journeys were rerun successfully. The production prototype build and whitespace checks also passed.
