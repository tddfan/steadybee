# 🐝 Steadybee

A retirement decision workspace for people considering retirement, reduced work or a change in spending.

**Current status:** working research prototypes. The [money picture](prototype/asset-canvas.html) opens with an editable fictional household example for Alex, age 43, and Gemma. An asset summary and doughnut can be explored by person, asset type or access; selecting an item opens its editor. A second step shows monthly income and spending in a Sankey diagram. Property rent and an entered or calculated repayment mortgage payment can be included in that flow; asset values and pension pots never become monthly income or payments. Visitors can also start with blank figures. The existing workspace organises information and uses three separately labelled fictional examples for scenario comparisons. Personal retirement forecasts, accounts and payments are not connected.

## What you can try

- A household asset picture: explore or reset Alex and Gemma’s fictional example, or enter a name and age to start blank and optionally add a partner. The overview shows net worth and a doughnut breakdown of total assets by person, type or access. The owner cards stay visible and show assets, debt, net value and an Add action. Selecting a person in the chart opens the same card; selecting an asset type or access category reveals its exact items above the cards. The chart always uses total assets as its denominator, while debt is deducted in net worth. The shared home and mortgage each count once. The owner sections show populated access categories and linked home equity when opened. Each owner’s Add button opens type choices with that owner preselected. An access review prompt opens pensions with missing access ages and holdings with unconfirmed sale rules; it clears as those details are recorded. In the compact editor, every item can be edited or removed, marked Exact/Estimate/Needs review, and assigned to Alex, Gemma or Shared. Employee shares start in Check access and can be moved after their scheme rules are confirmed. Pension access age can be recorded per pot. The example has £2,525,000 of assets, £380,000 shared mortgage debt and £2,145,000 net worth. Linked home equity is £400,000. Gurgaon rent (£100/month), illustrative mortgage payment (£2,375.30/month from a £380,000 balance, 4.7% rate and 21 years remaining), mortgage rate (4.7%), cash rate (4%) and stated investment descriptions are editable details; they do not change today’s net worth. This snapshot does not project growth, repayment, income or spending. Entries stay in the open tab and can be cleared; a refresh restores only the fictional example. Sentence entry and AI assistance are future experiments.
- A linked monthly-flow step: the fictional inputs show £14,962.38 in average monthly money in (including £100 rent recorded on Gurgaon), £11,191.97 spending (including the active £20,000/year school-fee entry), and £3,770.41 not assigned to spending. The later school-fee phase remains visible as a future entry. The Sankey shows the flow; an optional disclosure gives exact values and edit links. The fictional example uses Alex’s £146,500 base salary, £50,000 yearly bonus, 7% employee and 16% employer pension contributions on base salary; Gemma has £125,000 salary and £25,000 yearly employee pension contribution. An annualised 2026–27 England/Wales/Northern Ireland Income Tax and employee NI estimate gives rough take-home pay, which can be replaced by actual yearly take-home. The bonus is spread over 12 months for this snapshot. People can add named monthly, yearly, or one-off income and expense entries with start and end months. They may explicitly opt into a one-month illustration that directs the remaining amount first to a user-set cash reserve, then to each person's unused ISA allowance, then to an account they name; otherwise it stays unassigned. The reserve comparison uses recorded monthly spending and cash holdings. The overall ISA allowance is the 2026–27 £20,000 limit from GOV.UK, editable for the person's circumstances; current rules are subject to change. Growth, inflation, pay end dates and pension contributions are stored as inputs only and do not project future outcomes. In a personal draft, linked property rent and mortgage payments each wait for an explicit include choice. A repayment mortgage payment is calculated only with balance, rate and remaining term; an entered actual payment overrides it. The estimate assumes a constant rate and is not a lender quote. The step does not project future tax or retirement outcomes.

- An interactive full-retirement landing preview: annual spending coverage, separate savings/pension balances, early and later shortfalls, and planning endpoints of 90/95/100. Selected fictional choices and endpoint carry into the workspace, brief and CSV.
- A short DC or income-led start, with unknown, estimated and zero values kept distinct.
- Progressive details: partner, dated income, pension access, savings, contributions, housing/costs and manual accounts.
- Owner-aware summaries and calendar timelines. Account details reconcile against entered totals without being added twice.
- Baseline plus two named alternatives, combining timing, spending, part-time income and major costs. Personal choices record changes without calculated outcomes; fictional examples have inspectable annual workings.
- A compact printable household example brief, optional workings appendix and CSV export. A personal brief preserves entered facts and missing information.
- Optional local save, resume, validated JSON backup/import and deletion. Saving is limited to this browser profile, unencrypted and not shared across devices.
- A feedback download for research notes. It does not submit anything to a server or take payment.

Fictional calculations are deterministic demonstrations using authored assumptions, not a UK tax or pension engine. They do not establish the correctness of personal planning. See the [build plan and agent findings](docs/2026-10-09-prototype-loop-plan.md) and [build review](docs/2026-10-09-prototype-build-review.md).

The latest [full-retirement preview review](docs/2026-10-09-full-retirement-preview-review.md) records the founder’s complete-picture feedback, real endpoint recalculation and simulated review. The earlier [example validation loop](docs/2026-10-09-example-validation-loop.md) records the two-year-shortfall explanation. Customer willingness to pay remains unverified.

## Run and verify

No npm application dependencies or frontend framework are required.

```sh
node scripts/build-prototype.mjs
node --test tests/test_state.mjs tests/test_app_updates.cjs tests/test_asset_ledger.mjs tests/test_monthly_flow.mjs tests/test_uk_pay_estimate.mjs tests/test_mortgage_payment.mjs
python3 -m http.server 8000 --directory dist
```

Open `http://localhost:8000/`. Browser interaction checks require Playwright and a Chromium executable:

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
CHROME_EXECUTABLE_PATH=/absolute/path/to/chrome-headless-shell \
node --test tests/test_browser.mjs
```

Run `node --test tests/test_asset_canvas_browser.mjs` with the same Playwright and Chromium variables for the asset picture. The browser suites run their own local HTTP servers. They check the asset picture, intake, household dates, mode separation, compound scenarios, save/import/delete, deployment restoration, keyboard focus, mobile reflow and printable output. Generated screenshots/PDFs stay in ignored `test-artifacts/`.

## Deployment and installed app

The existing GitHub → Netlify pipeline builds with `node scripts/build-prototype.mjs` and publishes `dist/`. Each build stamps its version into all HTML pages and `version.json`.

The installed web app checks on reopen, focus, reconnection and once a minute while visible. A new deployment refreshes after a short idle period. A one-use snapshot preserves the current workspace and unfinished form edits in the same tab; it is removed after restoration. This is separate from optional persistent local saving. The manifest and existing bee icons support Home Screen installation. There is no offline service worker.

## Product direction

A future paid release must answer a real personal decision with verified accessible-money cash flow, declared tax/pension support, explainable assumptions and reproducible outputs. Price, access cadence, purchase and return behavior still require real-user evidence. Simulated persona reviews are critique, not interviews or observed demand; not everyone has a paid need.

The static prototype is an experience experiment. The agreed production direction remains Python/FastAPI with server-rendered templates, as recorded in [project rules](CLAUDE.md). Older [vision](docs/VISION.md), [strategy](docs/STRATEGY.md), [functionality](docs/FUNCTIONALITY.md) and [journey](docs/USER_JOURNEY.md) documents describe aspirations; current build limits above take precedence for prototype claims.

Steadybee is decision-support and educational software. It does not recommend securities, allocations or pension transfers.
