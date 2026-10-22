# Planning tax, inheritance and Insights: next improvement plan

Prepared 22 October 2026. This is a researched implementation roadmap and calculation audit, not a statement that the new features are implemented. Examples below are synthetic. No account data is included.

Implementation update: the [first Tax reporting delivery](2026-10-22-tax-reporting-delivery.md) now adds the Planning Tax view and addresses the initial pension-withdrawal/NI cases. It documents the remaining reconciliation limits. The audit below records the findings before that implementation; Inheritance, Insights and AI remain subsequent deliveries.

## Recommended delivery order

1. Correct and reconcile the tax calculations.
2. Add yearly and cumulative Tax views to Planning, using that reconciled ledger.
3. Add an Inheritance tab after Planning, starting with an estate snapshot and beneficiary distribution.
4. Add Insights with calculated comparisons and reversible “Try in Planning” actions.
5. Add optional AI explanations using verified engine results.

The intended navigation is Assets & debt → Income & spending → Planning → Inheritance → Insights. On phones, keep the active section visible in a horizontally scrollable navigation bar, without making the whole page overflow. Keep result cards concise; calculation methods remain available through the existing details icon.

## Audit: what needs correcting before new totals are trusted

The existing automated tests cover useful cases, but passing them does not establish that every financial assumption is correct. Additional synthetic investigations found these gaps:

| Priority | Finding | Required change |
| --- | --- | --- |
| First | A one-off pension withdrawal is annualised as though that month's withdrawal repeats twelve times. | Track taxable pension income across a tax year; distinguish provisional withholding from final liability. Reconcile earlier deductions and reflect refunds or outstanding tax in cash flow. |
| First | Payroll Income Tax, employee NI and State Pension tax are calculated upstream but not retained in Planning's monthly result rows. | Preserve a complete tax ledger; annual and cumulative totals must derive from it. |
| First | The pay estimator has no employee NI exemption at State Pension age. | Use the person's verified State Pension age/date and NI category; do not confuse private-pension access, retirement or pension claiming with the age at which employee NI stops. |
| First | Regular private pension income lacks person ownership and an explicit gross/net basis. | Record person, gross or net basis, amount and dates. Do not assume a couple receives an equal taxable split. |
| Next | Income Tax is estimated separately for pay, pension and savings rather than fully reconciled for each person and tax year. | Consolidate taxable income and reliefs; attribute incremental components consistently so allowances are neither duplicated nor silently lost. |
| Next | Coverage can say recorded spending is covered while some debt repayments are unmodelled. | Show an explicit incomplete status alongside any coverage result and prioritise the missing inputs in Insights. |

Reproducible pension example: a person aged 60, with no other income, needs a single £12,000 mortgage repayment from an eligible pension and has the full tax-free allowance available. The present engine withdraws £16,377.71 gross and charges £4,377.71 tax. Under the model's 25% tax-free treatment, a single £12,000 gross draw leaves £9,000 taxable, below the standard Personal Allowance, assuming no other taxable income for the entire tax year. The projected final annual liability should be zero in that controlled case. Emergency payroll withholding must not be treated as permanent tax. See [GOV.UK pension tax](https://www.gov.uk/tax-on-pension).

An existing coverage fixture also assumed a default access age of 57 in October 2026. It now explicitly requests a scheme/scenario age of 57 so it continues to test an early funding gap; this fixture correction does not change production calculations.

Verification completed: **127 existing tests passed** after that fixture correction, across Planning, input review, tax, withdrawals, pay, pensions, mortgages, monthly flow, coverage, saved-picture validation, simulations and asset validation. The synthetic accuracy findings above remain open implementation work; they are not covered adequately by the passing suite.

Reproduce the suite with:

```sh
node --test tests/test_planning.mjs tests/test_planning_review.mjs tests/test_investment_tax.mjs tests/test_withdrawals.mjs tests/test_uk_pay_estimate.mjs tests/test_state_pension.mjs tests/test_mortgage_payment.mjs tests/test_monthly_flow.mjs tests/test_coverage.mjs tests/test_picture_storage.mjs tests/test_planning_simulation.mjs tests/test_asset_ledger.mjs
```

## 1. Planning: Tax as a first-class view

Add Tax beside Income & spending, Net worth, Saving, Assets and Debt. Start with three compact results: selected-year tax, cumulative tax since the plan starts, and employee NI shown separately. An Annual / Cumulative switch controls the chart. Person filters reveal each person's contribution; selecting a year opens the same Year inspector.

