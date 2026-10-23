# Tax reporting: first delivery

Implemented 22 October 2026 as the first delivery from the tax/inheritance/Insights roadmap. No private household figures are included here.

## Available in Planning

- Tax & NI beside the existing metrics, with Annual / Cumulative chart modes.
- Person or component chart grouping through Chart options.
- Selected calendar-year and cumulative component table: employment Income Tax, State Pension Income Tax, pension-withdrawal Income Tax, CGT, cash-interest tax and employee NI.
- Cumulative means since the plan starts. Today's-money amounts discount each month's flow before adding it.
- Partial-estimate status and explanations for unknown take-home deductions, unclassified private pensions, unsupported income tax and missing opening-year history.
- Calculation CSV now includes monthly, annual, cumulative and April–March tax-year rows. Partial tax years are labelled by their projected month counts.
- Tax chart settings and optional NI exemption month survive saved household/scenario validation. Older saves still work.

## Calculation changes

Planning now forecasts recurring taxable earnings and State Pension for an April–March tax year. When their basis is known, employment and State Pension Income Tax are allocated from this forecast instead of assuming twelve months of pay after a midyear retirement. Their existing net income flows remain the cash-flow source; displaying the taxes does not deduct them a second time.

Pension withdrawals use accumulated taxable withdrawals within that year, rather than multiplying every month's withdrawal by twelve. Forecast recurring income establishes the remaining tax bands. A one-off pension-funded £12,000 payoff with no other income and sufficient tax-free allowance therefore no longer generates the previous spurious recurring-withdrawal tax. When pension income changes the CGT band for gains already realised that year, the incremental CGT is separately tracked.

Employee NI stops at an optional recorded exemption month. Otherwise the engine estimates its timing from recorded age, using approximate State Pension ages of 67/68. The exemption month belongs to reaching State Pension age, not the date someone chooses to claim. Month precision and age-only inference cannot verify an individual eligibility date. Scenario age overrides also apply to the NI estimate.

The standalone withdrawal helper preserves its prior annualised mode for callers without a tax-year income context. Planning always supplies the new tax-year context. This keeps that older API behaviour explicit rather than silently changing unrelated callers.

## Remaining limits

- This is a modelled estimate, not a full tax-return or PAYE reconciliation.
- Before a midyear plan start, recurring income is assumed at the opening rate. Earlier tax paid, pension draws and gains are not known. The opening tax-year limitation is disclosed.
- Cash-interest tax remains an annualised monthly reserve; it is not yet reconciled against actual full-year interest.
- Regular private pension income still needs a person and gross/net basis before its own tax can be reported reliably. Other manually entered taxable income retains the older simplified basis for pay/State Pension estimates.
- Tax within actual take-home entries is unknown and excluded from the reported total. Dividend/rental/other unsupported income taxes remain excluded and relevant records are flagged.
- Rates remain 2026–27 England/Wales/NI assumptions held fixed; tax-year boundaries use whole April–March months rather than splitting 6 April.
- Inheritance, deterministic Insights and optional AI analysis are subsequent deliveries. This change does not add their tabs or a live AI service.

## Verification

151 targeted tests passed across planning, the new tax ledger, tax functions, payroll, withdrawals, pension estimates, mortgages, monthly flow, coverage, saved household/scenario validation, simulations, account restore and production build.

New reference cases cover:

1. £24,000 salary: £2,286 Income Tax and £914.40 employee NI for a full modelled year; saved surplus is not taxed twice.
2. NI exemption at State Pension age, an explicit midyear exemption month and scenario age overrides.
3. Midyear retirement with earnings below the annual Personal Allowance.
4. Employment and State Pension sharing one allowance.
5. A one-off pension-funded mortgage payoff without inventing monthly repeats.
6. The same net pension need withdrawn once or across twelve months, with matching final tax-year tax within rounding tolerance.
7. April pension allowance reset, cumulative sums, calendar/tax-year separation and inflation-discounted totals.
8. Explicitly incomplete totals for take-home-only and unclassified pension entries.
9. Saved Tax/Cumulative settings and rejection of imported internal tax overrides.

Browser verification used the fictional example: annual/cumulative selection, matching chart/inspector/table totals and CSV download. The tax table fit a 375 CSS-pixel viewport without horizontal page overflow. No real household figures were edited for verification.

References checked: [pension tax depends on total tax-year income](https://www.gov.uk/tax-on-pension), [employee NI after State Pension age](https://www.gov.uk/tax-national-insurance-after-state-pension-age/stopping-paying-national-insurance).
