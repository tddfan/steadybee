/** Dated, immutable baseline snapshots. No storage, account requests or current-state writes. */
import {projectPlan} from './planning.mjs?v=20261024persona1';
import {resolveRetirementYears} from './planning-retirement.mjs?v=20261024persona1';

export const BASELINE_ENGINE_VERSION='planning-20261025-tracking1';
const supportedEngineVersions=new Set(['planning-20261025-baseline1',BASELINE_ENGINE_VERSION]);
export const BASELINE_RULE_VERSION='UK-2026-27-EWNI-fixed-thresholds';
export const MAX_BASELINE_VERSIONS=12;
const columns=Object.freeze(['assetsTotal','debtsTotal','withdrawableAssets','lockedPensions','incomeTotal','spendingTotal','taxTotal','unfunded','remainder','withdrawalNet','pensionContributions','debtPayment','incomeByPerson.primary','incomeByPerson.partner','incomeByPerson.shared','taxByPerson.primary','taxByPerson.partner','deflator']);
const stocks=new Set(['assetsTotal','debtsTotal','withdrawableAssets','lockedPensions']);
const record=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const monthPattern=/^\d{4}-(0[1-9]|1[0-2])$/;
const monthAt=(month,index)=>{const [y,m]=month.split('-').map(Number);return new Date(Date.UTC(y,m-1+index,1)).toISOString().slice(0,7);};
export function validBaselineDate(value){
 return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&value>='1900-01-01'&&value<='2200-12-31'&&Number.isFinite(Date.parse(`${value}T12:00:00Z`))&&new Date(`${value}T12:00:00Z`).toISOString().slice(0,10)===value;
}
function validTimestamp(value){return typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;}
function frozenForecast(projection){
 const years=[];
 for(const row of projection.months){
  const year=Number(row.month.slice(0,4));let group=years.at(-1);
  if(group?.year!==year){group={year,months:[]};years.push(group);}
  // Money is stored as integer pennies; grouping by year keeps import arrays bounded.
  group.months.push([Number(row.month.slice(5)),...columns.map(key=>key==='deflator'?row.deflator:Math.round((key.split('.').reduce((x,k)=>x?.[k],row)??0)*100))]);
 }
 return {version:1,engineVersion:BASELINE_ENGINE_VERSION,ruleVersion:BASELINE_RULE_VERSION,startMonth:projection.startMonth,endMonth:projection.endMonth,columns:[...columns],years,opening:structuredClone(projection.opening),assumptions:structuredClone(projection.assumptions),firstUnfundedMonth:projection.firstUnfundedMonth,unmodelledDebt:projection.unmodelledDebt,warnings:[...projection.warnings],taxLimitations:[...projection.taxLimitations]};
}

/** Caller validates the whole candidate document before committing it to application state. */
export function appendBaselineVersion(picture,{id=crypto.randomUUID(),name='',startDate,createdAt=new Date().toISOString()}={}){
 if(!validBaselineDate(startDate))throw new Error('Choose a valid baseline start date from 1900 to 2200.');
 if(!validTimestamp(createdAt))throw new Error('The baseline creation date is invalid.');
 if(picture.example)throw new Error('Set up your own household before creating a baseline; the public example is separate.');
 if(!picture.holdings?.name?.trim()||!Number.isInteger(picture.holdings.age))throw new Error('Complete your household name and age before setting a baseline.');
 const history=structuredClone(picture.baselines||{version:1,entries:[]});
 if(history.entries.length>=MAX_BASELINE_VERSIONS)throw new Error(`This household already has ${MAX_BASELINE_VERSIONS} baseline versions. Existing history has been kept.`);
 if(typeof id!=='string'||!id||id.length>80||history.entries.some(b=>b.id===id))throw new Error('Use a unique baseline identifier.');
 if(typeof name!=='string'||name.length>60)throw new Error('Use a baseline name of up to 60 characters.');
 const inputs=structuredClone(Object.fromEntries(['version','example','holdings','flow','planning','inheritance','insights'].filter(key=>picture[key]!==undefined).map(key=>[key,picture[key]])));
 inputs.example=false;
 // Keep dated records: a one-month receipt must not turn into permanent baseline pay.
 const sourceMonth=inputs.flow.timelineStartMonth||inputs.flow.asOfMonth;
 inputs.flow.timelineStartMonth=startDate.slice(0,7);inputs.flow.asOfMonth=startDate.slice(0,7);
 inputs.planning.scenario.retirementYears=resolveRetirementYears(inputs.flow,inputs.holdings,inputs.planning.scenario.retirementYears);
 const projection=projectPlan(inputs.flow,inputs.holdings,inputs.planning.scenario);
 history.entries.push({id,number:history.entries.length+1,name:name.trim()||`Baseline v${history.entries.length+1}`,startDate,createdAt,sourceMonth,inputs,forecast:frozenForecast(projection)});
 return {...structuredClone(picture),baselines:history};
}

