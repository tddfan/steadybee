# Steadybee: baseline, Lifeline and goals

Date: 25 October 2026. Revised following the founder's clarification: retain the existing Assets & debt and Income & spending input journeys; initial entry establishes a dated baseline; subsequent entries track reality; baseline changes are explicit, dated versions; Lifeline becomes the default workspace. Goals, AI, scenario exploration, two tiers and the remaining agreed direction are retained. This document does not change app behaviour, pricing, entitlements or existing saved households. Prices and validation thresholds below are hypotheses, not measured demand. No private household figures are included.

## Product decision

Position Steadybee as: **Understand where your money is taking you, track progress against your plan, and explore the choices that matter.**

The core loop is **enter starting figures → establish Baseline v1 → record dated updates → compare Lifelines → explore goal-led changes → review again**. Revising the baseline is a separate, explicit action, not an automatic consequence of tracking or accepting a scenario.

The strongest initial audience remains self-directed UK households approaching retirement, with pensions, ISAs and often a mortgage. Focus on three connected questions: Can we stop working when we want? Can we maintain the spending we want? What can we leave behind without undermining our own security?

This direction extends the existing retirement workspace into a continuing relationship. It should not expand into a general budgeting app, trading terminal or autonomous financial adviser. Baseline history and an understandable decision process are more valuable near-term than another visualisation or an unrestricted chatbot.

## 1. Clear information model

Separate concepts in storage, copy and interactions:

| Concept | Meaning | Editing behaviour |
| --- | --- | --- |
| Current household | Personal records, ownership, dated observations and active future assumptions | Changes save to the signed-in household; observed values and modelled estimates remain distinguishable |
| Observation | A recorded balance or other fact with an effective date, source and recording timestamp | Corrections create an auditable revision; distinguish corrections from genuine later changes |
| Baseline version | Starting inputs, goals, assumptions and the forecast generated at a user-visible baseline start date | First saved setup establishes v1; Update baseline creates a new dated version; retain each version's inputs, outputs and calculation/rule versions |
| Current Lifeline / latest outlook | A modelled path incorporating dated tracking updates, with estimates for items not updated | Recalculate from each relevant observation onward; never silently change the selected baseline |
| Scenario | A proposed set of changes, isolated from accepted facts and the active plan | Preview, save and compare; adopt only with an explicit action |
| Plan revision | An accepted change to goals or future assumptions | Keep dated provenance and preserve earlier assumptions; do not turn it into a new baseline unless the user explicitly chooses Update baseline |

Use **Baseline**, **Current Lifeline**, **Tracking updates** and **Saved scenarios** in the UI. Retire “picture”. Show baseline version names/dates in the comparison selector, not on every card. Internal revision records need not become another user-facing saving concept.

Keep the existing Assets & debt and Income & spending entry screens. When initial household setup is first saved, the entered starting information and assumptions establish **Baseline v1** with a visible start date. Explain once: “This is your starting baseline. Future updates track your progress against it.” Users can continue completing the starting setup in an explicit baseline-edit mode; do not create a baseline version for every keystroke. Mark incomplete inputs rather than treating missing fields as zero or known facts.

After initial setup, the normal save action is **Log update**, dated today by default and editable for an earlier statement or effective date. Preserve convenient autosave within that mode, with a visible saved status and effective date. Updating a pension balance records progress; testing an earlier retirement changes a scenario. Adopting that scenario revises future assumptions without rewriting historical actuals or the baseline.

Only values the user enters or explicitly confirms become observations. Saving a form containing untouched prefilled estimates must not mark those estimates as observed. Selecting a future date permits a scheduled change or scenario assumption, not a claim that a future balance has already been observed.

**Update baseline** is a separate action. The user selects the baseline start date, reviews the starting inputs and estimates being carried forward, then saves a new version. Previous baseline versions and all tracking updates remain available. A correction to starting figures also creates a revision with a reason, rather than destroying the original record. Confirmed corrections and a deliberate new starting plan should be distinguishable. Do not silently mark carried-forward projected figures as confirmed baseline facts.

Default comparison uses the latest adopted baseline version effective by the displayed current/as-of date. A future-dated baseline does not take effect early. Selecting an older version is a comparison choice, not a destructive switch of account data. A backdated baseline must not erase later observations; replay relevant updates against it and disclose any conflicts. Baselines can be compared only over their overlapping forecast periods.

