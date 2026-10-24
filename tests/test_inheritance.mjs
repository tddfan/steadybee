import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateEstate,createInheritanceIllustration,estateDefaults,equalChildren,validateEstateSettings,estateOwnership} from '../prototype/inheritance.mjs';
import {projectPlan} from '../prototype/planning.mjs';
import {createBlankMonthlyFlow,createExampleMonthlyFlow} from '../prototype/monthly-flow.mjs';
import {createPublicDemoHousehold} from '../prototype/asset-ledger.mjs';
import {validatePicture,createProtection,encryptPicture,decryptPicture} from '../prototype/picture-storage.mjs';
const cash=value=>({id:'cash',kind:'cash',owner:'primary',value});
const home=value=>({id:'home',kind:'home',owner:'primary',value});
const settings=overrides=>({...estateDefaults(),deathDate:'2028-01-01',beneficiaries:equalChildren(2),ukScopeConfirmed:true,...overrides});
const estate=(assets,overrides={},debts=[])=>calculateEstate({name:'Test',assets,debts},settings(overrides));
const total=(items,key)=>Math.round(items.reduce((sum,item)=>sum+item[key],0)*100)/100;
test('simple starting illustration gives a usable equal split with explicit age-90 couple assumptions',()=>{
  const holdings=createPublicDemoHousehold(),s=createInheritanceIllustration(holdings,'2026-10');
  validateEstateSettings(s);
  assert.equal(s.owner,'couple');assert.equal(s.couple.route,'survivor');assert.equal(s.couple.relationship,'married');
  assert.equal(s.couple.firstDeathDate,'2077-10-28');assert.equal(s.deathDate,'2079-10-28');
  assert.equal(s.beneficiaries.length,2);assert.equal(s.beneficiaries[0].percent,50);
  assert.equal(s.residenceAssetId,holdings.assets.find(a=>a.kind==='home').id);
  const result=calculateEstate(holdings,s);
  assert.equal(total(result.beneficiaries,'afterEstateTax'),result.afterEstateTax);
  assert.equal(result.first.estateTax,0);
  assert.deepEqual(createPublicDemoHousehold(),holdings);
});
test('single-person illustration and equal-age couple keep valid, ordered death dates',()=>{
  const single={name:'Person',age:60,assets:[cash(500000)],debts:[]};
  const s=createInheritanceIllustration(single,'2026-10');
  assert.equal(s.owner,'primary');assert.equal(s.deathDate,'2056-10-28');
  assert.equal(calculateEstate(single,s).estateTax,70000);
  const pair={...single,partnerName:'Partner',partnerAge:60};
  const p=createInheritanceIllustration(pair,'2026-10');
  assert.ok(p.couple.firstDeathDate<p.deathDate);validateEstateSettings(p);calculateEstate(pair,p);
});
test('£500k simple estate pays £70k estate tax, then each of two children receives £215k',()=>{
  const r=estate([cash(500000)]);assert.equal(r.estateTax,70000);assert.equal(r.afterEstateTax,430000);assert.deepEqual(r.beneficiaries.map(p=>p.afterEstateTax),[215000,215000]);assert.equal(r.incomplete,false);
});
test('qualifying home and direct descendants enable one residence band, not a band for every child',()=>{
  const r=estate([cash(250000),home(250000)],{residenceAssetId:'home'});assert.equal(r.residenceBand,175000);assert.equal(r.estateTax,0);
  const three=estate([cash(250000),home(250000)],{residenceAssetId:'home',beneficiaries:equalChildren(3)});assert.equal(three.estateTax,0);assert.equal(three.residenceBand,175000);
  assert.equal(total(three.beneficiaries,'afterEstateTax'),500000);assert.ok(Math.max(...three.beneficiaries.map(p=>p.afterEstateTax))-Math.min(...three.beneficiaries.map(p=>p.afterEstateTax))<.011);
});
test('£2.2m estate tapers the residence allowance to £75k and owes £720k',()=>{
  const r=estate([cash(1700000),home(500000)],{residenceAssetId:'home'});assert.equal(r.residenceTaper,100000);assert.equal(r.residenceBand,75000);assert.equal(r.estateTax,720000);
  const smallHome=estate([cash(2020000),home(80000)],{residenceAssetId:'home'});assert.equal(smallHome.residenceBand,80000);
});
test('marriage is explicit; a spouse-exempt pre-tax share differs from an unmarried partner',()=>{
  const beneficiary=relationship=>[{id:'b',name:'Recipient',percent:100,relationship}];
  assert.equal(estate([cash(1000000)],{beneficiaries:beneficiary('spouse')}).estateTax,0);
  assert.equal(estate([cash(1000000)],{beneficiaries:beneficiary('other')}).estateTax,270000);
  const mixed=estate([cash(1000000)],{beneficiaries:[{id:'s',name:'Spouse',relationship:'spouse',percent:50},{id:'c',name:'Child',relationship:'child',percent:50}]});
  assert.equal(mixed.estateTax,70000);assert.deepEqual(mixed.beneficiaries.map(p=>p.afterEstateTax),[500000,430000]);
});
test('verified transferred bands increase thresholds once, with the same £2m taper threshold',()=>{
  const r=estate([cash(400000),home(600000)],{residenceAssetId:'home',transferBasicPercent:100,transferResidencePercent:100});assert.equal(r.basicBand,650000);assert.equal(r.residenceBand,350000);assert.equal(r.estateTax,0);
});
test('home allowance is limited by net home equity passing proportionately to descendants',()=>{
  const debts=[{id:'m',kind:'mortgage',owner:'primary',linkedAssetId:'home',balance:200000}];
  const r=estate([cash(600000),home(300000)],{residenceAssetId:'home'},debts);assert.equal(r.qualifyingHome,100000);assert.equal(r.residenceBand,100000);assert.equal(r.netEstate,700000);assert.equal(r.estateTax,110000);
  const half=estate([home(300000)],{residenceAssetId:'home',beneficiaries:[{id:'c',name:'Child',relationship:'child',percent:50},{id:'o',name:'Other',relationship:'other',percent:50}]});assert.equal(half.residenceBand,150000);
});
test('standard DC pension inclusion changes on the exact 6 April 2027 boundary',()=>{
  const assets=[cash(325000),{id:'p',kind:'dc-pension',owner:'primary',value:100000}];
  const before=estate(assets,{deathDate:'2027-04-05'}),after=estate(assets,{deathDate:'2027-04-06'});
  assert.equal(before.estateTax,0);assert.equal(before.outsideEstate,100000);assert.equal(before.afterEstateTax,425000);
  assert.equal(after.outsideEstate,0);assert.equal(after.estateTax,40000);assert.equal(after.afterEstateTax,385000);
  assert.ok(after.warnings.some(w=>w.includes('pension Income Tax')));
});
test('joint ownership and debts are applied to one person, with complementary defaults and conflict validation',()=>{
  const holdings={partnerName:'Test partner',assets:[{...home(800000),owner:'shared'}],debts:[{id:'m',kind:'mortgage',owner:'shared',balance:200000,linkedAssetId:'home'}]};
  const s=settings({residenceAssetId:'home'}),r=calculateEstate(holdings,s);assert.equal(r.grossEstate,400000);assert.equal(r.debt,100000);
  s.shares.primary.home=75;assert.equal(estateOwnership(holdings.assets[0],{...s,owner:'partner'}),.25);
  s.shares.partner.home=50;assert.throws(()=>validateEstateSettings(s),/100%/);
});
test('precise equal-child weights remain equal to a penny on large estates',()=>{
  const r=estate([cash(2500000)],{beneficiaries:equalChildren(3)});assert.equal(r.estateTax,870000);
  assert.equal(total(r.beneficiaries,'afterEstateTax'),r.afterEstateTax);
  assert.ok(Math.max(...r.beneficiaries.map(p=>p.afterEstateTax))-Math.min(...r.beneficiaries.map(p=>p.afterEstateTax))<.011);
});
test('zero and insolvent estates cannot distribute negative funds; liquidity reserves debts first',()=>{
  const empty=estate([]);assert.equal(empty.estateTax,0);assert.equal(empty.afterEstateTax,0);
  const insolvent=estate([cash(1000)],{},[{id:'d',kind:'loan',balance:2000}]);assert.equal(insolvent.afterEstateTax,0);assert.ok(insolvent.incomplete);
  const r=estate([cash(100000),home(900000)],{},[{id:'d',kind:'loan',balance:100000}]);assert.equal(r.liquidAfterDeductions,0);assert.equal(r.liquidityGap,r.estateTax);
});
test('incomplete scope and exceptional cases stay visibly incomplete',()=>{
  const r=estate([cash(500000)],{ukScopeConfirmed:false,complexEstate:true});assert.equal(r.warnings.length,2);assert.equal(r.incomplete,true);
  assert.throws(()=>estate([cash(500000)],{beneficiaries:[]}),/100%/);
  assert.throws(()=>estate([cash(500000)],{beneficiaries:[{id:'c',name:'Child',percent:80,relationship:'child'}]}),/100%/);
  assert.throws(()=>estate([cash(1)],{deathDate:'2027-02-30'}),/date/);
  assert.throws(()=>estate([cash(1)],{residenceAssetId:'missing'}),/home/);
  assert.throws(()=>validateEstateSettings(settings({transferBasicPercent:101})),/100%/);
});
test('projected estate snapshots preserve individual asset ownership and reconcile to Planning totals',()=>{
  const holdings=createPublicDemoHousehold(),flow=createExampleMonthlyFlow();
  const p=projectPlan(flow,holdings,{years:1,captureEstateBalances:true});
  for(const month of p.months){assert.equal(total(month.estateAssets,'value'),month.assetsTotal);assert.equal(total(month.estateDebts,'balance'),month.debtsTotal);}
  assert.equal(projectPlan(flow,holdings,{years:1}).months[0].estateAssets,undefined);
  const last=p.months.at(-1),r=calculateEstate({...holdings,assets:last.estateAssets,debts:last.estateDebts},settings());assert.ok(r.grossEstate>0);
});
test('inheritance settings survive saved household encryption; older saves and unfinished splits still open',async()=>{
  const p={version:1,holdings:createPublicDemoHousehold(),flow:createExampleMonthlyFlow(),planning:{scenario:{years:1},metric:'income',group:'person',style:'bars',real:true},inheritance:settings()};
  assert.deepEqual(validatePicture(p).inheritance,p.inheritance);
  const protection=await createProtection('Synthetic test passphrase');assert.deepEqual((await decryptPicture(await encryptPicture(p,protection),'Synthetic test passphrase')).picture.inheritance,p.inheritance);
  p.inheritance.beneficiaries[0].percent=25;assert.doesNotThrow(()=>validatePicture(p));
  p.inheritance.transferBasicPercent=200;assert.throws(()=>validatePicture(p));delete p.inheritance;assert.doesNotThrow(()=>validatePicture(p));
});

