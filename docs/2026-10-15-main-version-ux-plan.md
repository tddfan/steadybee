# Main money-picture version: UX consolidation

## Intent
Keep Assets & debt → Income & spending → Planning as the single active experience. Keep Sankey and exact Table visible; retain other charts under Experimental. Improve trust in scenario comparisons and mobile use.

## Implementation
1. Capture a current-plan baseline from recorded inputs and compare scenarios at the same selected year, horizon and money basis. Add net-worth view, baseline overlay, changed-assumption list and undo/reset. Keep scenario growth edits separate from recorded inputs.
2. Group retirement, budget, saving destination, funding shortfalls, tax, mortgage and future costs by purpose. Use precise year/age controls and £ spending entry alongside percentages. Show payoff workings as figures.
3. Make three-section navigation fit phones, mobile chart fit the full timeline, controls discoverable through Adjust scenario, and exact figures available without hover. Keep readable fonts and 44px controls.
4. Make future scheduled amounts vs growth-based projections explicit. Add discoverable timeline event selection. Retain charts as optional experiments.
5. Promote the app at the root and installed-app entry point. Retire older routes to the main app. Preserve old workspace code outside the published bundle because its backup/restore, printable brief and DB-specific capture are valuable migration references. Document gaps; do not silently claim these features exist in the main app.
6. Verify deterministic helpers using Node tests, build output and live browser at phone and desktop sizes. No deployment/commit is requested in this turn.

## Verification criteria
- Same recorded baseline survives scenario edits; Undo restores rates and controls.
- Net worth is assets minus debt; comparisons use the same year and purchasing-power basis.
- Mobile navigation and charts fit 390px and 320px screens without page-level horizontal scrolling; graph alternatives and exact values remain reachable.
- Existing financial-engine tests pass. Current projection limitations remain visible and no allocation recommendation is introduced.
- Main routes open the retained version; archived assets are not deployed.

Required Superpowers workflow skills were searched for and are not installed in this checkout/session. Sites local-only workflow is used with this written plan, TDD for calculation changes and browser verification.

## Completed and verified

- Current-plan/scenario comparison uses the same selected calendar year and horizon, with the selected purchasing-power basis. Net worth is assets minus debt. Current plan is rebuilt from recorded facts; scenario growth/age edits do not overwrite them. Dashed baseline, changes list, numeric controls, linked £/percentage budget fields and grouped undo/reset are implemented.
- Sankey Flow and Table are primary. Other views remain in the Experimental menu. The phone Sankey fits the available width and retains clickable income/spending/saving entries. Full names and exact amounts remain in the Table and entry records.
- Three-section navigation fits 320px and 390px. Main chart fits the full timeline. Scenario controls open/close through Adjust scenario/Show results. Labelled event picker replaces ambiguous dots. Section hashes, browser Back, and home navigation preserve the in-tab journey.
- Mortgage source precedes the repayment switch; payoff is itemised into funding, tax, repayment and remaining debt. Future one-off costs, funding shortfalls, tax and saving destinations are separate controls.
- Root and old entry routes redirect to the retained app. Manifest opens the retained app. Retired UI and its valuable functionality are archived outside the deployed bundle; state and update logic still have active tests. README and HANDOFF identify remaining migration gaps. Nothing has been deployed or pushed by this task.
- Build gives nested calculation imports the same content version as the UI entry point, avoiding stale-module mixing.

### Verification evidence

- 143 deterministic calculation/state/build tests pass; active JavaScript syntax checks and git diff whitespace checks pass.
- Browser checked at 320×740, 390×844 and 1280×900. Page width matches viewport across assets, flow, exact table, planning and the phone adjustment panel. Experimental menu remains within 320px bounds.
- Browser checks verified earlier-retirement comparison, unchanged baseline, growth undo, restored baseline after undo, cash/SAYE payoff (£83,269 sale and £13,269 estimated tax), reset and browser Back to Flow. Portrait Sankey and desktop baseline comparison visually inspected.
- Optional standalone Playwright suite was updated to the active journey but not executed: its Playwright package is not installed in this environment. In-session browser checks used the available browser tools.
- Screenshots: `/tmp/steadybee-main-phone.png`, `/tmp/steadybee-main-desktop.png`.

### Still missing before a public release

Persistent saving/resume and backup/import, printable report/export, full UK tax-year reconciliation and excluded tax categories, complete DB scheme-specific details, verified pension eligibility, observed usability testing and a full assistive-technology audit. The archive preserves earlier useful capture/report/storage code for migration; it is not exposed as a competing version.
