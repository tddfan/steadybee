# Phase 3: default Lifeline workspace

**Follow-up:** [Single-chart consolidation and baseline-aware adjustments](2026-10-25-lifeline-consolidation.md) supersedes the legacy scenario-workspace presentation described below.

Implemented locally on `codex/asset-constellation-demo`. Phase 1 established frozen, versioned baselines; Phase 2 added dated tracking and replay. This increment makes those foundations visible as the main Lifeline workspace. The strategy's original combined engine/workspace milestone was split into the Phase 2 tracking increment and this Phase 3 UI increment. Goal-led Plan consolidation follows next.

## What changes for the user

- Lifeline is the first tab and the default destination. Assets & debt and Income & spending keep their existing inputs, breakdowns and editing paths. Explicit links to an input screen still open that screen. Older `#planning` links remain supported.
- Compare the current outlook with the active baseline or select any archived version. The selected reference changes only the comparison. It never adopts old inputs, changes the current projection's opening date or recalculates the archived forecast. A personal household without a baseline has no invented reference; it can establish one explicitly. The fictional sample uses its original synthetic outlook, separate from account baselines.
- Life shows calendar-year flow totals and each year's last available balance. Year shows monthly results, with calendar or April–March windows. Month shows a compact current/baseline comparison, dates and the monthly financial context. Date inspection never interpolates daily balances or cash transactions.
- Net assets is the default metric. Accessible investments, total assets, debt, income after tax, spending and Tax & NI are alternatives. The two lines use different strokes; a Today boundary is positioned within the monthly timeline. Historical current estimates have a dotted stroke. Recorded updates have explicitly labelled event chips and true source dates, not markers claiming the entire household was observed.
- Hover, touch dragging, the accessible range slider, date/month input and previous/next controls inspect the same model. Event chips jump directly to their month/date. No financial input or new tracking date changes merely because a chart point was inspected.
- The inspector compares closing net assets, accessible investments and debt; it shows opening/closing net assets and current/baseline income, spending, withdrawals, contributions, tax and unfunded spending. Partial-year coverage is explicit. Different coverage does not produce a misleading numeric improvement. Recorded updates are listed with effective dates; other items remain estimates.
- The small information icon opens calculation conventions, current-period tax components and existing model limitations, with an entirely local monthly CSV export in nominal pounds. Income is already after deductions; tax must not be subtracted twice. Incomplete tax estimates remain flagged. Detailed legacy tax/cumulative and withdrawal calculations remain available.
- **Adjust outlook** opens the existing scenario workspace. Saved scenarios, Undo, stress tests, outcome ranges, inheritance and AI remain available during migration. The legacy readiness check still applies when opening detailed scenario tools. No goal-scoring claim or new probability model is introduced.

## Data and calculation semantics

`lifeline.mjs` reuses the existing monthly planning engine and Phase 2 tracking replay. It does not implement another tax or pension calculator. Frozen reference rows come from `baselineMonths`, including archives made by Phase 1. Reading another baseline cannot rerun those outputs with current rules.

The default current opening basis is the tracking timeline, or the first effective saved baseline/opening timeline. Selecting a different comparison cannot move it. Current assumptions and the active saved scenario determine the forward outlook. The next goal-led Plan increment must make adoption/preview semantics more explicit; this increment preserves the existing scenario workflow.

Both paths use one common purchasing-power basis: the current month and current inflation assumption. Each archived baseline's own deflator is deliberately ignored for comparison. Its original nominal amounts and assumptions stay saved. This avoids presenting a change caused solely by different inflation anchor dates as financial progress.

Flow metrics sum their monthly values; balances use the closing stock. Tax-year zoom groups April–March and does not split April at 6 April. The existing monthly model's other UK tax, contribution-limit, pension and inheritance exclusions continue to apply. Archived component/per-asset forecasts that were not stored are not invented; the new tax-component detail is labelled as current-period data.

Optional version-1 `picture.lifeline` settings store zoom, metric, purchasing-power display, year basis, inspected month/date and reference ID. They survive the existing account document and sign-in checkpoint. Old documents remain valid. No Supabase schema change, new account permission, account-data migration or external data transmission is required. Viewing a reference saves only view preferences, not a new financial baseline.

## Verification

- Nine deterministic Lifeline tests cover frozen/reference independence, initial coincidence, no invented personal baseline, stock/flow aggregation, partial years, one common inflation basis, tax-year windows, dated observations, opening balances, mismatched coverage and document validation.
- The full non-browser regression run passes 305 tests, including existing finance engines, account state, AI request validation and deployment packaging. All provider calls in these tests are mocked; this is not live-provider verification or a new accountant audit.
- Three isolated browser journeys cover default navigation, baseline selection without mutation, calendar/tax-year zoom, recorded-date inspection, CSV contents/download, preferences and reload, retained scenario editing, 375px layout, keyboard scrubbing, event jumps and the old Planning route. Four existing baseline/tracking browser journeys also pass.
- Browser requests are restricted to the synthetic localhost account fixture. No live household, login, Supabase data or AI provider is changed by these tests. Screenshots are kept in ignored `test-artifacts/`.

The local build is served on port 8766 for review. This delivery does not publish to production. A full assistive-technology audit and observed testing with real target users remain future work.
