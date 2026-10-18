# Account and setup journey review

## User-facing flow

- The landing page distinguishes sample exploration, blank setup, and returning to a household.
- A normal signed-in app visit loads the saved default. An explicit sample or setup route keeps that choice.
- A signed-in sample shows one action: **Open my household** when a default exists; **Set up my household** otherwise.
- Setup clears sample entries, remains blank after refresh, and saves a new account's default after the user supplies their household details.
- Starting a blank household or resetting the sample detaches account autosaving from the previous version. Existing account versions are retained.
- Named versions save independently. Reopening the app returns to the default, rather than the most recently edited alternative.
- Encrypted-device backup controls and prompts have been removed from the active app and landing page. Previously stored encrypted data is not deleted; format and encryption utilities remain available for future migration.

## Issues corrected

- Stale account UI could say signed in while database calls failed with an expired JWT. Queries now attempt one session refresh and offer Google sign-in again when the session cannot be renewed. Temporary network errors retain the session for retry.
- App OAuth callback detection ran after the SDK had consumed the URL fragment. Callback registration now happens immediately after client creation.
- Setup intent was lost when its URL parameter was removed before account initialization finished.
- Explicit example pages incorrectly displayed “Opening your default household”.
- Account summaries described the default even while an alternative was being edited; saved-version action visibility could also remain stale.
- Scenario dialogs did not recognise current account-save labels, advertised retired backups, and retained an out-of-date “Saving” indicator.
- New-account background saving could mark newer edits as saved even though it had persisted an earlier snapshot. The saved snapshot is now tracked and subsequent edits queued; detaching a household invalidates the pending binding.
- Generic after-tax income was easier to find than salary capture. **Salary & pensions** now precedes **Other income**, whose amount is explicitly labelled after tax. The form clarifies that other income continues until its entered end date.
- Planning readiness described a missing regular budget despite active dated expenses. It now uses the monthly flow's spending total, including active entries and linked payments.
- The calculation icon created a spare row in the mobile planning actions. It now sits beside the heading.

## Verification

Browser interactions used a local fixture on port 8767 with synthetic identities and an in-memory account store. The fixture replaces the remote SDK/config only in its served responses; production source still uses Supabase. Run it with `node tests/fixtures/account-server.mjs`.

Verified through the app UI:

1. Landing → sample opens ready to explore.
2. Signed-in sample → open the existing default, removing the example URL marker.
3. Signed-in account with no saved default → setup, refresh remains in setup, enter household → automatic first save.
4. Add a £15,000 cash asset, £3,000 monthly after-tax income and £1,800 expense → £1,200 monthly surplus.
5. Save an alternative, change its asset to £20,000, wait for saving, reload → the £15,000 default is restored.
6. Confirm starting inputs, save a named scenario, compare it, reload → scenario remains and the review gate does not repeat for unchanged inputs.
7. Calculation details open; spreadsheet export is enabled for a valid plan.
8. Guest account dialog offers Google only, with no email link or backup action.
9. Desktop and 375px mobile layouts, including setup and the scenario bottom sheet; no page overflow in the checked mobile views.
10. No runtime console errors in the synthetic browser session.

184 Node tests pass. The optional Playwright browser runner was not used; UI journeys were exercised through the in-app browser.

## Live account findings and remaining checks

A read-only database check confirmed that the inspected live account has email and Google identities linked to the same user, but no saved household rows. Its older private household page was left open and unchanged. Those inputs still need a deliberate initial account save; the app cannot restore a record that does not exist.

The live session-expiry path was reproduced and the Google sign-in option verified after recovery. A fresh sign-in reached the external Google window; completing that login and verifying its final callback remain pending. Synthetic account persistence tests do not verify production Supabase write permissions or cross-device behaviour.
