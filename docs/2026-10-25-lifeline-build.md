# Living plan review build

Branch: `codex/lifeline-goal-outlook`. Based on Constellation commit `66be971`, now included in master. This branch is for review and must not be merged automatically.

## Main journeys

- New household: choose a goal and initial budget, enter assets/debt and income, review and preserve a starting baseline.
- Overview: see an explainable Goal Outlook, spending coverage, first shortfall, data freshness and relevant next steps.
- Lifeline: explore Life, Year and Month views, calendar or tax years, milestones, recorded checkpoints and a frozen baseline comparison.
- Return visit: edit a temporary set of balances, ages, pay and spending; review changes; explicitly confirm a dated checkpoint. Cancelling preserves the current household.
- Explore changes: goal-prioritised experiments, before/after goal outcomes, apply with Undo, or save an alternative. Advanced assumptions and estate details remain available.

## Data and interpretation

The original baseline preserves inputs, goal, assumptions and monthly illustration. Later edits do not rewrite it. Deliberately adopting a replacement baseline retains the previous one. Checkpoints remain dated observations; missing history is not filled with invented actuals. Differences are not investment returns. Contributions/withdrawals are attributed only when their intervals are complete.

Goal coverage is a modelled spending fraction, not a probability or suitability score. A late shortfall remains visible even near 100% coverage. Status considers timing, minimum accessible reserve, spending and an optional legacy target. The downside check uses the existing retirement market fall; ineffective tests do not establish resilience.

Journey history is included in existing account pictures and encrypted backups. Older saved pictures can open without history and require an explicit first baseline. Portfolio upload, quote-provider integration and subscription charging are deferred.

## Verification and remaining review

26 calculation, state, account and new journey test files passed. The static build completed successfully. New targeted suites cover immutable baselines, date-matched comparisons, import validation, goal constraints and staged/rebased updates.

Interactive browser checks are pending: this execution sandbox blocks Chromium sockets and local HTTP binding. This is a draft review build; review the first-visit and return journeys on desktop and mobile, keyboard operation, account save/reopen and encrypted backup restore before marking ready.
