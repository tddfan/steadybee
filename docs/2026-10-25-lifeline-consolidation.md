# One Lifeline, baseline-aware adjustments

The separate annual Planning chart and its repeated metric tabs, year picker, money toggle and year inspector are retired from the active experience. Lifeline owns the visible chart, date selection, comparison and money basis.

## Adjustments

**Adjust outlook** opens a 340px panel beside Lifeline on desktop and a non-modal bottom panel on mobile. Opening it scrolls the chart into the visible area above the controls. Existing retirement, horizon, budget, growth, pension, debt, funding, saving and one-off controls retain their calculation/event paths and saved-state format. Done and Escape close the panel.

Each control shows the selected frozen baseline's value. Numeric sliders also mark its position; changed controls and accordion sections are highlighted. The panel names the reference and reports how many assumptions differ. Selecting another baseline updates those references without adopting its inputs or changing the current path.

**Use baseline assumptions** restores scenario assumptions, with effective inflation/growth defaults materialised from the archived baseline. It does not restore household balances, overwrite tracking entries, delete history or create a new baseline. Undo is available. Personal households without a baseline get a single prompt to establish one rather than invented baseline values; the public sample uses the authored sample outlook.

Legacy documents with a fixed number of forecast years retain that horizon. Merely opening adjustments must not silently expand a three-year imported scenario to age 95. Age-based scenarios retain Plan to age; fixed horizons show Plan length.

## Useful capabilities carried across

- Lifeline adds **Income & funding** (net recurring income plus net asset withdrawals) and **New savings** (positive monthly surplus, separate from contributions/withdrawals).
- A progressive inspector breakdown groups the current metric by person or source/type. Income after tax excludes asset withdrawals; Income & funding includes them. Stock breakdowns use closing balances and flows sum months. Archived breakdowns are not reconstructed when they were never stored.
- The selected funding order sits with the inspector. **Explore alternatives** contains the existing withdrawal-order comparison and optional outcome simulation. **Saved scenarios** is available in the Lifeline header.
- The existing information icon includes selected-period/cumulative tax components, the monthly baseline comparison CSV and the full nominal-pound ledger for Excel, including monthly, annual, cumulative and April–March tax-year rows. It does not add a second chart or information icon.

## Implementation and validation

The existing planning controller retains input IDs, handlers, scenario-library state and export/calculation code. Its obsolete DOM is isolated in a hidden compatibility shell and its chart renderer is skipped after Lifeline integration. All moved controls remain descendants of the same controller root, so delegated events continue to work. No new tax rules, backend schema, provider requests or account migration are introduced.

Pure tests cover saved effective defaults, explicit zero/false, retirement age/year provenance, fixed versus age horizons, baseline immutability and assumption restoration. Financial breakdown tests reconcile funding, recurring income, saving, assets, debt, spending and tax against the monthly engine, including positive savings and cumulative tax.

Synthetic browser journeys cover desktop/mobile controls, switching the reference, live changed markers, baseline restoration, unchanged archived baselines, saved scenarios, both export paths and existing input navigation. The chart stays visible while mobile controls are used. The original baseline/tracking journeys remain regression coverage. These tests use synthetic accounts and block external requests; they are not a live account or accountant audit.
