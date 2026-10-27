/** Lifeline comparison, aggregation and provenance. Archived forecasts are never recalculated. */
import {projectPlan} from './planning.mjs?v=20261024persona1';
import {resolveRetirementYears} from './planning-retirement.mjs?v=20261024persona1';
import {activeBaseline,baselineMonths,validBaselineDate} from './baseline-history.mjs?v=20261025baseline1';
import {activeTrackingEntries,trackingMonthOffset,rewindTrackedInputs,applyTrackedBalances} from './tracking.mjs?v=20261025tracking1';
import {eligibleWithdrawalBucket} from './withdrawals.mjs?v=20261024persona1';

import {lifelineTurningPoints} from './lifeline-health.mjs?v=20261027cashflow1';

export const LIFELINE_METRICS=Object.freeze({netWorth:{title:'Net assets',stock:true},accessible:{title:'Accessible investments',stock:true},assets:{title:'Assets',stock:true},debts:{title:'Debt',stock:true},income:{title:'Income after tax',stock:false},funding:{title:'Money in & out',stock:false},saving:{title:'New savings',stock:false},spending:{title:'Spending',stock:false},tax:{title:'Tax & NI',stock:false}});
export const LIFELINE_DEFAULTS=Object.freeze({version:1,view:'life',metric:'funding',real:true,yearBasis:'calendar',selectedMonth:null,selectedDate:null,baselineId:null});
const validMonth=m=>typeof m==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(m);
const round=n=>Math.round(n*100)/100;
export const shiftLifelineMonth=(m,n)=>{const [y,month]=m.split('-').map(Number);return new Date(Date.UTC(y,month-1+n,1)).toISOString().slice(0,7);};
export const lifelineMonthEnd=m=>{const [y,month]=m.split('-').map(Number);return new Date(Date.UTC(y,month,0)).toISOString().slice(0,10);};
export function lifelineToday(){const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(p=>[p.type,p.value]));return `${parts.year}-${parts.month}-${parts.day}`;}
export function validateLifelineSettings(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||value.version!==1||Object.keys(value).some(k=>!Object.hasOwn(LIFELINE_DEFAULTS,k))||!['life','year','month'].includes(value.view)||!Object.hasOwn(LIFELINE_METRICS,value.metric)||typeof value.real!=='boolean'||!['calendar','taxYear'].includes(value.yearBasis)||value.selectedMonth!=null&&!validMonth(value.selectedMonth)||value.selectedDate!=null&&!validBaselineDate(value.selectedDate)||value.selectedDate!=null&&value.selectedMonth!=null&&!value.selectedDate.startsWith(value.selectedMonth)||value.baselineId!=null&&(typeof value.baselineId!=='string'||!value.baselineId||value.baselineId.length>80))throw new Error('The Lifeline view settings are invalid.');
 return structuredClone({...LIFELINE_DEFAULTS,...value});
}
export function createLifelineModel(picture,{today=lifelineToday(),baselineId=null,exampleReference=null}={}){
 if(!validBaselineDate(today))throw new Error('Choose a valid Lifeline inspection date.');
 const entries=picture.baselines?.entries||[],first=entries[0],flow=structuredClone(picture.flow);
 // Inspection of a different reference never changes the current path's opening basis.
 flow.timelineStartMonth=flow.tracking?.startMonth||(first&&first.startDate<=today?first.forecast.startMonth:flow.timelineStartMonth||flow.asOfMonth);
 const scenario=structuredClone(picture.planning.scenario);scenario.retirementYears=resolveRetirementYears(flow,picture.holdings,scenario.retirementYears);
 const current=projectPlan(flow,picture.holdings,{...scenario,captureEstateBalances:true});
 const reference=baselineId?entries.find(b=>b.id===baselineId)||null:activeBaseline(picture.baselines,today);
 const referenceMonths=reference?baselineMonths(reference):exampleReference?.months||[];
 const all=[current.startMonth,current.endMonth,...(referenceMonths.length?[referenceMonths[0].month,referenceMonths.at(-1).month]:[])].sort();
 const model={today,basisMonth:today.slice(0,7),inflation:current.assumptions.inflation,current,reference,referenceMonths,exampleReference:reference?null:exampleReference,startMonth:all[0],endMonth:all.at(-1),picture};
 model.events=lifelineEvents(model);return model;
}
export function lifelineWindow(view,selectedMonth,startMonth,endMonth,yearBasis='calendar'){
 if(view==='life')return {startMonth,endMonth};
 if(view==='month')return {startMonth:selectedMonth,endMonth:selectedMonth};
 const year=Number(selectedMonth.slice(0,4))-(yearBasis==='taxYear'&&Number(selectedMonth.slice(5))<4?1:0);
 return {startMonth:`${year}-${yearBasis==='taxYear'?'04':'01'}`,endMonth:`${year+(yearBasis==='taxYear'?1:0)}-${yearBasis==='taxYear'?'03':'12'}`};
}
function nominal(row,metric){
 if(metric==='saving')return Number.isFinite(row.remainder)?Math.max(0,row.remainder):null;
 if(metric==='funding')return Number.isFinite(row.incomeTotal)&&Number.isFinite(row.withdrawalNet)?row.incomeTotal+row.withdrawalNet:null;
 const field={accessible:'withdrawableAssets',assets:'assetsTotal',debts:'debtsTotal',income:'incomeTotal',spending:'spendingTotal',tax:'taxTotal'}[metric];
 if(metric==='netWorth')return Number.isFinite(row.assetsTotal)&&Number.isFinite(row.debtsTotal)?row.assetsTotal-row.debtsTotal:null;
 return Number.isFinite(row[field])?row[field]:null;
}
export function lifelineMoney(value,month,{real=true,basisMonth,inflation=0}={}){return value==null?null:value/(real?(1+inflation/100)**((trackingMonthOffset(basisMonth,month)+1)/12):1);}
export function lifelineValue(row,{metric='netWorth',...basis}={}){return lifelineMoney(nominal(row,metric),row.month,basis);}
export function lifelineSeries(months,{view='life',metric='netWorth',real=true,basisMonth,inflation=0}={}){
 const groups=new Map(),basis={metric,real,basisMonth,inflation};
 for(const month of months){const key=view==='life'?month.month.slice(0,4):month.month;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(month);}
 return [...groups].map(([key,rows])=>{
  const values=rows.map(r=>lifelineValue(r,basis)),valid=values.every(v=>v!==null);
  return {key,startMonth:rows[0].month,endMonth:rows.at(-1).month,date:lifelineMonthEnd(rows.at(-1).month),months:rows.length,estimated:true,value:valid?round(LIFELINE_METRICS[metric].stock?values.at(-1):values.reduce((a,b)=>a+b,0)):null,rows};
 });
}
/** Sum each monthly component independently: annual surpluses cannot cancel unpaid months. */
export function lifelineCashflowSeries(months,options={}){
 const {view='life',...basis}=options,groups=new Map();
 for(const r of months){const key=view==='life'?r.month.slice(0,4):r.month;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);}
 return [...groups].map(([key,rows])=>{
  const sum=fn=>round(rows.reduce((s,r)=>s+lifelineMoney(fn(r),r.month,basis),0));
  return {key,startMonth:rows[0].month,endMonth:rows.at(-1).month,months:rows.length,rows,
   income:sum(r=>r.incomeTotal),withdrawals:sum(r=>r.withdrawalNet),moneyIn:sum(r=>r.incomeTotal+r.withdrawalNet),
   costs:sum(r=>r.spendingTotal),paid:sum(r=>Math.max(0,r.spendingTotal-r.unfunded)),shortfall:sum(r=>r.unfunded),
   shortMonths:rows.filter(r=>r.unfunded>.01).length,saved:sum(r=>Math.max(0,r.remainder))};
 });
}
export function lifelinePeriodStatus(rows){
 if(rows.some(r=>r.unfunded>.01))return {kind:'shortfall',label:'Some costs unpaid'};
 if(rows.some(r=>r.withdrawalNet>.01))return {kind:'assets',label:'Covered using assets'};
 return {kind:'income',label:'Covered by income'};
}
function totals(rows,basis){
 if(!rows.length)return null;const closing=rows.at(-1),result={startMonth:rows[0].month,endMonth:closing.month,months:rows.length,rows,estimated:true,taxIncomplete:rows.some(r=>r.taxIncomplete)};
 for(const metric of Object.keys(LIFELINE_METRICS))result[metric]=lifelineSeries(rows,{...basis,metric,view:'life'}).reduce((value,group)=>LIFELINE_METRICS[metric].stock?group.value:value==null||group.value==null?null:value+group.value,LIFELINE_METRICS[metric].stock?null:0);
 for(const field of ['withdrawalNet','pensionContributions','unfunded','debtPayment'])result[field]=rows.every(r=>Number.isFinite(r[field]))?round(rows.reduce((sum,r)=>sum+lifelineMoney(r[field],r.month,basis),0)):null;
 const types=new Set(rows.flatMap(r=>Object.keys(r.taxByType||{})));result.taxByType=Object.fromEntries([...types].map(type=>[type,round(rows.reduce((sum,r)=>sum+lifelineMoney(r.taxByType?.[type]||0,r.month,basis),0))]));
 return result;
}
export function lifelinePeriod(model,selectedMonth,{view='life',real=true}={}){
 const start=view==='life'?`${selectedMonth.slice(0,4)}-01`:selectedMonth,end=view==='life'?`${selectedMonth.slice(0,4)}-12`:selectedMonth,basis={real,basisMonth:model.basisMonth,inflation:model.inflation};
 const currentRows=model.current.months.filter(r=>r.month>=start&&r.month<=end),referenceRows=model.referenceMonths.filter(r=>r.month>=start&&r.month<=end);
 const current=totals(currentRows,basis),reference=totals(referenceRows,basis);
 for(const [summary,rows,opening] of [[current,model.current.months,model.current.opening],[reference,model.referenceMonths,model.reference?.forecast.opening||model.exampleReference?.opening]]){
  if(!summary)continue;const previous=rows.find(r=>r.month===shiftLifelineMonth(summary.startMonth,-1));
  summary.openingNetWorth=previous?round(lifelineValue(previous,{...basis,metric:'netWorth'})):opening&&summary.startMonth===rows[0]?.month?round(lifelineMoney(opening.assetsTotal-opening.debtsTotal,shiftLifelineMonth(summary.startMonth,-1),basis)):null;
 }
 const comparable=Boolean(current&&reference&&currentRows.map(r=>r.month).join()===referenceRows.map(r=>r.month).join());
 return {current,reference,comparable,startMonth:start,endMonth:end,recorded:activeTrackingEntries(model.picture.flow.tracking).filter(e=>e.effectiveDate.slice(0,7)>=start&&e.effectiveDate.slice(0,7)<=end),events:model.events.filter(e=>e.date.slice(0,7)>=start&&e.date.slice(0,7)<=end)};
}
export function lifelineBreakdown(model,selectedMonth,{view='life',metric='netWorth',group='person',real=true}={}){
 const period=lifelinePeriod(model,selectedMonth,{view,real});if(!period.current||metric==='accessible')return [];
 const rows=LIFELINE_METRICS[metric].stock?[period.current.rows.at(-1)]:period.current.rows,result={},basis={real,basisMonth:model.basisMonth,inflation:model.inflation};
 const add=(key,n,month)=>{if(Number.isFinite(n))result[key]=(result[key]||0)+lifelineMoney(n,month,basis);};
 for(const r of rows){
  const suffix=group==='person'?'Person':'Type';
  if(metric==='netWorth'){for(const [key,n] of Object.entries(r[`assetsBy${suffix}`]||{}))add(key,n,r.month);for(const [key,n] of Object.entries(r[`debtsBy${suffix}`]||{}))add(key,-n,r.month);}
  else if(metric==='spending'){add('householdCosts',r.householdSpending,r.month);add('debtPayments',r.debtPayment,r.month);}
  else{const field=metric==='funding'||metric==='income'?'income':metric==='saving'?'saving':metric;const values=field==='tax'?(group==='person'?r.taxByPerson:r.taxByType):r[`${field}By${suffix}`];for(const [key,n] of Object.entries(values||{})){if(metric==='income'&&group==='type'&&key.startsWith('withdraw'))continue;add(key,n,r.month);}if(metric==='income'&&group==='person')for(const w of r.withdrawals||[])add(w.owner,-w.net,r.month);}
 }
 return Object.entries(result).filter(([,value])=>Math.abs(value)>.005).map(([key,value])=>({key,value:round(value)}));
}
export function lifelineCumulativeTax(model,endMonth,{real=true}={}){const result={},basis={real,basisMonth:model.basisMonth,inflation:model.inflation};for(const r of model.current.months.filter(r=>r.month<=endMonth))for(const [key,n] of Object.entries(r.taxByType||{}))result[key]=(result[key]||0)+lifelineMoney(n,r.month,basis);return Object.fromEntries(Object.entries(result).map(([k,n])=>[k,round(n)]));}
function lifelineEvents(model){
 const {picture,current}=model,events=[],add=e=>{if(e.date.slice(0,7)>=model.startMonth&&e.date.slice(0,7)<=model.endMonth)events.push(e);};
 for(const b of picture.baselines?.entries||[])add({id:`baseline-${b.id}`,date:b.startDate,label:`Baseline v${b.number}`,kind:'baseline',precision:'day',detail:`${b.name} · created ${b.createdAt.slice(0,10)}`});
 for(const e of activeTrackingEntries(picture.flow.tracking))add({id:e.id,date:e.effectiveDate,label:e.label,kind:'recorded',precision:'day',detail:`Recorded ${e.recordedAt.slice(0,10)}${e.mode==='period'?' · one month only':''}`,record:e});
 for(const [owner,date] of Object.entries(current.retirementDates))if(date)add({id:`retire-${owner}`,date:`${shiftLifelineMonth(date,1)}-01`,label:`${owner==='primary'?picture.holdings.name:picture.holdings.partnerName} stops work`,kind:'retirement',precision:'month',detail:`Expected final pay: ${date}`});
 for(const [owner,pension] of Object.entries(current.statePensions))add({id:`state-${owner}`,date:`${pension.startMonth}-01`,label:`${owner==='primary'?picture.holdings.name:picture.holdings.partnerName} State Pension`,kind:'pension',precision:'month',detail:'Estimated start under the current assumptions'});
 for(const owner of picture.holdings.partnerName?['primary','partner']:['primary']){
  const pots=picture.holdings.assets.filter(a=>a.kind==='dc-pension'&&(a.owner||'primary')===owner);if(!pots.length||!Number.isFinite(current.ages[owner]))continue;
  const eligible=(asset,index)=>eligibleWithdrawalBucket(asset,{month:current.months[index].month,pensionAccessAge:current.pensionAccessAge,ages:{[owner]:current.ages[owner]+index/12}})==='pension';
  if(pots.some(a=>eligible(a,0)))continue;
  const index=current.months.findIndex((_,index)=>pots.some(a=>eligible(a,index)));if(index>=0)add({id:`access-${owner}`,date:`${current.months[index].month}-01`,label:`${owner==='primary'?picture.holdings.name:picture.holdings.partnerName}: first pension access`,kind:'pension',precision:'month',detail:'Based on the recorded scheme/access assumptions, not verified eligibility'});
 }
 for(const entry of picture.flow.datedEntries||[])if(entry.startMonth)add({id:`scheduled-${entry.id}`,date:`${entry.startMonth}-01`,label:entry.label,kind:'scheduled',precision:'month',detail:entry.frequency==='once'?'One-off, in the scheduled month':'Scheduled recurring income or spending starts'});
 for(let i=1;i<current.months.length;i++)for(const debt of current.months[i].estateDebts||[])if(debt.balance===0&&(current.months[i-1].estateDebts||[]).some(d=>d.id===debt.id&&d.balance>0)&&!events.some(e=>e.kind==='recorded'&&e.date.startsWith(current.months[i].month)&&e.record.changes.some(c=>c.target.kind==='debt'&&c.target.id===debt.id)))add({id:`paid-${debt.id}-${current.months[i].month}`,date:lifelineMonthEnd(current.months[i].month),label:`${debt.label||'Debt'} paid off`,kind:'debt',precision:'month',detail:'Modelled repayment completion'});
 const opening=rewindTrackedInputs(picture.flow,picture.holdings).holdings;if(picture.flow.tracking)applyTrackedBalances(opening,picture.flow.tracking,current.startMonth,{beforeStart:true});
 for(const event of lifelineTurningPoints(current,opening))add(event);
 if(current.stressTest?.month)add({id:'stress',date:`${current.stressTest.month}-01`,label:'Market shock test',kind:'scheduled',precision:'month',detail:'The active stress-test assumption, not an actual market event'});
 for(let year=Number(model.startMonth.slice(0,4));year<=Number(model.endMonth.slice(0,4));year++)add({id:`tax-year-${year}`,date:`${year}-04-06`,label:`UK tax year ${year}/${String(year+1).slice(-2)}`,kind:'taxYear',precision:'day',detail:'The monthly tax model groups April–March; it does not split April at 6 April'});
 return events.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
}
