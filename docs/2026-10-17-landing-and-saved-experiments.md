# Landing page and saved experiments

Implement a public introduction at index.html while app.html remains the single workspace and PWA start. Explain who it helps, the three-step workflow, an accessible manual capability slideshow and the local-first saving model. Use the real calculation modules and named fictional fixtures for demo figures. No fabricated testimonials, pricing, approval claims or guarantees. Existing Git deployment remains the publishing path.

Add a named scenario library inside each picture: save, load, rename, delete, and compare up to three saved scenarios using current household inputs. Explicitly disclose that assets/income are shared and results recompute. Save scenario/chart/simulation settings, not stale outcome samples. Keep records in memory until the user enables existing encrypted device saving or exports an encrypted backup. Include the library in that encrypted picture, with backward-compatible validation and a bounded size. Make durability status and the Save picture action visible in the library.

Before promotion, handle invalid cross-field pay edits without throwing, and permit official pension forecasts without a separate NI-years requirement. Keep this pass bounded; the larger generic-income categorisation redesign remains a distinct follow-up from the persona review.

Tests: immutable named-scenario operations, duplicate names/limits/invalid state, encrypted round-trip with library, old-picture compatibility, landing routes/assets, salary edit validation in browser, official forecast entry, loading/comparing scenarios, desktop and 375px slideshow/navigation.

## Implementation and checks

- `index.html` is now the public introduction; `app.html` remains the workspace and PWA start URL. The four tour slides use actual ledger, monthly-flow and planning modules with the disclosed fictional example. Manual buttons and keyboard arrows work without auto-advance.
- The scenario library saves scenario/chart/experimental simulation settings. Household facts are shared and comparison results are recalculated; no simulation output or fabricated figure is stored. Up to 12 names, up to 3 comparisons, duplicate-name validation, rename, delete and undo are supported.
- The existing AES-GCM device/backup format includes the optional library. Old pictures without it remain valid. Import validation rejects invalid or nested libraries. No plaintext persistence or new account service was introduced.
- Pay edits now validate related fields before changing the model and show local errors without an uncaught exception. Correcting the pending salary/pension fields applies them together. Official weekly pension forecasts save with blank NI years.
- Withdrawal-order comparison is a standalone, always-visible section outside Funding & calculation details. Projection comparisons are cached by inputs/assumptions so year scrubbing does not rerun decades of projections unnecessarily. Saving settings and split controls are visible; long routing explanations are behind named info controls.
- Browser checks cover 375px and desktop landing layouts, all four slideshow states, keyboard navigation, direct personal setup, saving two scenarios, comparison, reopen, rename, delete/undo, visible saving controls and corrected validation. Unit tests verify encrypted library round-trip and old-picture compatibility. All 168 regression tests pass, including build identity for the new landing assets. The app and landing show no browser errors in these checks.
- Existing persona-review findings about generic income/budget semantics and incomplete debt repayment coverage remain follow-ups; this is a prototype introduction, not a claim of readiness for regulated advice or a paid personal service.
