# Steadybee

An educational retirement planning prototype connecting today's holdings with future income, spending and balances.

## Main version

**The workspace is [Your money picture](prototype/app.html).** The [public landing page](prototype/index.html) explains the product and includes a four-part capability tour using computed fictional-example figures. Older app routes and the installed-app manifest continue to open the same workspace. Start my picture on the landing page opens blank household setup directly.

The five sections are:

1. **Assets & debt:** editable fictional Sam and Priya example or a blank household. Ownership, linked mortgage, cash, ISAs and workplace pensions are recorded separately. All public example figures are synthetic.
2. **Income & spending:** annual gross or actual take-home pay, pension contributions, regular categories, future recurring entries and one-off events. A calendar month control switches to a timeline on request. Scheduled changes are available in timeline mode; neither view applies growth or inflation. Sankey **Flow** and exact **Table** are primary; Bridge, Sunburst, Treemap and Donut remain under **More views · Experimental**. Linked mortgage/rent entries edit their source records. A portrait Sankey is used on phones.
3. **Planning:** deterministic monthly illustrations with inflation, growth, retirement timing, spending phases, pension access and debt repayment. Compare **Current plan** and **Your scenario** for spending coverage, first shortfall and accessible closing investments before withdrawal tax. The default horizon reaches age 95 for the younger person with a known age. Net worth remains a chart; the year picker shows both people’s approximate ages. Undo/reset and precise inputs supplement sliders. Phone controls open through **Adjust scenario**. Scenario adjustments do not overwrite recorded inputs. Hover or drag the chart to inspect a year. **Tax & NI** shows annual or cumulative modelled deductions by person, with an expanded component table. The calculation CSV includes monthly, annual, cumulative and April–March tax-year component rows. Unknown take-home tax and unsupported income taxes are flagged as partial estimates. An optional 20% investment shock applies once at the first recorded retirement month; its scope and timing are disclosed.

4. **Inheritance:** a simple family illustration starts with two equal child shares, assumed deaths around age 90, current recorded balances, and partner-first inheritance for couples. Marriage status is visible and editable. The main view shows Inheritance Tax, what passes on and each recipient’s amount. Dates, Planning balances, custom shares, ownership and other assumptions are available on request; calculations and CSV export stay under the information icon. Existing customised inheritance settings are preserved. This is a fixed-balance illustration after estate tax, before beneficiary pension Income Tax. See the [simplified journey](docs/2026-10-24-simple-inheritance.md) and [calculation scope](docs/2026-10-22-inheritance-delivery.md).

5. **Insights:** prioritised input checks and funding gaps, followed by six calculated experiments. Preview before/after figures, apply with Undo, or save a named scenario without applying. An optional private AI review uses Groq to review a detailed financial summary and calculated alternatives, including one person retiring earlier or later. The user reviews every field before sending. The engine supplies displayed amounts; AI supplies bounded explanations and questions to investigate. See [verification](docs/2026-10-22-insights-delivery.md) and [AI pilot setup](docs/2026-10-22-ai-insights-pilot.md). Inheritance also supports [fixed-value couple routes](docs/2026-10-22-couple-inheritance.md): each parent directly to children, or partner first then children, with explicit marriage status and unused-band transfers.

Planning includes **Saved scenarios**: keep up to 12 named sets of scenario, chart and simulation settings; reopen, rename, delete/undo, or compare up to three against current household inputs. Account household versions preserve these settings. Calculated simulation samples are not saved. Withdrawal-order comparison is visible in its own card; Income & spending exposes saving settings directly, with longer explanations behind info controls.

Planning also has an optional **Outcome ranges** simulation: enter annual return variability, choose 100/200/500 paths, then run. It reuses the monthly engine and shows simulated spending-coverage frequency and 10th/50th/90th accessible-investment ranges in today’s money. It uses an illustrative, perfectly correlated investment proxy, not a calibrated personal success probability. Results are temporary and clear when scenario inputs change. The simulation runs in a cancellable worker; the fixed seed and full assumptions are disclosed. Calculation notes use closed topic cards and withdrawal-order comparisons use responsive cards. See [method and verification](docs/2026-10-17-planning-outcome-ranges.md).

Planning supports current-plan savings routing or all future surplus to general accounts; cash-and-shares mortgage payoff preserves ISAs. Payoff figures show amounts taken, estimated tax, repayment and remaining debt. A funding gap does not hide inaccessible pension balances. Household spending changes do not change separately scheduled costs or debt service.

