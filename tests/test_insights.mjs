import test from 'node:test';
import assert from 'node:assert/strict';
import {buildInsights,insightScenario,createInsightPreview,insightSourceKey,insightSummary,validateInsightSettings,INSIGHT_RECIPES} from '../prototype/insights.mjs';
import {projectPlan} from '../prototype/planning.mjs';
import {createBlankMonthlyFlow,createExampleMonthlyFlow} from '../prototype/monthly-flow.mjs';
import {createPublicDemoHousehold} from '../prototype/asset-ledger.mjs';
import {validatePicture} from '../prototype/picture-storage.mjs';
const setup=()=>{
 const flow=createBlankMonthlyFlow();flow.asOfMonth=flow.timelineStartMonth='2026-04';flow.pay.primary.annualGross=36000;flow.pay.primary.endDate='2028-12';flow.spending.everyday=1000;
 const holdings={name:'Test',age:60,assets:[{id:'c',kind:'cash',value:30000},{id:'p',kind:'dc-pension',value:100000}],debts:[]};
 const scenario={years:8,inflation:2,incomeGrowth:0,retirementYears:{primary:2028},growth:{cash:0,isa:0,pension:0,property:0,shares:0}};
 return {flow,holdings,scenario};
};
test('previews never mutate household or current scenario, and keep the same horizon and money basis',()=>{
 const {flow,holdings,scenario}=setup(),before=JSON.stringify({flow,holdings,scenario});
 const trial=createInsightPreview(flow,holdings,scenario,'retireLater');
 assert.equal(trial.scenario.retirementYears.primary,2029);assert.equal(trial.before.endMonth,trial.after.endMonth);assert.equal(JSON.stringify({flow,holdings,scenario}),before);
 assert.equal(trial.sourceKey,insightSourceKey(flow,holdings,scenario));assert.ok(trial.delta.netAssets>0);
});
test('5% retirement spending experiment scales subsequent phases and preserves separate costs/debt',()=>{
 const {flow,holdings,scenario}=setup();scenario.spendingChanges=[{year:2027,percent:120},{year:2030,percent:80}];
 flow.datedEntries.push({id:'fee',side:'spending',label:'Separate',amount:100,frequency:'monthly',startMonth:'2029-01',endMonth:''});
 const next=insightScenario(flow,holdings,scenario,'spendLess');assert.deepEqual(next.spendingChanges,[{year:2027,percent:120},{year:2029,percent:114},{year:2030,percent:76}]);
 const old=projectPlan(flow,holdings,scenario),trial=projectPlan(flow,holdings,next);const index=old.months.findIndex(m=>m.month==='2029-01');
 assert.equal(old.months[index].debtPayment,trial.months[index].debtPayment);assert.ok(trial.months[index].householdSpending<old.months[index].householdSpending);
});
test('retired household spending experiment begins now, without inventing future employment',()=>{
 const {flow,holdings,scenario}=setup();flow.pay.primary.annualGross=0;const next=insightScenario(flow,holdings,scenario,'spendLess');assert.equal(next.spendingChanges[0].year,2026);
 assert.throws(()=>insightScenario(flow,holdings,scenario,'retireLater'),/employment/);
});
test('missing repayments and funding gaps rank ahead of opportunities, with at most three cards',()=>{
 const {flow,holdings,scenario}=setup();flow.pay.primary.annualGross=0;flow.spending.everyday=50000;holdings.debts=[{id:'loan',kind:'loan',balance:20000}];
 const p=projectPlan(flow,holdings,scenario),insights=buildInsights(flow,holdings,scenario,p);
 assert.equal(insights.cards[0].id,'debt-details');assert.equal(insights.cards[1].id,'funding-gap');assert.ok(insights.cards.length<=3);assert.equal(insightSummary(p).incomplete,true);
});
test('actual-take-home tax unknowns remain flagged in comparisons',()=>{
 const {flow,holdings,scenario}=setup();flow.pay.primary.annualTakeHome=24000;
 const result=createInsightPreview(flow,holdings,scenario,'spendLess');assert.equal(result.before.incomplete,true);assert.ok(result.warnings.some(w=>w.includes('take-home')));
});
test('shock, withdrawal order and mortgage experiments change only supported assumptions',()=>{
 const {flow,holdings,scenario}=setup();assert.equal(insightScenario(flow,holdings,scenario,'stress').retirementStress,true);
 assert.equal(insightScenario(flow,holdings,scenario,'withdrawalOrder').withdrawalOrder,'isaFirst');
 holdings.debts=[{id:'m',kind:'mortgage',balance:10000,interestRate:0,remainingYears:5}];const trial=createInsightPreview(flow,holdings,scenario,'mortgagePayoff');
 assert.equal(trial.scenario.mortgagePayoffSource,'cashShares');assert.equal(trial.payoff.paid,10000);
 assert.throws(()=>insightScenario(flow,holdings,{...scenario,retirementStress:true},'stress'),/already/);
 assert.throws(()=>insightScenario(flow,holdings,scenario,'unknown'),/supported/);
});
test('summary tax discounts each monthly flow once and source keys invalidate changed inputs',()=>{
 const {flow,holdings,scenario}=setup(),p=projectPlan(flow,holdings,scenario),summary=insightSummary(p);
 assert.equal(summary.tax,p.months.reduce((sum,m)=>sum+m.taxTotal/m.deflator,0));
 const key=insightSourceKey(flow,holdings,scenario);flow.spending.everyday++;assert.notEqual(key,insightSourceKey(flow,holdings,scenario));
});
test('goals reorder experiments, settings save with household versions, and invalid goals fail closed',()=>{
 const flow=createExampleMonthlyFlow(),holdings=createPublicDemoHousehold(),scenario={years:1,retirementYears:{primary:2054,partner:2056}};
 const p=projectPlan(flow,holdings,scenario),insights=buildInsights(flow,holdings,scenario,p,'legacy');assert.ok(insights.available.includes('withdrawalOrder'));assert.ok(insights.cards.some(c=>c.recipe==='withdrawalOrder'));
 const picture={version:1,holdings,flow,planning:{scenario,metric:'income',group:'person',style:'bars',real:true},insights:{version:1,goal:'legacy'}};
 assert.deepEqual(validatePicture(picture).insights,picture.insights);assert.throws(()=>validateInsightSettings({version:1,goal:'guaranteed'}),/Insights/);assert.equal(Object.keys(INSIGHT_RECIPES).length,6);
});
