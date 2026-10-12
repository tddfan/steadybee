# Retirement screen clarity

Improve the existing retirement preview without changing the household model.

1. Keep the existing outcome, scenario management and chart tabs, with one active chart at every viewport size.
2. Give the selected year a clear context and a short chart-specific explanation. Move category legends, technical notes and the six-number overview into disclosures.
3. Use round chart-axis amounts, readable humanist typography and generous controls. Preserve keyboard navigation and the shared year selector.
4. Prioritise work/retirement controls; disclose income, spending and money moves on demand.
5. Rebuild locally, check desktop and mobile layouts, exercise chart tabs/year selection/disclosures, and run the existing relevant regression tests.

Density follow-up: combine tabs/year selection and slider/ages into two compact rows, align chart titles and amounts on one line, move chart explanations into the keys, group year workings behind one disclosure, and use a shorter chart frame. Preserve 18px main text and 44px controls.

Controls-below follow-up: make the graph full width and move Adjust your plan below it. Close individual control sections by default and show concise, computed summaries in their collapsed rows. Keep starting-year averages distinct from the chart's selected year. Use the extra desktop width for single-line ledger editing, preserve mobile readability, and verify live edits, scenario changes and invalid-input handling.

Salary-editor follow-up: open pay and pension settings directly from salary/bonus Edit, with pension contributions expanded. Preserve owner, amount conversion, growth, duplication/removal and payment-month controls; refresh the owned pension pot when the owner changes. Verify desktop/mobile editing and the payroll regressions without changing the calculation model.

Preserve the existing edits to retirement.html. Retain fictional-example labelling, tax/transfer explanations and auditable figures. Production deployment requires the user's explicit instruction.
