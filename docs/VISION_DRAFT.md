# Steadybee — proposed product vision

11 October 2026 · Revised draft for founder review

## Vision

Help UK households plan for retirement, understand what their money could support, explore choices and setbacks, and follow their retirement plan against what actually happens.

Steadybee is an interactive retirement planning and tracking app for UK individuals and households. It connects work and income, everyday spending, family commitments, housing, savings, actual investments, pensions and tax in one evolving retirement plan. People can enter figures, import statements or optionally connect supported accounts.

Its central questions are: **When could we retire or reduce work? What could we live on if earnings changed? How do today's choices affect our retirement?**

The ongoing promise is: **Know where your family stands for retirement, what has changed, and how this year's choices affect your future.**

The product loop is: understand the household → explore alternatives → choose a plan → update actual finances → explain changes → revisit decisions.

## The problem to solve

People can accumulate money across different accounts while still struggling to understand what it means for their lives. A useful plan must connect decisions across time: a period without earnings affects spending and saving now, which changes the resources available for retirement and family goals later.

The founder currently uses a spreadsheet and separate calculators. The unresolved questions include retirement timing and the spending the household could sustain following job loss. Keeping those answers connected is a product hypothesis to test with other people.

An initial calculation is only part of the problem. Balances, holdings, income and spending change, while a spreadsheet can become stale. An updated balance alone does not explain whether contributions, market movements or a changed lifestyle altered the outlook.

## Who we initially want to understand

The strongest firsthand discovery case is a working household balancing family costs, a mortgage, pensions and investments, with concerns about income disruption and future retirement. Investment expertise and precise age or asset thresholds have not been established as qualifications.

Recommended initial focus: working households with money spread across savings, investment and pension accounts, a concrete work or spending question, and an existing manual planning burden. This is a founder-led audience hypothesis, not a validated segment. The other personas remain candidates for later discovery.

Five audience hypotheses guide further research:

| Persona | Main decision bringing them to the app |
| --- | --- |
| Family planner | Connect current commitments, income resilience and future freedom |
| Person approaching a work transition | Compare stopping, reducing or changing work |
| Person living in retirement | Reassess spending, withdrawals and family support using actual experience |
| Person with irregular earnings | Plan through variable income while retaining flexibility |
| Person rebuilding an individual plan | Establish a new baseline after a major household change |

Pension knowledge, confidence, adviser use, household decision roles and willingness to pay are dimensions to investigate within each group. These are research hypotheses, not validated market segments.

## The experience we want to create

### Understand the whole household

Build a shared picture of each person's income, assets, pensions, debts and commitments. Distinguish money available now from money accessible later. Keep ownership and relevant dates visible. Represent school fees, rent or mortgage payments, dependent support and future family expenses as part of the same plan.

Start with what the person knows, identify missing information, and make estimates explicit. People should be able to improve their plan progressively.

Distinguish essential and flexible spending, regular and one-off costs, gross earnings and spendable income, and assets by ownership and access date. Short-term income interruptions need cash timing within the year; annual totals must not conceal a temporary shortage.

### Bring real finances into the plan

Offer manual entry and updates, supported statement/CSV imports with a confirmation step, and optional account connections. Bank transactions can inform income, spending and saving; holdings imports and available investment connections can inform portfolio analysis.

Connectivity is a convenience, not a condition for planning or purchasing advanced analysis. Explain supported providers and account products, the last successful update and missing information. Ordinary open banking does not cover every savings product, investment or pension; broader feeds and manual fallbacks are necessary.

Reconcile imported accounts with entered totals. Transfers between household accounts, credit-card repayments and investment contributions must not be counted again as new income, consumption or wealth. Let people correct transaction classifications and distinguish temporary expenses from lasting spending changes.

### Connect actual investments to household risks

Use confirmed holdings to analyse asset exposure, concentration, fund overlap, sector/country exposure and relevant currency, interest-rate and credit risks where supported data permits. Looking inside funds requires reliable underlying data, identifiers and reporting dates; show analysis coverage and unknown exposures.

Keep investment exposure, ability to absorb losses and personal willingness to accept losses distinct. Neither holdings nor past performance establishes future returns or the person's comfort with risk.

