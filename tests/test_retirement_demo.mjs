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

test('excess inflation compounds spending from year two without inflating income', () => {
  const base = retirementDemo().current;
  const changed = retirementDemo({ extraRealSpendingRate: 0.02 }).current;
  assert.equal(changed.rows[0].spending, base.rows[0].spending);
  assert.equal(changed.rows[1].spending, 45600 * 1.02);
  assert.equal(changed.rows[2].spending, Math.round(45600 * 1.02 ** 2 * 100) / 100);
  assert.equal(changed.rows[1].income, base.rows[1].income);
  assert.ok(changed.summary.finalTotal < base.summary.finalTotal);
});
test('a pension market loss hits opening pots once and leaves earlier years intact', () => {
  const base = retirementDemo().current;
  const changed = retirementDemo({ pensionLossPercent: 20, pensionLossAge: 60 }).current;
  assert.deepEqual(changed.rows.slice(0, 3).map(({pensionMarketLoss, ...row}) => row), base.rows.slice(0, 3));
  const row = changed.rows[3];
  assert.equal(row.pensionMarketLoss, Math.round(row.openingPension * 0.2 * 100) / 100);
  assert.equal(changed.rows[4].pensionMarketLoss, 0);
  assert.throws(() => retirementDemo({ pensionLossPercent: 101 }), /Invalid value/);
  assert.throws(() => retirementDemo({ pensionLossPercent: 20, pensionLossAge: 56 }), /within/);
});

test('saving is funded from spending and school/family budgets are charged once', () => {
  const saved = retirementDemo(scenarioOverrides['save-more']);
  assert.equal(saved.baseline.rows[0].spending - saved.current.rows[0].spending, 3600);
  assert.equal(saved.current.rows[0].income, saved.baseline.rows[0].income);
  assert.equal(saved.current.rows[0].closingAccessible - saved.baseline.rows[0].closingAccessible, 3600);
  for (const id of ['school-fees', 'help-family']) {
    const demo = retirementDemo(scenarioOverrides[id]);
    assert.equal(demo.current.rows.filter(row => row.majorCost > 0).length, 1);
    assert.equal(demo.current.rows.find(row => row.majorCost > 0).majorCost, 50000);
    assert.ok(demo.finalMoney < demo.baseline.summary.finalTotal);
  }
});
test('mortgage comparison uses matching payment assumptions and a single affordable payoff', () => {
  const demo = retirementDemo(scenarioOverrides.mortgage);
  assert.equal(demo.baseline.profile.mortgageMonthly, demo.current.profile.mortgageMonthly);
  assert.equal(demo.baseline.rows.find(row => row.primaryAge === 60).mortgagePayment, 9600);
  assert.equal(demo.current.rows.find(row => row.primaryAge === 60).mortgagePayment, 0);
  assert.equal(demo.current.rows.find(row => row.primaryAge === 60).mortgagePayoff, 90000);
  assert.equal(demo.current.rows.reduce((sum,row) => sum + row.mortgagePayoff, 0), 90000);
});
test('downsizing adds only net proceeds, while a legacy goal does not create or reserve assets', () => {
  const moved = retirementDemo(scenarioOverrides.downsize);
  assert.equal(moved.current.rows.reduce((sum,row) => sum + row.homeCashReleased, 0), 130000);
  const legacy = retirementDemo(scenarioOverrides.legacy);
  assert.equal(legacy.legacyTarget, 500000);
  assert.deepEqual(legacy.current.rows, legacy.baseline.rows);
  assert.throws(() => retirementDemo({ legacyTarget: -1 }), /non-negative/);
});
test('stressed ledgers reconcile annual flows without negative assets or hidden losses', () => {
  for (const id of Object.keys(scenarioOverrides)) {
    const demo = retirementDemo(scenarioOverrides[id]);
    for (const row of demo.current.rows) {
      const covered = row.spending + row.majorCost - row.annualGap;
      const expected = row.openingAccessible + row.openingPension + row.accessibleGrowth + row.pensionGrowth - (row.pensionMarketLoss ?? 0) + row.contributions + row.income + row.homeCashReleased - row.mortgagePayoff - covered;
      assert.ok(Math.abs(expected - row.closingTotal) < 0.05, `${id} ${row.year} reconciles`);
      assert.ok(row.closingAccessible >= 0 && row.closingPension >= 0 && row.annualGap >= 0);
    }
  }
});
