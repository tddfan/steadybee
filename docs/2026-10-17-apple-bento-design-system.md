# Apple Bento design system — 17 October 2026

The requested Apple Health / Apple Card and Copilot Money direction supersedes the earlier flat Google Finance-inspired treatment. This is a presentation refactor of the existing static prototype, not an engine or data-format migration.

## Implementation

`finance-theme.css` defines shared surface, ink, typography, semantic colour, radius and elevation tokens. Sticky translucent navigation, segmented view controls and owner filter pills establish three levels of navigation. Currency, ages, years and chart axes use tabular numerals.

Assets show live net worth, confirmed-access assets, total assets and negative debt; grouped row buttons preserve editing labels and focus restoration. Owner pills disappear when filtered. Linked mortgage/equity pills use the recorded balances. Access review remains an expandable amber banner above the list.

Monthly KPI values come from the existing flow diagram and summary: sources excluding funding gaps, modelled deductions, recorded spending and remainder. Actual take-home entries retain their after-tax meaning. Flow and exact Table remain available. Income, spending, State Pension and scheduled entries retain existing editors.

Planning retains the deterministic model and scenario state. Coverage is qualified under entered assumptions and uses actual end ages; shortfalls remain warnings. The inspector opens beside the chart on desktop and as a 35–80vh sheet below 768px. Pointer drag and arrow/Home/End resizing, Escape/Done dismissal, a mobile focus trap and focus return supplement touch controls. The compact mobile chart stays visible above the sheet. The Year inspector moves existing milestone, year and funding elements into cards without changing their calculations.

The semantic palette is teal for the primary person, iris for the partner, ochre for shared values and coral for outflows/debt. Warning copy uses a darker amber on the requested pale tint for readability. The spending line has a white halo. Projection qualifications and “Illustration, not advice” remain visible.

## Verification

Browser checks at 375×812 and 1280×900 cover layout overflow, four live KPI values, grouped asset editing/cancel/focus return, owner filtering, Flow/Table switching, Planning navigation, live age edits, Undo, sheet resizing/dismissal and the 340px desktop inspector. All 154 existing calculation, storage and static-build tests passed, as did module syntax and whitespace checks; the optional browser suite expectations are updated for negative debt presentation and the now-visible Year inspector.

This is implementation and browser validation, not research with human prospective users or an Apple certification.
