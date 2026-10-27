import test from 'node:test';
import assert from 'node:assert/strict';
import {goalCheckpoint,buildPlanReview,isaSubscriptionChecks,completePlanReview,validateReviewHistory,nextReviewDate,validatePlanGoal} from '../prototype/plan-review.mjs';
import {createPublicDemoHousehold} from '../prototype/asset-ledger.mjs';
import {createExampleMonthlyFlow} from '../prototype/monthly-flow.mjs';
import {projectPlan} from '../prototype/planning.mjs';
import {appendBaselineVersion} from '../prototype/baseline-history.mjs';
const projection=()=>({startMonth:'2026-10',endMonth:'2027-10',assumptions:{inflation:0},retirementDates:{primary:'2027-06',partner:'2027-10'},months:Array.from({length:13},(_,i)=>({month:new Date(Date.UTC(2026,9+i,1)).toISOString().slice(0,7),assetsTotal:100000+i*1000,debtsTotal:20000,withdrawableAssets:40000+i*1000,assetsByType:{cash:15000},householdSpending:2000,spendingTotal:2500,unfunded:i===8?100:0,deflator:99})),firstUnfundedMonth:'2027-06',unmodelledDebt:0,taxLimitations:[]});
test('goal checkpoints use an explicit common price date, reserve and exact selected month',()=>{
 const p=projection(),g={type:'event',person:'household',targetMonth:'2027-01',targetAmount:30000};
 const r=goalCheckpoint(g,p,{basisMonth:'2026-10',inflation:0,reserveMonths:6});
 assert.equal(r.value,43000);assert.equal(r.difference,13000);assert.equal(r.reserve,15000);assert.equal(r.cash,15000);assert.equal(r.unfunded,100);
 const inflated=goalCheckpoint(g,p,{basisMonth:'2026-10',inflation:12,reserveMonths:6});assert.ok(Math.abs(inflated.value-43000/(1.12**(4/12)))<.01);
 assert.equal(p.months[3].deflator,99,'Stored per-path deflators are never used for a common-date comparison');
});
test('outside dates and blank targets stay unavailable; a deliberate zero target stays known',()=>{
 const p=projection(),g={type:'legacy',targetMonth:'2050-01',targetAmount:0};
 assert.equal(goalCheckpoint(g,p,{basisMonth:'2026-10'}).status,'outside');
 assert.equal(goalCheckpoint({...g,targetMonth:'2027-01',targetAmount:null},p,{basisMonth:'2026-10'}).status,'missing');
 assert.equal(goalCheckpoint({...g,targetMonth:'2027-01'},p,{basisMonth:'2026-10'}).target,0);
 assert.throws(()=>validatePlanGoal({type:'event',targetMonth:'2026-13',targetAmount:3}));
 assert.throws(()=>validatePlanGoal({type:'event',targetMonth:'2026-12',name:'Private goal'}));
});
test('spending measures disclose partial coverage and retirement timing does not claim affordability',()=>{
 const p=projection(),s=goalCheckpoint({type:'spending',targetMonth:'2027-06',targetMonthly:1800},p,{basisMonth:'2026-10',inflation:0});
 assert.equal(s.value,2000);assert.equal(s.months,5);assert.equal(s.difference,200);
 const r=goalCheckpoint({type:'retireBy',person:'household',targetMonth:'2027-08'},p,{basisMonth:'2026-10',inflation:0});
 assert.equal(r.value,2);assert.equal(r.firstGap,'2027-06');assert.equal(r.metric,'retirement');
});
test('ISA checks distinguish unknown, explicit zero, stale years and 5/6 April',()=>{
 const flow=createExampleMonthlyFlow();flow.timelineStartMonth='2026-10';flow.assumptions.isaUsedPrimary=0;flow.assumptions.isaUsedPartner=null;
 const a=isaSubscriptionChecks(flow,true,'2027-04-05');assert.equal(a[0].remaining,20000);assert.equal(a[1].remaining,null);assert.equal(a[1].status,'unknown');
 const b=isaSubscriptionChecks(flow,true,'2027-04-06');assert.equal(b[0].status,'stale');assert.equal(b[0].remaining,null);
 flow.assumptions.isaUsedPrimary=22000;const c=isaSubscriptionChecks(flow,false,'2026-10-25')[0];assert.equal(c.status,'over');assert.equal(c.remaining,0);
 flow.assumptions.isaAllowance=30000;assert.equal(isaSubscriptionChecks(flow,false,'2026-10-25')[0].limit,20000,'Review uses verified overall rule, not a custom simulation limit');
});
test('review compares archived same-month nominal outputs and does not mutate the baseline',()=>{
 let picture={version:1,example:false,holdings:createPublicDemoHousehold(),flow:createExampleMonthlyFlow(),planning:{scenario:{years:2},metric:'income',group:'person',style:'bars',real:true}};
 picture=appendBaselineVersion(picture,{id:'v1',startDate:'2026-10-01',createdAt:'2026-10-25T12:00:00.000Z'});const archive=JSON.stringify(picture.baselines);
 picture.holdings.assets.find(a=>a.kind==='cash').value+=10000;
 const result=buildPlanReview(picture,{today:'2026-10-25'});assert.equal(result.progress.month,'2026-10');assert.ok(result.progress.difference>0);assert.equal(JSON.stringify(picture.baselines),archive);
 const outside=buildPlanReview(picture,{today:'2035-10-25'});assert.equal(outside.progress.current,null);assert.equal(outside.progress.difference,null);
});
test('reviews persist explicit completion, report changed inputs, and clamp due dates',()=>{
 const picture={version:1,holdings:createPublicDemoHousehold(),flow:createExampleMonthlyFlow(),planning:{scenario:{years:2}},insights:{version:1,goal:'security'}};
 let r=buildPlanReview(picture,{today:'2026-10-25'});assert.equal(r.lastReview,null);
 const history=completePlanReview(null,r,{recordedAt:'2026-10-25T12:00:00.000Z'});validateReviewHistory(history);picture.insights.review=history;
 assert.equal(buildPlanReview(picture,{today:'2026-10-25'}).inputsChanged,false);
 const original=JSON.stringify(picture);picture.flow.asOfMonth='2027-01';assert.equal(buildPlanReview(picture,{today:'2026-10-25'}).inputsChanged,false,'Inspection is not a financial update');
 picture.planning.scenario.inflation=3;assert.equal(buildPlanReview(picture,{today:'2026-10-25'}).inputsChanged,true);
 assert.equal(nextReviewDate('2026-11-30','quarterly'),'2027-02-28');assert.equal(nextReviewDate('2028-02-29','annual'),'2029-02-28');
 assert.throws(()=>validateReviewHistory({...history,notes:'Private'}));assert.equal(completePlanReview(history,r,{recordedAt:'2026-10-25T12:00:00.000Z'}).entries.length,1);
});
