# Steadybee

An educational retirement planning prototype connecting today's holdings with future income, spending and balances.

## Main version

**The single active app is [Your money picture](prototype/app.html).** The root page and older page routes lead here. The installed-app manifest opens this version. There is no separate landing preview or competing workspace in the deployment bundle.

The three sections are:

1. **Assets & debt:** editable Alex and Gemma example or a blank household. Ownership, linked mortgages/rent, cash, ISAs, DC pensions and shares are recorded separately. Alex is 43, Gemma 42. Gurgaon is shared; the £30k property belongs to Gemma. Alex's SAYE shares are worth £100k, cost £30k and require sale. Example totals: £2,525,000 assets, £380,000 debt, £2,145,000 net worth.
2. **Income & spending:** annual gross or actual take-home pay, pension contributions, regular categories, future recurring entries and one-off events. A slim timeline shows scheduled amounts without applying growth or inflation. Sankey **Flow** and exact **Table** are primary; Bridge, Sunburst, Treemap and Donut remain under **More views · Experimental**. Linked mortgage/rent entries edit their source records. A portrait Sankey is used on phones.
3. **Planning:** deterministic monthly illustrations with inflation, growth, retirement timing, spending phases, pension access and debt repayment. Compare **Current plan** and **Your scenario** for spending coverage, first shortfall and accessible closing investments before withdrawal tax. The default horizon reaches age 95 for the younger person with a known age. Net worth remains a chart; the year picker shows both people’s approximate ages. Undo/reset and precise inputs supplement sliders. Phone controls open through **Adjust scenario**. Scenario adjustments do not overwrite recorded inputs.

Planning supports current-plan savings routing or all future surplus to general accounts; cash-and-shares mortgage payoff preserves ISAs. Payoff figures show amounts taken, estimated tax, repayment and remaining debt. A funding gap does not hide inaccessible pension balances. Household spending changes do not change separately scheduled costs or debt service.

The active app uses a clean white-and-blue finance theme. Planning leads with the retirement question, coverage under the entered assumptions, a dated accessible investment balance before withdrawal tax, and visible budget/inflation/pension-growth assumptions. Retirement controls accept approximate ages while preserving the recorded final-pay month. Personal pictures have a starting-figure review; phone scenario editing keeps the chart available with an immediate coverage summary. A first-retirement-month breakdown uses the existing monthly projection. Saving status stays visible in the header. See the [theme implementation and verification](docs/2026-10-16-finance-theme-plan.md).

Assets & debt leads with totals and an always-visible breakdown. Select an owner or View items to open the flat list and edit an item. Definitions and additional account details open on request. Blank setup offers an optional partner before entry, and users can start with either an asset or a debt.

## Run locally

No npm application dependencies or frontend framework are required.

```sh
node scripts/build-prototype.mjs
python3 -m http.server 8765 --directory dist
```

Open `http://127.0.0.1:8765/`. During source editing, serve `prototype/` instead of `dist/`.

The existing GitHub → Netlify pipeline builds with `node scripts/build-prototype.mjs` and publishes only `dist/`. This consolidation does not deploy automatically from the local checkout; no push/deployment is implied by editing it.

## Verification

Run the deterministic engine/state tests (the archived state/update tests still protect useful migration code):

```sh
node --test tests/test_asset_ledger.mjs tests/test_monthly_flow.mjs tests/test_uk_pay_estimate.mjs tests/test_mortgage_payment.mjs tests/test_state_pension.mjs tests/test_planning.mjs tests/test_withdrawals.mjs tests/test_investment_tax.mjs tests/test_state.mjs tests/test_app_updates.cjs tests/test_main_build.mjs tests/test_coverage.mjs tests/test_picture_storage.mjs
```

`tests/test_asset_canvas_browser.mjs` is an optional Playwright suite for the active app. It needs `PLAYWRIGHT_MODULE` and `CHROME_EXECUTABLE_PATH` configured. In-session browser verification uses the available browser tooling to inspect phone and desktop layouts, comparison/undo, chart alternatives, entry forms and route navigation. Screenshots and temporary artifacts are not committed.

## Remaining limits before a public release

- **Optional protected saving:** Save picture encrypts recorded inputs and scenario settings in this browser using a passphrase, PBKDF2 and AES-GCM. Only ciphertext is stored. Resume needs the passphrase; it cannot be recovered. Encrypted JSON backups can be imported into a tab after validation and confirmation. Import does not overwrite a device copy; deletion removes the device copy and current tab data. Downloaded backups remain separate files. Saving is off by default. No accounts or cloud storage. Printable reports and CSV export remain in the archive.
- **Tax illustration:** 2026–27 England/Wales/NI rates and thresholds are held constant in future years. Cash interest and pension marginal tax are annualised monthly estimates, not complete tax-year reconciliation. CGT uses recorded/assumed cost and annual gains allowances. Dividend tax, rental-income tax, capital losses, pension protections/annual contribution limits and lender charges are excluded. General-account growth represents capital appreciation.
- **Pensions:** simplified State Pension uses NI years/35 with a ten-year minimum, scenario age 67, optional future qualifying years and an inflation-uprating assumption. Pre-2016 records can differ; an official forecast is preferable. Personal pension access defaults to 57 or a later recorded scheme age. These are scenario assumptions, not verified eligibility dates. Full DB scheme-specific escalation/survivor modelling is not implemented.
- **Projection:** deterministic return assumptions, not stochastic outcomes, probability estimates or promises. No automatic sale of property or unspecified-access shares. User-selected cash-and-shares payoff assumes needs-sale shares are saleable at the opening date. Unmet household costs are reported separately; unpaid debt instalments remain outstanding.
- **Accessibility:** responsive and keyboard-accessible controls are exercised in browser checks; a full assistive-technology audit and observed testing with target users remain required.

## Retired prototypes

[Archived workspace](archive/retired-workspace/README.md) preserves useful backup/restore, reporting, DB-input and research functionality without publishing another UI. Old routes redirect to the main version. The older browser tests are retained beside that source for reference. Historical design documents remain as research history.

See the [UX consolidation plan](docs/2026-10-15-main-version-ux-plan.md) and [planning assumptions](docs/2026-10-15-planning-prototype-plan.md).

Steadybee is decision-support and educational software, not regulated financial or tax advice. Every projection states: **Illustration, not advice. Current rules, subject to change.** The intended production stack remains Python/FastAPI and server-rendered templates; this buildless JavaScript app is the interactive prototype.

See [protected saving and coverage plan](docs/2026-10-15-save-coverage-plan.md) for this iteration. A full accessibility audit, DB pension capture and further tax validation remain outstanding.