The detail table has Component / This year / Cumulative columns. Supported components should include:

- Employment Income Tax.
- Income Tax attributed to State Pension and regular private pensions.
- Pension drawdown Income Tax.
- Savings-interest Income Tax.
- Capital Gains Tax on modelled disposals.
- Employee National Insurance, labelled as a separate deduction and optionally included in a clearly named Tax & NI total.

Employee and employer pension contributions are savings flows, not tax. Mortgage principal and mortgage interest are also separate from tax. Gross pension withdrawals, taxable portions and tax-free portions remain inspectable.

One monthly ledger is the source for chart, inspector, comparison, export and Insights. Each entry needs person, source, period, taxable amount, estimated liability, cash withheld/paid, reconciliation adjustment, calculation basis and completeness status. Income Tax component attribution is explanatory allocation, not a set of independently reusable Personal Allowances.

Do not deduct displayed payroll or State Pension tax again: existing cash flow already uses their net receipts. Actual take-home-only entries cannot establish actual tax paid; show the tax component as unknown or an explicitly labelled estimate, and mark the household total incomplete. Dividend and rental-income taxes need their own supported inputs and calculations before a comprehensive tax total can claim to include them.

Calendar-year graph totals and UK tax-year totals are different. Keep the existing annual chart convention labelled, and offer an April–March tax-year table. Label partial opening/closing years. The month-based engine must disclose how it approximates the 6 April boundary; add dated events where exact boundaries affect a result. Cumulative means since the selected plan start, not a person's lifetime.

Nominal totals add nominal liabilities. Today's-money totals add each month's discounted liability using the same deflator as other flows; never mix bases or deflate a cumulative sum twice. Keep the money basis visible on tables and exports.

Expose the same rows through the current calculation dialog and export. The existing export is CSV; a genuine .xlsx workbook is a separate deliverable, not a renamed CSV. A workbook can contain assumptions, monthly ledger, annual summary, cumulative summary and scenario comparison sheets with formulas where supported.

## 2. Inheritance: estate snapshot before beneficiary tax guesses

Use the selected Planning month and its projected asset/debt balances, or a clearly selected current snapshot. Ask for an exact assumed death date to choose effective tax rules; this is a scenario assumption, not a prediction of lifespan. Calculate statutory thresholds using nominal values for that date, then optionally display the results in today's money.

The headline result is Gross estate → Debts and qualifying deductions → Estate tax → Net inheritance. A beneficiary table shows name, relationship, distribution percentage and estimated net inheritance. Asset details show what enters the estate and why. Asset type affects eligibility and special treatment; it does not mean each child gets a separate tax-free estate allowance or every asset is independently taxed at 40%.

### Inputs, revealed progressively

1. **Whose estate and when?** Select the person, date and snapshot. Confirm ownership shares, the treatment of jointly owned assets and relevant UK residence status. A household's combined wealth is not automatically one person's estate.
2. **Who receives it?** A child-count shortcut creates equal shares. Allow named children/grandchildren, spouse/civil partner and other beneficiaries, with editable percentages. Validate that the relevant residual estate split totals 100%. Keep beneficiaries separate from income-earning household members.
3. **Home and pensions.** Ask whether a qualifying home passes to direct descendants. Show pension nominations separately from the will/residual estate because scheme trustees and scheme rules can determine pension beneficiaries. Capture pension type and death-benefit terms rather than treating all pensions alike.
4. **Only where applicable.** Ask about transferable unused allowances, recent gifts and their dates, debts, estate costs, excluded assets, overseas assets and any special reliefs. Unsupported trusts, business/agricultural relief, cross-border issues and complex gifts should produce a visible incomplete calculation, not a guessed relief.

A percentage is a planning instruction, not a will or legal beneficiary nomination. Start with percentage residual distributions; fixed gifts and specific property bequests need explicit priority and tax-burden rules before they can be mixed with residual percentages. State how the model funds estate tax. Any pro-rata tax attribution shown against assets or beneficiaries must say it is an illustrative allocation, not a determination of legal liability.

### Rules the model must represent

