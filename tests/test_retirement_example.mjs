import test from 'node:test';
import assert from 'node:assert/strict';
import { householdBaseExample } from '../prototype/retirement-example.mjs';
import { simulateHousehold, openingPicture, convertStreamFrequency } from '../prototype/retirement-household.mjs';

test('base household owns separate accounts and home equity is not double-subtracted',()=>{
 const i=householdBaseExample();assert.equal(i.people[0].age,43);assert.equal(i.people[1].age,42);
 assert.equal(i.assets.find(a=>a.id==='home').balance-i.debts[0].balance,400000);
 assert.equal(i.assets.find(a=>a.id==='alex-pot').balance,490000);
 const available=openingPicture(i).accessible;
 assert.equal(available,230000+160000+160000+150000);
});
test('one-off income happens once; net, excluded and estimated tax bases are explicit',()=>{
 const i=householdBaseExample();i.incomes=[{id:'gift',label:'Gift',type:'other',owner:'primary',amount:100000,frequency:'once',startAge:53,endAge:53,growth:0,taxBasis:'estimate',taxRate:20}];
 let m=simulateHousehold(i);assert.equal(m.rows[10].income,80000);assert.equal(m.rows[11].income,0);assert.equal(m.rows[10].incomeTax,20000);
 i.incomes[0].taxBasis='net';assert.equal(simulateHousehold(i).rows[10].income,100000);
 i.incomes[0].taxBasis='excluded';m=simulateHousehold(i);assert.equal(m.rows[10].income,100000);assert.ok(m.warnings.some(w=>w.includes('Gift')));
});
test('each redundancy prorates wages, March bonuses follow employment and severance happens once',()=>{
 const i=householdBaseExample();i.incomes=i.incomes.filter(r=>['salary','bonus'].includes(r.type));
 i.employment.forEach(e=>{e.taxBasis='net';e.returnYears=0;});
 const m=simulateHousehold(i,{job:true,jobPartner:true});
 const r=m.rows[1];assert.ok(Math.abs(r.sources.salary-(78000*1.01*.5+66000*1.03))<.01);
 assert.ok(Math.abs(r.sources.bonus-(50000*1.01+25000*1.03))<.01);
 assert.equal(r.sources.severance,110000);assert.equal(m.rows[2].sources.severance,0);assert.equal(m.rows[2].sources.bonus,25000*1.03**2);
 assert.equal(m.rows[3].sources.severance,80000);assert.equal(m.rows[4].sources.salary,0);assert.equal(m.rows[4].sources.bonus,0);
});
test('quoted education budgets, inheritance and car purchase occur in their periods',()=>{
 const i=householdBaseExample();i.debts=[];i.expenses=i.expenses.filter(r=>['education','vehicle'].includes(r.type));
 const m=simulateHousehold(i);assert.equal(m.rows[0].spending,20000);assert.equal(m.rows[2].spending,30000);assert.equal(m.rows[3].spending,50000);
 assert.equal(m.rows[7].spending,30000);assert.equal(m.rows[12].spending,0);
 assert.equal(m.rows[3].vehicleValue,20000);assert.ok(m.rows[4].vehicleValue<20000);
 assert.equal(m.rows[10].sources.inheritance,100000);assert.equal(m.rows[11].sources.inheritance,0);
});
test('vesting shares stay inaccessible until their date and disposal does not create wealth',()=>{
 const i=householdBaseExample();const b=openingPicture(i);assert.equal(b.accessible,700000);
 const m=simulateHousehold(i);assert.ok(m.rows[1].accessible>m.rows[0].accessible);
 i.incomes=[];i.debts=[];i.expenses=[];i.assets.forEach(a=>a.rate=0);
 const locked=i.assets.find(a=>a.id==='employer');i.assets=i.assets.filter(a=>a.id==='cash'||a===locked);i.assets[0].balance=0;
 i.expenses=[{id:'cost',label:'Cost',type:'regular',owner:'primary',amount:12000,frequency:'year',startAge:43,endAge:44,growth:0}];
 assert.equal(simulateHousehold(i).rows[0].withdrawals,0);
});
test('frequency preserves tax estimates and future budgets; protected fees resist spend-less',()=>{
 const i=householdBaseExample();const before=simulateHousehold(i);for(const r of i.incomes.filter(r=>r.frequency!=='once'))convertStreamFrequency(r,r.frequency==='month'?'year':'month');
 const after=simulateHousehold(i);before.rows.forEach((r,n)=>assert.ok(Math.abs(r.income-after.rows[n].income)<1e-6));
 i.expenses=i.expenses.filter(r=>r.type==='education');i.debts=[];const a=simulateHousehold(i),b=simulateHousehold(i,{spend:true});a.rows.forEach((r,n)=>assert.equal(r.spending,b.rows[n].spending));
});
test('owner withdrawal policy and yearly ceiling reveal unfunded spending without forgiving debt',()=>{
 const i=householdBaseExample();i.incomes=[];i.debts=[];i.assets.forEach(a=>a.rate=0);i.expenses=[{id:'cost',label:'Cost',type:'regular',owner:'primary',amount:50000,frequency:'year',startAge:43,endAge:110,ongoing:true,growth:0}];i.inflation=0;
 i.withdrawal={owner:'partner',order:'cash-first',maxPercent:1};
 const m=simulateHousehold(i);assert.ok(m.rows[0].gap>0);assert.equal(m.rows[0].withdrawalsByOwner.primary,0);assert.ok(m.rows[0].withdrawalsByOwner.partner>0);assert.ok(m.rows[0].withdrawals<50000);
});
test('new example reconciles all ledger flows across employment, withdrawals and tax assumptions',()=>{
 for(const actions of [{},{job:true,jobPartner:true},{parttime:true,parttimePartner:true},{downsize:true},{market:true}]){
  const m=simulateHousehold(householdBaseExample(),actions);for(const r of m.rows){assert.ok(Math.abs(r.openingAssets+r.growth+r.additions-r.withdrawals-r.marketLoss+r.propertyChange+r.assetPurchased-r.closingAssets)<.1,`asset reconciliation ${r.year}`);assert.ok(Math.abs(r.openingDebt+r.debtInterest-r.debtPaid-r.settlement-r.closingDebt)<.1);}
 }
});

