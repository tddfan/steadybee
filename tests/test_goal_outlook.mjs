import test from 'node:test';
import assert from 'node:assert/strict';
import {createBlankMonthlyFlow} from '../prototype/monthly-flow.mjs';
import {createGoal,createJourney} from '../prototype/journey-state.mjs';
import {evaluateGoalOutlook,goalScenario} from '../prototype/goal-outlook.mjs';

function picture(value=15000){
  const flow=createBlankMonthlyFlow();flow.timelineStartMonth=flow.asOfMonth='2026-04';flow.spending.everyday=1000;flow.pay.primary.endDate='2025-12';
  return {version:1,holdings:{name:'Sam',age:60,assets:[{id:'isa',kind:'isa',value,owner:'primary'}],debts:[]},flow,
    planning:{scenario:{years:1,inflation:0,incomeGrowth:0,growth:{cash:0,isa:0,pension:0,property:0,shares:0}}},journey:createJourney()};
}

test('coverage and stress outcomes come from the engine without editing the household',()=>{
  const source=picture(),before=JSON.stringify(source),outlook=evaluateGoalOutlook(source);
  assert.equal(outlook.status,'on-track');assert.equal(outlook.coveragePercent,100);assert.equal(outlook.firstGap,null);
  assert.equal(outlook.stress.applied,true);assert.equal(outlook.stress.loss,3000);assert.equal(outlook.stress.passes,true);
  assert.equal(JSON.stringify(source),before);assert.match(outlook.coverageBasis,/Not a probability/);
});

test('a small late funding gap cannot become a good result through rounding',()=>{
  const source=picture(11999.99),outlook=evaluateGoalOutlook(source);
  assert.equal(outlook.status,'needs-attention');assert.equal(outlook.coveragePercent,99.99);
  assert.equal(outlook.firstGap.month,'2027-03');assert.equal(outlook.firstGap.amount,.01);assert.equal(outlook.firstGap.ages.primary,60);
});

test('a funded current plan that misses after a market fall is sensitive',()=>{
  const outlook=evaluateGoalOutlook(picture(14900));
  assert.equal(outlook.coveragePercent,100);assert.equal(outlook.status,'sensitive');assert.equal(outlook.label,'Sensitive');assert.equal(outlook.stress.passes,false);
});

test('a no-effect downside test cannot certify the plan as stress-tested',()=>{
  const source=picture(20000);source.holdings.assets[0].kind='cash';
  const outlook=evaluateGoalOutlook(source);
  assert.equal(outlook.stress.applied,false);assert.equal(outlook.stress.passes,null);assert.equal(outlook.status,'sensitive');assert.equal(outlook.label,'Meets current plan');
});

test('minimum reserve is checked throughout the path, not only at the end',()=>{
  const source=picture(20000);source.journey.goal=createGoal({reserve:9000});
  const outlook=evaluateGoalOutlook(source);
  assert.equal(outlook.minimumAccessible,8000);assert.equal(outlook.reserveMet,false);assert.equal(outlook.status,'needs-attention');
});

test('the reserve requirement includes the opening balance before future savings',()=>{
  const source=picture(0);source.flow.pay.primary.annualGross=60000;source.flow.pay.primary.endDate='2026-12';source.journey.goal=createGoal({reserve:100});
  const outlook=evaluateGoalOutlook(source);
  assert.ok(outlook.accessibleAtEnd>100);assert.equal(outlook.minimumAccessible,0);assert.equal(outlook.reserveMet,false);
});

test('substantive missing inputs are incomplete while opening-year caveats remain visible',()=>{
  const source=picture(100000);source.flow.timelineStartMonth=source.flow.asOfMonth='2026-10';
  let outlook=evaluateGoalOutlook(source);
  assert.equal(outlook.taxIncomplete,true);assert.notEqual(outlook.status,'incomplete');assert.match(outlook.warnings.join(' '),/Opening tax year/);
  source.flow.pay.primary.annualTakeHome=12000;
  outlook=evaluateGoalOutlook(source);assert.equal(outlook.status,'incomplete');assert.match(outlook.reasons.join(' '),/take-home pay/i);
  source.flow.pay.primary.annualTakeHome=null;source.holdings.debts=[{id:'loan',kind:'loan',balance:500}];
  outlook=evaluateGoalOutlook(source);assert.equal(outlook.status,'incomplete');assert.match(outlook.reasons.join(' '),/debt repayments/);
});

