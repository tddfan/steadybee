# Steadybee prototype build review

9 October 2026 · Current implementation record. This and the prototype loop plan take precedence over older prototype/marketing claims.

## Decision

The research prototype now supports a complete personal information journey and separately named fictional comparisons. It is ready for observed prototype sessions. It is not a paid personal retirement planner: personal outcomes, accounts, server-side history and payments are not connected.

## Build and feedback loop

Neha planned the experience; Advik implemented the schema and fictional ledger; Aarav challenged the source; Saroj prepared the commercial evidence plan. Three additional reviewers represented six hypothetical user perspectives. These were simulated source/visual reviews, not customer interviews or human task observation. The build owner ran actual interactions with automated Chromium tests.

| Main review round | Findings | Result |
|---|---|---|
| 1. Initial implementation | Mode leakage; income-led semantics; lost scope/basis; hidden retired date; household chronology; unresolved next detail | Explicit personal mode, retained metadata, relevant routes, owner-aware calendar dates and contextual income/access |
| 2. Built journey and output | Retained partner income/accounts affecting solo; incomplete report facts; compound changes not clear; storage/import mismatch; imported attributes | Active-owner filtering, full input/override output, confirmed import replacing old save, escaped validated values |
| 3. Re-review and print | Existing draft could stay in sample mode; brief too long; deployment edits needed integration proof | Personal continue action, one-page brief with optional appendix, update restoration browser regression |

Final verification also fixed the keyboard skip link's hash-route collision, version stamping for formatted HTML and a clipped print provenance footer. The rendered household brief was re-reviewed with both retirement dates, changes, income/access milestones, bridge gaps and open assumptions visible.

No material demonstration blocker remained in the final reviews. The early-retirement, spreadsheet, household and retired buyer judgments remain conditional on reliable personal functionality. The low-need user remains a plausible free-only non-buyer. This is not a conversion survey; no price or demand was validated.

## Implemented scope

- DC and income-led/retired short starts; explicit unknown, estimate and zero states.
- Optional progressive partner, income, access, contributions, savings/cost and account details.
- Personal entered facts, owner-specific dates, household completeness and aggregate/account reconciliation.
- Baseline plus two named alternatives; complete combined overrides; revision history and stale comparisons.
- Three fictional examples with inspectable annual cash flow, reconciled ledger and CSV provenance.
- One-page A4 fictional household brief; optional workings appendix; personal facts/checklist brief.
- Optional browser-profile save, resume, validated backup/import and deletion; visible failure messages.
- Existing installed-app update checks with one-use restoration of current work and unfinished edits.
- Neutral locally downloaded feedback, with no server submission or payment claim.

Fictional version `2026-10-09.1` uses authored net income, fictional access ages, fixed real returns and pound-for-pound pension withdrawals. No UK tax engine, entitlement check, scheme-specific DB reductions/escalation, survivor model, variable returns or personal outcome is delivered. Browser saving is unencrypted and limited to the same browser profile; no account/cross-device/offline promise is made.

## Verification

| Check | Result |
|---|---|
| State/fixture logic and installed-app update suite | 27 passed: 18 state/fixture and 9 update checks |
| Chromium interactions | 11 passed; no runtime errors |
| Printed comparison | Baseline plus two alternatives, including a long name, fits one A4 page; appendix is optional and multi-page |
| Visual review | Desktop landing/overview, 375px mobile and rendered household brief inspected |
| Static build | Eight HTML pages generated with matching version markers |
| Source review | Whitespace clean; repository copy checklist checked within fictional scope |

The browser checks cover mode separation, both starts, unknown/zero inputs, income/access details, both household ages/dates, partner removal, save/resume/import/delete, hostile imported IDs, complete overrides, CSV provenance, joint ownership after editing, stale comparisons, temporary update restoration, keyboard skip focus and mobile/print behavior. Ledger tests include an independently specified first household year and an inaccessible-money gap example. Arithmetic invariants are not production financial validation.

## Next loop

The next build is the independently specified and verified personal Python engine, with declared tax/pension support and accessible-money cash flow. Production storage/recovery and payment promises require working services. Estimate that work separately from the prototype.

Prepare observed sessions with six active planners, two less involved partners and one low-need control. Compare tasks with current workarounds; keep personal intake separate from fictional-result comprehension until personal calculations are verified. Only after a useful personal deliverable works should fulfilled purchases and actual return be measured. A proposed three-purchase/ten-eligible-offer pilot threshold is a management experiment, not a market estimate. Repeating agent reviews cannot establish that everyone will pay.
