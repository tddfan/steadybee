import test from 'node:test';
import assert from 'node:assert/strict';
import {createPublicDemoHousehold} from '../prototype/asset-ledger.mjs';
import {createExampleMonthlyFlow} from '../prototype/monthly-flow.mjs';
import {projectPlan} from '../prototype/planning.mjs';
import {validatePicture,createProtection,encryptPicture,decryptPicture} from '../prototype/picture-storage.mjs';
import {appendBaselineVersion,activeBaseline,baselineMonths,baselineAnnualView,validateBaselineHistory,BASELINE_ENGINE_VERSION} from '../prototype/baseline-history.mjs';

const picture=()=>({version:1,example:false,holdings:createPublicDemoHousehold(),flow:createExampleMonthlyFlow(),planning:{scenario:{years:3,retirementYears:{primary:2049,partner:2051}},metric:'income',group:'person',style:'bars',real:true,selectedYear:null,experiments:[]}});
const metadata=(id='one',startDate='2026-10-01',createdAt='2026-10-25T12:00:00.000Z')=>({id,startDate,createdAt,name:'Starting plan'});
const create=(p=picture(),meta=metadata())=>validatePicture(appendBaselineVersion(validatePicture(p),meta));

test('legacy households remain valid and do not acquire an invented baseline',()=>{
 const p=picture();assert.deepEqual(validatePicture(p),p);assert.equal(activeBaseline(undefined,'2026-10-25'),null);
});
test('Phase 1 frozen forecasts remain readable after the tracking engine is introduced',()=>{
 const p=create();p.baselines.entries[0].forecast.engineVersion='planning-20261025-baseline1';const saved=structuredClone(p.baselines.entries[0].forecast);
 assert.deepEqual(validatePicture(p).baselines.entries[0].forecast,saved);
});
test('baseline creation preserves the current household, saves resolved inputs and freezes monthly results',()=>{
 const p=picture(),original=structuredClone(p),next=create(p),b=next.baselines.entries[0];
 assert.deepEqual(p,original);assert.deepEqual(next.holdings,p.holdings);assert.deepEqual(next.flow,p.flow);assert.deepEqual(next.planning,p.planning);
 assert.equal(b.startDate,'2026-10-01');assert.equal(b.number,1);assert.equal(b.forecast.engineVersion,BASELINE_ENGINE_VERSION);assert.equal(b.inputs.baselines,undefined);
 const projected=projectPlan(b.inputs.flow,b.inputs.holdings,b.inputs.planning.scenario),months=baselineMonths(b);
 assert.equal(months.length,36);assert.equal(months[0].month,projected.startMonth);
 for(let i=0;i<months.length;i++)for(const key of ['assetsTotal','debtsTotal','withdrawableAssets','incomeTotal','spendingTotal','taxTotal','unfunded'])assert.equal(months[i][key],projected.months[i][key]);
});
test('normal edits, scenario edits and subsequent baselines never mutate previous baseline inputs or results',()=>{
 let p=create();const original=structuredClone(p.baselines.entries[0]);
 p.holdings.assets[0].value+=1234;p.flow.pay.primary.annualGross+=5000;p.planning.scenario.inflation=3;
 p=create(p,metadata('two','2026-11-01','2026-10-26T12:00:00.000Z'));
 assert.deepEqual(p.baselines.entries[0],original);assert.equal(p.baselines.entries[1].number,2);
 assert.equal(p.baselines.entries[1].inputs.flow.timelineStartMonth,'2026-11');assert.equal(p.flow.timelineStartMonth,'2026-10');
 p.holdings.assets[0].value=0;assert.notEqual(p.baselines.entries[1].inputs.holdings.assets[0].value,0);
});
test('effective dates choose the active baseline; inspecting a future version never activates it early',()=>{
 let p=create();p=create(p,metadata('two','2027-01-01','2026-10-26T12:00:00.000Z'));
 assert.equal(activeBaseline(p.baselines,'2026-09-30'),null);assert.equal(activeBaseline(p.baselines,'2026-10-25').id,'one');assert.equal(activeBaseline(p.baselines,'2027-01-01').id,'two');
 p=create(p,metadata('three','2026-09-01','2026-10-27T12:00:00.000Z'));
 assert.equal(activeBaseline(p.baselines,'2026-10-25').id,'one');assert.equal(activeBaseline(p.baselines,'2026-09-15').id,'three');
});
test('annual frozen views sum flows and use year-end stocks; values are not rerun from current facts',()=>{
 const p=create(),b=p.baselines.entries[0],months=baselineMonths(b),annual=baselineAnnualView(b),first=months.filter(r=>r.month.startsWith('2026'));
 assert.equal(annual[0].months,3);assert.equal(annual[0].assetsTotal,first.at(-1).assetsTotal);
 assert.ok(Math.abs(annual[0].incomeTotal-first.reduce((s,r)=>s+r.incomeTotal,0))<.001);
 b.inputs.holdings.assets[0].value=0;assert.deepEqual(baselineAnnualView(b),annual);
});
test('baselines round-trip with scenarios through validation and encrypted storage',async()=>{
 const p=picture(),state=structuredClone(p.planning);delete state.experiments;p.planning.experiments=[{id:'alt',name:'Alternative',createdAt:'2026-10-25T12:00:00.000Z',state}];
 const next=create(p);assert.equal(validatePicture(next).planning.experiments.length,1);
 const raw=await encryptPicture(next,await createProtection('Fictional baseline test passphrase'));
 assert.deepEqual((await decryptPicture(raw,'Fictional baseline test passphrase')).picture,next);
});
test('reject malformed dates, duplicate IDs, nested histories and damaged frozen series without changing the household',()=>{
 const p=picture();for(const startDate of ['2026-02-30','bad','2026-13-01'])assert.throws(()=>create(p,metadata('one',startDate)),/date/i);
 const next=create(p);assert.throws(()=>create(next,metadata()),/identifier/i);
 for(const damage of [b=>b.inputs.baselines={},b=>b.forecast.years[0].months[0][1]=Infinity,b=>b.forecast.years[0].months.pop(),b=>b.forecast.years[0].months[0].pop(),b=>b.number=0,b=>b.forecast.endMonth='2029-02']){
  const broken=structuredClone(next);damage(broken.baselines.entries[0]);assert.throws(()=>validatePicture(broken));
 }
 assert.throws(()=>validateBaselineHistory({version:2,entries:[]},validatePicture));assert.equal(p.baselines,undefined);
});
test('public examples cannot silently become a personal baseline and no empty named profile is accepted',()=>{
 const p=picture();p.example=true;assert.throws(()=>create(p),/example/i);p.example=false;p.holdings.name='';assert.throws(()=>create(p),/household/i);
});
test('same-date revisions select the latest version and version limits preserve all existing history',()=>{
 let p=create();p=create(p,metadata('two','2026-10-01','2026-10-26T12:00:00.000Z'));
 assert.equal(activeBaseline(p.baselines,'2026-10-25').id,'two');
 for(let i=3;i<=12;i++)p=create(p,metadata(`version-${i}`));
 const before=structuredClone(p);assert.throws(()=>create(p,metadata('thirteen')),/12 baseline/);assert.deepEqual(p,before);
});
