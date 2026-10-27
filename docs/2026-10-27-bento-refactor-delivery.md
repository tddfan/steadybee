# Bento refactor delivery

Implemented on `codex/asset-constellation-demo`, left uncommitted for review.

## Interface

- A shared `bento-system.css` now defines the canvas, white 18px cards, semantic colours, five-tier typography, grouped rows and mobile geometry. Existing controller IDs and saved document formats remain intact.
- Three global sections: Assets & debt, Income & spending and Planning. Planning contains the Lifeline / Goals & insights segmented switch. Existing `#lifeline`, `#plan`, `#planning`, `#insights` and inheritance routes remain supported.
- Assets leads with net worth, then three drivers, the type/owner/access chart and two-slot item lists. Icons describe asset categories, filtered rows hide redundant owners, and linked debts show net equity. Editing a linked liability also gives a live equity preview.
- Income leads with monthly surplus/shortfall, then income, deductions and spending drivers. The chart and its view controls stay together; entry lists follow. Expenses and liabilities derive their display signs from category. Experimental chart alternatives are retained in code and removed from the main control row.
- Lifeline leads with its ending accessible balance, funding status and three whole-plan driver KPIs. Year/month detail and export remain available below. A funding shortfall with exhausted eligible funds and a retired owner's locked pension produces a dated, clickable warning.
- Currency targets reuse live thousand grouping and the existing numeric parser. Future-work age controls prevent ages at/below current age or at/above an explicitly set horizon age. Historical retirement records remain valid; saved values are not silently changed to fit a slider.
- Dialogs become mobile bottom sheets. Shared grab handles support swipe dismissal and keyboard close. The existing scenario panel stays 340px wide on desktop and becomes a resizable bottom sheet below 768px, with safe-area and reduced-motion support.

## Verification · 27 October 2026

- 105 focused calculation, persistence, AI schema, input-check and build tests passed.
- 12 synthetic browser journeys passed across desktop and 375px. They include baseline/tracking round trips, account reload, three-path previews, Apply/Discard/Undo, grouped amounts, equity previews, invalid age inputs, ownership filters, keyboard resizing, swipe dismissal and pension-access gap inspection.
- Screenshots under ignored `test-artifacts/` were inspected. The production prototype build and whitespace check passed.
- Tests use synthetic households and block external requests. No live accounts, AI providers or accountant agents were used. No deploy, push or commit was performed for this refactor.

The access warning uses the same eligibility function as drawdown. It reports a modelled funding shortfall, rather than treating every locked pension or low cash balance as an error. Fixed-duration projections remain supported; the retirement-versus-horizon age guard applies when an age horizon is explicitly selected.
