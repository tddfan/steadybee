# Phase 2: dated household tracking

Implemented locally on `codex/asset-constellation-demo`. This extends Phase 1 baselines; it does not introduce the Phase 3 Lifeline workspace or market-data connections. All verification fixtures use synthetic households.

## User journey

- Keep Assets & debt and Income & spending as the input screens. Starting setup remains unchanged until the household has a baseline. Once a personal baseline exists, the item editors offer a statement date and Log update; the pay/spending editor offers an effective date and ongoing change / this month only.
- Pay and regular-spending edits are staged. Log update commits one reviewed record; Escape discards the edit. Keystrokes do not become observations or autosaved changes to the account. Unchanged prefilled fields are not recorded as new pay observations.
- A person's one-month pay option asks for the actual monthly take-home received. Internally it uses the existing annual-pay representation, but UI history/corrections display monthly amounts. A receipt does not permanently reset salary or restart pension contributions after employment ends.
- Existing one-off and scheduled entries retain their occurrence/start/end controls. Additions, amendments and removals join tracking history. A past one-off is applied to its occurrence month; a future schedule is recorded as a change known now and contributes only when due. Changes to existing recurring schedules take effect from the current recording month, preserving earlier periods.
- History sits beside baseline access. Inspect a month to compare baseline expected gross salary rates with applicable recorded rates; starting rates and missing subsequent confirmation are identified. The update list shows effective and recording dates, before/after values and corrected entries. Corrections append an audited revision rather than deleting the original.
- Account saves, sign-in checkpoints and encrypted document validation carry the tracking records alongside the baseline library. Existing household documents without tracking remain valid. No new database table, authentication provider, account grant or production data migration is required.

## Calculation conventions

- Current recurring rates apply for the selected whole month. Exact dates are retained as provenance; this is not a daily payroll calculation. Earlier rates remain available, including backdated changes replayed in effective-date order.
- Each explicitly recorded field has an initial value and subsequent records. Unmodified fields retain their existing assumptions. Forecast growth restarts from the effective date of a newly entered monetary rate; pension percentages remain percentages. Regular private-pension/other-income fields retain their existing nominal treatment.
- Tax-year recurring-income estimates use the applicable dated pay rates across April–March. They do not multiply the latest annual rate into every month. Estimated tax can reconcile earlier modelled net amounts when new information changes the year's expected liability; a recorded take-home receipt stays fixed and is never taxed twice. Unknown payroll deductions remain excluded/flagged.
- Existing retirement/end-date scenario controls remain in force. Confirmed receipts after employment can be recorded without creating employment or contributions. New receipt rows and balance adjustments are distinguished from forecast salary and return assumptions.
- Statement balances replace the corresponding modelled closing balance. They are not deposits and are not automatically investment returns. Subsequent months continue growth, contributions, spending and withdrawals from that anchor; other accounts continue projecting. The engine records the unexplained adjustment for later Lifeline inspection.
- For recurring cash flow, a closing debt statement affects the next month's opening balance. Debt zero stops future payments. A balance-only mortgage statement retains its known contract and maturity rather than restarting the term. A sale/removal does not invent proceeds; record any known proceeds separately.
- Cost-basis corrections update the withdrawal model where an explicit basis is supplied; valuation changes alone do not fabricate a new cost basis. Existing tax-model exclusions remain.
- Baseline versions and their saved outputs stay unchanged. A new baseline can preserve dated source records so that a single monthly receipt does not become permanent future income.

## Validation and limits

Tracking supports up to 200 audited entries within the existing household-document size limit. It never silently prunes history. Targets, dates, amounts, rates, lifecycle records and correction chains are validated before state is committed; public examples cannot become personal tracking records. Future statement balances and future actual-month receipts are rejected; future assumptions belong in schedules/scenarios.

Partner removal is blocked if it would orphan dated partner/shared records. Existing asset-reassignment checks still apply. Supporting an archived former household member is a later feature.

Profile edits, State Pension forecasts and general growth/routing preferences retain their existing input behaviour; this phase does not claim a complete event history for every configuration field. Household amounts are user-recorded or modelled, not independently verified. No market data or bank transaction reconciliation is added. The monthly engine's existing UK tax, pension and inheritance exclusions remain in effect.

## Verification

New deterministic cases cover historical rates, one-period receipts, explicit zero, backdated replay, correction audit, weighted tax-year pay, income/contribution effects, pension balance anchors and subsequent growth, debt payoff, mortgage maturity, rent-rate growth, one-off inflation, legacy optional fields, encrypted round-trip and baseline receipt semantics.

The isolated browser suite verifies baseline preservation, reviewed versus cancelled edits, income history, corrections, one-month receipts, asset statements, account reload, example separation and 375px spending/history layouts. It blocks external browser requests and uses a local synthetic account backend; it is not a live Supabase account or RLS audit. Screenshots stay in ignored test-artifacts/.

The broad regression run passed 219 tests before the final legacy engine-version compatibility check was added. Four isolated browser journeys passed. The final targeted baseline/tracking and build checks also verify that Phase 1 forecast archives remain readable without replacing their saved results.
