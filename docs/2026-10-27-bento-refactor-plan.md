# Bento design-system refactor

The user-provided Apple Health/Copilot Money specification is the design approval for this increment. Preserve account data, baseline archives, dated tracking and calculation IDs. Leave the implementation uncommitted for review.

1. Establish shared semantic surface, category-colour and five-tier typography tokens in `bento-system.css`. Keep the existing calculation/controller modules and replace their visual wrappers with common outcome, KPI, workspace and grouped-list components.
2. Use three global sections: Assets & debt, Income & spending, Planning. Planning contains a Lifeline / Goals & insights segmented switch. Existing routes and baseline/default Lifeline behaviour remain supported.
3. Assets: promote net worth to an outcome banner; keep three driver KPIs; type/access colour semantics, two-slot item rows, owner pills that disappear when filtered, linked-equity previews for assets and liabilities.
4. Income: promote the monthly surplus/shortfall to an outcome banner; three drivers; keep chart and switcher together; move granular entry lists below the chart. Existing chart/table data and add-entry routes stay functional.
5. Planning: add a clear outcome banner and three whole-horizon KPIs above Lifeline; expose deterministic funding gaps where eligible liquid assets are exhausted while a retired owner's pension is locked. Use existing engine access eligibility, never a second statutory rule. Guard future-work age controls while allowing historical retirement records.
6. Mobile: a shared swipe-to-close handle for dialogs; a resizable scenario bottom sheet with keyboard alternatives and 340px desktop inspector; safe-area padding, 44px targets and reduced-motion support. Currency fields reuse the existing live grouping parser and category-implied sign.
7. Verify pure age/access checks against worked fixtures and existing engine tests. Run synthetic 375px/desktop journeys for all sections, editing, linked equity, grouped inputs and sheet gestures. No live account edits, AI requests or accountant agent runs.
