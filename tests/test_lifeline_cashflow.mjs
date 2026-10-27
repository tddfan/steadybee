import test from 'node:test';
import assert from 'node:assert/strict';
import {lifelineCashflowSeries,lifelinePeriodStatus} from '../prototype/lifeline.mjs';
import {lifelineTurningPoints} from '../prototype/lifeline-health.mjs';
const row=(month,income,withdrawals,costs,gap=0)=>({month,incomeTotal:income,withdrawalNet:withdrawals,spendingTotal:costs,unfunded:gap,remainder:income-costs,assetsByType:{cash:100},withdrawableAssets:500,assetsTotal:1000});
const opts={view:'life',real:false,basisMonth:'2026-01',inflation:0};
test('income, assets used and costs are distinct and unpaid costs never become income',()=>{const rows=[row('2026-01',20,30,80,30)],r=lifelineCashflowSeries(rows,opts)[0];assert.equal(r.income,20);assert.equal(r.withdrawals,30);assert.equal(r.moneyIn,50);assert.equal(r.costs,80);assert.equal(r.paid,50);assert.equal(r.shortfall,30);assert.equal(lifelinePeriodStatus(rows).kind,'shortfall');});
test('income-funded and asset-funded periods get different statuses',()=>{assert.equal(lifelinePeriodStatus([row('2026-01',100,0,80)]).kind,'income');assert.equal(lifelinePeriodStatus([row('2026-01',20,60,80)]).kind,'assets');});
test('a surplus elsewhere in the year cannot hide a monthly funding gap',()=>{const rows=[row('2026-01',200,0,100),row('2026-02',0,0,100,100)],r=lifelineCashflowSeries(rows,opts)[0];assert.equal(r.moneyIn,r.costs);assert.equal(r.shortfall,100);assert.equal(r.paid,100);assert.equal(r.shortMonths,1);assert.equal(r.saved,100);assert.equal(lifelinePeriodStatus(rows).kind,'shortfall');});
test('cash-flow bars use common dated prices and preserve partial-year coverage',()=>{const rows=[row('2026-10',120,30,180,30)],r=lifelineCashflowSeries(rows,{...opts,real:true,basisMonth:'2026-09',inflation:12})[0];assert.equal(r.months,1);assert.ok(Math.abs(r.income-120/1.12**(2/12))<.01);assert.ok(Math.abs(r.paid+r.shortfall-r.costs)<.02);});
test('cash depletion, accessible depletion and total asset exhaustion are different events',()=>{
 const months=[{...row('2026-01',0,100,100),assetsByType:{cash:0},withdrawableAssets:900,assetsTotal:10000},{...row('2026-02',0,50,100,50),assetsByType:{cash:0},withdrawableAssets:0,assetsTotal:9000},{...row('2026-03',0,0,100,100),assetsByType:{cash:0},withdrawableAssets:0,assetsTotal:0}],p={startMonth:'2026-01',ages:{primary:60},pensionAccessAge:55,months},h={assets:[{kind:'cash',value:100,owner:'primary'},{kind:'isa',value:1000,owner:'primary'},{kind:'home',value:9000}]};
 const before=JSON.stringify({p,h}),events=lifelineTurningPoints(p,h);assert.equal(events.find(e=>e.kind==='cash').date,'2026-01-31');assert.equal(events.find(e=>e.kind==='depleted').date,'2026-02-28');assert.equal(events.find(e=>e.kind==='exhausted').date,'2026-03-31');assert.equal(events.find(e=>e.kind==='gap').date,'2026-02-01');assert.equal(JSON.stringify({p,h}),before);
});
test('zero opening cash alone is not reported as running out of money',()=>{const p={startMonth:'2026-01',ages:{primary:40},months:[row('2026-01',200,0,100)]};assert.deepEqual(lifelineTurningPoints(p,{assets:[]}),[]);});
test('turning points preserve later recoveries and flag only the first instance of each kind',()=>{
 const h={assets:[{kind:'cash',value:100,owner:'primary'}]},p={startMonth:'2026-01',ages:{primary:40},months:[{...row('2026-01',0,100,100),assetsByType:{cash:0},withdrawableAssets:0,assetsTotal:0},{...row('2026-02',300,0,100),assetsByType:{cash:200},withdrawableAssets:200,assetsTotal:200},{...row('2026-03',0,200,300,100),assetsByType:{cash:0},withdrawableAssets:0,assetsTotal:0}]};
 const events=lifelineTurningPoints(p,h);assert.equal(events.filter(e=>e.kind==='cash').length,1);assert.equal(events.find(e=>e.kind==='gap').date,'2026-03-01');assert.equal(events.find(e=>e.kind==='exhausted').date,'2026-01-31');
});
test('dated balance updates use the true opening cash when locating depletion',async()=>{
 const {createBlankMonthlyFlow}=await import('../prototype/monthly-flow.mjs');
 const {appendTrackingUpdate}=await import('../prototype/tracking.mjs');
 const {createLifelineModel}=await import('../prototype/lifeline.mjs');
 const flow=createBlankMonthlyFlow();flow.asOfMonth='2026-01';flow.timelineStartMonth='2026-01';
 const p={version:1,example:false,holdings:{name:'Fixture',age:40,assets:[{id:'reserve',kind:'cash',owner:'primary',value:1000}],debts:[]},flow,planning:{scenario:{years:1,growth:{cash:0}}}};
 const next=structuredClone(p);next.holdings.assets[0].value=0;
 const tracked=appendTrackingUpdate(p,next,{id:'cash-statement',effectiveDate:'2026-06-15',recordedAt:'2026-06-15T12:00:00.000Z',label:'Cash statement',startMonth:'2026-01'}),before=JSON.stringify(tracked),model=createLifelineModel(tracked,{today:'2026-06-15'});
 assert.equal(model.events.find(e=>e.kind==='cash').date,'2026-06-30');assert.equal(JSON.stringify(tracked),before);
});