Link declared market setbacks to household consequences: accessible cash, spending coverage, family commitments, retirement timing and remaining resources. Allow combined stresses, such as interrupted earnings during poor markets, and account for the timing of withdrawals.

Allow exploration of hypothetical investment mixes as part of the intended vision. Compare growth assumptions, potential losses, inflation exposure and goal shortfalls together. Reducing fluctuations must not automatically receive a "safer plan" label. Suggestions and implementation scope will be specified and reviewed separately.

Vesper's investment-analysis work is a potential source of reusable capability. Its code, data coverage and suitability must be inspected before anything is described as ported or working in Steadybee.

### Explore possible futures

Let users combine changes in one scenario: either or both incomes stopping, temporary unemployment, lower-paid re-employment, part-time work, career changes and retirement at different dates.

Connect those choices to spending, saving, mortgage repayment, housing changes, major expenses, later-life costs and family goals. Include both aspirations and setbacks. A change should propagate consistently through the whole plan.

Users should be able to explore both directions: change a work date and see its spending consequences, or specify a desired spending level and explore the conditions under which it could be supported.

### Understand choices and trade-offs

Show the implications of chosen saving routes, pension contributions, mortgage payments and withdrawals. Include the tax treatment and allowances applicable to the declared circumstances and supported tax year, including capital gains and dividends.

Help people express priorities: essential spending, desired lifestyle, access to money, retirement timing, support for family and money they hope to leave behind. Compare alternatives against these priorities and explain the trade-offs. A plan that preserves more money for family may support different spending or work choices.

Explore optimisation against goals and constraints the person specifies: for example, supporting a chosen spending level, an earlier work transition, or a family legacy. Include saving and withdrawal strategies in these comparisons. Explain the objective, assumptions and compromises behind any identified strategy.

Suggestions are part of the intended experience: surface overlooked questions, explain which factors drive an outcome, and help people explore alternatives. The precise recommendation capability will be specified separately as the product direction develops.

### Explore possible actions for the year

Create a review of relevant choices tied to the person's goals and circumstances: saving routes, pension contributions, mortgage payments, spending changes, tax-aware withdrawals and supported allowance use. Annual review is a useful occasion, while comparisons remain available when work or family circumstances change.

For each possible action, identify the goal, change, owner, amount, dates, eligibility, required information, costs and assumptions. Show its modelled effect against the chosen baseline, including accessible cash, tax, future spending, retirement timing and family goals. Explain disadvantages as well as potential benefits; a lower tax bill does not automatically improve every goal.

Compare competing uses of the same money and evaluate combined choices together. Moving money between accounts must not appear as new wealth. Optimisation needs an explicit objective and constraints; earlier retirement, current spending, resilience and legacy cannot all be presumed to have equal priority.

Track dividend income, realised gains and applicable allowances separately. Spending a received dividend does not itself use the capital gains allowance. Tax comparisons require supported rules, tax circumstances and acquisition/transaction records where needed; current holdings alone are insufficient.

### Choose a plan and follow it

Save a chosen plan with its assumptions and date. Update income, spending, contributions, holdings and balances over time. Show actual-versus-planned progress at the same dates, separately from a new forecast based on the latest information.

Where the data supports it, explain differences caused by contributions, withdrawals, investment performance, spending, work changes and revised assumptions. A balance increase must not be labelled investment growth if it includes new contributions. Do not invent a precise attribution when transaction history is incomplete.

Let users record a chosen action and track whether it occurred and how the plan subsequently changed. Observed progress and estimated benefits remain distinct; market movements must not be attributed to the action without evidence.

Maintain a history of plans and assumptions. Support returning after a life event or routine review. The continuing value comes from keeping decisions connected to actual experience.

## The output should answer a life question

Lead with the question the person is trying to answer and the relevant result: a retirement timing range, an illustrative spending level, a funding gap, or the consequence of a chosen change.

Let them inspect the timeline, income sources, money available, tax treatment and assumptions behind it. Show essential and flexible commitments distinctly so that a spending result can be understood in the context of the household's life.

Model uncertainty explicitly, including investment outcomes, inflation, employment and longevity where supported. Any probability is a result within a stated model and its assumptions. Make clear what changes when an assumption changes.