test('monthly mortgage pays down over its 21-year term and unpaid interest stays owed',()=>{
 const i=householdBaseExample();const m=simulateHousehold(i);assert.ok(m.rows[19].debtBalances.mortgage>0);assert.ok(m.rows[20].debtBalances.mortgage<.01);
 i.incomes=[];i.assets.forEach(a=>a.balance=0);const bad=simulateHousehold(i);assert.ok(bad.rows[0].debtBalances.mortgage>383000);assert.equal(bad.rows[0].debtPaid,0);
});
test('part-time income is scaled before partial-year redundancy; March bonus follows chosen days',()=>{
 const i=householdBaseExample();i.settings.earlyPrimary=43;i.settings.partTimeDaysPrimary=3;i.incomes=i.incomes.filter(r=>r.owner==='primary'&&['salary','bonus'].includes(r.type));
 const r=simulateHousehold(i,{parttime:true,job:true}).rows[1];assert.ok(Math.abs(r.sources.salary-78000*1.01*.6*.5)<.01);assert.ok(Math.abs(r.sources.bonus-50000*1.01*.6)<.01);
});
test('deduction estimates require extra gross withdrawals and account transfers preserve ownership',()=>{
 const i=householdBaseExample();i.incomes=[];i.debts=[];i.expenses=[{id:'cost',label:'Cost',type:'regular',owner:'primary',amount:10000,frequency:'year',startAge:43,endAge:44,growth:0}];i.assets.forEach(a=>a.rate=0);i.assets.find(a=>a.id==='cash').withdrawalTaxBasis='estimate';i.assets.find(a=>a.id==='cash').withdrawalTaxRate=20;
 const r=simulateHousehold(i).rows[0];assert.equal(r.withdrawals,12500);assert.equal(r.withdrawalTax,2500);assert.equal(r.gap,0);
 i.allocation.year=2026;const m=simulateHousehold(i,{allocate:true});assert.equal(m.rows[0].transfer,40000);assert.ok(Math.abs(m.rows[0].openingAssets+m.rows[0].growth+m.rows[0].additions-m.rows[0].withdrawals-m.rows[0].closingAssets)<.01);
 i.allocation.toId='jemma-isa';assert.throws(()=>simulateHousehold(i,{allocate:true}),/same person/);
});
test('sale deductions leave the portfolio once and cannot create income',()=>{
 const i=householdBaseExample();i.expenses=[];i.debts=[];i.assets.forEach(a=>a.rate=0);i.incomes=[{id:'sale',label:'Sale',type:'sale',owner:'primary',assetId:'trading',amount:10000,frequency:'once',startAge:43,endAge:43,growth:0,taxBasis:'estimate',taxRate:20}];
 const r=simulateHousehold(i).rows[0];assert.equal(r.income,0);assert.equal(r.releasedFromInvestments,8000);assert.equal(r.incomeTax,2000);assert.equal(r.withdrawals,2000);assert.equal(r.closingAssets,r.openingAssets-2000);
});

