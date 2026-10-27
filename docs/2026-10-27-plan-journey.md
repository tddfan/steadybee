# A coherent goal-to-Lifeline journey

Scope: simplify the existing Plan UI and repair its missing return path. Preserve financial calculations, stored goals, named alternatives, AI consent, immutable baselines and the pending explanation/motion work. Leave uncommitted.

- One main goal drives two initial what-if choices; remove the separate guidance-focus control. Keep other experiments optional. Separate missing-input checks from experiments.
- Move review scheduling/check-in administration and optional AI below the main task in closed sections. AI results use the same comparison journey.
- A comparison shows the change, its main outcomes and one primary action: Compare on Lifeline. Keep detailed calculations and saving a named alternative optional. Applying happens only on Lifeline.
- Keep a sticky temporary-preview bar beneath the app header: Not applied, Back to comparison, Apply to outlook, Discard. Returning reopens the same comparison and preserves the inspected month. Closing it leaves a visible resume action on Plan.
- Discard returns to the ideas without changing the outlook. Apply stays on Lifeline with an explicit Undo change action. Input changes invalidate stale comparisons.
- Verify the round trip, scrolling return action, discarded/apply/undo state, goal persistence and named alternatives with synthetic desktop/375px browser journeys. Preserve existing AI/explanation and reduced-motion checks; build and inspect locally.

## Delivered and checked

- Removed the separate guidance-focus selector. The main goal derives the internal AI focus and the initial pair of what-ifs. Missing-input checks are separate from experiment cards.
- Comparison details, full figures and goal-method notes expand on request. The comparison sheet has one primary action; saved alternatives remain available under Save as a scenario.
- Added the sticky return/decision bar and a resume panel. Returning preserves the inspected month. A changed goal, changed financial inputs or opening manual outlook adjustments invalidates the old temporary comparison. Applied changes have Undo on Lifeline.
- 70 focused code tests passed. Nineteen distinct browser journeys passed across the new flow, prior goal/review behavior, calculated explanations, account save feedback and reduced motion. Tests used synthetic households and AI responses; external services were blocked.
- Inspected desktop and 375px screenshots. Rebuilt the local distribution as `dbbc1a3a3226`; `/app.html` returned HTTP 200. No financial calculation or account schema changed in this pass.
- Changes remain uncommitted. These automated checks do not replace observed usability testing with target users.
