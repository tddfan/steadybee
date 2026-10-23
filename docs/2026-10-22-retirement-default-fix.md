# Retirement defaults and asset breakdown

Planning previously displayed a final working year 20 years after the plan start when no pay-end month was recorded. That fallback was only a control value: an untouched control left the projection's retirement override empty, so pay continued indefinitely.

The view now resolves its displayed retirement years before controls, projections, comparisons, simulations and saved scenario snapshots use them. Explicit scenario dates take precedence over recorded pay-end years. Recorded end months are retained by the engine; missing months use December. Household facts are not edited. Reset and older saved scenarios use the same resolution.

Assets opens with the existing type breakdown, labelled “Asset type”, alongside People and Access. Planning's grouping switch is visible above the chart, with contextual Asset type, Debt type, Tax component or Source labels. The income chart explicitly says take-home income.

Validation: 153 tests passed, including regression coverage for untouched defaults, both people's pay and contributions stopping, post-retirement employment tax and NI, explicit dates, saved scenario round trips and single-person households. Browser checks confirmed asset-type cash drilldown and Planning asset-type legends. The signed-in account showed the expected final pay date and zero employment Income Tax/NI in a later year. Financial inputs were not edited. Responsive viewport overrides did not affect the test tab, so a fresh 375px visual check was not established in this pass.