- A basic nil-rate band, spouse/civil-partner exemptions and verified transferable unused allowances. Do not infer marriage from having a partner in the household.
- Residence nil-rate band eligibility, qualifying inherited home value and taper for larger estates. More children do not create additional bands.
- Cash, ISAs, taxable investments, property and pension death benefits classified by actual ownership and legal treatment. An ISA's lifetime income/gains exemption does not make it generally exempt from estate tax.
- Date-dependent pension estate inclusion: most unused pension funds and relevant death benefits come into IHT scope for deaths on or after **6 April 2027**. Do not extend this to excluded death-in-service benefits or survivor income streams automatically. Any beneficiary pension Income Tax is a separate calculation and may depend on age at death, benefit type, timing and the beneficiary's other income.
- Residence-dependent treatment of overseas assets. Since April 2025, long-term UK residence is material; country and property location cannot be ignored.
- Rule versions and source dates. Show the assumption when today's rates/thresholds are held fixed beyond published policy years.

The estate usually pays IHT before distribution. Inheriting ordinary cash, property or shares does not by itself create an immediate beneficiary Income Tax or CGT bill; later income or sales can. Present estate tax and any separately modelled pension-beneficiary tax in different rows.

First release: a validated single-person estate snapshot. Then add linked first-death and second-death scenarios with survivor cash flow, ownership transfers and unused allowance transfer. A genuine second-death projection must stop the deceased person's earnings/contributions and apply the actual pension/survivor assumptions; reusing the unchanged two-person retirement projection would be misleading. Until that exists, a manually assumed survivor-estate snapshot must be labelled accordingly.

### Synthetic acceptance examples

- £500,000 estate without a qualifying residence allowance, one £325,000 basic band and no exemptions: £70,000 estate tax and £430,000 distributable. Two equal beneficiaries receive £215,000 each.
- £500,000 eligible estate including sufficient qualifying home value left to direct descendants, full £325,000 basic and £175,000 residence bands: no IHT in the simple case.
- £2.2m eligible estate with a single person's full bands: residence band tapers to £75,000; simple-case IHT is £720,000.
- Changing two children to three changes their shares, not the estate's thresholds.
- Test spouse versus unmarried partner, percentage validation, ownership fractions, debt allocation, allowance transfer, gift sequencing, pre/post-6-April-2027 pensions and beneficiary tax unknowns.

## 3. Insights: findings with a measured experiment

Show at most three useful cards initially. Rank data problems and funding gaps ahead of opportunities. Each card contains a short finding, supporting figures, a trade-off and one action. Expand for the method, source and exclusions.

Ask what the household wants to improve: earlier retirement, secure spending, liquid reserves or a legacy target. Use that objective to rank experiments; maximising a distant asset balance is not a substitute for the user's goals.

Start with deterministic checks and comparisons already close to the engine:

| Insight | Action |
| --- | --- |
| Missing repayment, ownership, gross/net income or pension data | Open the relevant editor. |
| Spending gap before accessible pension money | Try retiring one year later or lower retirement spending. |
| Plan becomes unfunded under the existing retirement shock | Try the stress scenario and compare the first gap and accessible reserve. |
| Mortgage payoff is partial or consumes a large liquid reserve | Compare repayment with the same scenario without repayment; show remaining liquidity and tax. |
| Withdrawal orders produce different tax/outcomes | Compare coverage, tax and accessible assets, alongside estimated inheritance once supported. |
| Savings remain in cash while a recorded ISA allowance is unused | Review or try the saving destination, without assuming a particular investment or guaranteed return. |
| Personal Allowance taper is relevant to gross income | Explain the recorded exposure; contribution-change experiments require pension limits and supported scheme assumptions first. |
| Estate exposure or insufficient liquid funds to pay estate tax | Open the inheritance scenario and show its calculation basis. |

“Try in Planning” opens a comparison preview. Keep horizon, money basis, household inputs and rules identical, changing only the named assumptions. Show deltas in first gap, accessible closing investments, cumulative tax, liquid reserve and estimated inheritance where supported. A lower tax bill alone is not an optimisation goal: spending, risk, access, fees, survivor needs and inheritance can move in different directions.

Provide Apply to scenario / Undo / Save scenario. Household facts remain editable through their normal controls. Previewing an insight must not autosave unaccepted scenario assumptions into the default household. Add a contribution override before offering pension-contribution experiments; this override does not currently exist. Gifts also need explicit cash-flow removal, beneficiary tracking and their own tax rules before appearing as a one-click improvement.

Saved scenarios currently preserve settings and recalculate against current household inputs. Label the household version and input date used for a comparison. A historical snapshot preserving household facts and results is a separate capability. Recompute Insights when facts, scenario settings or rules change.

