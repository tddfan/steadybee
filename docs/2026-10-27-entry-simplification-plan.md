# Entry and navigation simplification

Approved design: the seven-point assessment accepted with “do it”. This is a bounded refactor of existing flows; the calculation engine and account schema remain unchanged. Execute inline and leave changes uncommitted for user review.

1. Monthly Entries: one canonical list, filtered All / Income / Spending / Scheduled. Active dated entries appear once; future/past entries remain inspectable. State Pension records live within Income. Add buttons on the chart and ledger open the same entry chooser/editor, with specialist salary, dated and NI forms inside one dialog. Existing recurring versus one-month tracking controls remain.
2. Asset filtering: a pure group filter selects assets and related debts by owner, type or access. Chart selection and list filters share one state, with Clear filter. Chart grouping switches clear the previous filter. No stored holdings change.
3. Savings: retain one waterfall and move its existing reserve, subscription, split and routing controls into one Saving settings dialog. Preserve settings and deterministic calculations; distinguish the scenario-only override in Lifeline.
4. Navigation: one shared navigation in the app header, one active state for all planning subviews. Preserve old route aliases and compatibility action IDs. Hide navigation during onboarding.
5. Remove the four unused cash-flow chart renderers, buttons and host markup. Keep the Sankey and audit table. Preserve inheritance as a secondary view and long-term assumptions in Lifeline.

Verification: write a failing unit test for type/access/owner filtering and a synthetic browser journey for one editor, date-sensitive entries, settings persistence, shared navigation, legacy routes and 375px layout. Verify baseline archives remain identical, calculations keep their existing results, and browser console has no errors. Run relevant existing browser suites, focused calculation/persistence tests, build and whitespace checks. Inspect desktop/mobile screenshots and rebuild the local dist app.

## Implemented

- `flow-ledger-view.mjs` supplies one Monthly Entries list with All, Income, Spending and Scheduled filters. Active scheduled items are not repeated in All; future/past items retain dates and one-off amounts. Salary, recurring expenses, dated receipts and NI records open specialist panes in the same dialog. The flow graphic remains directly editable; the table is an audit view.
- `holdings-filter.mjs` selects assets and linked debts without changing the household. Chart categories and list pills share a selection across People, Type and Access. Clear filter restores every holding. The redundant donut drill list and per-list totals are removed.
- One waterfall remains below entries, with a Saving settings action that opens the original routing, split, reserve and ISA controls once. Validation messages are inside that settings dialog. Lifeline labels its alternative destination as a scenario override.
- The shared app-header navigation covers Assets & debt, Income & spending and Planning, including Goals and inheritance subviews. Legacy hashes and programmatic action IDs remain supported. Onboarding hides navigation.
- The four experimental cash-flow chart implementations, markup and styles are removed. Long-term assumptions remain in Adjust outlook. Inheritance remains available.
- The account schema, financial engine and archived baselines are unchanged. State Pension rows show net income when active and distinguish future gross forecasts from this month’s income.

## Verification · 27 October 2026

115 focused tests passed. All 16 relevant synthetic browser journeys passed on desktop and 375px. Coverage includes shared navigation and legacy routes, inheritance access, type/access/owner filters, one-off and recurring entries, the single editor, empty-income quick-add, cancellation rollback, dated tracking and correction history, frozen baseline preservation, settings reload, scenario apply/discard/undo, exports and unavailable AI. Browser external requests were blocked; no live accounts, AI providers or accountant agents were used. Mobile top-of-page, entry list and editor screenshots were inspected. Production prototype build and whitespace checks passed. Changes remain uncommitted for review.
