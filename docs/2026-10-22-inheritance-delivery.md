# Inheritance: first delivery

Added Inheritance after Planning. This is a single-person estate snapshot and percentage-distribution illustration, not a linked first/second-death or survivor projection. Existing household facts and Planning calculations remain separate.

## User journey

1. Choose whose estate and an assumed death date. Current assets uses recorded balances without growth. Planning scenario uses the same retirement, growth, spending and mortgage settings, with the selected month's closing balances in future nominal pounds. Dates outside the Planning horizon show an error.
2. Create an equal split among 1–20 children, or add named beneficiaries with relationship and percentages. Percentages are explicitly **before estate tax**. Spouse/civil partner exemption requires that relationship to be selected; having a household partner does not establish it. Tax burden is allocated to non-exempt recipients. This differs from a legal will specifying equal after-tax residue or mixed fixed gifts.
3. Choose a qualifying residence only where the person lived there and it passes to direct descendants. Joint assets and debts default to 50%; ownership overrides are kept separately from asset records, are complementary where only one person's override exists, and conflicting explicit shares over100% are rejected.
4. Review optional verified transferred allowance percentages and deductible funeral costs. Confirm standard UK scope and pension assumptions. Complex estates and missing confirmations remain visibly incomplete.
5. Open the small information icon for the numerical calculation and CSV for Excel. Settings travel with the existing default household and saved household versions. Older saves without inheritance settings open with an empty beneficiary list.

## Calculation scope

- £325,000 standard basic band; up to £175,000 residence band, capped at qualifying net home value passing to direct descendants. The combined residence allowance is tapered by £1 for every £2 of net estate above£2m, before capping against qualifying home value. These nominal thresholds and the40% rate are held fixed for future scenarios.
- Validated unused transferred percentages can increase either band. There is one estate allowance calculation, regardless of how many children receive it.
- Standard unused discretionary DC pensions are assumed outside IHT for deaths before6April2027 and inside it from that exact date. Pension nominations are assumed to follow the same percentages only after user confirmation; other scheme terms remain unsupported.
- Beneficiary pension Income Tax is excluded and explicitly labelled. “After estate tax” does not claim to be after all pension-beneficiary taxes. Most ordinary inheritances do not have an immediate separate beneficiary Income Tax bill merely because they are inherited, but later income/gains are outside this view.
- The cash/ISA liquidity check reserves recorded debts and funeral costs first; it does not prescribe which assets an executor must use to settle liabilities or tax.
- Recent gifts, trusts, charitable relief/rates, agricultural/business relief, foreign assets, residence exceptions, downsizing relief, special pension protections and actual executor funding choices require separate analysis. Selecting complex items marks the result incomplete; no guessed relief is applied.
- Projected balances inherit Planning's missing tax/debt information and funding-gap warnings. Survivor earnings, pensions and ownership transfers are not simulated.

## Verification

- 172 targeted tests passed, including13 new Inheritance cases, older saved-version compatibility, encrypted roundtrip, individual projected asset/debt balance reconciliation and deployment build checks.
- Reference cases: £500k without qualifying home →£70k estate tax; £500k with sufficient home →£0; £2.2m eligible estate →£720k. Exact pension-date boundary, spouse versus unmarried partner, net home equity, transferred bands, insolvency and ownership conflicts are tested.
- Independent accountant review plus100 extra distributions:1–20 children and estates from1p to£999,999,999.99. All gross shares, estate tax allocations and net distributions conserve pennies; equal child payouts differ by at most1p. No blocking finding remained after review fixes.
- Browser journey: create three children, select a future Planning date and qualifying home, review assumptions, open calculation dialog and download actual CSV. CSV beneficiary totals match the after-estate-tax result. No console errors.
- 375px browser viewport verified: document scrollWidth375px, navigation overflow contained within its own bar, active section revealed. Checked beneficiary inputs and two-column mobile KPI cards. Desktop also exercised. No private account data changed or committed.

## Sources checked 22 October 2026

- https://www.gov.uk/inheritance-tax
- https://www.gov.uk/guidance/inheritance-tax-residence-nil-rate-band
- https://www.gov.uk/hmrc-internal-manuals/inheritance-tax-manual/ihtm46025
- https://www.gov.uk/guidance/inheritance-tax-grossing-up-calculator
- https://www.gov.uk/government/publications/inheritance-tax-on-pensions-technical-note/technical-note-inheritance-tax-on-pensions

Next roadmap delivery: deterministic Insights with preview/apply/undo, followed by optional AI explanations backed by engine results. These are not part of this release.