The app must load the signed-in household before showing personal results. Example mode is separate, explicit and never autosaves synthetic data over a personal household. Existing account and load reliability is a prerequisite for history features.

## 2. Tracking that answers why

### Combining confirmed inputs with projected values

The user does not need to re-enter every account at each check-in. For each item at the selected date:

1. Start with the selected baseline's opening values and supported future assumptions.
2. Replay applicable dated updates in chronological order. An observed balance replaces that item's estimated balance at its effective point; it is not added on top. A reported zero is a valid observed balance. No entry means missing/unupdated, not zero.
3. From that point forward, continue the model from the updated balance. Items with no subsequent observation continue from their last relevant baseline value or observation using the supported growth, contribution, spending, debt and other assumptions.
4. Re-run connected cash flow, access, withdrawals and tax where the changed information affects them. Do not combine independently projected balances that violate household cash-flow constraints.
5. Keep the baseline forecast exactly as produced at its creation. Show the current combined path as the Current Lifeline, with recorded versus estimated values visible on inspection.

Synthetic example: Baseline v1 starts in January with a £100,000 pension and £20,000 cash. In April the pension was projected to be £102,000, but the user records £110,000. The Current Lifeline uses £110,000 for that pension on the observation date, the model's cash estimate for the same date, and recalculates onward. Baseline v1 still shows its original £102,000 pension expectation. The £8,000 difference is a valuation difference until contributions and other causes are known; it is not automatically market performance.

An observation is an anchor at its date, not a permanently frozen balance. For a later view date, show when that anchor was last recorded and which subsequent amount is estimated. A household total containing projected items is labelled **Estimated total**, even if some components have fresh observations. Recorded values are user-reported/source-recorded, not a claim of independent verification. User-entered property estimates remain estimates. Future market data uses the same source/date structure, but no market integration is part of the first delivery.

Distinguish balance observations from events and ongoing changes. A new salary or regular cost applies from its effective date until superseded; a one-off expense occurs once. Record contributions, withdrawals and transfers separately when known. A closing balance observation must not trigger the same contribution or market movement twice. Sold assets/closed debts require an end date and any known proceeds/funding route, not deletion of their history. A corrected observation preserves both its effective date and recording/revision timestamp and triggers a replay rather than erasing audit history.

Historical dates and events may be recorded exactly, but the current engine forecasts monthly. Specify consistent start/end-of-month ordering before implementing partial-month balances; do not invent daily compounding, daily taxes or precise daily projections. A dated observation within a month remains visible at its exact date, while any monthly approximation around it is disclosed.

### Income and spending history

Tracking includes income, regular spending, contributions and repayment schedules, not only asset balances. Preserve each record's identity and effective periods. A pay change ends the prior rate's period and starts a new rate; it does not overwrite the earlier income or create a second simultaneous salary. Preserve who receives it, source, currency, gross-versus-net basis, frequency, pension contribution method, known end dates and optional reason. Spending and other recurring changes use the same dated-period model.

Distinguish three actions without requiring a complex form:

- **Change from a date:** a new ongoing amount, such as a pay rise, reduced hours or a changed monthly cost. Apply supported growth and other assumptions from the new rate, respecting recorded pay-end dates and retirement; do not restart a future growth assumption retrospectively or continue earnings beyond their supported end.
- **Record an amount for a period:** a confirmed receipt/expense for a selected month or period. This overrides that period only and does not permanently reset salary or regular spending. Bonuses and other one-off items remain separate events where appropriate.
- **Correct an earlier entry:** fix a mistake, preserving correction provenance and recalculating dependent results. This is different from saying the household's income actually changed on the correction date.

Synthetic example: Baseline v1 expected £50,000 gross annual salary initially and £52,000 from April. In June the user records a new £55,000 annual salary effective from May. The baseline continues to show its original expectation. The current path retains the applicable earlier periods and uses £55,000 from May until a later change, scheduled end or supported adjustment. Show “Effective May; recorded June” in history. An annual salary rate is not the amount actually received in that year: the year view totals applicable monthly periods, accounting for any supported partial-period convention. Recompute relevant modelled tax, contributions and savings; do not simply add the gross salary difference to available cash.

Selecting a historical month/year shows the baseline expectation, the applicable recorded income rate/confirmed period amount and their difference. Selecting the income-change event shows the previous rate, new rate, effective date and any modelled impact on the chosen goal. Keep gross/net and annual-rate/monthly-total labels explicit and compare like bases. A user-confirmed salary rate supports estimated monthly income; it does not prove every payslip, future bonus or tax deduction. When actual receipt history is incomplete, label totals “Based on recorded rates” or “Estimated”, not fully actual.

