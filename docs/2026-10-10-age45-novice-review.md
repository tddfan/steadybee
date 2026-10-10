# Steadybee — age 45 fictional user review

## Age-45 novice walkthrough — Tesco employee persona

10 October 2026 · Review began 9 October · Fictional persona and authored example, not a recruited customer.

**Verdict:** the revised example's purpose and main choices are likely understandable without coaching. The original landing had material interpretation problems. This is an AI-assisted usability judgment supported by actual browser interactions; it does not establish human comprehension, retirement affordability or willingness to pay.

### Persona and method

The hypothetical reader is a 45-year-old male Tesco employee, comfortable using a smartphone and unfamiliar with pension terminology. Pension familiarity is an explicit test assumption, unrelated to occupation or ability. No Tesco salary, scheme terms, eligibility or personal financial figures were inferred. The reader explored Alex's clearly named fictional age-52 example, then tested a separate draft using only synthetic age 45 and a synthetic alternative retirement age of 58.

The initial persona agent used a fresh 375×812 anonymous browser, read only rendered UI, and did not see source code, the PRD or previous reviews. Aarav independently checked actual phone layout and the own-draft boundary. After revision, a separate UI-only agent repeated six bounded checks at 375×812. The build owner independently checked 320/375/1440, calculations shown in the interface, immediate choice feedback, and the public hosting badge. No customer was contacted, no personal data was used and no purchase occurred.

### Tasks, findings and revisions

| Task | Initial visible evidence and comprehension risk | Delivered revision / repeat evidence |
|---|---|---|
| Identify whose figures these are | Fictional badge and “Alex, 52” clearly separate the example from a reader aged45 | Fictional identity remains prominent; the independent repeat identified Alex's figures correctly |
| Understand annual spending | £3,000/month alongside £/year required a conversion; stripes appeared within “What covers spending” as though they were funding | “Yearly spending and gaps”; “Spending not covered”; visible £3,000/month = £36,000/year and “Stripes show spending with no funding” |
| Explain the £106,777 early number | “Before pension access” did not identify whether this was available money or a spending gap | “Spending gap before 60”; “Total across 3 years”, ages 57–59/2031–2033; aggregate gaps explicitly distinguished from a top-up required today |
| Tap retire-at58 | Choice changed while results were well below the phone viewport | Immediate paragraph below buttons: stop work at58, no early spending gap, later gap starts at 83; detailed results remain consistent |
| Tap part-time | Fixed £24,000/year earnings and duration were below the graph, away from the choice | Immediate £2,000/month assumed take-home pay, ages 55–59; early gap £0 and later gap at 82. It is a separate authored choice, not part-time added to retirement-at58 |
| Distinguish flows from balances | Income, pot withdrawals and money left required terminology knowledge | Visible year-end balance explanation and pension locking until 60; pension pot explained as retirement savings and pension income as regular payments |
| Choose the early range and endpoint | “Bridge” did not predict its effect; endpoint explanation was far below its selector | Literal “Ages52–62” control, including two years after assumed pot access; planning-age assumption explained next to selector. All-years/90/95/100 behaviour retained |
| Inspect year 67 | The ledger reconciled, but “Income” did not identify its source | Explicit assumed regular pension income £12,000/year + £24,000/year pot withdrawal = £36,000 spending; £297,556 remains available to draw |
| Read the graph on a phone | Public “Powered by Netlify” iframe covered the actual chart; elementFromPoint confirmed interception | Public badge remains functional in page flow after the footer. Charts and controls are unobscured; keyboard opening and hosting link preserved. Owner/private toolbar untouched |
| Try own age 45 plan | Own draft correctly used unknown fields instead of importing Alex's numbers | Age45 is retained; “Personal retirement outcomes have not been calculated”. A alternative retirement age of 58 compares entered information only. This capability limit is unchanged |

The early total remains £106,777.19 across three years. The first uncovered year is age 57/2031, £34,777.19, while £473,848.56 remains in pension money assumed locked until 60. Annual spending becomes covered at 60, without resolving the earlier gaps. The later baseline gap starts at 81. Retiring at58 and part-time earnings close the early gap while leaving later gaps at 83 and82. These calculations were not changed to make the example look more reassuring.

### Repeat review and verification

The independent repeated mobile walkthrough found no material blocker in its six tasks. The reader can plausibly follow “changing work choices changes which years have a spending gap”. “Today's money” and the dashed original-plan comparison remain useful topics for actual human testing; no unassisted completion time, comprehension score or customer quote is claimed.

All 60 automated checks passed: 30 state/fixture, 9 installed-app update and 21 browser checks. The browser suite checks funding reconciliation, selected endpoints, handoff/refresh, personal/example separation, exports and one-page briefs. A navigation timing race in the handoff test was corrected by waiting for the destination URL and safely polling the application snapshot; financial and application state logic were unchanged. Focused phone/desktop checks verify that the short choice result is in the viewport after tapping, there is no horizontal overflow, the public badge is after the footer, and its keyboard interaction and link still work. JavaScript syntax, whitespace and the static build are checked before release.

### Product learning and human validation gate

Understandability improves when the interface names the question answered by a number, its period, and what changes immediately after a tap. A helpful chart does not substitute for an answer on the person's own information. A 45-year-old can explore these examples and organise a draft today; the app cannot yet calculate their personal retirement decision.

Ask real 45–55-year-old participants with varied pension familiarity to explain, unaided: whose figures they see; what a striped year means; whether £106,777 is money available or a total spending gap; what the part-time choice assumes; why £0 before 60 does not mean later life is covered; what “today's money” and dashed lines mean; and what happens when they enter their own information. Record actual answers and task outcomes before claiming comprehension. Payment remains conditional on reliable personal outcomes and observed benefit, followed by actual fulfilled commitments; agreement between simulated agents is not demand evidence.
