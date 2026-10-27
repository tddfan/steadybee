# Phase 4: goal-led Plan prototype

Date: 25 October 2026. Updated 27 October after Phase 5 verification.

## Delivered for review

- The former Insights destination is now presented as **Plan** and uses the `#plan` URL. Existing `#insights` links continue to resolve to the same screen.
- A household can keep one primary goal with a target month and, where relevant, a target amount or person. The setting is stored in the existing optional `insights` object, so older account documents remain valid.
- The goal panel gives a deterministic checkpoint from the current monthly projection: recorded work-end assumptions, regular spending, accessible investments at a dated goal, or projected net assets for a legacy target.
- Goal checkpoints do not combine into a score or probability. They disclose when the result excludes debt/dated costs, withdrawal tax, estate tax, survivor cash flow, or other unsupported details.
- Existing deterministic findings, named scenarios, AI review consent and the inheritance calculation remain available. The legacy inheritance page is reached from a legacy goal; its existing `#inheritance` route remains supported.
- A user can send a calculated experiment to Lifeline as a temporary scenario path. A banner provides **Apply to Plan** and **Discard preview** actions. Preview state is not in the household snapshot or autosaved; applying uses the existing scenario controller and does not rewrite observations or the frozen baseline.

## Current limits

- Phase 5 extends the reviewed AI request with the chosen goal and calculated checkpoints; see `2026-10-27-phase5-review-delivery.md`. The updated server function must be deployed alongside the frontend.
- A stop-work goal compares the target date with recorded final-pay dates. It does not prove that the household can afford to stop work then.
- A spending goal compares household costs in the selected month window, including scheduled costs. Debt service is separate.
- A future-event goal compares the target amount with projected accessible investments before withdrawal tax. It does not reserve the amount or account for other competing spending.
- A legacy goal compares net assets before estate tax. The existing inheritance page remains a separate simplified illustration.
- Scenario previews use the existing deterministic monthly engine and existing supported experiments. Market outcome ranges remain illustrative and are not a personal success probability.

## Review path

Open **Plan**, choose a primary goal, set the date/amount, inspect the calculated checkpoint, then open a supported what-if and choose **View on Lifeline**. The temporary line can be discarded or explicitly applied. Saved named scenarios remain separate from the primary goal and baseline.

The goal foundation and Phase 5 review are committed together on the feature branch after synthetic account and calculation verification. Live AI requests were not made during these checks.
