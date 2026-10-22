# Independent chief accountant numerical audit

Audit date: 22 October 2026. Baseline commit: `9b3680e`.
Scope: calculation code and synthetic numerical execution, not a certification of any private account. No account data was read or changed. No implementation changes were made by this reviewer.

## Conclusion

The per-person pension tax-free allowance, cumulative pension withdrawal taxation, retirement cessation fix, and tested mortgage arithmetic work under the model's stated assumptions. However, the tax figures should not yet be presented as a fully reconciled tax-year liability: a retirement-year savings-interest example overcharges tax by £518.31. Existing tests all pass because they do not cover this interaction.

## Confirmed numerical defect — high priority

### Savings tax uses current annualised salary after employment tax was changed to a tax-year forecast

Location: `prototype/planning.mjs:197–199`, `prototype/planning.mjs:110`; compare forecast recurring income in `prototype/planning-tax.mjs:15–28`.

Reproduction, all synthetic:

- `createBlankMonthlyFlow()`, `asOfMonth = timelineStartMonth = '2026-04'`.
- Single person, age 60; primary gross salary £24,000/year, no bonus or employee/employer pension contributions, final pay month `2026-09`.
- One primary-owned cash asset, opening £100,000, no debts; no spending, other income, or State Pension.
- `projectPlan(..., {years:1, inflation:0, incomeGrowth:0, growth:{cash:6, isa:0, pension:0, property:0, shares:0}})`.

Actual results:

| Item | Engine output |
|---|---:|
| Actual salary earned Apr–Sep | £12,000 |
| Employment Income Tax | £0 |
| Gross savings interest over all 12 months | £6,465.16 |
| Savings-interest tax reserved/deducted | **£518.31** |

Correct savings tax on these realised amounts is **£0**: unused Personal Allowance £570, savings starting-rate band £5,000, and Personal Savings Allowance £1,000 permit £6,570 interest before tax. The engine itself's `savingsTax(12000,6465.16)` returns £0. Full-year interest remains under that limit even after returning the small excess reserve to cash.

Cause: employed months use £24,000 annualised pay when computing interest tax; later retired months switch to £0 rather than reconciling against the same year's actual £12,000. The deduction is never refunded. The documentation acknowledges monthly annualisation, but this example is a material numerical mismatch, not merely an inconvenient label.

Recommended fix: maintain per-person fiscal-year accumulated interest, non-savings income, pension withdrawals and tax already reserved; reconcile the total incremental liability consistently. Forecast reserves may be used during the year, but must support negative adjustments/refunds and end-of-year reconciliation. Do not simply replace salary with forecast income while continuing to annualise changing interest each month and call it exact. Add this example as a regression and check retirement, pay changes and pension drawdowns in the same year.

## Independently checked pension examples — pass within penny rounding

Called `withdrawForSpending` in fiscal-year mode (`month:'2026-04'`, age60), with an eligible £100,000 primary pension and specified other annual taxable income. These tests solve for a required net withdrawal; internal £1,000 allocation steps can differ by a few pennies from an exact gross target.

| Other taxable income | Remaining tax-free allowance | Intended gross withdrawal | Expected tax | Actual tax |
|---|---:|---:|---:|---:|
| £0 | £268,275 | £20,000 | £486 | £486 |
| £20,000 | £268,275 | £20,000 | £3,000 | £2,999.99 |
| £100,000 | £268,275 | £20,000 | £9,000 | £8,999.96 |
| £0 | £0 | £20,000 | £1,486 | £1,486 |

The third case correctly includes the Personal Allowance taper: £15,000 taxable drawdown above £100,000 incurs an effective 60% marginal charge. The first has £5,000 tax-free, £15,000 taxable, less £12,570 Personal Allowance, giving £486 tax. With exhausted allowance the full £20,000 is taxable, giving £1,486.

Large two-person test: two £2 million pensions, each owner age60 and no other income. A £1.5 million net need in April2026 withdrew £2,238,106.06 gross with £738,106.06 tax. Each person used exactly £268,275 tax-free; neither received the other's allowance. In April2027 a further £100,000 net draw received **£0 additional tax-free cash**: lifetime allowances did not reset at the tax-year boundary. Annual income-tax bands did reset. Owner1's first-year taxable pension £888,959.85 independently gives £386,234.85 tax; owner2's £812,596.21 gives £351,871.21, matching output.

