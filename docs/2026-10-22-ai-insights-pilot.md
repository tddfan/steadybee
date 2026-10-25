# Optional AI planning review pilot

The Insights preview now leads with headline results, keeps the detailed table behind a disclosure, and preserves keyboard focus on the close control. A no-effect preview disables Apply and Save. Detection checks the monthly path, not just end balances; lower regular spending cannot change debt or separately scheduled spending.

## Scope

The opt-in AI review now receives detailed financial context and engine-calculated comparisons, rather than only five lifetime totals. Names become Person A / Person B. Ages, annual pay and workplace contributions, State Pension estimates and dates, grouped assets by owner, debt terms, opening monthly cash flow, retirement dates, model assumptions, funding milestones and scheduled amounts are allowlisted. Holding names, asset IDs, notes, email, account IDs and raw free-text records are excluded. The review dialog shows all transmitted fields in readable sections before sending. The financial summary is still personal financial information, despite removing names.

The browser calculates up to ten supported alternatives using the existing engine, including individual-person retirement date changes. Only alternatives that change the model are sent. Each includes actual shortfall, tax, accessible-asset, net-asset and cash outcomes, plus partial mortgage repayment details where applicable. The model chooses up to three and writes a short reason and trade-off. It can select bounded pension/ISA/reserve questions to investigate; no contribution saving or optimum is calculated for these questions. Investment products, invented scenarios, new numeric claims, guarantees and invented tax savings are not accepted. Legacy V1 clients still receive the older prioritisation response.

Both client and server validate the context and model output. Any numerical impact shown in the UI comes from the calculated candidate, not the model's prose. Model explanations cannot contain digits, currencies or percentages; selected candidate IDs must exist in the submitted context. Results clear on household/scenario/goal changes; stale in-flight replies are discarded. Applying and saving remain explicit preview actions.

Only the reviewed financial summary goes to Groq. The Supabase bearer token goes only to the same-origin function and Supabase for authentication. Groq hosts the default `openai/gpt-oss-120b` model; no requests go to OpenAI. Enable Global Zero Data Retention in Groq Data Controls. The app does not inspect or silently change that setting.

## Enable on Netlify

Set these in the **server-side Functions environment**, never in source or client build variables:

- `GROQ_API_KEY`: the server-only Groq key.
- `GROQ_MODEL`: optional; defaults to `openai/gpt-oss-120b`, hosted by Groq, with strict structured outputs. A different model must support the same schema and low reasoning effort.
- `AI_ALLOWED_USER_IDS`: comma-separated Supabase user UUIDs explicitly admitted to this private pilot.

Redeploy after configuration. The endpoint is `/.netlify/functions/planning-analysis`; it is unavailable on the plain Python static server. Use Netlify's local function runtime for an integrated local pilot. Unconfigured service, invalid/expired auth, non-pilot users, provider failure, refusals, timeouts and invalid model output all fail without touching the plan.

Identical successful summaries reuse a five-minute per-user warm-instance cache after fresh authentication. Changed summaries are throttled to once per minute per user, per warm function instance, **not a durable global quota**. An authenticated GET availability check runs before the browser builds the detailed summary. The POST handler verifies identity and pilot access before reading the submitted body. The request body is capped at 24 KB. The UUID allowlist keeps the first deployment a private pilot; the Groq free-tier provider quota remains shared across requests. Deployment contexts must be explicitly approved when setting pilot access. Add a durable per-user quota and deployment-level rate limiting before expanding beyond the private pilot. Context checks cover identity exclusion, immutable inputs, numerical reconciliation, person-specific retirement changes, retired pay/contributions, explicit unknown tax basis, and partial payoff. Mocked transport checks cover the Groq endpoint, provider key isolation, unchanged summary contents, output validation, configuration/auth/pilot gates, provider limits, refusals, truncation and authenticated cache expiry. A successful live Groq call still needs a deployment with the secret and pilot allowlist; the Python static server does not run Netlify functions.

References: [Groq structured outputs](https://console.groq.com/docs/structured-outputs), [Groq data controls](https://console.groq.com/docs/your-data), [Supabase authenticated user verification](https://supabase.com/docs/reference/javascript/auth-getuser).

## Persona iteration — 24 October 2026

Simulated mid-career and near-retirement couple reviews identified hidden funding warnings, overemphasis on final estate values, hard-to-scan consent, internal limitation codes and weak navigation labels. These were code-based persona walkthroughs using fictional household data, not real user interviews or an accountant audit.

The second pass keeps critical gaps, incomplete estimates and low accessibility visible regardless of AI choices. Recommendation cards show shortfall, accessible assets, net assets, lifetime tax and before/after first-gap timing with directional language. Partial mortgage payments show paid, remaining and estimated sale tax. Reviews show focus, horizon, local review time and today-money basis. Consent names both household members’ inclusion, Steadybee-to-Groq routing, sensitive financial amounts and unverified provider-retention settings. Disclosure uses readable person rows and plain-English model limitations. Follow-up buttons name the destination section, and questions without a calculated saving remain distinct from tested scenarios.

Next scope: links directly to individual editors, editable pension-versus-ISA contribution comparisons once contribution methods and allowances can be modelled, durable pilot quotas, and real participant usability research. AI prose is not independently verified; numeric filtering limits unsupported amounts but is not a semantic guarantee. No production financial data was used in persona testing.

Final persona iteration added the availability gate, explicit pre-withdrawal-tax accessibility labels, assumed pension allowance caveats, solo-household consent wording and review date/time. Regression checks confirm non-pilot summaries are not read by the function and GET does not call Groq.