## 4. AI: expert explanation backed by calculated facts

Add an optional Analyse my plan action after deterministic Insights are dependable. The existing static app needs a server endpoint to protect credentials and enforce usage limits. A browser bundle must never contain an AI service secret.

Before sending financial data, show a concise preview of the minimised analysis payload. Omit names, email, account identifiers and unnecessary labels; age ranges and anonymous person IDs are enough for many explanations. Treat user-entered labels as data, not AI instructions.

The server provides the model with the supported scenario recipes, validated facts, completeness flags and dated official-source references. Require structured responses containing evidence references, proposed recipe IDs, bounded parameters, trade-offs and missing information. Validate them before rendering. The engine computes every displayed financial comparison; AI may explain it and propose another supported experiment, but must not invent savings, probabilities or tax liabilities.

AI proposals enter the same preview/apply/undo flow. Missing critical information should prompt an editor action rather than confident advice. Current simulation coverage frequency is illustrative and is not a calibrated personal probability. AI should not rebrand it as certainty or imply a guaranteed best withdrawal order. Preserve usable deterministic Insights if the AI request fails.

Show when the analysis was generated and which household/scenario/rule versions it used. Stale commentary must be marked or regenerated. Validate AI output against cases involving missing inputs, unsupported tax claims, contradictory facts, labels containing instructions and fabricated numerical recommendations.

## Later backlog, after these foundations

- Pension contribution scenarios with scheme basis, contribution limits, available allowance and access consequences; include salary-sacrifice support only with the appropriate pay/NI model.
- Mortgage fixed-rate expiry, fees and future-rate stress rather than assuming one rate forever.
- Investment fees, asset allocation and account-specific risk inputs before presenting a personalised range of outcomes.
- Dated gifting scenarios that show the effect on the donor's spending security, estate and recipients together.
- Survivor income and expenses, including actual pension death benefits and changes in ownership.
- Frozen household/result snapshots for historical comparisons, distinct from saved scenario settings that recalculate.
- Adviser-ready export containing input provenance, rule versions, missing information and the full calculation ledger.

## Engineering and verification gates

- Introduce small pure modules for tax-year aggregation/reconciliation, estate rules, beneficiary distribution and insight recipes; keep DOM work in view modules.
- Reuse the account's household-version model, adding versioned optional inheritance/beneficiary settings without replacing the default household or exposing private data in examples.
- Extend strict saved-picture/scenario validation, defaults, migration, snapshot and restore for new fields. Older saves must open without fabricated beneficiaries or lost figures.
- Add invariant tests for monthly flow conservation, gross = net + tax, annual totals = monthly sums, cumulative totals = sums since plan start, and distribution + estate costs/taxes = distributable wealth under the chosen assumptions.
- Add independent reference cases for one-off versus regular pension drawdowns with the same tax-year totals, midyear retirement, combined pay/pensions/interest, employee NI cessation, CGT allowances/cost basis and tax-year reset. Check pension-access transitions against official rules before encoding a boundary expectation.
- Exercise missing data, zero rates, exhausted allowances, large estates, partial mortgage payoff, foreign assets and incomparable nominal/real views.
- Verify each tab at 375px and desktop, keyboard and touch chart inspection, saved-version reload, preview/undo, exports and default-household autosave isolation.

## Sources checked 22 October 2026

- [GOV.UK: pension tax](https://www.gov.uk/tax-on-pension).
- [GOV.UK: employee NI after State Pension age](https://www.gov.uk/tax-national-insurance-after-state-pension-age/stopping-paying-national-insurance).
- [GOV.UK: IHT overview and who pays](https://www.gov.uk/inheritance-tax).
- [GOV.UK: residence nil-rate band calculation and taper](https://www.gov.uk/guidance/inheritance-tax-residence-nil-rate-band).
- [GOV.UK: pension IHT technical note, including the April 2027 effective date and beneficiary Income Tax](https://www.gov.uk/government/publications/inheritance-tax-on-pensions-technical-note/technical-note-inheritance-tax-on-pensions).
- [GOV.UK: taxes on inherited property, money and shares](https://www.gov.uk/tax-property-money-shares-you-inherit).
- [HMRC: long-term UK residence and overseas assets](https://www.gov.uk/hmrc-internal-manuals/inheritance-tax-manual/ihtm47020).

Use these as versioned reference material and recheck before implementing or updating rules; the model must disclose its supported scope and incomplete cases.