const coupleSettings=overrides=>{
  const s=settings({owner:'couple',residenceAssetId:'home'});s.couple={...s.couple,relationship:'married',firstDeathDate:'2027-01-01',routeConfirmed:true,descendantsConfirmed:true,...overrides};return s;
};
const family=()=>({name:'Parent A',partnerName:'Parent B',assets:[{...home(500000),owner:'shared'},{...cash(500000),owner:'shared'}],debts:[]});
test('married parents can each leave directly to children or pass to survivor first, with no duplicate estate',()=>{
  for(const route of ['direct','survivor']){
    const r=calculateEstate(family(),coupleSettings({route}));assert.equal(r.estateTax,0);assert.equal(r.afterEstateTax,1000000);assert.equal(total(r.beneficiaries,'afterEstateTax'),1000000);assert.equal(r.familyGross,1000000);
    if(route==='survivor'){assert.equal(r.second.basicBand,650000);assert.equal(r.second.residenceBand,350000);}
  }
});
test('couple direct route keeps two estates separate and transfers only actual unused bands',()=>{
  const h={...family(),assets:[{...cash(100000),id:'a'},{...cash(600000),id:'b',owner:'partner'}]},s=coupleSettings();s.residenceAssetId='';
  const r=calculateEstate(h,s);assert.equal(r.first.estateTax,0);assert.equal(r.second.basicBand,550000);assert.equal(r.estateTax,20000);assert.equal(r.afterEstateTax,680000);
  s.couple.relationship='unmarried';assert.equal(calculateEstate(h,s).estateTax,110000);
});
test('spouse exemption and allowance transfer are not inferred for unmarried parents',()=>{
  const r=calculateEstate(family(),coupleSettings({route:'survivor',relationship:'unmarried'}));
  assert.equal(r.first.estateTax,70000);assert.equal(r.transferBasicPercent,0);assert.equal(r.transferResidencePercent,0);assert.equal(r.second.estateTax,172000);assert.equal(r.estateTax,242000);assert.equal(r.afterEstateTax,758000);
  assert.equal(total(r.settlement,'amount'),70000);assert.equal(total(r.beneficiaries,'afterEstateTax'),758000);
});
test('first-death residence taper reduces transfer even where everything goes to a spouse',()=>{
  const h={...family(),assets:[home(600000),cash(1500000)]};
  const r=calculateEstate(h,coupleSettings({route:'survivor'}));assert.equal(r.first.estateTax,0);assert.equal(r.transferBasicPercent,100);assert.ok(Math.abs(r.transferResidencePercent-125000/175000*100)<1e-8);assert.equal(r.second.residenceBand,250000);
});
test('couple routes remove first-parent assets going to children; retained pensions use the second death rules',()=>{
  const h={...family(),assets:[{...cash(325000),owner:'partner'},{id:'p',kind:'dc-pension',owner:'primary',value:100000}]};
  const s=coupleSettings({firstDeathDate:'2027-04-05'});s.deathDate='2027-04-06';s.residenceAssetId='';
  const direct=calculateEstate(h,s);assert.equal(direct.first.outsideEstate,100000);assert.equal(direct.second.pensionValue,0);assert.equal(direct.estateTax,0);
  s.couple.route='survivor';const survivor=calculateEstate(h,s);assert.equal(survivor.second.pensionValue,100000);assert.equal(survivor.second.outsideEstate,0);assert.equal(survivor.afterEstateTax,425000);
});
test('family allocations conserve odd pennies, costs are counted once, and original records are unchanged',()=>{
  const h={...family(),assets:[{...cash(.01),owner:'shared'}]},before=JSON.stringify(h),s=coupleSettings();s.residenceAssetId='';s.beneficiaries=equalChildren(3);
  const r=calculateEstate(h,s);assert.equal(r.afterEstateTax,.01);assert.equal(total(r.beneficiaries,'afterEstateTax'),.01);assert.equal(JSON.stringify(h),before);
  const t=coupleSettings({route:'survivor',primaryCosts:1000,partnerCosts:2000});const paid=calculateEstate(family(),t);assert.equal(paid.costs,3000);assert.equal(paid.afterEstateTax,997000);
});
test('older inheritance saves migrate safely and couple assumptions reject invalid relationships/dates',()=>{
  const old=settings();delete old.couple;assert.equal(validateEstateSettings(old).couple.route,'direct');
  assert.throws(()=>calculateEstate(family(),coupleSettings({relationship:'unconfirmed'})),/married/);
  assert.throws(()=>calculateEstate(family(),coupleSettings({firstDeathDate:'2029-01-01'})),/first death/i);
  const s=coupleSettings();s.beneficiaries[0].relationship='other';assert.throws(()=>calculateEstate(family(),s),/children/);
});
test('couple route, dates and relationship survive saved household versions',()=>{
  const picture={version:1,holdings:createPublicDemoHousehold(),flow:createExampleMonthlyFlow(),planning:{scenario:{years:1},metric:'income',group:'person',style:'bars',real:true},inheritance:coupleSettings({route:'survivor'})};
  assert.deepEqual(validatePicture(picture).inheritance,picture.inheritance);
  picture.inheritance.couple.route='unsupported';assert.throws(()=>validatePicture(picture),/couple/);
});