/** Selection never changes the stored baseline list or the current household. */
export function activeBaseline(history,asOfDate){
 if(!validBaselineDate(asOfDate))throw new Error('Choose a valid comparison date.');
 return (history?.entries||[]).filter(b=>b.startDate<=asOfDate).sort((a,b)=>b.startDate.localeCompare(a.startDate)||b.number-a.number)[0]||null;
}
export function baselineMonths(baseline){
 return baseline.forecast.years.flatMap(group=>group.months.map(values=>{
  const row={month:`${group.year}-${String(values[0]).padStart(2,'0')}`};
  baseline.forecast.columns.forEach((key,i)=>{
   const value=key==='deflator'?values[i+1]:values[i+1]/100;
   const [parent,child]=key.split('.');if(child){row[parent]||={};row[parent][child]=value;}else row[key]=value;
  });return row;
 }));
}
export function baselineAnnualView(baseline){
 const years=new Map();
 for(const month of baselineMonths(baseline)){
  const year=month.month.slice(0,4),row=years.get(year)||{year,months:0};row.months++;
  for(const key of columns.filter(k=>!k.includes('.')&&k!=='deflator'))row[key]=stocks.has(key)?month[key]:Math.round(((row[key]||0)+month[key])*100)/100;
  years.set(year,row);
 }
 return [...years.values()];
}

export function validateBaselineHistory(history,validateSnapshot){
 if(!record(history)||history.version!==1||!Array.isArray(history.entries)||!history.entries.length||history.entries.length>MAX_BASELINE_VERSIONS||Object.keys(history).some(k=>!['version','entries'].includes(k)))throw new Error('The baseline history is invalid.');
 const ids=new Set();
 for(const [index,b] of history.entries.entries()){
  if(!record(b)||typeof b.id!=='string'||!b.id||b.id.length>80||ids.has(b.id)||b.number!==index+1||typeof b.name!=='string'||!b.name.trim()||b.name.length>60||!validBaselineDate(b.startDate)||!validTimestamp(b.createdAt)||!monthPattern.test(b.sourceMonth))throw new Error('A baseline version has invalid dates, name or identifier.');
  ids.add(b.id);
  if(!record(b.inputs)||b.inputs.baselines!=null||b.inputs.example!==false)throw new Error('A baseline must contain personal inputs without nested baseline history.');
  validateSnapshot(b.inputs);
  const f=b.forecast;
  if(!record(f)||f.version!==1||!supportedEngineVersions.has(f.engineVersion)||f.ruleVersion!==BASELINE_RULE_VERSION||f.startMonth!==b.startDate.slice(0,7)||b.inputs.flow.timelineStartMonth!==f.startMonth||b.inputs.flow.asOfMonth!==f.startMonth||!monthPattern.test(f.endMonth)||JSON.stringify(f.columns)!==JSON.stringify(columns)||!Array.isArray(f.years)||!f.years.length||f.years.length>101||!record(f.opening)||!record(f.assumptions)||!Number.isInteger(f.assumptions.years)||f.assumptions.years<1||f.assumptions.years>100||!Number.isFinite(f.unmodelledDebt)||f.unmodelledDebt<0||!['assetsTotal','debtsTotal'].every(k=>Number.isFinite(f.opening[k])&&f.opening[k]>=0))throw new Error('The frozen baseline forecast is invalid.');
  for(const key of ['warnings','taxLimitations'])if(!Array.isArray(f[key])||f[key].length>200||f[key].some(value=>typeof value!=='string'||value.length>2000))throw new Error('The baseline forecast notes are invalid.');
  let indexOfMonth=0,lastYear=null;
  for(const group of f.years){
   if(!record(group)||!Number.isInteger(group.year)||group.year===lastYear||!Array.isArray(group.months)||!group.months.length||group.months.length>12)throw new Error('The baseline forecast years are invalid.');
   lastYear=group.year;
   for(const row of group.months){
    const expected=monthAt(f.startMonth,indexOfMonth++);
    if(!Array.isArray(row)||row.length!==columns.length+1||group.year!==Number(expected.slice(0,4))||row[0]!==Number(expected.slice(5))||row.slice(1,-1).some(v=>!Number.isSafeInteger(v))||!Number.isFinite(row.at(-1))||row.at(-1)<=0)throw new Error('The baseline forecast months are invalid.');
   }
  }
  if(indexOfMonth!==f.assumptions.years*12||f.endMonth!==monthAt(f.startMonth,indexOfMonth-1)||(f.firstUnfundedMonth!=null&&(!monthPattern.test(f.firstUnfundedMonth)||f.firstUnfundedMonth<f.startMonth||f.firstUnfundedMonth>f.endMonth)))throw new Error('The baseline forecast horizon is invalid.');
 }
 return structuredClone(history);
}
