# Optional AI planning review pilot

The Insights preview now leads with headline results, keeps the detailed table behind a disclosure, and preserves keyboard focus on the close control. A no-effect preview disables Apply and Save. Detection checks the monthly path, not just end balances; lower regular spending cannot change debt or separately scheduled spending.

## Scope

The next roadmap phase is an opt-in AI prioritisation pilot. The existing engine supplies all facts. The model selects up to three applicable checks and two supported experiments; explanations use reviewed templates. There is deliberately no free-form advice, invented tax saving, investment recommendation, or probability. Experiment actions use the existing preview/apply/undo flow.

Users inspect the exact anonymous summary before sending. Only horizon, goal, rounded aggregate unfunded spending, tax, accessible/net assets, completeness flags and allowed recipe IDs go to OpenAI. No household names, ages, emails, pay entries, holding labels, credentials or user IDs are in the model prompt. A Supabase bearer token goes only to the same-origin function and Supabase for authentication. OpenAI requests set `store:false`; this does not constitute a promise of zero provider retention.

Both server and client validate an allowlisted schema and fact references. Results clear when household/scenario/goal changes; an in-flight result for changed inputs is discarded. Results are not included in saved household versions.

## Enable on Netlify

Set these in the **server-side Functions environment**, never in source or client build variables:

- `OPENAI_API_KEY`: a dedicated project key with an operator-set provider spend limit.
- `OPENAI_MODEL`: an available Responses API model supporting strict structured outputs.
- `AI_ALLOWED_USER_IDS`: comma-separated Supabase user UUIDs explicitly admitted to this private pilot.

Redeploy after configuration. The endpoint is `/.netlify/functions/planning-analysis`; it is unavailable on the plain Python static server. Use Netlify's local function runtime for an integrated local pilot. Unconfigured service, invalid/expired auth, non-pilot users, provider failure, refusals, timeouts and invalid model output all fail without touching the plan.

The one-minute user throttle is per warm function instance, **not a durable global quota**. The UUID allowlist and provider budget are intentional launch gates. Add a durable per-user quota and deployment-level rate limiting before expanding beyond the private pilot. No actual API credentials or live model call were used in this implementation; successful response handling is tested with mocked transports.

References: [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [Supabase authenticated user verification](https://supabase.com/docs/reference/javascript/auth-getuser).
