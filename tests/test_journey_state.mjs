import test from 'node:test';
import assert from 'node:assert/strict';
import {createBlankMonthlyFlow} from '../prototype/monthly-flow.mjs';
import {projectPlan} from '../prototype/planning.mjs';
import {validatePicture} from '../prototype/picture-storage.mjs';
import {createGoal,createJourney,validateGoal,validateJourney,saveBaseline,saveCheckpoint,compareWithBaseline,recordedTotals} from '../prototype/journey-state.mjs';

function fixture(month='2026-04') {
  const flow=createBlankMonthlyFlow();flow.asOfMonth=flow.timelineStartMonth=month;
  flow.pay.primary.annualTakeHome=12000;
  flow.spending.everyday=500;
  const picture={version:1,example:false,holdings:{name:'Alex',age:60,partnerName:'',assets:[{id:'cash',kind:'cash',owner:'primary',value:10000}],debts:[]},flow,planning:{metric:'assets',group:'type',style:'lines',real:true,scenario:{years:1,inflation:0,incomeGrowth:0,growth:{cash:0,isa:0,pension:0,property:0,shares:0}}}};
  return {picture,projection:projectPlan(flow,picture.holdings,picture.planning.scenario)};
}
const meta={date:'2026-04-01',recordedAt:'2026-04-01T12:00:00.000Z',id:'baseline-1'};

test('goals preserve unset choices and reject unsupported/invalid settings',()=>{
  assert.deepEqual(createGoal(),{type:'retirement',retirementAge:null,monthlySpending:null,reserve:0,legacyTarget:0});
  assert.equal(validateGoal({...createGoal(),type:'legacy',legacyTarget:100000}).legacyTarget,100000);
  for(const invalid of [{type:'unknown'},{retirementAge:17},{monthlySpending:-1},{reserve:Infinity},{legacyTarget:'1000'},{surprise:true}])assert.throws(()=>createGoal(invalid));
});

test('saving a baseline preserves inputs, goal, monthly projection and closing balances without recursion',()=>{
  const {picture,projection}=fixture();picture.journey=createJourney();picture.planning.experiments=[{id:'alternative',state:{}}];
  const state=saveBaseline(picture.journey,picture,projection,meta);
  assert.equal(state.baseline.month,'2026-04');assert.equal(state.baseline.totals.assets,10000);
  assert.equal(state.baseline.path['2026-04'].assets,10500);assert.equal(state.baseline.summary.endMonth,'2027-03');
  assert.equal('journey' in state.baseline.picture,false);assert.equal('experiments' in state.baseline.picture.planning,false);
  picture.holdings.assets[0].value=1;projection.months[0].assetsTotal=1;state.goal.reserve=100;
  assert.equal(state.baseline.picture.holdings.assets[0].value,10000);assert.equal(state.baseline.path['2026-04'].assets,10500);assert.equal(state.baseline.goal.reserve,0);
  assert.equal(picture.journey.baseline,null);
});

test('an explicit new baseline archives the prior baseline and retains checkpoints',()=>{
  const {picture,projection}=fixture();const first=saveBaseline(createJourney(),picture,projection,meta);
  const updated=saveCheckpoint(first,picture,projection,{...meta,id:'update-1'});
  const second=saveBaseline(updated,picture,projection,{...meta,id:'baseline-2',label:'Annual review'});
  assert.equal(second.previousBaselines[0].id,'baseline-1');assert.equal(second.baseline.id,'baseline-2');assert.equal(second.checkpoints.length,1);
  assert.equal(first.previousBaselines.length,0);assert.equal(updated.baseline.id,'baseline-1');
});

test('manual checkpoints append dated facts and do not change baseline or current picture',()=>{
  const {picture,projection}=fixture();const start=saveBaseline(createJourney(),picture,projection,meta);
  const {picture:later}=fixture('2026-05');later.holdings.assets[0].value=12000;
  const state=saveCheckpoint(start,later,projectPlan(later.flow,later.holdings,later.planning.scenario),{date:'2026-05-01',id:'update-1',contributions:1000,withdrawals:0,note:'Monthly check'});
  assert.equal(state.checkpoints.length,1);assert.equal(state.checkpoints[0].totals.assets,12000);assert.equal(state.baseline.totals.assets,10000);
  assert.equal(start.checkpoints.length,0);assert.equal(later.journey,undefined);
});

