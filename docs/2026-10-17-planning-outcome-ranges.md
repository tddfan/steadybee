# Planning detail polish and modelled outcome ranges

Replace the remaining document-style calculation area with a Bento surface and closed, topic-based disclosures. Keep the calculation facts and source links reachable. Show withdrawal comparisons as responsive cards with a selected-order marker and separate coverage, net-worth and tax facts, without ranking strategies.

Add an explicit-run, experimental Monte Carlo panel, separate from deterministic coverage. Reuse the monthly engine for every path, including pension access, withdrawals, tax and first shortfall. Require users to enter an annual log-return volatility assumption; no calibrated allocation is known. Entered investment growth is the arithmetic expected annual return. Annual independent normal log-return innovations share the same draw across ISA/DC/share/general proxies (perfect correlation). Monthly factors evenly compound each annual draw. Cash/property growth, inflation, income and lifespan remain deterministic. Existing opt-in retirement shock overlays if selected. This is an illustrative distribution conditional on assumptions, not a validated personal probability of success or a worst case.

Use a fixed disclosed seed and 100/200/500 paths; run in a module worker so mobile interactions remain responsive. Report all-month spending coverage frequency and annual 10th/50th/90th percentiles of accessible closing investments in today's money. First gaps count as failed paths even if later income recovers. Invalidate/terminate results on scenario or input changes; cancel and rerun are explicit. Simulation settings/results are temporary and separate from saved scenario schema.

Tests first: path validation, exact zero-volatility equivalence, repeatable seed, percentile ordering, input immutability, and failure definition despite positive property or locked pensions. Preserve deterministic off-state results and validate the worker in the built bundle.

Primary context: FCA cashflow modelling guidance describes the risk of presenting projections as certainty and the importance of lower-percentile outcomes and explicit assumptions. This prototype does not claim regulatory approval or calibrated market estimates.

## Implementation and verification

- Pure simulation module: `prototype/planning-simulation.mjs`; a validated annual investment-return path is the only new monthly-engine input. With that input absent, existing calculations remain unchanged.
- Dedicated module worker, locally computed with no input transmission. Build identity now covers worker URLs as well as nested imports. No stored-picture format changes; simulation settings and results are temporary.
- Browser run: 100 paths across the full fictional-household horizon completed. The count/frequency, percentile band, exact annual ranges and progress rendered. Cancellation stops the worker. Changing a retirement age during a run terminates it and clears results with an explicit rerun prompt. Undo was then used before a fresh run. No page overflow at 375px or 1280px. Comparison cards and calculation topics inspected at both widths.
- All 164 regression tests pass, including five simulation tests, existing monthly/tax/coverage/storage tests and built worker dependency identity. Module syntax and whitespace checks pass.
- The simulator is experimental and is not empirically calibrated to the entered assets. A fixed seed ensures reproducibility, not predictive validity. The deterministic first-retirement shock remains a separate optional overlay.

Primary design context: [FCA cashflow modelling guidance](https://www.fca.org.uk/firms/undertaking-cashflow-modelling-demonstrate-suitability-retirement-related-advice), checked 17 October 2026. This is context for explaining uncertainty and assumptions, not a claim that this prototype is an FCA-compliant regulated simulation.
