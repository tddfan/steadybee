# Savings-interest tax-year reconciliation

The accountant audit found that monthly annualisation overstated savings-interest tax after midyear retirement. Planning now accumulates actual earned interest per person in each April–March tax year, and uses the same forecast recurring taxable income as its payroll and pension withdrawal calculations. It reserves only each month's incremental liability; it does not charge against predicted future interest. A January retirement does not reset annual allowances: April does.

For recurring taxable income B, cumulative taxable pension withdrawals P, and cumulative interest I, an interest credit charges T(B+P, I_new) − T(B+P, I_old). A later pension draw charges T(B+P_new, I) − T(B+P_old, I). These changes telescope to the full modelled Income Tax liability without double charging allowance taper or savings-band changes. A mortgage payoff before interest accrual uses the previous accrued interest; ordinary draws after interest accrual use the updated amount. Pension tax-free lifetime allowance is unchanged.

Cash taxes are allocated within each owner's accounts, including their half of shared accounts. Later interest that moves earlier realised gains into a higher CGT band is separately charged to cash and reported as Capital Gains Tax, rather than savings Income Tax. Annual results, comparisons and CSV export include this adjustment.

## Validation

- Original synthetic case: £24,000 salary rate, last pay September2026, starting April2026 with £100,000 cash at6%, no expenses or pension contributions. Actual salary is £12,000; savings tax is now **£0**. Interest is **£6,486.80**, closing cash **£118,029.60**. Interest is slightly higher than the original failing run because excess tax no longer leaves the cash balance.
- Six new regression tests cover that reproduction, varying balances, April resets, owner/joint allocation, pension-and-interest taxation including allowance taper, cash conservation and CGT rebanding.
- One old test incorrectly expected savings tax to disappear in January immediately after retirement. It now verifies that the salary earned in that same tax year still matters until April.
- All159 targeted regression tests passed, including the deployment build and nested-module version checks.
- The independent chief accountant also checked30 synthetic fiscal-year combinations against separately summed income/interest/pension/gains liabilities; maximum difference5p from rounding. No blocking discrepancy found.
- Browser checks confirmed annual/cumulative tax views, updated method text and no console errors. No private financial inputs were edited.

This remains a projection under fixed2026–27 England/Wales/NI rates, with whole-month April boundaries. Opening-year prior interest, withdrawals and tax payments are unknown, and existing incomplete-income warnings remain. The monthly tax reserve is modelling timing, not a forecast of HMRC collection dates.

Rule reference: [GOV.UK savings allowances](https://www.gov.uk/apply-tax-free-interest-on-savings/how-much-is-tax-free).