test('baseline comparison matches the update month rather than the far-future endpoint',()=>{
  const {picture,projection}=fixture();const start=saveBaseline(createJourney(),picture,projection,meta);
  const later=fixture('2026-05');later.picture.holdings.assets[0].value=12000;
  const state=saveCheckpoint(start,later.picture,projectPlan(later.picture.flow,later.picture.holdings,later.picture.planning.scenario),{date:'2026-05-01',id:'update-1',contributions:1000,withdrawals:0});
  const comparison=compareWithBaseline(state);
  assert.equal(comparison.expected.assets,10500);assert.equal(comparison.difference.assets,1500);assert.equal(comparison.recordedChange.assets,2000);
  assert.equal(comparison.movements.unexplainedAssetChange,1000);assert.match(comparison.comparisonNote,/start of/);
  assert.equal(comparison.changes.assets[0].change,2000);
});

test('same-month comparison uses the reported baseline opening instead of its first projected closing',()=>{
  const {picture,projection}=fixture();const start=saveBaseline(createJourney(),picture,projection,meta);
  picture.holdings.assets[0].value=11000;
  const state=saveCheckpoint(start,picture,projectPlan(picture.flow,picture.holdings,picture.planning.scenario),{date:'2026-04-15',id:'update-1'});
  const comparison=compareWithBaseline(state);assert.equal(comparison.expected.assets,10000);assert.equal(comparison.difference.assets,1000);
  assert.equal(comparison.movements.net,null);assert.equal(comparison.movements.unexplainedAssetChange,null);
});

test('no matching baseline forecast stays unavailable instead of comparing another month',()=>{
  const {picture,projection}=fixture();const start=saveBaseline(createJourney(),picture,projection,meta);
  const later=fixture('2029-01');const state=saveCheckpoint(start,later.picture,later.projection,{date:'2029-01-01',id:'later'});
  const comparison=compareWithBaseline(state);assert.equal(comparison.expected,null);assert.equal(comparison.difference,null);assert.match(comparison.comparisonNote,/outside/);
});

test('checkpoints require a baseline and chronological, unique, valid identifiers and dates',()=>{
  const {picture,projection}=fixture();assert.throws(()=>saveCheckpoint(createJourney(),picture,projection,meta),/baseline/);
  const start=saveBaseline(createJourney(),picture,projection,meta);
  assert.throws(()=>saveCheckpoint(start,picture,projection,{date:'2026-02-30',id:'bad'}),/date/i);
  assert.throws(()=>saveCheckpoint(start,picture,projection,{date:'2026-03-01',id:'earlier'}),/before/i);
  const update=saveCheckpoint(start,picture,projection,{...meta,id:'update-1'});
  assert.throws(()=>saveCheckpoint(update,picture,projection,{...meta,id:'update-1'}),/unique/i);
});

test('reported totals preserve joint-owner cents and exclude locked or illiquid assets',()=>{
  const {picture}=fixture();picture.holdings.partnerName='Blair';picture.holdings.partnerAge=45;
  picture.holdings.assets=[{id:'joint',kind:'cash',owner:'shared',value:100.01},{id:'p',kind:'dc-pension',owner:'partner',value:500},{id:'house',kind:'home',owner:'shared',value:1000}];
  const totals=recordedTotals(picture);assert.equal(totals.accessible,100.01);assert.equal(Math.round((totals.byPerson.primary.assets+totals.byPerson.partner.assets)*100),Math.round(totals.assets*100));
  assert.equal(Math.round((totals.byPerson.primary.accessible+totals.byPerson.partner.accessible)*100),Math.round(totals.accessible*100));
});

test('import validation rejects malformed history, recursion, invalid money and inconsistent frozen values',()=>{
  const {picture,projection}=fixture();const state=saveBaseline(createJourney(),picture,projection,meta);
  for(const change of [s=>s.checkpoints='bad',s=>s.baseline.picture.journey={},s=>s.baseline.totals.assets=-1,s=>s.baseline.path['2026-04'].accessible=Infinity,s=>s.baseline.picture.holdings.assets[0].value=123]){
    const invalid=structuredClone(state);change(invalid);assert.throws(()=>validateJourney(invalid));
  }
  const bad=structuredClone(state);bad.checkpoints=Array.from({length:61},()=>({}));assert.throws(()=>validateJourney(bad),/60/);
});

