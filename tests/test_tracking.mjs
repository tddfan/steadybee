import test from 'node:test';
import assert from 'node:assert/strict';
import {createPublicDemoHousehold} from '../prototype/asset-ledger.mjs';
import {createExampleMonthlyFlow,summarizeMonthlyFlow} from '../prototype/monthly-flow.mjs';
import {projectPlan} from '../prototype/planning.mjs';
import {validatePicture,createProtection,encryptPicture,decryptPicture} from '../prototype/picture-storage.mjs';
import {appendBaselineVersion,baselineMonths} from '../prototype/baseline-history.mjs';
import {appendTrackingUpdate,correctTrackingUpdate,trackedInputsAt,activeTrackingEntries} from '../prototype/tracking.mjs';
const picture=()=>({version:1,example:false,holdings:createPublicDemoHousehold(),flow:{...createExampleMonthlyFlow(),asOfMonth:'2026-01',timelineStartMonth:'2026-01'},planning:{scenario:{years:2,inflation:0,incomeGrowth:0,growth:{cash:0,isa:0,pension:0,property:0,shares:0},retirementYears:{primary:2027,partner:2027}},metric:'income',group:'person',style:'bars',real:true,selectedYear:null}});
const meta=(id,date,mode='change')=>({id,effectiveDate:date,mode,recordedAt:'2026-10-25T12:00:00.000Z',label:'Test update'});
const change=(p,mutate,m)=>{const after=structuredClone(p);mutate(after);return validatePicture(appendTrackingUpdate(p,after,m));};

