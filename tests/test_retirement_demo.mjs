import test from 'node:test';
import assert from 'node:assert/strict';
import { retirementDemo, fundingFacts, scenarioOverrides, displayNames } from '../prototype/retirement-demo.mjs';

test('landing presentation uses the mixed household ledger and explicit display aliases', () => {
  const demo = retirementDemo();
  assert.equal(demo.current.provenance.fixtureId, 'mixed-household');
  assert.equal(demo.current.profile.primary.age, 57);
  assert.equal(demo.current.profile.partner.age, 55);
  assert.equal(displayNames('Morgan and Sam'), 'Alex and Jemma');
  assert.equal(demo.finalMoney, demo.current.summary.finalTotal);
  assert.equal(demo.firstGap, null);
});
test('stopping income now removes employment and contributions from the first year', () => {
  const demo = retirementDemo(scenarioOverrides['income-stops']);
  const base = demo.baseline.rows[0], changed = demo.current.rows[0];
  assert.equal(base.income - changed.income, demo.baseline.profile.primary.employmentAnnualNet);
  assert.equal(base.contributions - changed.contributions, demo.baseline.profile.primary.monthlyContributions * 12);
  assert.ok(demo.finalMoney < demo.baseline.summary.finalTotal);
});
test('earlier access gaps remain visible even with money left at the horizon', () => {
  const demo = retirementDemo({ retirementAge: 57, partnerRetirementAge: 55, monthlySpending: 4000 });
  assert.ok(demo.firstGap);
  assert.ok(demo.firstGap.closingLockedPension > 0);
  assert.ok(demo.finalMoney > 0);
  assert.ok(demo.current.rows.at(-1).cumulativeGap > 0);
  const facts = fundingFacts(demo.firstGap);
  assert.ok(Math.abs(facts.need - facts.covered - demo.firstGap.annualGap) < 0.01);
  assert.ok(demo.current.rows.some((row) => row.year > demo.firstGap.year && row.annualGap === 0));
});
test('part time income ends at its specified age and cannot rewrite earlier years', () => {
  const demo = retirementDemo(scenarioOverrides['part-time']);
  assert.equal(demo.current.rows.find((r) => r.primaryAge === 58).incomeBreakdown.partTime, 15000);
  assert.equal(demo.current.rows.find((r) => r.primaryAge === 65).incomeBreakdown.partTime, 0);
});
