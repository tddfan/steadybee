# Planning prototype

Build a deterministic monthly illustration from the recorded opening balance sheet and cash-flow timeline. Preserve the source inputs when changing a scenario.

- One chart workspace: income, saving, asset balances and debt balances; group by person or type; annual stacked bars or lines; nominal or today's pounds. Selecting a year exposes exact amounts.
- Editable sliders: inflation, pay growth, cash/ISA/DC pension/property/shares growth, final working year per person, mortgage rate, earlier mortgage payoff and horizon. Defaults are illustrative assumptions, never recommended returns.
- Recompute monthly pay/tax from current 2026–27 rules, stop pay and pension contributions at the scenario's final working month, carry scheduled entries and optional configured State Pension income into future months.
- Compound assets monthly; add employee/employer DC pension contributions; route positive saving in the user's chosen cash → own ISA → general account order. Reset subscriptions in April (monthly approximation), retain year-to-date subscriptions in the initial tax year. If routing is disabled, retain surplus as cash.
- Inflate spending and rent/pay using stated assumptions; State Pension and other fixed pension receipts stay nominal. Future dated costs are entered in today's pounds. A scenario-only one-off cost uses the same convention.
- Service included repayment mortgages with a constant rate and actual/calculated installment; an explicit repayment term recalculates installments. A pay-off-now scenario withdraws from eligible opening assets, records gross/net/tax, and reduces mortgage balances only by funded amounts; any remainder retains its repayment schedule. Excluded mortgage balances stay unchanged. Other debts use explicit planning repayment/rate inputs; unspecified schedules are disclosed and held unchanged.
- Spending gaps withdraw from the selected cash/general/ISA/DC pension order. DC access is checked per person (default age 57); property, possessions and shares with unconfirmed access are excluded. Show gross withdrawals, estimated tax and net funding by person/account. Any unmet amount is recorded as unfunded; balances continue, including inaccessible pension pots. Later income does not silently settle earlier unmet costs. Unpaid debt installments remain in their debt balance.
- State Pension uses an editable scenario age and recorded NI years plus assumed future qualifying years while working. The simplified 35-year/ten-year-minimum method is approximate for pre-2016 records; an entered official forecast takes precedence. Age-only dates are approximate. State Pension uprating with inflation is an editable assumption.
- Keep a prominent today’s-money/future-value toggle across charts and exact figures. Multiple household spending change years/percentages affect ordinary categories relative to the opening baseline; mortgage and dated/scheduled items retain their own amounts and schedules.
- Pension tax uses an annualised incremental Income Tax estimate with up to 25% tax-free, capped by entered remaining lump-sum allowance (£268,275 default assumes unused). GIA tax applies an editable flat 24%/18% estimate to gains above the £3,000 annual exemption, reset in April; new deposit basis is tracked. Unknown opening gain share defaults to 100%, explicitly editable. No other gains, losses, tax protections, investment income tax, fees or changing future tax rules.
- Compare user-selected withdrawal orders without ranking or recommending one. Small withdrawal steps choose lower immediate estimated tax within each bucket; do not claim lifetime optimisation.
- Include opening balances and annual snapshots, partial-year labels, assumptions/method disclosure and exact-value table. No income is manufactured from pension pots or investment growth.

Sources checked 15 October 2026: GOV.UK ISA overview (2026–27 £20,000 limit; https://www.gov.uk/individual-savings-accounts); Bank of England monetary policy (2% target is context only; https://www.bankofengland.co.uk/monetary-policy). Tax uses the existing audited pay-estimate module. Current rules are held constant for illustration.

Verification: deterministic tests for balance conservation, zero growth, cash reserve/ISA transitions and resets, retirement/pension contribution end, scheduled expenses/one-off costs, mortgage amortisation/term shortening, inflation and immutability. Browser review of chart toggles, slider changes, exact values and empty state.

Drawdown sources checked 15 October 2026: https://www.gov.uk/new-state-pension/what-youll-get; https://www.gov.uk/new-state-pension; https://www.gov.uk/personal-pensions-your-rights/how-you-can-take-pension; https://www.gov.uk/government/publications/increasing-normal-minimum-pension-age/increasing-normal-minimum-pension-age; https://www.gov.uk/capital-gains-tax/rates; https://www.gov.uk/capital-gains-tax/allowances.

Visual refinement: larger SVG chart (1000×500), distinct qualitative colours with white boundaries, and year hover/focus details. Growth inputs are nominal; the displayed real rate is (1+nominal)/(1+inflation)−1, before tax.

## Investment tax and compact controls — 15 October refinement

- Replace the flat CGT selector with deterministic 18%/24% income-band estimates and the £3,000 annual gains exemption. Opening cost basis uses the visible gain-share assumption; new deposits retain their cost.
- Treat cash growth as interest. Aggregate accounts per person, split joint interest equally, apply Personal Allowance/taper, starting-rate savings band and Personal Savings Allowance, and reserve the estimated tax from cash monthly. ISA growth/withdrawals and cash principal withdrawals remain untaxed.
- Include savings interest in pension marginal-tax estimates and CGT income-band estimates. Show gross cash interest and estimated tax in annual details; order comparisons include interest and withdrawal tax.
- Keep 2026–27 England/Wales/NI rates and nominal thresholds fixed for all future scenario years. Monthly income/interest are annualised: this is a provisional projection, not a complete tax-year reconciliation. Later income changes can change actual liability. General investment returns represent capital appreciation only; dividend and rental-income tax remain excluded and disclosed. Gross income is needed for accurate income-band estimates; take-home-only entries trigger a warning.
- Compress final-working-year/horizon controls into three rows. Shorten household spending copy and move the explanation into a disclosure, keeping 40–44px controls.
- Verification: 92 Node tests pass, including HMRC CGT examples, savings allowances/taper, joint/multiple cash accounts, retirement tax changes, and projection deductions. Browser checked at 1280px; screenshot `/tmp/steadybee-tax-compact.png`.

## Like-for-like mortgage payoff comparison

A fictional employer-share holding records value and purchase cost separately, with Needs sale access. The share editor exposes purchase cost and scheme classification with validation.

Add a user-selected cash-and-shares mortgage payoff which preserves ISAs/pensions, explicitly permits sale of Needs sale shares for the opening payoff only, and never falls back to other assets. Add General account only as an explicit scenario destination for all future surplus. Show debt/net worth beside total assets and itemise payoff sources/tax. Existing automatic options remain available.

The retired example's selected cash-and-shares payoff is tested with isolated synthetic balances and cost basis. It uses the current illustrative CGT rate above the annual exemption, with no other gains/losses. Source: https://www.gov.uk/tax-employee-share-schemes/save-as-you-earn-saye . Scheme relief/ISA transfers, other employee-scheme employment tax, lender fees, dividends and full-year tax reconciliation are excluded.

With default 4% nominal investment growth, 2% cash/pay/inflation and all surplus to general accounts in both cases, net-worth difference versus scheduled mortgage: −£1,600.41 after 12 months, +£126,776.37 after 120 months, +£334,037.44 after 252 months. Future pounds, before unrealised gain tax. Original comparison used ISA funds and differed from the app defaults; it was not like-for-like.

Verification: calculation tests cover recorded synthetic share basis, preserved ISAs, partial payoff and direct-to-general saving. Browser checks confirm the estimate and remaining debt in the selected scenario.
