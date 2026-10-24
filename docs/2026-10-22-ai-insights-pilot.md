# Optional AI planning review pilot

The Insights preview now leads with headline results, keeps the detailed table behind a disclosure, and preserves keyboard focus on the close control. A no-effect preview disables Apply and Save. Detection checks the monthly path, not just end balances; lower regular spending cannot change debt or separately scheduled spending.

## Scope

The next roadmap phase is an opt-in AI prioritisation pilot. The existing engine supplies all facts. The model selects up to three applicable checks and two supported experiments; explanations use reviewed templates. There is deliberately no free-form advice, invented tax saving, investment recommendation, or probability. Experiment actions use the existing preview/apply/undo flow.

Users inspect the exact anonymous summary before sending. Only horizon, goal, rounded aggregate unfunded spending, tax, accessible/net assets, completeness flags and allowed recipe IDs go to Groq. No household names, ages, emails, pay entries, holding labels, credentials or user IDs are in the model prompt. A Supabase bearer token goes only to the same-origin function and Supabase for authentication. Groq hosts the selected model (default `openai/gpt-oss-120b`); no requests go to OpenAI. Provider retention is controlled in Groq Data Controls. Enable Global Zero Data Retention for this project; the app does not inspect or silently change that setting.

Both server and client validate an allowlisted schema and fact references. Results clear when household/scenario/goal changes; an in-flight result for changed inputs is discarded. Results are not included in saved household versions.

## Enable on Netlify

Set these in the **server-side Functions environment**, never in source or client build variables:

- `GROQ_API_KEY`: the server-only Groq key.
- `GROQ_MODEL`: optional; defaults to `openai/gpt-oss-120b`, hosted by Groq, with strict structured outputs. A different model must support the same schema and low reasoning effort.
- `AI_ALLOWED_USER_IDS`: comma-separated Supabase user UUIDs explicitly admitted to this private pilot.

Redeploy after configuration. The endpoint is `/.netlify/functions/planning-analysis`; it is unavailable on the plain Python static server. Use Netlify's local function runtime for an integrated local pilot. Unconfigured service, invalid/expired auth, non-pilot users, provider failure, refusals, timeouts and invalid model output all fail without touching the plan.

Identical successful summaries reuse a five-minute per-user warm-instance cache after fresh authentication. Changed summaries are throttled to once per minute per user, per warm function instance, **not a durable global quota**. The UUID allowlist keeps the first deployment a private pilot; the Groq free-tier provider quota remains shared across requests. Deployment contexts must be explicitly approved when setting pilot access. Add a durable per-user quota and deployment-level rate limiting before expanding beyond the private pilot. Mocked transport checks cover the Groq endpoint, provider key isolation, unchanged summary contents, output validation, configuration/auth/pilot gates, provider limits, refusals, truncation and authenticated cache expiry. A successful live Groq call still needs a deployment with the secret and pilot allowlist; the Python static server does not run Netlify functions.

References: [Groq structured outputs](https://console.groq.com/docs/structured-outputs), [Groq data controls](https://console.groq.com/docs/your-data), [Supabase authenticated user verification](https://supabase.com/docs/reference/javascript/auth-getuser).
