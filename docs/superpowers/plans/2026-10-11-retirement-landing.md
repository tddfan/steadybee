# Retirement landing preview Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development for the bounded demo task and review. Execute the approved local design without another approval gate.

**Goal:** Create a reviewable HTML landing page inspired by the spacious blue Codex page, explaining retirement planning, scenario exploration and ongoing reviews.

**Architecture:** Add `prototype/retirement.html`, `retirement.css`, `retirement.mjs` and a small `retirement-demo.mjs` presentation adapter. Reuse the existing deterministic fictional household ledger without modifying calculation logic. The existing build copies all four files to `dist/`. Preserve the existing homepage and discovery documents.

**Tech Stack:** Semantic HTML, CSS, browser JavaScript modules, existing fictional ledger, Node test runner, local static server.

## Global Constraints

- Local preview only; no publication, payment, account connection or personal forecast claims.
- Every financial number and chart point comes from the existing fictional ledger. Alex and Jemma are display names for its mixed-household example, aged 57 and 55. Show that mapping in the workings.
- All projections identify their fictional nature, fixed real return assumptions, today’s pounds, horizon and omitted tax calculation. Earlier gaps stay visible even if later assets remain.
- Retirement and spending sliders, supported scenario shortcuts, reset, three visual slides and a year inspector must work with keyboard controls. Do not add unsupported market/risk controls.
- Show investment, inflation and spending tracking as planned features, not observed live feeds. The three slides are Your money today, Your retirement outlook and Plan better.
- No invented testimonials, prices, adoption claims or claimed live integrations. Keep the hero to one retirement question; remove the research statistic and long introduction.
- Responsive layout, body text at least 18px, secondary text at least 16px, targets at least 44px, visible focus and reduced motion support.

## Tasks

- [x] Build the demo adapter and interaction module. Reuse `evaluateExample("mixed-household", overrides)`; use supported retirement, spending and part-time controls. Render baseline/current funding coverage and money remaining, plus a selected-year table and computed opening-asset donut. Add meaningful adapter checks for earlier income loss and for gaps that survive later pension access.
- [x] Build the HTML and CSS. Include a short question-led hero, three visual slides, account icons converging into one plan, a fictional retirement timeline, working scenario controls, compact planned tracking feeds and a working draft link. Use a soft blue hero and simple black actions, retaining Steadybee branding.
- [x] Review the module and whole page against the global constraints. Fix important findings, run `node --test tests/test_state.mjs tests/test_app_updates.cjs tests/test_retirement_demo.mjs`, `node scripts/build-prototype.mjs` and syntax checks.
- [x] Verify the live desktop and narrow mobile page in the browser: controls change calculated results, story navigation works, links work, no horizontal overflow. Capture the completed page and leave its preview open for the user.

## Verification record

Verified: 49/49 Node tests, JavaScript syntax checks and the static build pass. Desktop (1440px) and mobile (390px) have no horizontal page overflow. All three slides, arrows, keyboard sliders, scenario shortcuts and chart modes work. A scenario with an age-59 gap retains that unpaid gap despite later positive assets. The computed opening total is included in the donut’s accessible name. No browser console errors were observed. Existing fixtures and the personal draft remain unchanged; no new engine or tax rules were added.

## Visual revision — 11 October

User feedback: the slides feel too dense, and their icons should lead the presentation.

- [x] Replace the outlined dashboard frame and filled tabs with an open blue/lavender stage and quiet Today / Outlook / What if navigation.
- [x] Present six large tinted source icons around one computed financial total. Keep the total explicitly limited to pensions and savings; unentered home, mortgage and investment values remain qualified in accessible groups and details.
- [x] Use one headline/result with an unboxed graph and icon milestones. Put the explanations, chart modes, year inspector and input provenance behind Show details.
- [x] Give the four scenario shortcuts prominent icons; retain the three working sliders and Reset. Keep live tracking visibly planned.
- [x] Keep the source icons around the total in the 560px browser preview; use a compact grid below the total on narrow phones. The 560px page has no horizontal overflow.
- [x] Review accessibility, symbol/ID contracts and copy. Verify desktop and narrow mobile in the running browser, with no horizontal overflow at the observed 1200px and 325px CSS widths. Spend less updates the graph and spending output; keyboard sliders expose the age-59 gap; the spending chart and year inspector remain reachable inside details. No browser errors observed.

Validation: 49/49 existing and adapter tests pass; module syntax checks and the static build pass. No calculation logic or household fixtures changed.

## Typography, graph milestones and scenario names — 11 October

User feedback: unify the font, size and colour; put the retirement milestones on the graph only; show a wider range of scenarios as names.

- [x] Use one Helvetica Neue / Arial family, regular and medium weights, a shared result size, graphite text, one readable secondary grey and one restrained blue. Reduce tight letter spacing and remove the different source-icon colours.
- [x] Remove the separate milestone row. Mark the calculated retirement date, State Pension start and illustration horizon directly on each chart with icons, ages and full accessible descriptions. Nearby or coincident points retain their exact guide/dot and use short connectors to distinct badges.
- [x] Show four working scenario names: Retire earlier, Job loss, Spend less and Part-time work. Show eight static names under More scenarios · planned: Save more, Pay off mortgage, Downsize, School fees, Help family, Higher inflation, Market falls and Leave a legacy. No unsupported scenario produces a result.
- [x] Verify the running 1200px desktop, 560px preview and 325px phone layouts without horizontal overflow. Spend less and Job loss update the calculated comparison. Funding charts keep nearby age-66/68 and coincident age-68 icons distinct. No browser errors observed.

Validation: 49/49 Node tests pass, module syntax and static build pass. A focused geometry check covers assets/funding, retirement ages 60/66/68 and widths 220/280/528; badge centres stay at least 32px apart and age labels clear the badges. Financial calculations and authored household assumptions are unchanged.

## Feedback clarity revision — 11 October

- [x] Keep the app's warm paper/teal theme, large icons and Today / Outlook / What if slides.
- [x] Introduce the fictional household using baseline ages, retirement dates and spending; show the computed pension/savings totals and percentage split below the donut.
- [x] Move Money left / Spending above the graph. Keep the year inspector in details.
- [x] Explain scenario work dates, spending reductions and part-time income beside the result. Show first unpaid year/amount when present, and qualify final assets when earlier gaps exist.
- [x] Present inputs and assumptions as labelled rows, with technical provenance in a separate disclosure. Do not add external citations that did not supply the authored assumptions.
- [x] Explain the draft CTA without claiming personal forecasts or unimplemented uploads, analysis or privacy features.

Validation: 49/49 Node tests, module syntax, static build and diff whitespace checks pass. Chromium checks passed for all three slides at 1200px, 560px and 325px with no horizontal overflow or JavaScript errors. All four shortcuts, Reset and the spending view work. A combined immediate-retirement/high-spending case exposes the first unpaid year and amount; expanded assumptions fit the 325px layout. Desktop and phone screenshots inspected/captured locally. Calculation logic and fixtures unchanged.
