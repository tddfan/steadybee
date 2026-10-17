# Protected saving and retirement coverage

## Scope

1. Optional encrypted device saving, encrypted JSON backup/import, explicit restore, lock and deletion. Passphrases stay in memory, saved payloads contain no readable financial inputs. Example and personal drafts cannot silently replace an existing saved picture.
2. Planning leads with illustrated spending coverage, first shortfall and accessible closing investments before withdrawal tax. Net worth remains a chart. Default horizon is age 95 for the younger person with a known age; missing ages are disclosed.
3. Persist recorded facts and scenario inputs, not computed projections or confirmation state. Restored personal pictures require starting-figure confirmation before planning.
4. Preserve compact desktop and phone layouts. Verify encryption/invalid imports, age horizon, early gaps with inaccessible pensions, restore/edit/reload and backup/deletion journeys.

## Boundaries

No new tax rates, advice, DB modelling, stress tests or report generation in this iteration. Existing tax limitations remain visible. Saved device data is encrypted locally; no account or network storage is introduced. An encrypted backup needs its passphrase and cannot be recovered without it.

## Implemented and checked

- Age horizon, shared drawdown eligibility and coverage summaries are pure deterministic functions. Early gaps remain the coverage result even after pension access. Unmodelled debt repayments are explicitly flagged. Accessible closing investments are gross before withdrawal tax.
- AES-GCM encrypted picture format with PBKDF2-derived, non-extractable keys; passphrases are not stored. Validation rejects malformed, unsupported, oversized and unsafe payloads before applying them. Stored facts, scenario and chart choices are included; projections and confirmation state are not.
- Encrypted saving is opt-in. Writes are serialized, stale writes are cancelled, failed saves remain visible, and pending changes trigger the browser’s leave-page protection. Another tab’s saved update pauses saving here. Import is staged and opens in this tab without silently replacing a device copy.
- Restore asks for starting-figure review. Lock/deletion clear the tab, hidden form values and scenario history. Encrypted backups remain independent files. Device saving was turned off and the fictional verification copy deleted after the browser checks.
- Browser checks covered wrong passphrase, save/reload/restore, edited retirement dates and plan age, encrypted download and import, separate backup/device scenarios, lock and deletion. Encrypted downloaded content was independently decrypted and checked against the edited inputs. Phone and desktop layouts were inspected.
- Optional Playwright regression journeys were updated for coverage and saving; the package is not configured in this checkout, so the running browser was exercised through the available browser controls.
- Targeted accessibility fixes: interactive chart containers use group roles, the Flow control’s accessible name includes its visible label, and the phone chart heading remains available to assistive technology. A complete accessibility audit remains outstanding.

No new tax policy is introduced. DB capture, fee modelling, stress tests, survivor scenarios and printable reports remain later work. There is no claim of certainty or of an optimal withdrawal strategy.
