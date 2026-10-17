# Account storage setup

Steadybee runs as a static site. Its existing protected-picture feature encrypts data in the browser and saves it to that browser or to an encrypted backup file. Account saving uses Supabase Auth and its Postgres Data API.

The selected account service is Supabase. The intended first account flow is email sign-in, verified through a link, followed by an explicit **Save picture** action. A signed-in user can then reopen their latest saved household picture from another browser or device. Saved content includes household inputs and named scenarios; calculated charts and simulation samples are regenerated when opened.

Returning signed-in users automatically reopen their saved picture when the initial public example is untouched, preserving the selected app section. Changes made before sign-in finishes or while the saved picture loads require an explicit choice in Account before replacing the tab. Token refreshes do not repeatedly reload the picture, and stale responses from a previous account are ignored. Loading a picture does not write it back to the database.

## Database boundary

`supabase/migrations/20261017152028_create_user_pictures.sql` creates one record per Supabase user. Row-level security permits an authenticated user to read, create, update, and delete only the row whose `user_id` matches their authenticated ID. Deleting an account cascades to that row.

The `steadybee` project was created in the London region in `tddfan’s Org` on 17 October 2026. Supabase quoted the project at $0/month. The migration is applied; the table exists with RLS enabled, and the Supabase security advisor returned no findings. The app now has an email-link account flow, one explicit initial cloud save, reopen, sign-out, and subsequent auto-save with a conflict check.

The migration stores the picture JSON in the database. Row-level security protects access between users; it does not make data end-to-end encrypted from the project operator. The account dialog discloses this. Users can delete their saved cloud picture, but self-service account deletion still needs an authenticated server-side function before public release. The existing passphrase-encrypted device backup remains available independently.

## Project setup

1. The project is already created in `tddfan’s Org` in London (`eu-west-2`); Supabase quoted it at $0/month.
2. The migration is applied and the `public.user_pictures` table has RLS enabled.
3. The app uses the project URL and publishable key. The key is intentionally public; the database policies are the access boundary. No secret/service-role key is included in browser code.
4. Supabase Auth URL Configuration is set: Site URL `https://steadybee.netlify.app`; allowed redirects `https://steadybee.netlify.app/app.html` and `http://127.0.0.1:8766/app.html`.
5. Verify email confirmation, sign-in, saving, reopening from another browser, and deleting the cloud picture with test accounts and fictional data.

The Supabase Auth URL configuration is complete. Live email-link sign-in, saved-picture reopening, and automatic restoration after reloading Planning have been verified in the signed-in browser. Independent cross-device testing and a self-service account deletion function remain public-release requirements.
