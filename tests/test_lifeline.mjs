import test from 'node:test';
import assert from 'node:assert/strict';
import {createPublicDemoHousehold} from '../prototype/asset-ledger.mjs';
import {createExampleMonthlyFlow} from '../prototype/monthly-flow.mjs';
import {appendBaselineVersion} from '../prototype/baseline-history.mjs';
import {appendTrackingUpdate} from '../prototype/tracking.mjs';
import {validatePicture} from '../prototype/picture-storage.mjs';
import {createLifelineModel,lifelineSeries,lifelinePeriod,lifelineWindow,validateLifelineSettings,lifelineValue,lifelineBreakdown,lifelineCumulativeTax} from '../prototype/lifeline.mjs';
const picture=()=>({version:1,example:false,holdings:createPublicDemoHousehold(),flow:{...createExampleMonthlyFlow(),asOfMonth:'2026-10',timelineStartMonth:'2026-10'},planning:{scenario:{years:3,retirementYears:{primary:2027,partner:2028}},metric:'income',group:'person',style:'bars',real:true,selectedYear:null}});
const baseline=p=>appendBaselineVersion(p,{id:'reference-one',startDate:'2026-01-01',createdAt:'2026-10-25T12:00:00.000Z'});
test('first baseline and current path coincide on the same opening basis, without mutating saved inputs',()=>{
 const p=baseline(picture()),before=structuredClone(p),m=createLifelineModel(p,{today:'2026-10-25'});
 assert.equal(m.current.startMonth,'2026-01');assert.equal(m.reference.id,'reference-one');
 for(const row of m.current.months){const frozen=m.referenceMonths.find(x=>x.month===row.month);assert.equal(row.assetsTotal,frozen.assetsTotal);assert.equal(row.incomeTotal,frozen.incomeTotal);}
 assert.deepEqual(p,before);
});
test('selecting another archived baseline cannot change the current projection or recalculate archived results',()=>{
 let p=baseline(picture());p.holdings.assets[0].value+=10000;p=appendBaselineVersion(p,{id:'reference-two',startDate:'2026-09-01',createdAt:'2026-10-25T12:00:00.000Z'});
 const before=structuredClone(p.baselines),a=createLifelineModel(p,{today:'2026-10-25',baselineId:'reference-one'}),b=createLifelineModel(p,{today:'2026-10-25',baselineId:'reference-two'});
 assert.deepEqual(a.current,b.current);assert.notEqual(a.referenceMonths[0].month,b.referenceMonths[0].month);assert.deepEqual(p.baselines,before);
});
test('personal households without a baseline show no invented reference',()=>{
 const m=createLifelineModel(picture(),{today:'2026-10-25'});assert.equal(m.reference,null);assert.deepEqual(m.referenceMonths,[]);
});
test('annual flows sum months, balances use closing stocks and partial years retain their coverage',()=>{
 const m=createLifelineModel(picture(),{today:'2026-10-25'}),rows=lifelineSeries(m.current.months,{view:'life',metric:'income',real:false,basisMonth:'2026-10',inflation:2});
 assert.equal(rows[0].months,3);assert.equal(rows[0].value,Math.round(m.current.months.slice(0,3).reduce((s,r)=>s+r.incomeTotal,0)*100)/100);
 const wealth=lifelineSeries(m.current.months,{view:'life',metric:'netWorth',real:false,basisMonth:'2026-10',inflation:2});assert.equal(wealth[0].value,m.current.months[2].assetsTotal-m.current.months[2].debtsTotal);
});
test('both paths use one purchasing-power basis, regardless of their original inflation anchors',()=>{
 const opts={metric:'netWorth',real:true,basisMonth:'2026-10',inflation:3},row={month:'2027-03',assetsTotal:200000,debtsTotal:50000,deflator:999};
 const value=lifelineValue(row,opts);assert.ok(Math.abs(value-150000/1.03**(6/12))<.001);assert.equal(lifelineValue({...row,deflator:1},opts),value);
});
test('year and tax-year zoom have explicit windows; date inspection uses the existing monthly row',()=>{
 assert.deepEqual(lifelineWindow('year','2027-02','2026-01','2029-12','taxYear'),{startMonth:'2026-04',endMonth:'2027-03'});
 const m=createLifelineModel(baseline(picture()),{today:'2026-10-25'}),p=lifelinePeriod(m,'2026-06',{view:'month',real:false});
 assert.equal(p.current.months,1);assert.equal(p.current.endMonth,'2026-06');assert.equal(p.reference.endMonth,'2026-06');assert.equal(p.comparable,true);
 const previous=m.current.months.find(row=>row.month==='2026-05');assert.equal(p.current.openingNetWorth,Math.round((previous.assetsTotal-previous.debtsTotal)*100)/100);
 const first=lifelinePeriod(m,'2026-01',{view:'month',real:false});assert.equal(first.current.openingNetWorth,m.current.opening.assetsTotal-m.current.opening.debtsTotal);
});
test('recorded events keep their true dates and recorded balances do not imply a fully observed household total',()=>{
 const p=baseline(picture()),next=structuredClone(p);next.holdings.assets.find(a=>a.id==='demo-sam-pension').value=90000;
 const tracked=appendTrackingUpdate(p,next,{id:'statement',effectiveDate:'2026-06-15',recordedAt:'2026-10-25T12:00:00.000Z',label:'Pension statement',startMonth:'2026-01'}),m=createLifelineModel(tracked,{today:'2026-10-25'});
 assert.ok(m.events.some(e=>e.kind==='recorded'&&e.date==='2026-06-15'));
 const period=lifelinePeriod(m,'2026-06',{view:'month',real:false});assert.equal(period.recorded.length,1);assert.equal(period.current.estimated,true);assert.equal(period.current.rows[0].estateAssets.find(a=>a.id==='demo-sam-pension').value,90000);
});
test('different coverage is not reported as an improvement or a numeric comparable delta',()=>{
 const p=baseline(picture());const m=createLifelineModel(p,{today:'2026-10-25'});m.referenceMonths=m.referenceMonths.filter(r=>r.month>='2026-06');
 assert.equal(lifelinePeriod(m,'2026-07',{view:'life',real:false}).comparable,false);
 assert.equal(lifelinePeriod(m,'2026-07',{view:'month',real:false}).comparable,true);
});
test('Lifeline preferences survive account documents and reject unsafe or unsupported settings',()=>{
 const p=baseline(picture());p.lifeline={version:1,view:'year',metric:'tax',real:true,yearBasis:'taxYear',selectedMonth:'2027-02',selectedDate:'2027-02-15',baselineId:'reference-one'};
 assert.deepEqual(validatePicture(p).lifeline,p.lifeline);
 assert.throws(()=>validateLifelineSettings({...p.lifeline,view:'day'}));assert.throws(()=>validateLifelineSettings({...p.lifeline,selectedDate:'2027-02-30'}));assert.throws(()=>validateLifelineSettings({...p.lifeline,unknown:true}));
});
test('funding, savings and current breakdowns reconcile with the same monthly projection',()=>{
 const p=baseline(picture());p.flow.spending.everyday=20000;const model=createLifelineModel(p,{today:'2026-10-25'}),opts={view:'life',real:false};
 const period=lifelinePeriod(model,'2026-12',opts).current,rows=period.rows;
 assert.equal(period.funding,Math.round((period.income+period.withdrawalNet)*100)/100);
 assert.equal(period.saving,Math.round(rows.reduce((sum,r)=>sum+Math.max(0,r.remainder),0)*100)/100);
 for(const metric of ['income','funding','saving','netWorth','assets','debts','tax','spending'])for(const group of ['person','type']){
  const sum=lifelineBreakdown(model,'2026-12',{...opts,metric,group}).reduce((sum,r)=>sum+r.value,0);
  assert.ok(Math.abs(sum-period[metric])<.05,`${metric}/${group}: ${sum} matches ${period[metric]}`);
 }
});
test('cumulative tax components add only elapsed modelled months in the selected money basis',()=>{
 const model=createLifelineModel(picture(),{today:'2026-10-25'}),components=lifelineCumulativeTax(model,'2027-03',{real:false});
 const expected=model.current.months.filter(r=>r.month<='2027-03').reduce((sum,r)=>sum+r.taxTotal,0);
 assert.ok(Math.abs(Object.values(components).reduce((s,n)=>s+n,0)-expected)<.03);
});
test('positive saving breakdowns reconcile by person and destination without counting contributions twice',()=>{
 const model=createLifelineModel(picture(),{today:'2026-10-25'}),opts={view:'life',real:false},value=lifelinePeriod(model,'2026-12',opts).current.saving;
 assert.ok(value>0);for(const group of ['person','type'])assert.ok(Math.abs(lifelineBreakdown(model,'2026-12',{...opts,metric:'saving',group}).reduce((s,r)=>s+r.value,0)-value)<.03);
});
