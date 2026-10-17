# Clean finance theme

Implement the existing local app with a white, restrained blue, sans-serif theme. Planning leads with the household’s retirement question, one spending-coverage result under assumptions and the chart. Scenario controls, current-plan comparisons, year details and assumptions open when requested. The asset breakdown stays visible above individual records.

Add a starting-figure checklist, visible example/saving status, and a positive Start my own transition. Editing retains the chart and the compact coverage result. Preserve the deterministic engine, saved-picture schema, existing navigation and privacy model. No publication or new hosted Site is part of this local-app change.

Verify the existing calculation/state/storage/build tests, module syntax, and responsive browser journeys at desktop, 390px and 320px. Exercise scenario edit/undo, baseline preservation, confirmation, example-to-personal setup and saving status. Record limitations and actual verification after implementation.

## Implemented

- Added `prototype/finance-theme.css` as the shared presentation layer: white surfaces, restrained blue, sans-serif type, flat panels, underlined navigation and consistent numerical labels. Build output versions the theme with the rest of the app.
- Planning asks the household's retirement question and shows an explicit fictional/personal context. Final-pay dates are discoverable beside the question. The comparison states that coverage depends on assumptions, gives end ages and dates the accessible investment balance before withdrawal tax. Key budget, inflation and pension-growth inputs are visible.
- Retirement ages map to the existing scenario years, accounting for final-pay months before the assumed birthday. Recorded pay end dates remain unchanged. Actual birth dates are not collected; timing remains approximate.
- Chart style/group controls are under Chart options. Pension and growth shortcuts reveal the correct controls on phones. Mobile editing preserves the chart, adds a sticky coverage summary and moves keyboard focus into the controls.
- Added a personal starting-figure checklist and review links, positive wording for starting a blank picture, explicit tab-only/browser-saving status and a scope explanation for extra scenario costs.
- A first-retirement-month panel reads spending, income, withdrawals and gaps directly from the existing monthly projection. The financial engine, saved-picture schema, local encryption and opt-in saving model are unchanged. DB capture, named scenarios and reports are outside this theme iteration.

## Verification

- 154 existing calculation, state, encryption/storage and build checks passed. Added theme inclusion/versioning assertions to the build check. Module syntax and whitespace checks passed.
- Used the live in-app browser at measured CSS widths of 1280px, 390px and 320px. Assets, Flow, exact Table, Planning, readiness review and the saving dialog fit without page-level horizontal scrolling. Chart currency labels and the final year label fit the narrow chart.
- Checked retirement-age edits, headline/date updates, current-plan preservation and Undo. A change to age 60 with recorded May 2045 final pay produces scenario final pay May 2044 and a displayed age of 60; the recorded May 2045 input remains intact. Also checked growth edit/undo and today's-money/future-value toggles.
- Checked phone scenario open/close, immediate result text and continued chart availability. Verified the blank-picture transition, missing-budget checklist, hidden results before confirmation and explicit unsaved personal status. Opened saving options without creating a persistent browser test copy. Saving cryptography/round trips were covered by the automated storage tests.
- Updated optional Playwright regression journeys for age conversion and baseline comparison. That separate browser runner was not executed; browser verification used the supported in-app controls. No browser errors were captured during these journeys.
- Desktop preview: `/Users/sanjaysharma/.codex/visualizations/2026/10/16/01a145e2-ae67-7751-a228-71ab50146d69/steadybee-finance-desktop.jpg`.

No deployment, push or account/cloud-storage change was performed. Observed testing with real target users and a full assistive-technology audit remain outstanding.

## Assets & debt: progressive structure

The nested person/category cards and repeated explanatory paragraphs have been replaced with household totals, an owner filter, and separate flat asset/debt lists. Rows show names, ownership, access or collateral, and aligned values; opening a row edits it directly. On phones, type and owner sit beneath the name. Access issues remain visible in affected rows.

The breakdown chart is always visible at the top, directly below household totals. Individual records and counting definitions open on request. Linked equity is shown in the item editor, where changing the value updates the preview. Core fields precede Additional details, with repayment fields grouped separately. Starting a personal household opens setup directly, with optional partner capture. Either assets or debt can be the first item. Income & spending has a shorter header/continuation, and its basis disclosure opens on demand; repeated planning instructions were shortened.