test('missing age or spending does not produce a reassuring percentage verdict',()=>{
  const source=picture();source.holdings.age=null;source.flow.spending.everyday=0;
  const outlook=evaluateGoalOutlook(source);
  assert.equal(outlook.status,'incomplete');assert.equal(outlook.coveragePercent,null);assert.equal(outlook.firstGap,null);
  assert.match(outlook.reasons.join(' '),/age/);assert.match(outlook.reasons.join(' '),/spending/);
});

test('saving a goal materialises only the primary work-stop target and preserves month offsets',()=>{
  const source=picture();source.holdings.age=50;source.holdings.partnerName='Priya';source.holdings.partnerAge=48;
  source.flow.pay.primary.endDate='2040-02';source.flow.pay.partner.endDate='2045-06';
  const goal=createGoal({retirementAge:60}),scenario=goalScenario(source,goal);
  assert.equal(scenario.retirementYears.primary,2037);assert.equal(scenario.retirementYears.partner,2045);
  assert.equal(source.planning.scenario.retirementYears,undefined);
});

test('a later-retirement experiment remains active and can miss the fixed timing target',()=>{
  const source=picture(100000);source.flow.pay.primary.annualGross=12000;source.holdings.age=60;
  source.journey.goal=createGoal({type:'independence',retirementAge:60});
  source.planning.scenario.years=3;source.planning.scenario.retirementYears={primary:2027};
  const outlook=evaluateGoalOutlook(source);
  assert.equal(outlook.projection.retirementDates.primary,'2027-12');assert.equal(outlook.retirementAge,61);
  assert.equal(outlook.timingMet,false);assert.equal(outlook.status,'needs-attention');
});

test('a checkpoint age with elapsed months produces an integer target year',()=>{
  const source=picture();source.flow.timelineStartMonth=source.flow.asOfMonth='2026-10';
  source.planning.scenario.ages={primary:60.5};source.flow.pay.primary.endDate='2030-11';source.flow.pay.primary.annualGross=12000;
  const goal=createGoal({retirementAge:60}),scenario=goalScenario(source,goal);
  assert.equal(scenario.retirementYears.primary,2026);assert.equal(Number.isInteger(scenario.retirementYears.primary),true);
});

test('a projection ending before retirement cannot assess the retirement goal',()=>{
  const source=picture(100000);source.flow.pay.primary.annualGross=12000;source.flow.pay.primary.endDate='2030-12';
  const outlook=evaluateGoalOutlook(source);
  assert.equal(outlook.status,'incomplete');assert.match(outlook.reasons.join(' '),/Extend the plan beyond/);
});

test('a regular spending target composes with later phases and leaves dated expenses intact',()=>{
  const source=picture(100000);source.planning.scenario.years=3;
  source.planning.scenario.spendingChanges=[{year:2026,percent:100},{year:2028,percent:120}];
  source.flow.datedEntries=[{id:'trip',side:'spending',label:'Trip',amount:500,frequency:'once',startMonth:'2026-06',endMonth:''}];
  const scenario=goalScenario(source,createGoal({monthlySpending:900}));
  assert.deepEqual(scenario.spendingChanges,[{year:2026,percent:90},{year:2028,percent:108}]);
  const projected=evaluateGoalOutlook({...source,planning:{scenario},journey:createJourney(createGoal({monthlySpending:900}))});
  assert.equal(projected.projection.months.find(month=>month.month==='2026-06').householdSpending,1400);
  assert.equal(source.flow.datedEntries[0].amount,500);
});

test('the inheritance target uses projected balances at the horizon rather than opening wealth',()=>{
  const source=picture(100000);source.planning.scenario.growth.isa=10;source.journey.goal=createGoal({type:'legacy',legacyTarget:99000});
  const outlook=evaluateGoalOutlook(source);
  assert.equal(outlook.projection.months.at(-1).estateAssets.length,1);
  assert.equal(outlook.legacyAmount,outlook.projection.months.at(-1).assetsTotal);
  assert.notEqual(outlook.legacyAmount,100000);assert.equal(outlook.legacyMet,false);assert.equal(outlook.status,'needs-attention');
  assert.match(outlook.legacyBasis,/before beneficiary pension Income Tax/);
});

test('unconfirmed or incomplete inheritance assumptions do not silently pass a legacy target',()=>{
  const source=picture(100000);source.journey.goal=createGoal({type:'legacy',legacyTarget:0});
  const outlook=evaluateGoalOutlook(source);assert.equal(outlook.status,'incomplete');assert.match(outlook.reasons.join(' '),/amount you want to leave/);
});