The active app uses an Apple-inspired Bento system: a system-gray canvas, elevated white cards, tabular figures, segmented view controls and coordinated teal, iris, amber and coral chart colours. Assets lead with four live KPI cards, a visible breakdown and grouped whole-row editors. Income and spending starts with the monthly arithmetic and separates entries, State Pension and scheduled changes into cards.

Planning combines the question and qualified coverage result, with milestone shortcuts and exact figures in a Year inspector. Adjust scenario opens a 340px desktop inspector or a draggable, keyboard-resizable mobile bottom sheet that keeps the chart visible above it. Retirement controls preserve recorded final-pay dates; scenario adjustments remain separate from inputs. Personal households retain starting-figure review. Google accounts load a default household automatically, sync its changes, and can save named versions to reopen on another device. Cloud rows are protected by per-user RLS; cloud storage is not end-to-end encrypted. The separate local picture flow and downloaded backups remain passphrase-encrypted. See the [Bento implementation and verification](docs/2026-10-17-apple-bento-design-system.md).

Starting a blank household is under More. Edit People sits beside the owner filters. Official pension forecast links open GOV.UK, and pay-only Personal Allowance notices link to HMRC. Owner filters hide redundant owner pills, while linked property rows show mortgage and net equity. Additional account and calculation details open on request. Savings routes show Cash → ISA → General for one period at a time.

## Entry and navigation simplification · 27 October 2026

One shared header provides Assets & debt, Income & spending and Planning. Monthly Entries has All / Income / Spending / Scheduled filters and one editor shell for salary, regular amounts, dated entries and State Pension. Chart quick-add buttons use the same editor; the Flow table is read-only for audit. A selected asset donut category filters the holdings list, including linked liabilities, and Clear filter restores all items. Saving settings opens the existing routing inputs beside a single waterfall. Lifeline’s destination switch is explicitly a scenario override. Inheritance, baseline versions and dated tracking remain available. Experimental cash-flow charts have been removed. See the [implementation notes](docs/2026-10-27-entry-simplification-plan.md).

## Run locally

The current baseline/tracking increment keeps the existing input screens. In a personal household, set a starting baseline, then use **Log update** with an effective/statement date. Pay and spending edits can be ongoing or for one month; the person's monthly-pay option records actual take-home. **History** shows earlier rates and corrections while baseline versions remain frozen. Values save through the existing account document. See [Phase 2 behaviour, calculation conventions and limits](docs/2026-10-25-phase2-tracking-delivery.md). Phase 3 adds the default Lifeline comparison workspace. See below.

No npm application dependencies or frontend framework are required.

```sh
node scripts/build-prototype.mjs
python3 -m http.server 8765 --directory dist
```

Open `http://127.0.0.1:8765/`. During source editing, serve `prototype/` instead of `dist/`.

To use the private AI review from the local app served on port `8766` (use this local URL instead of the production origin), start the local-only bridge in a second terminal:

```sh
node scripts/local-ai-bridge.mjs
```

The bridge listens only on `127.0.0.1:8888` and forwards the review endpoint to the authenticated Steadybee deploy preview. The Groq key stays in Netlify; no API key or `.env` entry is needed locally. Sign in to the local app with an account enabled for the AI pilot. The review still shows the exact summary before it can be sent. If the preview is unavailable, local AI review is unavailable too; deterministic planning insights continue to work.

The existing GitHub → Netlify pipeline builds with `node scripts/build-prototype.mjs` and publishes only `dist/`. This consolidation does not deploy automatically from the local checkout; no push/deployment is implied by editing it.

## Lifeline workspace · Phase 3

Lifeline opens by default and keeps Assets & debt and Income & spending directly accessible. Compare the current monthly projection with a frozen baseline version; changing the reference never rewrites its archived results. Life shows annual flows and closing balances, Year shows months (calendar or April–March), and Month inspects actual event dates within the monthly model. Both paths share one selected purchasing-power basis. Recorded updates are marked separately; unobserved values stay estimated.