## Why people would choose and return to Steadybee

The proposed value is **a household plan grounded in actual finances, explanations of what changed, and comparisons of choices that matter to the household**.

The acquisition hook should start with a concrete question, such as retirement timing or spending after an income interruption. The broader plan provides the context needed to explore that question. Ongoing use follows changes in work, finances and family life.

Hook hypothesis: **“When could you retire—and what could you live on?”**

The proposed compact landing-page explanation and exploration paths are recorded in [LANDING_PAGE_DRAFT.md](LANDING_PAGE_DRAFT.md).

This is positioning to test. It is not evidence of differentiation, demand or willingness to pay.

Actual-versus-plan tracking and scenario planning already exist in competitors. The more specific differentiation hypothesis is connecting underlying investment exposures, accessible money and actual spending to work and family decisions, with less updating effort and clearer explanations. Neither uniqueness nor superior usability has been established.

## Intended feature set

| Capability | Question it helps answer |
| --- | --- |
| Household financial picture | What do we own, owe, earn and spend, and what money can we access? |
| Retirement and work transitions | When could either of us stop, reduce or change work? |
| Income-loss scenarios | What could we live on during unemployment or lower-paid re-employment? |
| Investment exposure and stress tests | Where does investment risk come from, and which goals could it affect? |
| Spending and saving tracking | Are actual expenses and contributions consistent with our plan? |
| Housing and major life events | What changes if we repay the mortgage, move home or fund a family expense? |
| Tax-aware saving and withdrawal comparisons | How do supported routes and allowances affect tax and access to money? |
| Annual choices and goal comparisons | What would each possible change achieve, and what would it cost? |
| Saved plans, reviews and follow-through | What changed, why, and are we following the path we chose? |
| Later-life and legacy scenarios | What resources might remain for care, a surviving partner or family? |

This is the destination feature set, not a commitment to deliver every capability in the first release.

## Proposed free and paid offer

| Free: understand your position | Paid: deeper decisions and easier upkeep |
| --- | --- |
| A useful personal household plan with manual inputs | Detailed comparisons, combined alternatives and saved scenarios |
| Basic retirement and income-change scenarios | Holdings analysis connected to household goal risks |
| Manual updates and a simple progress view | Explanation of changes against the dated plan |
| Inspect existing results, assumptions and missing information | Annual action comparisons and tracking of chosen actions |
| Export and delete personal information | Optional supported account connections and automatic updates |

Paid analysis must also work with manually entered or imported data. People should not have to connect an account to buy a useful comparison. An initial supported statement import is a candidate free onboarding feature; continuous tracking and advanced analysis provide the stronger charging hypothesis.

A paid preview should make the question, comparison scope and key assumptions/trade-offs understandable. A personal impact figure may be previewed only when it has been reliably calculated. Do not hide essential explanations of existing results behind a paywall or imply a guaranteed saving.

Price hypothesis: **£5 per household per month**. This is not validated pricing or proof of viable margins. Connection, fund/market-data, computation and support costs must be assessed before committing to the offer. Review annual billing alongside monthly payment if customer behaviour supports it.

## Recommended first coherent release

Build a reliable personal household baseline that connects income disruption and retirement. Include temporary income loss, permanent loss and lower-paid re-employment; essential/flexible spending; dated family commitments; mortgage costs; accessible savings and pension access; changes to contributions and employer contributions; and declared tax/pension coverage.

Let the person compare a chosen change, save a plan, update their own figures later, and understand what the update means. Include a supported market-setback scenario so income resilience is not assessed using an uninterrupted growth path.

Prove that complete loop before adding the full catalogue. For paid pilots, add a clearly bounded decision comparison and supported holdings analysis. Extend connections by provider and data coverage after testing whether upkeep effort drives payment. Full wrapper optimisation, broader investment connectivity, detailed housing, care and legacy models are subsequent increments.

## Principles

- Calculations are reproducible, inspectable and traceable to confirmed inputs, assumptions and sources.
- AI can help people ask questions and understand results; all displayed financial figures come from verified calculation code.
- Uncertainty and missing information remain visible.
- Plain language and accessible design make the plan usable by people with varied financial knowledge.
- Privacy, consent and deletion are part of the experience.
- Independence supports trust in the explanations and comparisons.

