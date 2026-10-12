import test from 'node:test';
import assert from 'node:assert/strict';
import { householdExample, simulateHousehold, openingPicture } from '../prototype/retirement-household.mjs';

test('opening net wealth includes property, car and every debt; access excludes property and locked pensions', () => {
  const input = householdExample(); const p = openingPicture(input);
  assert.equal(p.assets, input.assets.reduce((s,a)=>s+a.balance,0));
  assert.equal(p.net, p.assets-input.debts.reduce((s,d)=>s+d.balance,0));
  assert.equal(p.accessible, input.assets.filter(a=>['cash','investment','bonds'].includes(a.type)).reduce((s,a)=>s+a.balance,0));
});
test('household ledger reconciles cash, assets and debt each year', () => {
  for(const actions of [{},{early:true},{downsize:true,payoff:true},{market:true,inflation:true},{pension:true,spend:true},{fixed:true,growth:true}]) {
    const model=simulateHousehold(householdExample(),actions);
    for(const r of model.rows) {
      assert.ok(Math.abs(r.openingAssets+r.growth+r.additions-r.withdrawals-r.marketLoss+r.propertyChange-r.closingAssets)<0.1, `assets ${r.year}`);
      assert.ok(Math.abs(r.openingDebt+r.debtInterest-r.debtPaid-r.settlement-r.closingDebt)<0.1, `debt ${r.year}`);
      assert.ok(Math.abs(r.closingAssets-r.closingDebt-r.netWealth)<0.1);
      assert.ok(r.withdrawals>=0 && r.gap>=0);
    }
  }
});
test('salary stops at each owner work date; pension access cannot be borrowed against', () => {
  const input=householdExample(); input.people[0].retireAge=58; input.people[1].retireAge=60;
  const result=simulateHousehold(input);
  assert.equal(result.rows.find(r=>r.primaryAge===58).sources.salary, 24000*1.02);
  const poor=householdExample();poor.assets=poor.assets.filter(a=>['pension','cash'].includes(a.type));poor.assets.find(a=>a.type==='cash').balance=0;poor.incomes=[];poor.debts=[];
  const row=simulateHousehold(poor).rows[0];assert.ok(row.gap>0);assert.equal(row.withdrawals,0);
});
test('dividends and sale proceeds cannot create assets or be counted as earned income', () => {
  const input=householdExample();input.incomes.push({id:'div',label:'Dividend',type:'dividend',owner:'primary',amount:1000,frequency:'year',startAge:57,endAge:90,growth:0});
  const base=simulateHousehold(householdExample()).rows[0], row=simulateHousehold(input).rows[0];
  assert.equal(row.income,base.income);assert.equal(row.releasedFromInvestments,1000);assert.equal(row.sources.assetRelease,0);assert.equal(row.closingAssets,base.closingAssets);
});
test('additional pension saving is funded from surplus, not created from nothing', () => {
  const input=householdExample();const base=simulateHousehold(input).rows[0],row=simulateHousehold(input,{pension:true}).rows[0];
  assert.equal(row.closingAssets,base.closingAssets);assert.ok(row.pensionSaving>0);
  input.incomes=[];const poor=simulateHousehold(input,{pension:true}).rows[0];assert.equal(poor.pensionSaving,0);assert.ok(poor.unfundedSaving>0);
});
test('downsizing releases net cash while the replacement home remains an asset', () => {
  const input=householdExample();input.settings.downsizeAge=57;
  const row=simulateHousehold(input,{downsize:true}).rows[0];
  assert.ok(row.homeCash>0);assert.ok(row.propertyValue>0);assert.equal(row.settlement, input.debts.filter(d=>d.type==='mortgage').reduce((s,d)=>s+d.balance*(1+d.rate/100),0));
  assert.ok(row.propertyChange<0);
});
test('one-off expense happens once and errors cannot silently turn unknown balances into zero', () => {
  const input=householdExample();input.expenses.push({id:'once',label:'Family gift',type:'oneoff',owner:'primary',amount:12345,frequency:'once',startAge:60,endAge:60,growth:0});
  const rows=simulateHousehold(input).rows;assert.equal(rows.filter(r=>Math.abs(r.oneOff-12345*1.02**3)<0.01).length,1);
  input.assets[0].balance=null;assert.throws(()=>simulateHousehold(input),/Complete/);
});

test('pension saving follows ownership and caps combined part-time salaries', () => {
  const input=householdExample();input.assets.forEach(a=>a.rate=0);input.debts=[];input.expenses=input.expenses.filter(r=>r.type==='saving');
  const base=simulateHousehold(input).rows[0];
  // £12,600 is transferred to the pension pots, leaving earned income in cash.
  assert.equal(base.pensionSaving,12600);assert.equal(base.additions,66000);assert.equal(base.pensionSavingByOwner.primary,8400);assert.equal(base.pensionSavingByOwner.partner,4200);
  const varied=householdExample();varied.incomes.push({...varied.incomes[0],id:'salary-two'});varied.settings.earlyPrimary=57;
  const row=simulateHousehold(varied,{parttime:true}).rows[0];assert.equal(row.sources.salary,15000+24000);
});
test('inflation changes spending without inventing extra earnings; past work/pension dates remain usable', () => {
  const low=householdExample(),high=householdExample();high.inflation=4;
  const a=simulateHousehold(low).rows[1],b=simulateHousehold(high).rows[1];
  assert.equal(a.income,b.income);assert.ok(Math.abs(b.spending-a.spending-33600*.02)<.001);
  const retired=householdExample();retired.people[0].age=70;const row=simulateHousehold(retired).rows[0];
  assert.equal(row.sources.salary,24000);assert.equal(row.sources.state,10000);
});

test('a dated cost cannot silently disappear outside the forecast or between annual age steps', () => {
  const input=householdExample();input.expenses.push({id:'late',label:'School fees',type:'oneoff',owner:'primary',amount:1000,frequency:'once',startAge:100,endAge:100,growth:0});
  assert.throws(()=>simulateHousehold(input),/outside/);input.expenses.at(-1).startAge=60.5;input.expenses.at(-1).endAge=60.5;
  assert.throws(()=>simulateHousehold(input),/whole ages/);input.expenses.pop();input.people[0].horizonAge=90.5;assert.throws(()=>simulateHousehold(input),/whole ages/);
});
