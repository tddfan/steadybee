# Lifeline explanations and scenario trade-offs

Approved scope: B (explain a Lifeline period) and C (explain a calculated scenario comparison). Execute inline; no accountant agents, automatic plan changes, commit or deployment.

## Design

1. Add pure evidence builders over the existing monthly projection. Period explanations distinguish income after deductions, net withdrawals, paid/unpaid costs, tax components, accessible and locked balances. Compare a month with its predecessor, or an annual period with the same months in the previous year; unequal/missing coverage is not a numeric change. Source-component changes are measured, while nearby timeline events are labelled as context, never assumed causes.
2. Add calculated scenario trade-off evidence to temporary insight previews. Compare like-for-like horizons in a common price basis, show first changed month and gap dates, and make tax/income/reserve effects explicit. A lower tax total does not establish a better outcome. Previews and frozen baselines stay unchanged.
3. Put a compact computed explanation and expandable evidence in the Lifeline inspector and experiment preview. Links jump to the affected timeline month or open the existing what-if workflow. No new whole-plan dashboard or free-form chatbot.
4. Optional inline AI wording uses a new version-four contract on the existing protected function. Send only reviewed fixed-key numeric evidence and dates, excluding names, labels, notes and identities. Each AI note cites supplied evidence IDs, contains no numeric claim or advice/guarantee, and is displayed beside the underlying computed evidence. Keep material limitations visible independently of AI. Requests require explicit action; no network calls on scrub. Clear stale results when inputs, period, preview or account change.
5. Preserve the existing account/pilot verification, rate limit, cache and server-only secret. Advertise the new capability and fall back to calculated explanations if the deployed function or local bridge does not support it. Existing version-one through version-three review remains compatible. Live AI wording requires deploying the updated function; synthetic tests do not contact Groq.

## Verification

Write failing hand-worked evidence tests (including withdrawals not income, monthly tax versus lifetime tax, partial years, changing sources, shortfalls, missing inputs, common money basis and immutability). Verify version-four schema, anonymous payloads, unsupported facts/numbers/advice rejection, auth/rate/cache behavior and old version compatibility with mocked upstream. Synthetic browser tests cover selected-period explanation, comparison jump, no automatic AI sending, reviewed payload, stale-response rejection, unavailable/old-service fallbacks, no plan/baseline mutations and 375px layout. Run existing relevant engine/persistence/browser suites, inspect screenshots, build dist, and verify the local server.

## Delivered

- The Lifeline inspector now shows a short computed explanation for the selected period, an exact evidence list, and an unpaid-month jump when relevant. Comparisons preserve period coverage and a common purchasing-power basis. Pension gross withdrawals, their tax, recurring after-deduction receipts and unpaid costs remain separate.
- Experiment previews explain measured gains and trade-offs, avoid repeating unchanged income/tax figures, and link to the first calculated change on a temporary Lifeline preview. The existing Apply/Discard/Save workflow remains explicit.
- Optional AI wording sits behind an inline review-and-send control. The new fixed-key evidence vocabulary and version-four schema exclude identities and free-text labels; replies must cite supplied facts and pass numeric/advice/guarantee filters. This validates structure and wording, not the semantic truth of every possible AI sentence; the calculated evidence remains visible for checking.
- Account/pilot verification, per-user rate limit and short-lived cache are reused. Old review formats remain supported. A capability check prevents sending the new financial summary to an older deployment. Scrubbing, changed inputs and account restore invalidate pending or displayed wording.
- The new UI and deterministic explanations work locally. Live Groq wording requires deployment of the updated `planning-analysis` function; the local bridge uses that same hosted service. No live financial data or credentials were sent in testing, and no deployment, commit or push was performed.

## Verification · 27 October 2026

The full focused suite passed 127 tests; the added comparison-protocol regression also passed, and the final evidence/AI contract run passed all 35 tests. All 16 relevant synthetic browser journeys passed, followed by a final four-journey rerun after copy/disclosure refinements. Checks cover anonymous payloads, old-service refusal before POST, invalid wording rejection, pending-response invalidation, scenario jumps, baseline/household immutability and 375px layout. Evidence cards and scenario cards were visually inspected. The final dist build, syntax checks and diff whitespace checks passed, and the local app returned HTTP 200. Changes remain uncommitted; live Groq output has not been exercised or deployed.
