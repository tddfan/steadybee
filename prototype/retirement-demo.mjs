import { evaluateExample } from './fixtures.mjs';

export const scenarioOverrides = Object.freeze({
  earlier: { retirementAge: 58, partnerRetirementAge: 60 },
  'income-stops': { retirementAge: 57, partnerRetirementAge: 62 },
  'spend-less': { monthlySpending: 3200 },
  'part-time': { retirementAge: 58, partnerRetirementAge: 60, partTimeAnnual: 15000, partTimeEndAge: 65 },
});
export function displayNames(text) {
  return text.replaceAll('Morgan', 'Alex').replaceAll('Sam', 'Jemma');
}
export function fundingFacts(row) {
  const need = row.spending + row.majorCost;
  return { need, covered: Math.max(0, need - row.annualGap), gap: row.annualGap };
}
export function retirementDemo(overrides = {}) {
  const baseline = evaluateExample('mixed-household');
  const current = evaluateExample('mixed-household', overrides);
  return {
    baseline, current,
    firstGap: current.rows.find((row) => row.annualGap > 0) ?? null,
    finalMoney: current.rows.at(-1).closingTotal,
    funding: current.rows.map(fundingFacts),
    assumptions: current.assumptions.map(displayNames),
  };
}