Relevant implementation: `prototype/withdrawals.mjs:12–15` (per-owner remaining allowance), `:34` (fiscal-year income reset), `:53–58` (tax-free fraction and incremental tax). Remaining lifetime tax-free allowance is deliberately not reset.

## Automated verification executed

67 tests passed, 0 failed:

```sh
node --test tests/test_planning_tax.mjs tests/test_withdrawals.mjs tests/test_planning_retirement.mjs tests/test_investment_tax.mjs tests/test_mortgage_payment.mjs tests/test_planning.mjs tests/test_planning_review.mjs
```

These cover salary/contribution cessation after the materialised final working month; employee NI cessation; a midyear-retirement employment-tax case; pay and State Pension sharing an allowance; a one-off pension-funded mortgage payoff; equivalent annual versus monthly pension needs; April reset; calendar/fiscal/cumulative reporting; real-money discounting; mortgage repayment/interest-only; asset conservation and source immutability. Passing these cases does not validate untested tax interactions.

## Supported assumptions and limitations requiring clear presentation

- Pension withdrawals assume phased uncrystallised withdrawals with 25% tax-free while remaining allowance exists. There is no separate crystallised/taxable-only pot or upfront pension commencement lump sum. A person who has already taken tax-free cash needs an accurate remaining allowance, and still needs a taxable-only pot distinction if some pensions are crystallised while others are not. Protected higher allowances are rejected by the standard £268,275 cap. These are scope limits, not verified full pension administration.
- Contribution tax treatment assumes a **net-pay arrangement** (`prototype/uk-pay-estimate.mjs`), not salary sacrifice or relief-at-source. The same pension percentage can produce a different NI/take-home result in a real salary-sacrifice scheme. Contribution annual allowance/taper and MPAA eligibility are not validated.
- NI age inferred from whole age and opening month is approximate (`prototype/planning-tax.mjs:11–13`); it is not a statutory date-of-birth calculator. An explicit NI exemption month is available. Retirement alone does not determine NI exemption; stopping salary removes salary NI in either case.
- Whole April–March months approximate the actual 6April tax-year boundary. Opening partial-year earnings, prior taxes and withdrawals are not known. Unidentified regular private pension income, rent and some other taxable sources are flagged as incomplete; their omission can materially affect tax and funding.
- Current England/Wales/Northern Ireland rates are frozen nominally throughout the projection. This produces fiscal drag rather than a forecast of future legislation. Scotland's non-savings bands are unsupported.
- Income/funding bars are **net available cash**, and include asset withdrawals. Tax bars cover wider sources, including tax on interest whose gross amount is credited to assets outside that income graph. Comparing their heights as gross income versus deductions is misleading. Label net income explicitly and expose gross pay → employee contribution → payroll tax/NI → take-home, with savings and withdrawal tax separate.
- Calendar-year and cumulative tax tables correctly sum recorded monthly ledger amounts and discount real values once; summation correctness does not cure errors or omissions in that underlying ledger. Fiscal-year tax liabilities and calendar-year graph amounts must be distinguished.

## Authoritative rules checked

- [GOV.UK: lump sum allowance](https://www.gov.uk/tax-on-your-private-pension/lump-sum-allowance): usual 25% and standard £268,275 lifetime allowance; protection can change it.
- [HMRC: individual lump sum allowances](https://www.gov.uk/guidance/find-out-the-rules-around-individual-lump-sum-allowances): allowance applies across relevant pension lump sums, including the tax-free element of UFPLS.
- [GOV.UK: Income Tax rates](https://www.gov.uk/income-tax-rates): standard Personal Allowance and taper above £100,000; regional differences apply.
- [GOV.UK: savings interest tax](https://www.gov.uk/apply-tax-free-interest-on-savings): unused Personal Allowance, savings starting-rate band and Personal Savings Allowance are separate relevant reliefs.
- [GOV.UK: NI after State Pension age](https://www.gov.uk/tax-national-insurance-after-state-pension-age/stopping-paying-national-insurance): employee NI cessation depends on State Pension age, not when someone chooses to retire.

Priority: fix the savings-interest reconciliation before adding more precise-looking projected tax or optimisation claims; retain the independently passing pension/retirement cases as regression coverage.