test('snapshot validation can use the complete household validator without recursive journey validation',()=>{
  const {picture,projection}=fixture();const state=saveBaseline(createJourney(),picture,projection,meta);let calls=0;
  const restored=validateJourney(state,{validatePicture:snapshot=>{calls++;assert.equal(snapshot.journey,undefined);return snapshot;}});
  assert.equal(calls,1);restored.baseline.picture.holdings.name='Changed';assert.equal(state.baseline.picture.holdings.name,'Alex');
});

test('freezing baseline paths rejects malformed or non-contiguous projection data',()=>{
  const {picture,projection}=fixture();projection.months[1].month='2026-09';
  assert.throws(()=>saveBaseline(createJourney(),picture,projection,meta),/monthly/i);
});

test('an outdated projection cannot be recorded as the outlook for new actual balances',()=>{
  const {picture,projection}=fixture();picture.holdings.assets[0].value=20000;
  assert.throws(()=>saveBaseline(createJourney(),picture,projection,meta),/Recalculate/);
});

test('movement attribution accumulates known intervals and never crosses a replacement baseline',()=>{
  const {picture,projection}=fixture();let state=saveBaseline(createJourney(),picture,projection,meta);
  picture.holdings.assets[0].value=11000;
  state=saveCheckpoint(state,picture,projectPlan(picture.flow,picture.holdings,picture.planning.scenario),{date:'2026-04-02',id:'update-1',contributions:1000,withdrawals:0});
  picture.holdings.assets[0].value=11500;
  state=saveCheckpoint(state,picture,projectPlan(picture.flow,picture.holdings,picture.planning.scenario),{date:'2026-04-02',id:'update-2',contributions:500,withdrawals:0});
  assert.equal(compareWithBaseline(state,state.checkpoints[0]).movements.contributions,1000);
  assert.equal(compareWithBaseline(state).movements.contributions,1500);
  state=saveBaseline(state,picture,projectPlan(picture.flow,picture.holdings,picture.planning.scenario),{date:'2026-04-02',id:'baseline-2'});
  assert.equal(compareWithBaseline(state),null);
  picture.holdings.assets[0].value=11700;
  state=saveCheckpoint(state,picture,projectPlan(picture.flow,picture.holdings,picture.planning.scenario),{date:'2026-04-03',id:'update-3',contributions:200,withdrawals:0});
  assert.equal(compareWithBaseline(state).movements.contributions,200);assert.equal(compareWithBaseline(state).recordedChange.assets,200);
});

test('current picture validation roundtrips a baseline and updates, while older pictures need no journey',()=>{
  const {picture,projection}=fixture();assert.equal(validatePicture(picture).journey,undefined);
  picture.journey=saveBaseline(createJourney(),picture,projection,meta);
  picture.journey=saveCheckpoint(picture.journey,picture,projection,{...meta,id:'update-1'});
  const restored=validatePicture(JSON.parse(JSON.stringify(picture)));
  assert.equal(restored.journey.baseline.totals.assets,10000);assert.equal(restored.journey.checkpoints.length,1);
  restored.journey.baseline.path['2026-04'].assets=1;
  assert.equal(picture.journey.baseline.path['2026-04'].assets,10500);
});

test('picture imports validate historical inputs as rigorously as current inputs',()=>{
  const {picture,projection}=fixture();picture.journey=saveBaseline(createJourney(),picture,projection,meta);
  picture.journey.baseline.picture.planning.scenario.withdrawalOrder='invented-order';
  assert.throws(()=>validatePicture(picture),/withdrawal order/i);
});

test('a full 100-year frozen monthly path fits the normal household import shape',()=>{
  const {picture}=fixture();picture.planning.scenario.years=100;
  const projection=projectPlan(picture.flow,picture.holdings,picture.planning.scenario);
  picture.journey=saveBaseline(createJourney(),picture,projection,meta);
  assert.equal(Object.keys(validatePicture(picture).journey.baseline.path).length,1200);
});
