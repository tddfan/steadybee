# Purposeful motion

Approved scope: the first three proposed patterns—before/after scenario transitions, accurate completion feedback, and a newly added item reveal. Preserve the pending explanation work. Execute inline, leave uncommitted, and do not add landing-page sales effects or animate financial digits.

1. Add a small UI motion module using native animations only for decorative layers. Respect reduced-motion preferences, stop active effects when that preference changes, and cancel superseded effects. No content waits for animation, no altered values, no looping motion or sound.
2. During scenario previews, keep current cash-flow totals visible as dashed outlines behind the actual preview bars. Stock charts already retain their comparison paths. Fade only the new graphical layer, not axes or amounts. Trigger once for preview/apply/discard, never while scrubbing, resizing or switching metrics.
3. Reveal only the explicitly added asset/debt row after a successful form submission. Initial account loads and ordinary rerenders do not replay the effect. Confirm local actions as local actions.
4. Show a brief checkmark confirmation only after a successful account write. Distinguish pending, failed, stale and superseded writes. View-only auto-saves remain quiet. Named versions and scenario application receive accurate, concise confirmations. No claim that local edits have reached the cloud.
5. Verify reduced motion, exact current/preview totals, no replay on inspection, new-item versus initial-load behavior, delayed/failed cloud writes and account/preview immutability with synthetic browser tests at desktop and 375px. Run relevant existing suites, rebuild and inspect the local app. No production deployment or commit.

## Verification · 27 October 2026

- 67 focused code tests passed, including motion eligibility, view-only save classification, Lifeline, account restoration, explanation evidence and build checks.
- Six motion browser cases passed: initial load versus explicit add, 375px reduced-motion/no-overflow, no preview replay while scrubbing, exact current totals behind previews, delayed/failed cloud writes, cancellation when reduced motion changes, and quiet view-only saves.
- Sixteen existing desktop/mobile browser journeys passed across Lifeline, scenario review, explanations, monthly entry editing and Bento layout. All account/AI responses were synthetic; external requests were blocked.
- Inspected mobile screenshots and rebuilt `dist/` with version `7e3f1b70673d`; local `/app.html` returned HTTP 200. Figures remain immediate; no projection, baseline or account-schema calculation changes were introduced by this motion pass.
- Changes remain uncommitted. A full assistive-technology audit and observed user feedback are still separate from these automated checks.
