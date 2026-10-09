# Steadybee example validation and revision

9 October 2026 · Fictional fixture version 2026-10-09.2. This records the founder’s concern that an example seemed to run out of money in two years and supersedes earlier final-review claims about example clarity.

## Meaning of the numbers

Alex starts at 52 in 2026, retires at 55 in 2029 and first has uncovered spending at 57 in 2031: five years after the example starts, two years after retirement. That first year has £34,777.19 of spending not covered while £473,848.56 remains in a pension assumed inaccessible until 60. £106,777.19 sums unpaid annual spending across 2031–2033; it is not extra capital required today.

Annual spending becomes covered in 2034, but the earlier gaps remain unpaid. A separate shortfall starts in 2055, age 81. Retiring at 58 removes the pre-access shortfall but leaves a shortfall at 83; £24,000/year part-time income at ages 55–59 removes the pre-access shortfall but leaves one at 82. The arithmetic is unchanged, fictional and simplified, with no UK eligibility or personal affordability conclusion.

Priya’s savings outside pensions reach zero in 2031, age 71, while pension withdrawals cover spending and £222,079.86 remains available in the pension. Empty non-pension savings and uncovered spending are different events.

## Review method and rounds

The founder supplied actual product feedback. Three user agents represented six simulated perspectives: early-retirement DC and spreadsheet planners; mixed-income household planner and less involved spouse; retired income-led user and privacy-conscious low-need skeptic. Neha planned the revision, Advik audited calculation/reporting semantics, Aarav independently challenged and exercised the browser, and the build owner implemented and verified it. No real customers were recruited or contacted. No purchases occurred.

| Round | Feedback | Delivered revision |
|---|---|---|
| 1: current app | Total wealth hid locked pensions; first-gap wording implied continuous failure; annual/summed gaps unclear; results below long editor; household/retired lead information generic | Explicit timing, amount and remaining locked pension; separate balances and shortfall periods; annual funding inspector; relevant spending/named dates; results before collapsed editor; user-initiated example choices |
| 2: revised screens/source | Choices too low on mobile; desktop chart scale persisted on resizing; controls resembled headings; restored selector and figures could disagree; CSV omitted new facts | Earlier comparison actions; responsive redraw without form reset; readable chart ticks and active-year buttons; coherent restored year/figures; CSV includes available/locked pensions and cumulative unpaid spending |
| 3: focused re-review | Interpretation and layout concerns resolved; payment objections remain | Six simulated perspectives found no remaining material prototype blocker in reviewed tasks. Aarav independently verified restoration/reload/resizing; Advik rechecked the critical ledger and reporting cases |

Intake tab switches now stage edits until confirmation, protecting the baseline and scenario revision. A positive one-off cost beyond the illustrated horizon is rejected rather than silently omitted. Comparisons and briefs explicitly preserve part-time income periods, even if an endpoint equals a previously irrelevant baseline value.

## Current acceptance requirements

| Requirement | Acceptance |
|---|---|
| What fails, when, why | First-year shortfall, calendar year, age, years from start/retirement, locked pension balance and assumed access date are visible together |
| Distinct money and funding | Zero non-pension savings is not all money gone; annual view shows income, savings/pension withdrawals, available/locked balances and uncovered spending |
| Every shortfall period matters | Later coverage retains unpaid gaps; zero pre-access gap or positive final assets cannot imply all years are covered |
| Clear units and conventions | Monthly and annual spending, year-end balances, opening amounts and fictional starting dates; no inferred UK access rules |
| Useful comparisons | User-initiated choices preserve baseline, amounts and periods; results precede editing; no ranking or recommendation |
| Household/retired relevance | Named dates/shared spending, grouped milestones, retired spending/cost controls, compact brief plus optional appendix |
| Coherent state | Selector and funding panel agree after restore/reload; resizing preserves edits; changing intake tabs cannot silently revise a saved baseline |
| Faithful exports and scope | CSV contains new balances/unpaid gaps; excluded costs rejected; personal drafts remain information only, without forecasts or payments |

## Verification and limits

49 automated checks: 24 state/fixture, 9 installed-app update and 16 Chromium interaction tests. New checks cover access/later gaps, positive final assets with earlier unpaid spending, usable pensions after non-pension savings reach zero, pension splits, out-of-horizon costs, authored choices, baseline staging and coherent inspector restoration. Existing intake, ownership, import/save/delete, scenario, CSV, keyboard and print checks remain covered.

All three example overviews are checked at 320, 375, 768 and 1440 pixels. Mobile charts remain readable after desktop-to-phone resizing; the Alex baseline with two alternatives and household brief with two alternatives fit one A4 page, with a separate optional appendix. Screenshots and rendered briefs are visually inspected. These checks do not certify financial-model accuracy, broad accessibility or real-user comprehension.

The unpublished runtime reset during preparation for publication. The reviewed changes were restored from the retained review record, checkpointed and verified again before release.

## Use/payment judgments and stopping point

An anxious planner can understand the shortfall and continue into alternatives. A spreadsheet planner can inspect consistent annual workings. Household planner/spouse can discuss named dates and a compact brief. A retired user can follow how spending is funded. Return after pension statements, changed work plans, major costs or an annual review is plausible but unobserved.

Paid judgments remain conditional on verified personal calculations and benefit over current workarounds. The low-need skeptic remains a plausible free-only non-buyer. Agreement between agents is not demand evidence. This loop stops at a materially clearer tested demonstration; real comprehension, return and fulfilled purchases remain open under the existing human-validation protocol.
