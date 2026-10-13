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

test('dated spending replaces the budget without duplicating it; ongoing has no artificial end',()=>{
 const input=householdExample();input.debts=[];input.inflation=0;
 input.expenses=[{id:'budget',label:'Budget',type:'regular',owner:'primary',amount:100,frequency:'month',startAge:57,endAge:58,ongoing:true,growth:0,changes:[{age:60,amount:50}]}];
 const model=simulateHousehold(input);
 assert.equal(model.rows.find(r=>r.primaryAge===59).spending,1200);
 assert.equal(model.rows.find(r=>r.primaryAge===60).spending,600);
 assert.equal(model.final.spending,600);
 input.expenses[0].changes[0].age=60.5;assert.throws(()=>simulateHousehold(input),/whole/);
});
test('debt payoff dates reflect funded payments and do not forgive unpaid balances',()=>{
 const input=householdExample();const model=simulateHousehold(input);
 const paid=model.rows.find(r=>r.debtBalances['car-loan']<0.01);
 assert.ok(paid);assert.ok(model.events.some(e=>e.label==='Car finance ends'&&e.age===paid.primaryAge));
 input.assets.forEach(a=>a.balance=0);input.incomes=[];
 const unfunded=simulateHousehold(input);
 assert.ok(unfunded.final.debtBalances['car-loan']>8000);
 assert.ok(!unfunded.events.some(e=>e.label==='Car finance ends'));
});
test('changed budgets keep inflation growth and dated ends',()=>{
 const input=householdExample();input.debts=[];input.expenses=[{id:'budget',label:'Budget',type:'regular',owner:'primary',amount:100,frequency:'year',startAge:57,endAge:62,growth:1,changes:[{age:60,amount:50}]}];
 const model=simulateHousehold(input);
 assert.ok(Math.abs(model.rows[2].spending-100*1.03**2)<1e-8);
 assert.ok(Math.abs(model.rows[3].spending-50*1.03**3)<1e-8);
 assert.equal(model.rows[5].spending,0);
 assert.ok(model.events.some(e=>e.age===60&&e.label==='Budget changes'));
});

test('frequency conversion preserves current and future budgets through repeated switches',async()=>{
 const {convertStreamFrequency}=await import('../prototype/retirement-household.mjs');
 const input=householdExample();input.expenses[0].changes=[{age:67,amount:2400},{age:80,amount:2000}];const before=simulateHousehold(input);
 for(let i=0;i<4;i++){convertStreamFrequency(input.expenses[0],'year');convertStreamFrequency(input.expenses[0],'month');}
 convertStreamFrequency(input.expenses[0],'year');const after=simulateHousehold(input);
 before.rows.forEach((r,i)=>assert.ok(Math.abs(r.spending-after.rows[i].spending)<1e-7));
});
test('target debt end derives a payment but unfunded debt survives that year',async()=>{
 const {paymentForDebtEnd}=await import('../prototype/retirement-household.mjs');
 const input=householdExample();input.debts=[{id:'loan',label:'Loan',type:'loan',balance:12000,rate:5,payment:paymentForDebtEnd(12000,5,3)}];
 const model=simulateHousehold(input);assert.ok(model.rows[1].debtBalances.loan>0);assert.ok(model.rows[2].debtBalances.loan<.01);
 assert.equal(paymentForDebtEnd(12000,0,2),500);
 input.assets.forEach(a=>a.balance=0);input.incomes=[];assert.ok(simulateHousehold(input).rows[2].debtBalances.loan>12000);
 assert.throws(()=>paymentForDebtEnd(12000,5,0));
});

test('retirement living target starts after both work-end dates and replaces the everyday budget',()=>{
 const input=householdExample();input.debts=[];input.incomes=[];input.people[0].retireAge=58;input.people[1].retireAge=57;
 const living=input.expenses.find(r=>r.id==='living');living.growth=1;living.changes=[{age:59,amount:9000}];
 input.retirementBudget={monthly:5000,expenseId:'living'};
 const target=simulateHousehold(input);
 assert.equal(target.retirementStartYear,2028);
 assert.equal(target.rows[1].retirementLivingTarget,0);
 assert.ok(Math.abs(target.rows[1].spending-(2800*12*1.03+400*12))<.01);
 const retired=target.rows[2],expected=5000*12*1.03**2;
 assert.ok(Math.abs(retired.retirementLivingTarget-expected)<.01);
 assert.ok(Math.abs(retired.spendingByCategory.living-expected)<.01);
 assert.ok(Math.abs(retired.spending-(expected+400*12))<.01);
 const unchanged=structuredClone(input);delete unchanged.retirementBudget;unchanged.expenses.find(r=>r.id==='living').changes=[];
 const base=simulateHousehold(unchanged).rows[2];
 assert.ok(retired.withdrawals>base.withdrawals);
 assert.ok(retired.closingAssets<base.closingAssets);
});

test('temporary redundancy does not start a retirement target; permanent redundancy waits for a full year',()=>{
 const input=householdExample();input.retirementBudget={monthly:5000,expenseId:'living'};
 input.employment=[{owner:'primary',year:2027,month:7,severance:0,returnYears:2},{owner:'partner',year:2029,month:7,severance:0,returnYears:2}];
 const temporary=simulateHousehold(input,{job:true,jobPartner:true});
 assert.equal(temporary.retirementStartYear,2038);
 assert.equal(temporary.rows.find(r=>r.year===2030).retirementLivingTarget,0);
 input.employment.forEach(e=>e.returnYears=0);
 const permanent=simulateHousehold(input,{job:true,jobPartner:true});
 assert.equal(permanent.retirementStartYear,2030);
 assert.equal(permanent.rows.find(r=>r.year===2029).retirementLivingTarget,0);
 assert.ok(permanent.rows.find(r=>r.year===2030).retirementLivingTarget>0);
 assert.equal(simulateHousehold(input,{job:true}).retirementStartYear,2038);
});

test('retirement target requires a valid monthly amount and regular expense id',()=>{
 const input=householdExample();input.retirementBudget={monthly:-1,expenseId:'living'};
 assert.throws(()=>simulateHousehold(input),/retirement.*monthly/i);
 input.retirementBudget.monthly=Infinity;assert.throws(()=>simulateHousehold(input),/retirement.*monthly/i);
 input.retirementBudget.monthly=4000;input.retirementBudget.expenseId='missing';
 assert.throws(()=>simulateHousehold(input),/regular.*expense/i);
 input.retirementBudget.expenseId='lease';assert.throws(()=>simulateHousehold(input),/regular.*expense/i);
});
