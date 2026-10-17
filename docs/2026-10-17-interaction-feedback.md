# Interaction and scenario feedback — implementation plan

Keep the Bento presentation and existing IDs. Move People configuration beside owner filters. Let chart pointer movement select the inspected year, with horizontal touch scrubbing, vertical page scrolling and existing keyboard/select alternatives. Provide a separate GOV.UK forecast link alongside the pension edit control; never nest a link in a button.

Show the actual selected withdrawal bucket order, with eligibility/tax qualifications behind a disclosure. Flag only active gross-pay estimates whose existing calculation reduces the Personal Allowance; call this pay-only, not a full adjusted-net-income assessment. Link HMRC guidance without recommending contributions.

Add an opt-in deterministic 20% investment-value shock at the first recorded retirement month (or opening month if already retired). It applies once, before that month's growth, deposits and withdrawals, to ISA, general, shares and DC pension balances, including locked DC pots. Cash, property and defined-benefit income stay outside this proxy. No asset allocation is inferred. Existing growth assumptions resume; this is one illustrative shock, not a worst case or probability model. No known retirement date means no shock and an explicit message. Preserve source records, tax cost bases and scenario saving/Undo/reset. Cover timing, eligibility, depletion, off-state equivalence and input validation with deterministic tests before implementation.

## Sources and verification

- [HMRC adjusted net income](https://www.gov.uk/guidance/adjusted-net-income) and [Personal Allowance taper](https://www.gov.uk/income-tax-rates) checked 17 October 2026. The existing deterministic payroll estimator already applies this taper; this change surfaces its result rather than adding an unverified tax calculation.
- [GOV.UK State Pension forecast](https://www.gov.uk/check-state-pension) opens separately without sending app inputs.
- Desktop and 375px browser checks: People editor, owner filter, separate forecast links, retained pension entry dialog, chart dragging updates the year and annual figures, stress toggle calculates its loss and milestone, and no horizontal page overflow. Native drag exercises pointer scrubbing; this is not a physical-device touch test.
- Deterministic regression tests cover shock off/on, exact timing, locked pots, cash/property exclusions, new shortfall, normal growth after shock, source immutability, missing dates, and encrypted scenario round-trip/validation. All 159 calculation, storage and build tests passed, along with module syntax and whitespace checks. Stress-toggle Undo was checked in the browser; no runtime errors were reported.
