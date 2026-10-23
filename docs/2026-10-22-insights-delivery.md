# Insights delivery

Added Insights after Inheritance. This release uses deterministic Planning calculations; no AI provider, external analysis request or new accountant-agent run is involved.

## Behaviour

- Show at most three cards, prioritising unmodelled repayments, funding gaps and missing tax inputs. Focus can be spending security, earlier retirement or future assets. Preferences save with household versions.
- Six bounded experiments: reduce regular post-retirement spending5%, move future retirement one year later/earlier, enable the existing20% retirement shock, compare an alternative eligible withdrawal order, or test a cash-and-shares mortgage payoff. A recipe is unavailable where its required inputs are absent or the assumption is already enabled.
- Every preview reruns the same engine with the same household, horizon, returns and money basis. Compare first recorded spending gap, total unfunded spending, cumulative tax/NI, accessible investments, net assets and cash at the horizon. Monetary results are today's money; monthly tax/shortfall flows are discounted individually. Accessible assets remain before withdrawal tax.
- No preview edits household facts or the active Planning scenario. Apply is explicit and supports both the native Planning Undo and an experiment Undo banner. If facts/scenario change, the old preview cannot be applied or saved. An Undo banner disappears when its source changes rather than reverting newer changes.
- Save without applying preserves a named scenario through the existing Saved scenarios library. It does not replace the active scenario. Saved assumptions recalculate against current household inputs; they are not frozen historical balances/results.
- Reducing spending preserves separate debt payments and dated costs, and scales existing later spending phases instead of discarding them. Retirement changes preserve recorded pay-end months. Mortgage payoff keeps the existing partial-payoff behaviour and reports remaining debt. A lower tax bill alone is not described as an improvement.
- Working snapshots materialise the same retirement defaults as the controls, even if Insights or Inheritance is opened before visiting Planning. This prevents a preview baseline silently assuming continued employment while its candidate has a retirement date.

## Verification

The full188-test regression suite passed, including eight new Insights cases. Tests cover preview immutability, retirement timing, spending-phase composition, missing-data priority, tax limitations, supported recipes, identical horizons, real-money aggregation, stale source keys and saved-goal validation. Subsequent targeted checks after final view changes also passed. Another48 account/profile/state regressions passed, giving236 tests across the two full regression groups. Browser interactions were checked separately in the in-app browser.

Browser checks used the public synthetic household: preview alone did not apply anything; Save without applying increased saved-scenario count; Apply moved both retirement ages one year; Undo restored the original dates and retained the named alternative. No private household facts were edited. No console errors were observed.

At375px, the page remains375px wide. Navigation scrolls inside its own bar. Comparison rows become stacked Current / Experiment / Change cards with no horizontal overflow. Desktop uses a compact table.

## Remaining scope

Existing model limitations remain visible, including incomplete tax data, monthly tax-year boundaries and unmodelled debt. “No recorded gap” is not a guarantee or calibrated success probability. These experiments do not optimise contributions or incorporate limits/salary sacrifice, add gifting, recalculate inheritance outcomes, or simulate survivor cash flow. Optional AI explanations are a later delivery and must use a protected server endpoint and explicit, minimised data sharing.