Verification: 154 calculation/state/storage/build checks passed. Module syntax, build packaging and whitespace checks passed. In-app browser checks covered owner filters; balance edits with a non-empty cash rate and value confidence preserved while details were collapsed; linked equity preview; debt entry defaulting to the selected owner; direct couple setup; debt before assets; optional charts; and all three sections. Measured 320px, 390px and 1280px layouts fit without page-level horizontal scrolling. No persistent test copy was created. The optional Playwright suite includes these regression journeys but was not run separately.

The financial engine and encrypted data schema are unchanged. New previews: `steadybee-assets-progressive-desktop.jpg` and `steadybee-assets-progressive-phone.jpg` in the calling chat’s visualization directory.

## Final progressive-disclosure pass

- Assets: household totals → always-visible breakdown → always-visible flat item list. Owner selection filters the list. Add asset and Add debt stay beside the list controls. Empty and debt-only households retain their entry actions. Breakdown tabs and rows use the shared sans-serif, white and blue theme.
- Planning: one coverage result above a full-width chart. Compare plan reveals both scenarios and the dated closing investments. Adjust scenario reveals the editor on desktop and phones. Retirement, budget and advanced groups open one at a time. Chart options includes an optional current-plan overlay.
- Removed repeated upfront assumptions, endpoint figures, duplicate chart titles and inactive Undo/Reset actions. Retirement dates and key assumptions remain in Assumptions & calculation details. Year details contains funding, events, exact values and explanations. Shortfall month/amount and unmodelled-debt warnings remain visible without expanding details.
- Earlier browser checks verified owner drill-down, balance edit/totals, scenario age edit/Undo, unchanged current plan, controls accordion, baseline overlay, year details and an intentionally unfunded fictional scenario. This pass visually verified the always-visible asset records and white background. Desktop and 390px/320px widths had been checked. No real personal data or persistent test copy was used.

Earlier implementation notes above describe the first iteration; this final pass supersedes statements about visible key-assumption strips, always-open scenario controls, sticky mobile outcome summaries and collapsed item records. Calculation code and saved-picture schema remain unchanged.

## 17 October: density and direct manipulation

- Assets uses one compact title/action row and a smaller three-column totals strip. The repeated page example badge, visible All items heading and item-type subtitles are removed. Example/saving status stays in the app header. Start my own is in More. Access labels are shorter and stay on one line; access warnings remain visible.
- The asset breakdown stays open. On phones a smaller donut sits beside its category values, so the list is reachable much sooner. Counts are secondary rather than another full line.
- Income & spending shows a calendar month control by default. Timeline switches to the slider, selected month and optional Changes picker; switching back preserves the month. The event picker starts with a generic prompt rather than a selected example event.
- Entries have explicit Edit actions. State Pension uses compact person/amount/Edit rows, with a flag for missing forecast or start information. NI details and forecast assumptions stay in the editor. Scheduled entries show compact dates and amounts; property settings open on request.
- Savings uses Cash → ISA → General route diagrams. This month and To March show one period at a time. Highlighted amounts and bars show each destination's share of new deposits. Display values round to whole pounds; exact amounts remain in element titles and accessible labels. The existing deterministic allocation and tax-year projection supply the values.
- Planning has no repeated example badge above its result. The year picker and timeline are alternatives. Retirement ages show one editable value beside their label; duplicate outputs and final-pay-date helper rows are hidden from the main editor. Dates remain in the calculation details.

Verification: all 154 calculation/state/storage/build checks passed; syntax and whitespace checks passed. Live browser checks covered 1280px, 390px and 320px layouts, date-mode switching with month preservation, age edit/Undo, State Pension editing, both savings periods, the exact Table, and phone info disclosure. No page-level horizontal scrolling was observed. A view-switch regression was found during the final check: replacing the entire chart helper text also removed the tax-info disclosure and blocked later Planning renders. The switch now updates only the units label. Flow → Table → experimental view → Flow → Planning was repeated successfully, and the optional browser regression journey now checks that the disclosure survives and the Planning chart renders. The separate browser runner was not executed; the interaction check used the in-app browser.

No financial engine or saved-picture schema changes were made. This remains a prototype review with fictional data, not observed research with real prospective users.