The period inspector separates net assets, accessible investments, income after tax, withdrawals, spending and tax. A small information control provides calculation notes, current tax components and a local monthly CSV export. **Adjust outlook** opens controls beside the same Lifeline chart, with baseline values and slider markers highlighting changes; inheritance, saved scenarios, outcome ranges and AI remain available. Saving/funding and person/source breakdowns, cumulative tax detail, full Excel ledger export, saved scenarios and alternative withdrawal comparisons now live in Lifeline. The duplicate annual chart workspace is retired. Goals/Plan consolidation is the next phase, not part of this delivery. See [Phase 3 scope and verification](docs/2026-10-25-phase3-lifeline-delivery.md).

## Verification

Run the deterministic engine/state tests (the archived state/update tests still protect useful migration code):

```sh
node --test tests/test_asset_ledger.mjs tests/test_monthly_flow.mjs tests/test_uk_pay_estimate.mjs tests/test_mortgage_payment.mjs tests/test_state_pension.mjs tests/test_planning.mjs tests/test_withdrawals.mjs tests/test_investment_tax.mjs tests/test_planning_tax.mjs tests/test_state.mjs tests/test_app_updates.cjs tests/test_main_build.mjs tests/test_coverage.mjs tests/test_picture_storage.mjs
```

`tests/test_asset_canvas_browser.mjs` is an optional Playwright suite for the active app. It needs `PLAYWRIGHT_MODULE` and `CHROME_EXECUTABLE_PATH` configured. In-session browser verification uses the available browser tooling to inspect phone and desktop layouts, comparison/undo, chart alternatives, entry forms and route navigation. Screenshots and temporary artifacts are not committed.

## Remaining limits before a public release

- **Accounts and protected saving:** Google sign-in accounts have a default household that syncs automatically, plus named versions for alternatives. Row-level security restricts each household row to its owner, but cloud data is not end-to-end encrypted and can be read by project administrators. The separate encrypted backup flow protects device data and downloaded JSON files with a passphrase using PBKDF2 and AES-GCM. Keep that passphrase safe; it cannot be recovered. Browser storage can be cleared, so keep a backup. Printable reports and CSV export remain in the archive.
- **Tax illustration:** 2026–27 England/Wales/NI rates and thresholds are held constant in future years. Pension drawdown tax accumulates taxable withdrawals within April–March years against forecast recurring income, so one-off payments are not multiplied into twelve repeated withdrawals. Known pay/State Pension tax is allocated using that forecast. Employee NI stops at an entered exemption month or an approximate State Pension age inferred from age. Cash-interest tax accumulates actual earned interest per person and shares tax-year bands with pension withdrawals; opening-year history, unclassified private pension income and unknown take-home deductions prevent complete tax reconciliation. CGT uses recorded/assumed cost and annual gains allowances. Dividend tax, rental-income tax, capital losses, pension protections/annual contribution limits and lender charges are excluded. General-account growth represents capital appreciation.
- **Pensions:** simplified State Pension uses NI years/35 with a ten-year minimum, scenario age 67, optional future qualifying years and an inflation-uprating assumption. Pre-2016 records can differ; an official forecast is preferable. Personal pension access defaults to 57 or a later recorded scheme age. These are scenario assumptions, not verified eligibility dates. Full DB scheme-specific escalation/survivor modelling is not implemented.
- **Projection:** deterministic return assumptions, not stochastic outcomes, probability estimates or promises. No automatic sale of property or unspecified-access shares. User-selected cash-and-shares payoff assumes needs-sale shares are saleable at the opening date. Unmet household costs are reported separately; unpaid debt instalments remain outstanding.
- **Accessibility:** responsive and keyboard-accessible controls are exercised in browser checks; a full assistive-technology audit and observed testing with target users remain required.

## Retired prototypes

[Archived workspace](archive/retired-workspace/README.md) preserves useful backup/restore, reporting, DB-input and research functionality without publishing another UI. Old routes redirect to the main version. Historical design documents remain as research history.

See the [UX consolidation plan](docs/2026-10-15-main-version-ux-plan.md) and [planning assumptions](docs/2026-10-15-planning-prototype-plan.md).

Steadybee is decision-support and educational software, not regulated financial or tax advice. Every projection states: **Illustration, not advice. Current rules, subject to change.** The intended production stack remains Python/FastAPI and server-rendered templates; this buildless JavaScript app is the interactive prototype.

See [protected saving and coverage plan](docs/2026-10-15-save-coverage-plan.md) for this iteration. A full accessibility audit, DB pension capture and further tax validation remain outstanding.
