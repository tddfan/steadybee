# Google sign-in setup

The app offers Google sign-in only when Supabase's public Auth settings report that Google is enabled. The Google sign-in window leaves unsaved household edits open in the original tab. Email-link sign-in has been removed from the account dialog.

Use a dedicated Steadybee Google Cloud project. Configure the OAuth consent screen for Steadybee and create a Web application OAuth client with this authorized redirect URI:

`https://lwqmfphocjxhdfsqfivc.supabase.co/auth/v1/callback`

Enter the client ID and secret in Supabase → Authentication → Sign In / Providers → Google, then enable the provider. Keep secrets in Supabase, never in source control. Keep nonce checks enabled and require email addresses. Complete Google's consent-screen publishing requirements before inviting external testers.

Supabase Auth must allow `https://steadybee.netlify.app/app.html` and the local development return URL `http://127.0.0.1:8766/app.html`.

Use the same verified Google email as the existing account. Supabase performs verified identity linking; the app does not merge household records by an email supplied by the browser. Verify the existing account ID and saved picture are retained before inviting users. A new account without a saved picture starts with the fictional public example and must explicitly save its own picture.

Test Google sign-in, returning sessions, sign-out, blocked popups, and cancellation on desktop and an installed mobile app. Email fallback for external testers additionally requires custom SMTP; Supabase's built-in email service is restricted and rate limited.

The Netlify production branch is `codex/asset-constellation-demo`. Publishing this branch does not merge or push `master`.
