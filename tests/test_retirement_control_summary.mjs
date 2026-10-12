import test from 'node:test';
import assert from 'node:assert/strict';
import { householdBaseExample } from '../prototype/retirement-example.mjs';
import { simulateHousehold } from '../prototype/retirement-household.mjs';
import { controlSummaries } from '../prototype/retirement-control-summary.mjs';

function example() {
  const input = householdBaseExample();
  input.savings = { cashTarget: 30000, priority: 'liquidity', maxPension: false, isaLimit: 20000, pensionLimit: 60000 };
  return input;
}
const scenario = { name: 'Default', savedCount: 0, changes: [] };

test('summaries use starting-year averages and actual model endpoints', () => {
  const input = example(), model = simulateHousehold(input);
  const summary = controlSummaries(input, {}, model, scenario);
  assert.match(summary.adjustment, /2026 averages: income £18,350\/mo/);
  assert.match(summary.income, /Starting 2026 average · 8 scheduled entries/);
  assert.equal(summary.work, 'Alex: work ends at 68 · Jemma: work ends at 68');
  assert.match(summary.assumptions, /Alex 91 \/ Jemma 90/);
  assert.equal(summary.changes, 'No added scenario options');
});

test('work summary distinguishes redundancy from early retirement settings', () => {
  const input = example(), actions = { job: true, early: true };
  const summary = controlSummaries(input, actions, simulateHousehold(input, actions), scenario);
  assert.equal(summary.work, 'Alex: redundancy set for 2027 · Jemma: work ends at 55');
});

test('spending summary includes funded mortgage payoff in its monthly average', () => {
  const input = example(), actions = { payoff: true };
  input.settings.payoffAge = input.people[0].age;
  const model = simulateHousehold(input, actions), now = model.rows[0];
  assert.ok(now.payoff > 0);
  const expected = new Intl.NumberFormat('en-GB', {
    style: 'currency', currency: 'GBP', maximumFractionDigits: 0,
  }).format((now.spending + now.payoff) / 12);
  assert.ok(controlSummaries(input, actions, model, scenario).adjustment.includes(`spending ${expected}/mo`));
});

test('direct edits update summaries without being labelled no changes', () => {
  const input = example();
  input.incomes.find(row => row.type === 'rent').amount = 200;
  input.moves = [{ id: 'move', label: 'Transfer', type: 'transfer', amount: 1000, year: 2026, sourceId: 'trading' }];
  input.withdrawal.owner = 'partner';
  input.withdrawal.order = 'investments-first';
  const summary = controlSummaries(input, {}, simulateHousehold(input), {
    name: 'Unsaved draft', savedCount: 2, changes: [],
  });
  assert.match(summary.adjustment, /income £18,450\/mo/);
  assert.equal(summary.transfers, 'Cash target £30,000 · 1 money move');
  assert.match(summary.withdrawal, /^Jemma · Investments → cash → pensions/);
  assert.equal(summary.saved, 'Unsaved draft · 2 saved this session');
});

test('invalid inputs never leave stale calculated summaries visible', () => {
  const summary = controlSummaries(example(), {}, null, scenario);
  assert.equal(summary.adjustment, 'Complete the figures');
  assert.equal(summary.work, 'Complete the figures');
  assert.equal(summary.saved, 'Default · 0 saved this session');
});
