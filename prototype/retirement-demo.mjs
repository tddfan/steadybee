import { evaluateExample } from './fixtures.mjs';

// Authored, editable fictional choices; no recommendations or product defaults.
export const scenarioDefinitions = {
  earlier: { title: 'Retire earlier', icon: 'sun', group: 'work', description: 'Change both work-end dates. Earnings and contributions stop at each date.', fields: [['retirementAge', 'Alex stops work at', 58, 57, 70, 1], ['partnerRetirementAge', 'Jemma stops work at', 60, 55, 70, 1]] },
  'income-stops': { title: 'Job loss', icon: 'pause', group: 'work', description: 'Permanent loss of Alex’s earnings and contributions from the chosen age; no re-employment or benefit income.', fields: [['retirementAge', 'Alex’s income ends at', 57, 57, 70, 1]] },
  'spend-less': { title: 'Spend less', icon: 'spending', group: 'money', description: 'Change monthly household spending from the first illustrated year.', fields: [['monthlySpending', 'Monthly spending (£)', 3200, 0, 10000, 100]] },
  'part-time': { title: 'Part-time work', icon: 'work', group: 'work', description: 'Alex replaces full-time work with assumed spendable part-time earnings. No tax calculation.', fields: [['retirementAge', 'Alex steps back at', 58, 57, 70, 1], ['partnerRetirementAge', 'Jemma retires at', 60, 55, 70, 1], ['partTimeAnnual', 'Part-time income (£/year)', 15000, 0, 100000, 1000], ['partTimeEndAge', 'Part-time work ends at', 65, 58, 90, 1]] },
  'save-more': { title: 'Save more', icon: 'savings', group: 'money', description: 'Fund extra saving by reducing spending. Unspent income stays in accessible savings; after work ends this means smaller withdrawals, not new earnings.', fields: [['savingReduction', 'Spend less to save (£/month)', 300, 0, 3800, 100]] },
  'mortgage': { title: 'Pay off mortgage', icon: 'mortgage', group: 'home', description: 'Declare a mortgage within existing spending on both paths; the original pays until its end age. The alternative uses a supplied cash payoff and stops payments. No interest/amortisation model.', fields: [['mortgageMonthly', 'Payment within spending (£/month)', 800, 0, 3800, 100], ['mortgageEndAge', 'Original payments end at Alex age', 70, 57, 90, 1], ['mortgagePayoffAmount', 'Cash payoff quote (£)', 90000, 0, 500000, 5000], ['mortgagePayoffAge', 'Pay off at Alex age', 60, 57, 90, 1]] },
  'downsize': { title: 'Downsize', icon: 'home', group: 'home', description: 'Only sale proceeds less replacement home, mortgage settlement and moving costs become accessible money. No new borrowing, Stamp Duty or tax calculation.', fields: [['homeSaleAmount', 'Sale proceeds (£)', 500000, 0, 2000000, 10000], ['replacementHomeCost', 'Replacement home (£)', 350000, 0, 2000000, 10000], ['mortgageSettlement', 'Mortgage settlement (£)', 0, 0, 500000, 5000], ['movingCosts', 'Moving and transaction costs (£)', 20000, 0, 100000, 1000], ['downsizeAge', 'Move at Alex age', 65, 57, 90, 1]] },
  'school-fees': { title: 'School fees', icon: 'school', group: 'family', description: 'A one-off school-fee budget, paid in the selected year in addition to regular spending. This does not model annual fees or instalments.', fields: [['majorCost', 'School-fee budget (£)', 50000, 0, 500000, 1000], ['majorCostAge', 'Pay at Alex age', 60, 57, 90, 1]] },
  'help-family': { title: 'Help family', icon: 'family', group: 'family', description: 'An additional one-off family gift. No gift/inheritance tax or estate calculation.', fields: [['majorCost', 'Family gift (£)', 50000, 0, 500000, 1000], ['majorCostAge', 'Give at Alex age', 65, 57, 90, 1]] },
  'inflation': { title: 'Higher inflation', icon: 'inflation', group: 'stress', description: 'Extra cost growth above baseline inflation, from year two. Non-mortgage spending rises in today’s pounds; real income and mortgage payments remain fixed. A price stress, not a full inflation forecast.', fields: [['extraInflationPercent', 'Extra annual cost growth (%)', 2, 0, 10, 0.5]] },
  'market-falls': { title: 'Market falls', icon: 'investment', group: 'stress', description: 'One loss on both invested pension pots before growth and withdrawals in the chosen year. Savings and DB/State Pension income are unchanged. Fixed growth resumes on reduced pots; recovery is not promised.', fields: [['pensionLossPercent', 'One-off pension loss (%)', 20, 0, 100, 5], ['pensionLossAge', 'Loss at Alex age', 60, 57, 90, 1]] },
  'legacy': { title: 'Leave a legacy', icon: 'legacy', group: 'family', description: 'Compare money remaining at the illustration’s end with a chosen target. This does not reserve money, infer a death date or calculate an inheritance; unpaid spending remains separate.', fields: [['legacyTarget', 'End-horizon target (£)', 500000, 0, 5000000, 10000]] },
};
export function scenarioValues(id) {
  return Object.fromEntries(scenarioDefinitions[id].fields.map(([key, , value]) => [key, value]));
}
export function scenarioInputs(id, values) {
  const { savingReduction, extraInflationPercent, legacyTarget, ...overrides } = values;
  if (savingReduction !== undefined) overrides.monthlySpending = evaluateExample('mixed-household').profile.monthlySpending - savingReduction;
  if (extraInflationPercent !== undefined) overrides.extraRealSpendingRate = extraInflationPercent / 100;
  return { ...overrides, ...(legacyTarget !== undefined ? { legacyTarget } : {}) };
}
export const scenarioOverrides = Object.freeze(Object.fromEntries(Object.keys(scenarioDefinitions).map(id => [id, scenarioInputs(id, scenarioValues(id))])));
export function displayNames(text) {
  return text.replaceAll('Morgan', 'Alex').replaceAll('Sam', 'Jemma');
}
export function fundingFacts(row) {
  const need = row.spending + row.majorCost;
  return { need, covered: Math.max(0, need - row.annualGap), gap: row.annualGap };
}
export function retirementDemo(overrides = {}) {
  const { legacyTarget = 0, ...ledgerOverrides } = overrides;
  if (!Number.isFinite(legacyTarget) || legacyTarget < 0) throw new Error('Enter a non-negative legacy target.');
  const housingBaseline = Object.fromEntries(['mortgageMonthly', 'mortgageEndAge'].filter(key => key in ledgerOverrides).map(key => [key, ledgerOverrides[key]]));
  const baseline = evaluateExample('mixed-household', housingBaseline);
  const current = evaluateExample('mixed-household', ledgerOverrides);
  return {
    baseline, current, legacyTarget,
    firstGap: current.rows.find((row) => row.annualGap > 0) ?? null,
    finalMoney: current.rows.at(-1).closingTotal,
    funding: current.rows.map(fundingFacts),
    assumptions: current.assumptions.map(displayNames),
  };
}

export function estateFlows(row) {
  const surplus = Math.max(0, row.income - row.spending - row.majorCost);
  return {
    additions: row.contributions + surplus + row.homeCashReleased,
    withdrawals: row.withdrawalsAccessible + row.withdrawalsPension + row.mortgagePayoff,
    growth: row.accessibleGrowth + row.pensionGrowth,
    marketLoss: row.pensionMarketLoss ?? 0,
  };
}
