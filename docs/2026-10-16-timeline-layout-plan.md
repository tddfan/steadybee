# Timeline and planning layout polish

- Separate the month field, slider and event markers so they cannot overlap. Add a year scale, a return-to-start action and an event picker; retain exact monthly input and keyboard navigation.
- Reduce planning summary repetition: one horizon, one status per plan, and one closing accessible value. Put qualifications and end ages in expandable details; keep any funding gap visible.
- Align chart controls in one row on desktop, with a full-width money toggle on phones. Keep chart units visible and distinguish dashed lines in the legend visually.
- Preserve the existing calculations. Verify running at desktop and phone sizes, future event selection, and planning chart toggles.

## Verification

- 154 automated tests passed; module syntax, production build and whitespace checks passed.
- Browser checked at 1280px and 320px: no page overflow, desktop chart controls share a baseline, and phone grouping/style controls share a row beneath the money toggle.
- Future milestone selection changed school spending to the senior-school entry; keyboard slider movement advanced one month; Now returned to the starting picture.
- Net worth retains the money toggle while hiding irrelevant grouping/style choices. Future-value selection updates the outcome figures. No browser console errors observed.
- Existing calculation assumptions and visible shortfall warnings are retained; no tax or investment policy changed.
