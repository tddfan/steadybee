# Steadybee — Strategy

## Positioning
**An independent second opinion on your retirement — for a fraction of an adviser's fee.**
We sell certainty of *process*, not certainty of *outcome*: "we show you the risks hidden in
today's portfolio and how sensitive your future is to them," never "we'll tell you if you can
retire." This is both more honest and more defensible (legally and psychologically).

## Target segments
- **Primary:** anxious near-retirees, 52–70, £150k+, self-directed, no/disappointed-by adviser,
  scarred by 2008/2020/2022, who dislike big drawdowns more than they love upside. Highest
  willingness to pay; price-insensitive (£150 is a rounding error on £500k).
- **Secondary:** analytical mid-career DIY, 40–52, £100k+, who engage with the present-tense
  diagnostics (concentration, correlation, fees) now and grow into the retirement question.

## How we win (the moat — built, not claimed)
The "today → retirement" connected engine is our **wedge and differentiator**, but it is *copyable*
by a larger player, so it is **not** the moat. The durable moats are earned over time:
1. **Trust & brand** — honesty, transparency, independence (slow, compounding, hard to fake).
2. **Distribution** — SEO ranking + audience + finance-creator relationships.
3. **The annual ritual** — a habit and a tangible artifact people re-buy.
4. **Peer-benchmark data** — *"your concentration is higher than 78% of investors like you."*
   Requires accumulated anonymised data; compounds with scale; genuinely hard to copy. **Capture
   the data from day one** so it becomes an asset later (cold-start: worthless at zero users).

## Business model
- **Free:** the personalised Portfolio Check-up (the hook). Diagnosis is free.
- **Paid:** the **annual Retirement MOT report** + scenario sandbox + ongoing calm monitoring.
  Prognosis is paid. **Price to test: £99 vs £150/year.** (Open question — see below — whether to
  also offer a low-commitment monthly option to reduce activation energy.)
- **Cadence matches behaviour:** retirement planning is *episodic*, so we sell an **annual review
  ritual** (like a car MOT or a tax return), not a daily-SaaS subscription people forget to cancel.
  "Churn" reframes as "was last year's report worth re-buying?" — a cleaner, more honest test.

## The four pillars (every design decision serves one)
- **Fear (acquisition):** present shock + future stakes, aimed at *curable* inputs ("your
  allocation may not support the return your plan assumes"). Compliant copy: "your assumptions may
  be overly optimistic," never "your plan is lying to you."
- **Trust (conversion):** visible causal chain; confirm-holdings step; cited sources (BoE, ONS,
  HMRC); **numbers computed by deterministic code — AI only explains, never invents**; loud
  independence + privacy (encrypted, deletable, never sold).
- **Usability:** one plain-English headline and one number lead; correlation matrices and graphs
  live behind "show me why" (depth for analysts, never forced on the anxious).
- **Reliability:** deterministic engine; confidence bands; honest ranges over false precision;
  DB/state pension optional + approximate + caveated; "current rules, subject to change."

## Acquisition
1. **Problem-query SEO (primary):** rank for what people actually Google — "is my portfolio too
   concentrated," "sequence of returns risk UK," "am I overpaying fund fees." NOT the commoditised
   "can I retire" query owned by Vanguard/HL.
2. **Finance creators (biggest accelerator):** a vouch from a trusted UK personal-finance
   YouTuber/podcaster borrows their audience's trust instantly. Offer free access / affiliate.
3. **Communities (credibility):** UKPersonalFinance, FIREUK, Monevator, Lemon Fool — contribute
   value, don't spam. "Second opinion vs a £5k IFA" framing.
4. **Email newsletter (essential for an annual product):** stay useful in the inbox between annual
   touchpoints.
5. **Product-led sharing:** the free check-up's honest, slightly-alarming result is the shareable
   artifact ("look what this said about my portfolio").

## Compliance guardrails (non-negotiable — FCA: decision-support, not advice)
- **No recommended allocations, no "better" scenarios, no pre-filled changes, no buy lists.**
- **Scenario sandbox = user-initiated, illustrative, behavioural-levers-only at launch** (save
  more / work longer / spend less / delay state pension). Defer/generalise allocation-shift levers,
  which are the highest legal risk once mapped to a specific portfolio.
- **DB pensions = immutable cash flows. Never calculate a CETV or model transferring out** (UK DB
  transfer advice is the most heavily regulated, most-litigated area in finance).
- **Alerts state facts only** ("concentration rose X%→Y%"), never "consider reducing."
- **Every projection:** "illustration, not advice; current rules, subject to change."
- Discipline erodes under conversion pressure — that is the slippery slope. Hold the line.

## The one assumption — and how we test it FIRST
Everything rests on: **will affluent UK investors pay, and renew (>60%), for an annual retirement
check-up?** No further analysis can answer this — only real people can. So, before building the engine:

1. **Fake-door landing page** describing the annual MOT report + "Reserve yours" (test £99 vs £150).
2. **Concierge MVP:** for the first ~10 who bite, **produce the report by hand** (reusing existing
   analysis scripts + a polished template).
3. **Measure the three signals that settle the business:** "I'd buy again next year," "I'd share
   this with my spouse," "I'd recommend it."

Only if those signals are real do we invest in building/automating. Day-one metrics:
**pre-sale conversion → upload-completion → return rate.**

## Honest risks (ranked)
1. **One-and-done churn** — episodic behaviour; the annual report + peer benchmark are the
   mitigations, unproven until real renewals exist. *This is the business.*
2. **Trust/privacy at upload** — affluent 50–70s are scam-wary; asking an unknown site for a CSV is
   the biggest conversion killer. Mitigation: "Bella demo" (try before you upload), loud privacy,
   manual-entry fallback.
3. **CSV parsing fragility** — UK brokers change export formats; a misread destroys trust instantly.
   Mitigation: confirm-holdings step + manual entry.
4. **CMA-vs-lived-returns tension** — forward assumptions (~5%) look "broken" next to a user's
   trailing 11%. Mitigation: explicitly bridge and educate the gap. Permanent, managed not solved.
5. **Regulatory drift** — sliding into advice under growth pressure. Mitigation: the guardrails above.

## Open questions to resolve via testing (not argument)
- **Pricing/cadence:** annual-only (£99–£150) vs also offering ~£15/mo to lower activation energy.
- **Is the product software, or really a report?** Concierge MVP will reveal whether buyers want a
  tool to log into or simply an expert annual report delivered to them.

## Validation record
Strategy stress-tested across four independent AI expert-panel simulations + persona testing. Strong
convergence on customer, funnel, the churn risk, the compliance ceiling, and the lifestyle-scale
ceiling (~£250k–£2M ARR). Divergence (now test items): pricing cadence; report-vs-software.