Retain effective time separately from recording time so later backdated entries do not obscure what was originally known. The default historical view can use the latest corrected record, with an optional audit view for the earlier recorded state. Earlier baseline forecasts remain frozen in either case. Data updates should not force creation of a new baseline version.

### Comparisons and explanation

Show two comparisons separately:

1. **Progress so far:** latest observed values versus what the dated baseline forecast expected at the same date.
2. **Change in outlook:** what the latest facts imply for the chosen goal versus the original forecast.

Compare like dates, horizons and purchasing-power bases. Preserve the baseline's original rules/model output; when current rules or the engine change, identify their effect separately from tracked balance changes wherever supported. A new tax rule or revised goal must not be described as investment underperformance. If an effect cannot be isolated reliably, label the comparison accordingly.

A synthetic example: assets are £12,000 above the baseline expectation, but £10,000 came from additional deposits. Do not label the full £12,000 as investment outperformance. When deposits, withdrawals, transfers and valuation history are incomplete, show the balance difference and say its causes cannot yet be fully separated.

Reconcile changes through supported categories: net external saving/withdrawals, investment or interest changes, debt reduction, property valuation changes, fees/taxes and corrections. Internal transfers, including pension withdrawals transferred to cash and mortgage principal movements, must not inflate household income or wealth. Missing inputs produce an unclassified residual rather than fabricated attribution.

Every balance needs an effective date and source. Account, pension and property values may be updated at different times. Show stale data and partial household coverage. An estimated home value is an estimate; price updates alone are not complete portfolio performance tracking. Historical observations start at the first actual record unless the user explicitly supplies earlier records. Modelled estimates may connect gaps, but they remain visibly estimated and are never backfilled as actual history.

Use quarterly check-ins and material life events as the main return habit; add an annual review and relevant tax-year prompts. Daily stock-market engagement is optional and does not define success.

## 3. Lifeline as the main workspace

Lifeline is the default view after sign-in and the main successor to the current Planning forecast workspace. Keep Assets & debt and Income & spending as directly accessible input screens, including their useful tables, categories, breakdowns and editing controls. Lifeline drives the selected date/context and links to relevant records; it does not replace those entry experiences.

The default chart compares **Baseline Lifeline** and **Current Lifeline**. They initially coincide and diverge when tracking information or accepted future assumptions change. Show a compact baseline version/date selector and a separate scenario preview only when requested. Lifeline connects recorded history, today's estimated position, future assumptions and life events. Its purpose is to answer a question at each scale, not display every available metric simultaneously.

| Scale | Primary question | Default information |
| --- | --- | --- |
| Life | Where are we heading? | Net assets, accessible assets, baseline comparison, uncertainty where supported, retirement and major milestones |
| Year | Why does this year change? | Opening/closing wealth, income, spending, contributions, withdrawals, tax and significant events |
| Month | What moves in and out? | Dated or monthly-aggregated inflows/outflows, debt service and tax components; provenance and calculation access |
| Selected date | What do we know at this point? | Recorded events/observations on that date, values' source dates and the applicable monthly forecast context; no invented daily model precision |

Use a visible **Today** boundary. Distinguish baseline/current with colour or stroke pattern and distinguish confirmed observations from estimates with markers and labels; a single solid line must not imply the whole current path was observed. Sparse observations remain sparse; do not imply monthly valuations that were never recorded. On mobile provide Life / Year / Month controls, tap-to-inspect/date selection and next/previous controls; touch scrubbing can supplement them. Zooming should preserve the selected date and context. Clicking a past chart point selects/inspects it; it does not silently change the date of a newly logged update.

Net assets and accessible assets must remain distinct. Property and inaccessible pensions can make a person look wealthy while their spending cannot be funded. A tax overlay should retain legible units and aggregation rather than add unrelated series to one axis. Calendar-year and UK tax-year views must be explicitly labelled and never conflated. Month detail uses available model granularity; it does not promise bank-transaction precision.