For production financial data, confirmed imports, encryption at rest, explicit household sharing permissions, revocable connection consent, export/deletion and logs without raw holdings or personal information are required. A conversational explanation must never manufacture financial figures or fill missing facts silently.

## How we will know the vision is useful

In real-user research, people should be able to bring a concrete question, understand the result and its assumptions, explain a relevant trade-off, and describe what the plan helps them do next.

Commercial validation needs observed behaviour: completion, useful decisions or discussions, fulfilled paid commitments, and returns when the plan needs updating. Founder enthusiasm and simulated persona reviews inform discovery but do not establish demand.

My current assessment is that a paying audience is plausible, particularly among households maintaining fragmented spreadsheets and facing consequential work, spending or tax decisions. Automation and decision clarity are separate purchase hypotheses. A dashboard or initial forecast alone may not create continuing value.

Existing paid planners establish that the category has commercial offers; ProjectionLab's founder-reported recurring revenue also provides evidence of category payment. Free alternatives mean a projection is not sufficient for every person. None of this establishes Steadybee demand or retention.

Test a reliable, clearly scoped paid pilot with people facing a current decision, using their own information and the stated household price. Observe whether they understand the answer and trade-offs, how it compares with their current workaround, whether they actually pay, and whether later changes lead to voluntary return and renewal. Record cancellation reasons and updating effort. Agree pilot decision criteria before reviewing results; do not substitute hypothetical willingness or invented conversion thresholds for evidence.

## Evidence and next decisions

This draft draws on the founder conversation and primary research:

- [MaPS pension engagement segmentation](https://maps.org.uk/en/media-centre/financial-wellbeing-blog/2025/understanding-how-different-audiences-engage-with-their-pensions): behaviour and confidence provide useful audience distinctions alongside financial circumstances.
- [DWP Planning and Preparing for Later Life 2024](https://www.gov.uk/government/publications/planning-and-preparing-for-later-life-2024/planning-and-preparing-for-later-life-2024): retirement preparedness, pension engagement and household circumstances vary across the population studied.
- [DWP Pension Decumulation and Decision-making research](https://www.gov.uk/government/publications/pension-decumulation-and-decision-making/pension-decumulation-and-decision-making-report): qualitative interviews describe work, health, caring and relationship changes influencing pension decisions; the findings are not statistically representative.
- [Moneyhub data aggregation](https://moneyhub.com/products/data-aggregation/): supported banking feeds and optional wider finance coverage require product/provider checks.
- [MoneyHelper retirement investment guidance](https://www.moneyhelper.org.uk/en/pensions-and-retirement/taking-your-pension/invest-pension-in-retirement): exposure, growth, inflation, loss capacity and withdrawal timing matter in different ways.
- [HMRC dividend guidance](https://www.gov.uk/tax-on-dividends) and [share disposal guidance](https://www.gov.uk/tax-sell-shares): dividend income and capital gains need separate treatment.
- [RetireEasy pricing and features](https://www.retireeasy.co.uk/): Classic is advertised at £5.99/month and Premium at £7.99/month; these are category price anchors, not Steadybee purchase evidence.
- [ProjectionLab pricing](https://projectionlab.com/pricing) and [integration documentation](https://projectionlab.com/help/plugins): paid planning and progress comparison already exist; its documentation says direct account linking is not supported, with third-party plugins/imports available.
- [ProjectionLab founder revenue report](https://projectionlab.com/blog/we-reached-1m-arr-with-zero-funding): the June 2025 recurring-revenue milestone is self-reported category evidence, not a UK Steadybee demand forecast.
- [Guiide's provider offering](https://www.corp.guiide.co.uk/): a free consumer planner demonstrates competition for basic retirement projections.

Following vision review, agree the first-release scope, the free/paid boundary and the first personal question to verify. Then specify calculation coverage, data dependencies, onboarding and the paid pilot. Feature and regulatory review remains a subsequent workstream, as requested by the founder; this draft is a product direction, not clearance to launch every proposed feature.

This document describes the proposed destination. The current prototype's implemented capabilities are documented in [README.md](../README.md). The existing [VISION.md](VISION.md) remains available while this replacement direction is reviewed.