test('pay rates retain earlier periods and spending updates do not rewrite the initial inputs',()=>{
 const p=picture(),original=structuredClone(p);
 const next=change(p,n=>{n.flow.pay.primary.annualGross=55000;n.flow.spending.everyday=3100;},meta('raise','2026-05-01'));
 assert.deepEqual(p,original);assert.equal(trackedInputsAt(next.flow,next.holdings,'2026-04').flow.pay.primary.annualGross,47000);
 assert.equal(trackedInputsAt(next.flow,next.holdings,'2026-05').flow.pay.primary.annualGross,55000);
 assert.equal(summarizeMonthlyFlow({...next.flow,asOfMonth:'2026-04'},next.holdings).uses.find(x=>x.key==='everyday').amount,2900);
 assert.equal(summarizeMonthlyFlow({...next.flow,asOfMonth:'2026-06'},next.holdings).uses.find(x=>x.key==='everyday').amount,3100);
});
test('one-period receipts and explicit zero apply only to the recorded month',()=>{
 const next=change(picture(),n=>{n.flow.pay.primary.annualTakeHome=1500*12;n.flow.spending.carPayment=0;},meta('receipt','2026-05-20','period'));
 assert.equal(summarizeMonthlyFlow({...next.flow,asOfMonth:'2026-05'},next.holdings).payDetails[0].monthlyTakeHome,1500);
 assert.equal(trackedInputsAt(next.flow,next.holdings,'2026-06').flow.pay.primary.annualTakeHome,null);
 assert.equal(trackedInputsAt(next.flow,next.holdings,'2026-05').flow.spending.carPayment,0);
 assert.equal(trackedInputsAt(next.flow,next.holdings,'2026-06').flow.spending.carPayment,250);
});
test('backdated changes replay in date order; corrections retain the superseded audit entry',()=>{
 let p=change(picture(),n=>n.flow.pay.primary.annualGross=60000,meta('later','2026-07-01'));
 p=change(p,n=>n.flow.pay.primary.annualGross=52000,meta('earlier','2026-03-01'));
 assert.equal(trackedInputsAt(p.flow,p.holdings,'2026-02').flow.pay.primary.annualGross,47000);
 assert.equal(trackedInputsAt(p.flow,p.holdings,'2026-05').flow.pay.primary.annualGross,52000);
 assert.equal(trackedInputsAt(p.flow,p.holdings,'2026-08').flow.pay.primary.annualGross,60000);
 const original=structuredClone(p.flow.tracking.entries[0]);
 p.flow=correctTrackingUpdate(p.flow,'later',[61000],{...meta('correction','2026-07-01'),reason:'Corrected statement'});
 assert.deepEqual(p.flow.tracking.entries[0],original);assert.equal(p.flow.tracking.entries.length,3);
 assert.equal(activeTrackingEntries(p.flow.tracking).length,2);assert.equal(trackedInputsAt(p.flow,p.holdings,'2026-08').flow.pay.primary.annualGross,61000);
 assert.equal(validatePicture(p).flow.tracking.entries.length,3);
});
test('projected pay changes affect the right months, taxes, contributions and savings; annual flows reconcile',()=>{
 const p=picture(),next=change(p,n=>n.flow.pay.primary.annualGross=55000,meta('raise','2026-05-01'));
 const before=projectPlan(p.flow,p.holdings,p.planning.scenario),after=projectPlan(next.flow,next.holdings,next.planning.scenario);
 assert.equal(after.months[0].pensionContributions,before.months[0].pensionContributions);
 assert.ok(after.months[4].pensionContributions>before.months[4].pensionContributions);assert.ok(after.months[4].incomeTotal>before.months[4].incomeTotal);
 assert.ok(after.months[4].taxTotal>before.months[4].taxTotal);assert.ok(after.months.at(-1).assetsTotal>before.months.at(-1).assetsTotal);
 assert.equal(after.months.reduce((s,r)=>s+Math.round(r.incomeTotal*100),0),Math.round(after.months.reduce((s,r)=>s+r.incomeTotal,0)*100));
});
test('balance observations replace closing estimates without repeating contributions; other assets keep projecting',()=>{
 const p=picture(),next=change(p,n=>n.holdings.assets.find(x=>x.id==='demo-sam-pension').value=90000,meta('statement','2026-05-31'));
 const before=projectPlan(p.flow,p.holdings,p.planning.scenario),after=projectPlan(next.flow,next.holdings,next.planning.scenario);
 assert.equal(after.months[3].assetsTotal,before.months[3].assetsTotal);
 const observed=after.months[4].balanceAdjustments.find(x=>x.id==='demo-sam-pension');assert.equal(observed.recorded,90000);
 assert.ok(after.months[4].assetsTotal>before.months[4].assetsTotal);
 assert.equal(Math.round((after.months[5].assetsByType.pension-after.months[4].assetsByType.pension)*100),Math.round(after.months[5].pensionContributions*100));
});
test('observed debt zero stays paid and retirement still stops pay and contributions',()=>{
 const p=picture();p.planning.scenario.retirementYears={primary:2026,partner:2026};
 const next=change(p,n=>n.holdings.debts[0].balance=0,meta('debt-paid','2026-05-31'));
 const after=projectPlan(next.flow,next.holdings,next.planning.scenario);
 assert.equal(after.months[4].debtsTotal,0);assert.equal(after.months[5].debtPayment,0);assert.equal(after.months[12].pensionContributions,0);
 assert.ok(summarizeMonthlyFlow({...next.flow,asOfMonth:'2026-05'},next.holdings).linkedMortgages[0].amount>0);
 assert.equal(summarizeMonthlyFlow({...next.flow,asOfMonth:'2026-06'},next.holdings).linkedMortgages[0].amount,0);
});
test('imports reject invalid dates, unsafe targets, unknown corrections and contradictory histories',()=>{
 const p=picture();assert.throws(()=>change(p,n=>n.flow.pay.primary.annualGross=55000,meta('bad','2026-02-30')));
 let n=change(p,n=>n.flow.pay.primary.annualGross=55000,meta('ok','2026-05-01'));
 n.flow.tracking.entries[0].changes[0].target.field='__proto__';assert.throws(()=>validatePicture(n));
 n=change(p,n=>n.flow.pay.primary.annualGross=55000,meta('ok','2026-05-01'));assert.throws(()=>correctTrackingUpdate(n.flow,'missing',[1],meta('c','2026-05-01')));
});
test('a confirmed receipt after employment ends does not restart workplace contributions or repeat next month',()=>{
 const p=picture();p.flow.pay.primary.endDate='2026-04';p.planning.scenario.retirementYears.primary=2026;
 p.flow.pay.partner.annualGross=0;p.flow.pay.partner.employeePensionRate=0;p.flow.pay.partner.employerPensionRate=0;p.planning.scenario.retirementYears.partner=2026;
 const next=change(p,n=>n.flow.pay.primary.annualTakeHome=24000,{...meta('arrears','2027-05-01','period'),recordedAt:'2027-05-02T12:00:00.000Z'});
 const receipt=summarizeMonthlyFlow({...next.flow,asOfMonth:'2027-05'},next.holdings).payDetails[0];assert.equal(receipt.active,false);assert.equal(receipt.monthlyTakeHome,2000);
 const projection=projectPlan(next.flow,next.holdings,next.planning.scenario);assert.equal(projection.months[16].pensionContributions,0);assert.equal(projection.months[16].incomeTotal,2000);assert.equal(projection.months[17].incomeTotal,0);
});
test('weighted tax-year earnings use the dated rates, not twelve months of the newest salary',()=>{
 const p=picture();p.holdings.debts=[];for(const owner of ['primary','partner'])Object.assign(p.flow.pay[owner],{annualGross:owner==='primary'?40000:0,annualBonus:0,employeePensionRate:0,employerPensionRate:0,employeePension:0,employerPension:0,endDate:''});
 p.flow.statePensions={primary:null,partner:null};p.planning.scenario.retirementYears={primary:2030,partner:2030};
 const next=change(p,n=>n.flow.pay.primary.annualGross=60000,meta('summer-raise','2026-07-01'));
 const projection=projectPlan(next.flow,next.holdings,next.planning.scenario),year=projection.months.filter(r=>r.month>='2026-04'&&r.month<='2027-03');
 const expectedIncomeTax=37700*.2+(55000-12570-37700)*.4;
 assert.ok(Math.abs(year.reduce((s,r)=>s+r.taxByType.employmentTax,0)-expectedIncomeTax)<.12);
 assert.equal(year.length,12);assert.equal(year.filter(r=>r.pensionContributions!==0).length,0);
});
test('recorded pension balances continue growing from the closing anchor and retain non-observed assets',()=>{
 const p=picture();p.planning.scenario.growth.pension=4;
 const next=change(p,n=>n.holdings.assets.find(x=>x.id==='demo-sam-pension').value=90000,meta('pension-statement','2026-05-31'));
 const projection=projectPlan(next.flow,next.holdings,{...next.planning.scenario,captureEstateBalances:true});
 const may=projection.months[4].estateAssets.find(a=>a.id==='demo-sam-pension'),june=projection.months[5].estateAssets.find(a=>a.id==='demo-sam-pension');
 const contribution=47000*.1/12;assert.equal(may.value,90000);assert.ok(Math.abs(june.value-(Math.round(90000*1.04**(1/12)*100)/100+Math.round(contribution*100)/100))<.02);
 assert.ok(projection.months[5].estateAssets.some(a=>a.id==='demo-priya-pension'&&a.value>35000));
});
test('new baselines preserve one-period semantics instead of making a receipt permanent income',()=>{
 const p=picture(),next=change(p,n=>n.flow.pay.primary.annualTakeHome=24000,meta('receipt','2026-10-01','period'));
 const saved=validatePicture(appendBaselineVersion(next,{id:'new-reference',startDate:'2026-10-01',createdAt:'2026-10-25T12:00:00.000Z'}));
 const months=baselineMonths(saved.baselines.entries[0]);assert.notEqual(months[0].incomeTotal,months[1].incomeTotal);
 assert.equal(saved.flow.tracking.entries.length,1);
});
test('a balance-only mortgage statement preserves the known maturity instead of restarting its term',()=>{
 const p=picture();p.holdings.assets.find(a=>a.id==='demo-sam-cash').value=500000;p.holdings.debts[0].remainingYears=1;
 const next=change(p,n=>Object.assign(n.holdings.debts[0],{balance:200000,mortgageType:'repayment'}),meta('mortgage-statement','2026-05-31'));
 const projection=projectPlan(next.flow,next.holdings,next.planning.scenario);assert.equal(projection.months[11].debtsTotal,0);assert.equal(projection.months[12].debtPayment,0);
});
test('a recorded rent rate grows from its effective month rather than from plan opening',()=>{
 const p=picture();p.flow.includeLinkedRent=true;p.holdings.assets[0].monthlyRent=1000;p.planning.scenario.incomeGrowth=2;
 const next=change(p,n=>n.holdings.assets[0].monthlyRent=2000,meta('rent-rise','2026-05-01'));
 const projection=projectPlan(next.flow,next.holdings,next.planning.scenario);assert.equal(projection.months[4].incomeByType.rent,2000);assert.equal(projection.months[5].incomeByType.rent,Math.round(2000*1.02**(1/12)*100)/100);
});
test('one-off scheduled costs are logged once and do not get inflation applied twice',()=>{
 const p=picture();p.planning.scenario.inflation=2;
 const next=change(p,n=>n.flow.datedEntries.push({id:'one-off-cost',side:'spending',label:'Replacement boiler',amount:1800,frequency:'once',startMonth:'2026-10',endMonth:''}),meta('boiler','2026-05-01'));
 const before=projectPlan(p.flow,p.holdings,p.planning.scenario),after=projectPlan(next.flow,next.holdings,next.planning.scenario);
 const expected=Math.round(1800*1.02**(5/12)*100)/100;
 assert.ok(Math.abs(after.months[9].spendingTotal-before.months[9].spendingTotal-expected)<.02);assert.equal(after.months[10].spendingTotal,before.months[10].spendingTotal);
 assert.equal(trackedInputsAt(next.flow,next.holdings,'2026-04').flow.datedEntries.some(e=>e.id==='one-off-cost'),false);
});
test('legacy optional pay fields, encrypted saving and baseline history survive tracked updates',async()=>{
 const p=picture();delete p.flow.pay.primary.employeePensionRate;delete p.flow.pay.primary.employerPensionRate;
 const next=change(p,n=>{n.flow.pay.primary.annualGross=50000;n.flow.pay.primary.employeePensionRate=7;},meta('legacy-pay','2026-05-01'));
 assert.equal(trackedInputsAt(next.flow,next.holdings,'2026-04').flow.pay.primary.employeePensionRate,0);
 const raw=await encryptPicture(next,await createProtection('Synthetic tracking test passphrase'));
 assert.deepEqual((await decryptPicture(raw,'Synthetic tracking test passphrase')).picture,JSON.parse(JSON.stringify(next)));
});