Proposed navigation is **Lifeline | Assets & debt | Income & spending | Plan**. Lifeline opens by default and includes a compact current position/what-changed summary, avoiding another Overview destination. Plan combines goals, saved scenarios and findings/AI, with proposed changes previewed on Lifeline. Useful existing planning controls and tax/withdrawal detail remain accessible from Lifeline. Inheritance remains available through the legacy goal rather than being removed; its existing route/data must continue to work during migration. Calculations and exports stay available through a consistent information control.

## 4. Goals define improvement

Start with one primary goal and optional secondary goals:

- Stop working, reduce hours or reach financial independence by a chosen date.
- Maintain a chosen after-tax household spending level through retirement.
- Fund a dated life event, such as education or a major purchase.
- Leave a chosen legacy while protecting the household's own needs.

Capture target amount/date, who it concerns, essential versus flexible spending, priority and tolerated flexibility. A legacy needs a valuation date and basis: today's money, before/after estate tax and the treatment of property/pensions. A retirement goal needs sufficient accessible funding before pension access, not merely a large total pension.

Treat these as constrained comparisons. Protect essential spending and a user-chosen liquidity reserve first; then compare progress toward the primary goal. Make conflicts explicit: pension saving may reduce available cash; early retirement may reduce inheritance; a lower tax bill may accompany lower disposable income or greater risk. No recommendation should be ranked on distant closing assets or tax savings alone.

Avoid a single opaque “optimisation score”. Initially show an understandable goal measure, a resilience result and data completeness separately. Examples: projected retirement date versus target; funded spending versus target; accessible reserve; outcome under an explicitly described shock. A goal-status indicator is useful; an unsupported 82/100 is not.

The existing return simulation is illustrative and uses a simplified investment proxy. Do not rename its simulation frequency as a calibrated personal probability. Holding-specific risk, appropriate return/correlation assumptions, fees, longevity assumptions and model validation are later requirements. If frequency is shown, describe it as the share of simulated paths meeting the defined goal under the displayed assumptions. Scenario comparisons should reuse equivalent simulation draws to reduce sampling noise. A retirement success condition must include funding every required period, not simply a positive ending balance.

### Make Plan engaging through consequences and exploration

Plan should be a compact decision workspace connected to the selected Lifeline date and primary goal, rather than another report. Its repeatable interaction is **what changed → what it means → what could I explore?**

1. **A personal opening:** show the selected goal and the most material supported change since baseline or the last review. An income change can be an entry point, but describe effects on retirement or reserves only after the engine has calculated them. When there is no material change, say so without manufacturing an alert.
2. **A visible consequence:** selecting a Lifeline event reveals a small chain such as pay change → estimated take-home → saving capacity → projected goal outcome. Show only supported links and distinguish an observed fact from its projected consequences. Keep detailed calculations behind the existing information/export control.
3. **At most three relevant explorations:** choose from supported levers such as saving more, changing work timing/hours, spending differently or testing a shock. Each card explains which goal it explores, what input changes and its main trade-off. Let the user select/confirm the parameter. Contribution/wrapper comparisons remain gated on valid model support and the existing regulatory scope; never invent a quantified tax saving or suggest a specific security.
4. **Immediate comparison:** preview baseline, current and the selected scenario on Lifeline only while comparing. Present a compact before/after panel for the few relevant measures, such as retirement date, spending gap, accessible reserve and legacy. Do not show every available metric by default. Use realistic animation only as a comprehension aid; preserve reduced-motion and keyboard alternatives.
5. **A clear decision:** allow Adjust, Save scenario, Apply to current plan and Discard, with Undo for application. Update baseline remains separate. A saved scenario is not a completed real-world action. If an experiment is adopted, later tracking can show recorded progress against it without assuming transfers/contributions have actually occurred.

AI offers context-specific questions such as “Why did this change?”, “What if I reduce my hours?” or “Compare saving more with working longer.” It uses calculated facts and supported scenarios, asks for missing information and explains trade-offs. It does not fabricate encouragement, personalised probabilities or speculative outcome amounts. Keep the useful experience available when external AI is unavailable.

Measure engagement through comprehension, successful scenario decisions and subsequent real tracking updates, not time spent browsing charts, gamified scores or daily streaks. A concise shareable household summary can help partners understand a decision; sharing personal information must remain explicit and private by default.

## 5. AI and calculations

The calculation engine owns every number, eligibility check, constraint and before/after comparison. AI can explain a discrepancy, ask for missing information, translate a user question into a supported scenario and summarise calculated trade-offs.