test('retiring before redundancy cannot manufacture later severance',()=>{
 const i=householdBaseExample();i.settings.earlyPrimary=43;i.settings.earlyPartner=42;const m=simulateHousehold(i,{early:true,job:true,jobPartner:true});
 assert.equal(m.rows.reduce((s,r)=>s+r.sources.severance,0),0);
});
test('mortgage payoff respects selected owner, ceiling and withdrawal deductions',()=>{
 const i=householdBaseExample();i.settings.payoffAge=43;i.withdrawal={owner:'partner',order:'cash-first',maxPercent:0};assert.throws(()=>simulateHousehold(i,{payoff:true}),/selected|ceiling/);
 i.withdrawal.maxPercent=100;assert.throws(()=>simulateHousehold(i,{payoff:true}),/selected|ceiling/);
 i.withdrawal.owner='household';const m=simulateHousehold(i,{payoff:true});assert.equal(m.rows[0].debtBalances.mortgage,0);assert.ok(m.rows[0].withdrawalsByOwner.primary>0);
});

test('a release into Alex cash cannot be claimed as funding withdrawn from Jemma',()=>{
 const i=householdBaseExample();i.debts=[];i.assets.forEach(a=>a.rate=0);i.withdrawal.owner='partner';i.incomes=[{id:'sale',label:'Alex sale',type:'sale',owner:'primary',assetId:'trading',amount:10000,frequency:'once',startAge:43,endAge:43,growth:0,taxBasis:'net'}];i.expenses=[{id:'cost',label:'Cost',type:'regular',owner:'primary',amount:10000,frequency:'year',startAge:43,endAge:44,growth:0}];
 const r=simulateHousehold(i).rows[0];assert.equal(r.releasedFromInvestments,10000);assert.equal(r.sources.assetRelease,0);assert.equal(r.sources.withdrawals,10000);assert.equal(r.withdrawalsByOwner.primary,0);
});

test('a replacement job starts in the return month at its declared pay percentage',()=>{
 const i=householdBaseExample();i.incomes=i.incomes.filter(r=>r.id==='salary-a');i.employment[0].returnYears=1;i.employment[0].returnPayPercent=80;
 const m=simulateHousehold(i,{job:true});assert.ok(Math.abs(m.rows[2].sources.salary-78000*1.01**2*.5*.8)<.01);assert.ok(Math.abs(m.rows[3].sources.salary-78000*1.01**3*.8)<.01);
});
