import test from 'node:test';
import assert from 'node:assert/strict';
import {rebasePictureMonth,setRegularBudget} from '../prototype/journey-controls.mjs';
import {createBlankMonthlyFlow} from '../prototype/monthly-flow.mjs';
import {projectPlan} from '../prototype/planning.mjs';

function picture(){
 const flow=createBlankMonthlyFlow();flow.timelineStartMonth=flow.asOfMonth='2026-04';flow.pay.primary.annualGross=24000;flow.pay.primary.endDate='2026-09';flow.spending.everyday=1000;flow.statePensions.primary={mode:'official',qualifyingYears:35,assessmentMonth:'2026-04',startMonth:'2033-04',weeklyForecast:100,otherTaxableIncome:0};
 return {version:1,holdings:{name:'Example',age:60,partnerName:'',assets:[{id:'cash',kind:'cash',value:100000,owner:'primary'}],debts:[{id:'home-loan',kind:'mortgage',balance:50000,interestRate:2,remainingYears:10,owner:'primary'}]},flow,planning:{scenario:{retirementYears:{primary:2026},spendingChanges:[{year:2026,percent:90},{year:2030,percent:80}],planToAge:95},metric:'income',group:'person',style:'bars',real:true}};
}

test('confirmed update advances dates and approximate ages without rewriting absolute events or balances',()=>{
 const original=picture(),before=structuredClone(original),next=rebasePictureMonth(original,'2026-10');
 assert.deepEqual(original,before);assert.equal(next.flow.asOfMonth,'2026-10');assert.equal(next.flow.timelineStartMonth,'2026-10');assert.equal(next.planning.scenario.ages.primary,60.5);assert.equal(next.holdings.age,60);
 assert.equal(next.flow.pay.primary.endDate,'2026-09');assert.equal(next.flow.statePensions.primary.startMonth,'2033-04');assert.deepEqual(next.planning.scenario.retirementYears,before.planning.scenario.retirementYears);assert.deepEqual(next.planning.scenario.spendingChanges,before.planning.scenario.spendingChanges);
 assert.equal(next.holdings.debts[0].balance,50000);assert.equal(next.holdings.debts[0].remainingYears,9.5);assert.equal(next.holdings.assets[0].value,100000);
});

test('successive updates preserve elapsed months and explicit current ages override approximation',()=>{
 const first=rebasePictureMonth(picture(),'2026-05'),second=rebasePictureMonth(first,'2026-06');assert.ok(Math.abs(second.planning.scenario.ages.primary-(60+2/12))<1e-10);
 const explicit=rebasePictureMonth(second,'2026-10',{ages:{primary:61}});assert.equal(explicit.planning.scenario.ages.primary,61);assert.equal(explicit.holdings.age,61);
 assert.throws(()=>rebasePictureMonth(explicit,'2026-09'),/cannot precede/);assert.throws(()=>rebasePictureMonth(explicit,'2026-13'),/cannot precede/);assert.throws(()=>rebasePictureMonth(explicit,'2027-01',{ages:{primary:61.5}}),/whole number/);
});

test('rebased retired household preserves pay cessation and historical spending phases in projection',()=>{
 const next=rebasePictureMonth(picture(),'2028-04');
 const projection=projectPlan(next.flow,next.holdings,next.planning.scenario);
 assert.equal(projection.startMonth,'2028-04');assert.equal(projection.retirementDates.primary,'2026-09');assert.ok(projection.months.every(row=>row.employmentIncome===undefined||row.employmentIncome===0));
 assert.equal(projection.months[0].householdSpending,900);
});

test('explicit regular budget update preserves categories to the penny and leaves scheduled costs separate',()=>{
 const flow=createBlankMonthlyFlow();flow.spending={everyday:100,carPayment:200};flow.customSpending=[{id:'food',label:'Food',amount:300}];flow.datedEntries=[{id:'holiday',label:'Holiday',amount:1000,startMonth:'2027-01',side:'spending',frequency:'once'}];const before=structuredClone(flow);
 const next=setRegularBudget(flow,1000);assert.equal(next.spending.everyday+next.spending.carPayment+next.customSpending[0].amount,1000);assert.deepEqual(next.datedEntries,flow.datedEntries);assert.deepEqual(flow,before);assert.equal(next.spending.everyday,166.67);
 assert.equal(setRegularBudget(createBlankMonthlyFlow(),500).spending.everyday,500);assert.throws(()=>setRegularBudget(flow,-1),/monthly budget/);assert.throws(()=>setRegularBudget(flow,1.001),/penny/);
});
