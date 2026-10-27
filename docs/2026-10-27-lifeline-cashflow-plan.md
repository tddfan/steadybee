# Lifeline: clearer cash flow and financial turning points

Replace overlapping Income/Funding choices with one Money in & out view. Keep old metric IDs valid when loading accounts, mapping an old income chart preference to the combined view. New Lifelines open with cash flow; saved asset-chart preferences are retained.

The cash-flow chart uses paired bars: income received plus money taken from assets on the left, costs paid plus unpaid costs on the right. A shortfall is never drawn as incoming money. Annual summaries retain monthly shortfalls even when a different month has a surplus. Detailed current/baseline/preview comparisons remain in the selected-period figures; asset charts retain their three overlaid paths. Other flow metrics use bars; wealth balances use lines.

Show an explicit selected-period status: covered by income, covered using assets, or unpaid costs. Income includes pay, pensions and rent after modelled deductions; money taken from assets is a withdrawal, not additional earnings. Tax is already deducted and is not subtracted again.

Add distinct engine-derived turning points for the first unpaid cost, cash being used up, accessible assets being exhausted and all modelled assets being exhausted. Cash at zero is not labelled insolvency; locked pensions/property may remain. Plot important events with keyboard/touch inspection and shade periods with unpaid costs. Keep retirement, pension access and scheduled events available.

Verify hand-worked cash-flow cases, monthly-to-year aggregation, common price basis, event accuracy and account preference compatibility. Run synthetic desktop/375px journeys with income surplus, asset-supported retirement and an actual shortfall. Preserve the uncommitted Bento changes, baseline archives, calculation engine and saved household figures.

## Delivered and verified

- Money in & out replaces the two overlapping visible choices. Old saved income preferences migrate on restore; explicit asset-chart preferences remain.
- Paired stacked bars show after-tax recurring receipts + net asset withdrawals versus paid + unpaid costs. Flow metrics use bars; stock metrics retain current/baseline/preview lines.
- The headline now prioritizes the first unpaid-cost month or the covered-through month. Selected-period badges distinguish income coverage, asset-supported costs and unpaid costs, including monthly shortage counts.
- Turning points use the engine's eligible-asset rule and the rewound opening holdings, including dated tracking. Same-position chart markers cluster; subordinate same-month exhaustion cards are suppressed while the event rail retains the individual events.
- Bar scopes are explicit: current or preview cash flow, with baseline/current/preview values below. No financial engine or archived baseline calculation changed.
- Verification: 112 focused tests passed, plus the new dated-opening regression (8 cash-flow tests now pass); 9 synthetic desktop/mobile browser journeys passed. Browser tests cover 375px overflow, legacy income preferences, keyboard event inspection, baseline preservation, exports, scenario apply/discard/undo, and unavailable AI. Build and diff whitespace checks passed. Local server returns HTTP 200.
- These changes, alongside the preceding Bento refactor, remain uncommitted for review.
