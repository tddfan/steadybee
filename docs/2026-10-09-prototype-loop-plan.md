# Steadybee prototype loop — Neha's product plan

9 October 2026 · Product decisions for the current build · Part IV of the PRD takes precedence over older product/design copy.

## Purpose and boundary

Build a complete, usable research prototype for a person or household with an active retirement or reduced-work question. Personal entry produces entered totals, dates and an information checklist. A separate named fictional household demonstrates comparisons and the decision brief. The prototype must make this distinction clear before data entry, beside results, and in exports.

The target is a reviewable experience without material journey or truthfulness defects. Agent agreement does not prove demand, financial correctness or willingness to pay. A low-need user may rationally prefer a free alternative even after every feature is delivered.

## Build priorities and copy decisions

| Priority / step | Required interaction | Copy or design decision |
|---|---|---|
| 1. Landing and mode | Offer personal entry and a complete worked example; preserve each separately | “Your retirement information, brought together.” Primary: “Start my draft.” Secondary: “Explore a worked example.” Explain: “This prototype organises information you enter. Personal retirement forecasts are not connected yet.” |
| 2. Short start | Choose solo/household and DC/income-led route, then five fields with explicit unknown/estimated states | Disclose route choices as choices before the five fields. DC: age, retirement status/age, invested pension pots, other savings/investments, monthly spending. Retired/declared DB-led: age, retirement status/target, pension income, accessible savings, monthly spending. Income needs gross/net and month/year labels; “not sure” remains unknown. DB income is never a pot. |
| 3. Personal overview | Actual entered assets, entered timeline and missing-information checklist; edit every item | Title: “Your information so far.” Incomplete assets read “Known balances”, not total wealth. Gross pension income stays labelled gross; do not subtract it from spending. Household pending: “This includes your information so far. Add your partner to complete the shared picture.” |
| 4. One contextual detail | Offer one relevant optional question; save returns to overview; skipping does not open another | Priority: missing partner/spending basis → missing DB/retired income → retirement-before-known-access details → DC contributions → income/access → cash/invested split. Retired users with known income get spending/debt/major-cost detail. “Why this matters” is one sentence. Actions: “Add detail”, “Not sure”, “Later”. All groups stay available through “My information”. |
| 5. Household | Add partner progressively; show owner for each balance and income; preserve solo information | Require a clear spending basis: “For me” or “For our household”. Do not double-count joint assets or divide shared spending automatically. If either person's data is unknown, say which part is missing. Show calendar years plus each person's age. |
| 6. Combined example choices | Baseline plus up to two named alternatives; change both retirement dates, part-time income/end date and spending together | Persistent “Fictional example — not your plan”. Use authored complete fixture choices, not arbitrary sliders producing invented outcomes. Show every changed field before results. If users can edit personal scenario inputs, label them as choices recorded with no calculated outcome. Preserve baseline and support reset/undo. |
| 7. Keepable output | Free personal information brief; complete fictional free/expanded examples; downloadable or printable content | Personal brief contains only actual entered values/status, timeline, open questions and selected input changes. The fictional household brief names both retirement dates, income start dates, bridge periods and every scenario change. Keep the example label on every page. The appendix holds inputs, assumptions and tables. |
| 8. Save and return | Real local draft save/resume, dated snapshots, edit, delete and new plan; failed save is visible | Before sensitive entry: “Your draft stays in this browser on this device. It is not saved to an account. Clearing browser data removes it.” Offer export for a copy; disclose any prototype network behavior accurately. Return shows last saved date and changed inputs. Saved comparisons from an older baseline must be marked outdated. |

Use warm white surfaces, navy text, teal actions and a small honey accent. Body text is at least 18px; controls have visible labels/focus and generous targets. Mobile stacks baseline and alternative with repeated labels. A table provides the same information as any timeline/chart. Avoid green reassurance badges, completion-as-accuracy percentages and app-like success messages for unfinished services.

Do not copy stale storage, AI or outcome claims from the older design document. “Encrypted”, account recovery, cross-device saving, payment success and probability claims require working services or verified methods before appearing.

## Purchase hypothesis to challenge

The plausible buying moment is after a person has compared a concrete retirement choice and can explain how accessible money, income and spending interact. The future offer is a verified personal decision bundle with reproducible comparisons, a household brief and a stated revision/access period. Price and cadence remain questions. Report length, saving a second alternative and removing an artificial limit are weak evidence of value.

In this prototype use “Preview the decision bundle”, followed by “Example preview. No payment is taken.” Keep corrections, basic household input, the basic summary and local draft save available. Do not present this information-only build as something users have agreed to buy.

## Review loop and completion gate

1. Review the built journey with the DC early-retirement planner, analytical spreadsheet user, mixed DB/DC household planner, less involved partner, recently retired income-led user and low-need/privacy-conscious user perspectives. Record agent findings as simulated critique with no invented quotes or conversion rates.
2. Run the actual interactions for both intake routes, unknown/estimated/zero entries, edit/skip, household-pending state, example-to-personal separation, compound choices, report, local return and save failure. A screenshot review alone is insufficient.
3. Fix material defects, update PRD/feedback with evidence from the implemented behavior, then give reviewers the revised build. Stop after a pass introduces no new material defect; keep preference disagreements and commercial unknowns explicit.
4. Require a reader of only the fictional household brief to identify both retirement dates, income starts, bridge periods, all selected changes and one unresolved assumption. Require every reviewer to identify which outputs use their entered values, which are fictional and where data is saved.

The next independent evidence is observed target-user tasks. After a verified personal engine exists, compare participants' own decisions with their current workaround and observe actual purchase/return. Agents can identify friction and prepare that work; they cannot establish that all users will pay.

## First build review — code inspection

Reviewed `prototype/app.mjs`, `workspace.css` and `index.html` after the first implementation. This is a source review, not observed user behavior. Findings below were sent to the build owner for verification and fixes; this list does not assert they remain in the final build.

| Material issue | Smallest practical fix |
|---|---|
| Landing opens `#setup` directly, bypassing the start-screen storage explanation | Put the tab-only/optional device-save statement before the setup form. |
| Setup route switching keeps numeric input but drops scope, spending-basis and income-basis selections; it reinterprets other savings as accessible | Preserve all form metadata; require confirmation or retain unknown accessibility when changing route. |
| Income-led overview omits the pension income just entered; household headline excludes partner balances | Show entered income with gross/net status and owner; add clearly labelled household known balances and incompleteness. |
| Personal timeline sorts two people's ages numerically and omits partner retirement | Render entered calendar years and each event owner's age; include both retirement dates. |
| The income/access contextual card links to an income-only editor and can remain unresolved after saving | Direct a missing access age to the access group; distinguish DB income-start dates from DC access. |
| Alternative timeline is collapsed and absent from default print; bridge periods are not stated explicitly | Keep compact income/access/part-time dates and bridge periods visible in the brief; retain detailed tables in the appendix. |
| Personal brief omits access/split detail and some estimate statuses | Include recorded timeline/access facts and annotate income/cost estimates in the printed summary. |

Also raise essential helper/status text from 13–15px to at least 16px, and link validation errors to their fields. Browser and print testing should verify these fixes rather than infer usability from the code.
