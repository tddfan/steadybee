import assert from 'node:assert/strict';
import { test } from 'node:test';
import { householdBaseExample } from '../prototype/retirement-example.mjs';
import { simulateHousehold } from '../prototype/retirement-household.mjs';
import { planInputSummary } from '../prototype/retirement-plan-summary.mjs';

const money = value => new Intl.NumberFormat('en-GB', {
  style: 'currency', currency: 'GBP', maximumFractionDigits: 0,
}).format(value);

test('snapshot shows entered balances and named rows beside calculated starting cashflow', () => {
  const input = householdBaseExample();
  const model = simulateHousehold(input);
  const summary = planInputSummary(input, {}, model);
  const startingAssets = input.assets.reduce((sum, asset) => sum + asset.balance, 0);
  const startingDebts = input.debts.reduce((sum, debt) => sum + debt.balance, 0);
  assert.deepEqual(summary.starting, {
    assets: money(startingAssets), debts: money(startingDebts),
    net: money(startingAssets - startingDebts),
  });
  assert.deepEqual(summary.assets.items[0], {
    id: 'home', label: 'Home', amount: '£783,000',
  });
  assert.deepEqual(summary.debts.items, [{
    id: 'mortgage', label: 'Home mortgage', amount: '£383,000',
  }]);
  assert.equal(summary.assets.count, input.assets.length);
  assert.equal(summary.assets.moreCount, input.assets.length - 3);
  assert.equal(summary.cashflow.year, input.year);
  assert.equal(summary.cashflow.incomeMonthly, `${money(model.rows[0].income / 12)}/mo`);
  assert.equal(summary.cashflow.spendingMonthly,
    `${money((model.rows[0].spending + model.rows[0].payoff) / 12)}/mo`);
  assert.equal(summary.cashflow.debtMonthly,
    `${money(model.rows[0].spendingByCategory.debt / 12)}/mo`);
  assert.equal(summary.incomes.items[0].amount, '£10,000/mo');
  assert.equal(summary.incomes.items[2].amount, '£50,000/yr');
  assert.equal(summary.expenses.items[0].amount, '£3,500/mo');
  assert.equal(summary.expenses.items[2].amount, '£30,000/yr · from Alex 50');
  assert.equal(summary.incomes.moreCount, input.incomes.length - 3);
  assert.equal(summary.retirementBudgetMonthly, '—');
  assert.equal(summary.inflation, '2%');
  assert.equal(input.assets[0].id, 'cash', 'sorting previews must not reorder the plan');
});

test('work dates show early retirement and actual redundancy interruptions', () => {
  const input = householdBaseExample();
  const early = planInputSummary(input, { early: true });
  assert.deepEqual(early.work.map(item => [item.name, item.age, item.mode]), [
    ['Alex', 55, 'work-end'], ['Jemma', 55, 'work-end'],
  ]);

  const interrupted = planInputSummary(input, { job: true, jobPartner: true });
  assert.deepEqual(interrupted.work.map(item => [item.age, item.year, item.mode]), [
    [44, 2027, 'redundancy'], [45, 2029, 'redundancy'],
  ]);
  assert.match(interrupted.work[0].label, /redundancy at 44/);

  input.employment[0].returnYears = 2;
  const returned = planInputSummary(input, { job: true });
  assert.equal(returned.work[0].age, 68);
  assert.equal(returned.work[0].mode, 'return');
  assert.match(returned.work[0].label, /back at 46; work ends at 68/);
});

test('incomplete model leaves calculated cashflow blank while preserving input previews', () => {
  const input = householdBaseExample();
  input.assets[0].balance = 40000;
  const summary = planInputSummary(input, {}, null, { previewLimit: 2 });
  assert.equal(summary.cashflow.incomeMonthly, '—');
  assert.equal(summary.cashflow.spendingMonthly, '—');
  assert.equal(summary.incomes.items.length, 2);
  assert.equal(summary.incomes.count, input.incomes.length);
  assert.equal(summary.assets.items.length, 2);
  assert.equal(summary.assets.moreCount, input.assets.length - 2);
  assert.equal(summary.starting.assets,
    money(input.assets.reduce((sum, asset) => sum + asset.balance, 0)));
  input.retirementBudget = { monthly: 5500, expenseId: 'retirement' };
  assert.equal(planInputSummary(input).retirementBudgetMonthly, '£5,500/mo');
});