Workflow: user states a question → required facts checked → supported scenario parameters confirmed → engine calculates → AI explains supported results → user previews and decides. No hidden edits, speculative savings amounts or automated financial transactions. Maintain the existing reviewed-summary consent before external AI processing.

Show no more than three relevant findings at once. Each needs: why it matters to the selected goal; a traceable input/rule; what is known or missing; and a user-initiated comparison where supported. Scope AI to the household's question and the engine's supported recipes rather than launch a general-purpose finance chat.

Tax opportunities need verified facts. ISA usage requires subscriptions across providers, not just balances. Pension allowance checks need applicable limits and pension inputs, including employer contributions, with taper/MPAA/carry-forward and relevant tax-relief constraints addressed or flagged unsupported. Dividend and realised-gain checks need the right account wrappers, income, cost basis, gains/losses and tax-year data. Unused allowance is not automatically wasted money. The user probably means the capital gains annual exempt amount, rather than business capital allowances.

The current engine excludes dividend tax, some other income taxes and pension contribution-limit modelling, and the inheritance flow does not model survivor cash flow between deaths. Do not sell comprehensive optimisation or survivor probabilities on top of those omissions. Add each supported lever with independent worked examples and regression checks before exposing quantified outcomes.

Regulatory design is part of the commercial choice: personalised product/investment suitability, automated allocation changes and implementation are outside the present proposition. The FCA's targeted-support regime is not a blanket exemption for an unauthorised app. Seek a UK regulatory perimeter review of the actual paid workflow and claims before launching personalised optimisation services; a disclaimer alone does not determine the position.

## 6. Two tiers first

Recommended launch hypothesis: **Free** and **Plus**. Avoid “Maximise”, which suggests an outcome or global optimum that the product cannot establish.

| Capability | Free | Plus |
| --- | --- | --- |
| Household, baseline and manual updates | Yes | Yes |
| History and baseline comparison | Yes | Yes |
| Main goal and basic Lifeline | Yes | Yes |
| Basic goal status, data checks and material funding warnings | Yes | Yes |
| Simple user-initiated what-if and representative useful finding | Limited, useful in its own right | Expanded |
| Saved comparisons, multiple goals and detailed trade-offs | Limited | Yes |
| Bounded AI explanations and supported scenario exploration | Demonstration/limited allowance | Fair-use allowance |
| Annual review and relevant tax-year planning workspace | Basic summary | Detailed supported analysis |
| Connections, imports and automatic pricing | Manual first | Add progressively when coverage and unit economics justify them |

All users can access, correct, export and delete their information. Calculation errors, missing-data warnings and known imminent funding gaps are never hidden behind a paywall. Do not display a worrying score and demand payment to understand its fundamental cause. Premium value is depth, comparison and saved effort.

Test approximately **£99/year against £129/year**, with a monthly option around **£12** if required by buyers. These are test offers, not settled pricing. Current reference points: ProjectionLab advertises Premium at $129/year; Sharesight UK advertises Starter £6/month and Standard £14/month billed annually; Guiide offers free pension planning. These comparisons do not prove willingness to pay for Steadybee. Sell a continuing goal review, not generic forecasting or AI access.

Automatic tracking is technically and commercially separate from insights. Start with dated manual updates and reconciled imports, then end-of-day valuation for supported holdings, then selected account connections if demand warrants their cost. Explicitly disclose instrument/provider coverage, price timestamps, fund valuation delays and estimated property values. End-of-day prices do not discover missing trades, subscriptions or contributions. Avoid promising universal real-time ISA, pension and house-price syncing.

Consider a third tier only if a meaningful group demonstrably pays for automation independently of planning, or data-service cost requires it. Until then, a third tier adds onboarding and entitlement complexity before demand is understood.

## 7. Keep, combine and defer

**Keep and strengthen:** the existing Assets & debt and Income & spending screens as directly accessible input destinations; useful asset-type/owner breakdowns and cash-flow tables; account/default-household reliability; transparent tax and pension calculations; ownership/access distinctions; calculation export; scenario preview/apply/undo; compact, progressive disclosure.

**Combine:** move the current Planning forecast/chart workspace into default Lifeline; combine goal selection, Insights and scenario decisions in supporting Plan; consolidate duplicated household-version/scenario concepts into explicit baseline versions, tracking records and scenarios; bring tax-year prompts/events into Lifeline; make inheritance accessible through a legacy goal journey.

**Remove from the main journey:** experimental Bridge/Sunburst/Treemap alternatives; repeated example/setup guidance; multiple competing saving concepts; repeated explanatory paragraphs; a separate generic AI-chat destination. Preserve user data and migrate old routes safely rather than delete working records.

**Defer:** live market feeds, broad account aggregation, advanced fund look-through/correlation, complex estate/gifting optimisation, autonomous actions, peer ranking and a composite optimisation score. Add them only if they materially improve a priority decision and inputs/model quality support them.

## 8. Implementation sequence and gates

1. **Trust, baseline and tracking foundation.** Verify default-household loading and example separation. Keep current asset/income entry. Introduce initial Baseline v1, explicit dated baseline updates, observations, effective-dated income/spending histories and source/model provenance. Existing households must not be assigned invented historical baseline dates: confirm the opening date and establish an honest first baseline from available records. Preserve existing defaults, saved scenarios and facts. Gate: a correction, a tracking update, a baseline revision and a scenario survive reload/sign-in with distinct effects; previous baselines remain recoverable. Test partial updates, explicit zero, backdated observations, future-effective baselines, midyear pay-rate aggregation, one-period receipts versus ongoing changes, retained retirement/end dates and no duplicate cash flows.
2. **Current-Lifeline engine and default workspace.** Replay observations into the existing monthly model; use estimates for unupdated items and propagate changes through dependent cash flows. Connect historical observations and the future forecast. Deliver baseline/current comparison, version/date selection, Life/Year/Month, selected-date inspection, Today boundary, events, tax detail and accessible-asset view. Gate: partial synthetic updates reconcile and continue forward correctly; original baseline outputs stay frozen; aggregation respects stocks versus flows, inflation basis and calendar/tax years; phone inspection works without hovering. Confirm all existing asset/income entry paths remain directly usable.
3. **Goal-led Plan.** Add one primary goal, constraints and explicit competing priorities; consolidate existing experiment UI into what changed → what it means → what could I explore. Connect income/spending and other Lifeline events to their calculated consequences and bounded scenario previews. Gate: a user can inspect an earlier income period versus the baseline, explain a scenario's changes and trade-offs, then save/adopt/discard it without altering history or silently resetting the baseline.
4. **Supported paid insights.** Validate contribution/tax limits and only the selected supported levers; connect AI explanations to engine results; create annual/quarterly review. Obtain regulatory perimeter assessment for actual proposed claims and flows. Gate: quantified findings reproduce with traceable inputs and fail safely on incomplete data.
5. **Commercial pilot.** Test the two offers with real target users before extensive integrations. Suggested initial decision rule: 8–12 observed participants; at least 8/10 on the key comprehension tasks and several genuine paid commitments from qualified users. These small-sample thresholds guide iteration; they do not establish market fit. Measure a later real check-in, time to complete an update, support burden, AI/data cost per active paid household and eventually renewal.
6. **Automation after evidence.** Add import reconciliation and end-of-day pricing for the sources pilot users actually use. Gate: coverage, missing-data behaviour and variable costs support the promise and price. Consider connections or another tier only on evidence.

The next build should cover phases 1–2 in bounded increments, not launch pricing, AI optimisation and universal tracking simultaneously. Goals, supported tax/allowance comparisons, AI, scenario exploration, legacy planning, outcome ranges, the two-tier proposition and the later automation roadmap remain in scope; the baseline/tracking clarification does not cancel them.

## Sources checked on 25 October 2026

- [ProjectionLab pricing](https://projectionlab.com/pricing)
- [Sharesight UK pricing](https://www.sharesight.com/uk/)
- [Guiide FAQs and free pricing](https://www.guiide.co.uk/faq)
- [FCA: support and the advice boundary](https://www.fca.org.uk/firms/helping-firms-provide-more-support-customers-making-investment-decisions)
- [FCA: targeted support framework](https://handbook.fca.org.uk/handbook/cobs9b)
- [GOV.UK: pension annual allowance](https://www.gov.uk/tax-on-your-private-pension/annual-allowance)
- [GOV.UK: ISA treatment](https://www.gov.uk/individual-savings-accounts/how-isas-work)
- [GOV.UK: dividends](https://www.gov.uk/tax-on-dividends)

Implementation basis: current README, Insights delivery, outcome-range documentation, tax/inheritance roadmap and existing strategy/compliance documents. This proposal refines product structure; it does not certify existing calculations or make the new tracking architecture implemented.
