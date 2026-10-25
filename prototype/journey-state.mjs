/** Dated household records and frozen baseline illustrations. No account writes. */
import {validateDraft} from './asset-ledger.mjs';
import {summarizeMonthlyFlow} from './monthly-flow.mjs';
import {eligibleWithdrawalBucket} from './withdrawals.mjs';

export const GOAL_TYPES=Object.freeze({retirement:'Maintain my retirement lifestyle',independence:'Make work optional earlier',legacy:'Leave money to family'});
export const JOURNEY_LIMITS=Object.freeze({checkpoints:60,previousBaselines:4,months:1200,bytes:900000});
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const round=value=>Math.round(value*100)/100;
const copy=value=>structuredClone(value);
const money=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1e11;
const modelAmount=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
const validMonth=value=>typeof value==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(value)&&value>='1900-01'&&value<='2300-12';
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&validMonth(value.slice(0,7))&&Number.isFinite(Date.parse(`${value}T12:00:00Z`))&&new Date(`${value}T12:00:00Z`).toISOString().slice(0,10)===value;
const allowed=(value,keys,label)=>{if(!record(value)||Object.keys(value).some(key=>!keys.includes(key)))throw new Error(`Invalid ${label}.`);};
const monthAt=(month,delta)=>{const [y,m]=month.split('-').map(Number);return new Date(Date.UTC(y,m-1+delta,1)).toISOString().slice(0,7);};

export function createGoal(overrides={}) {
  return validateGoal({type:'retirement',retirementAge:null,monthlySpending:null,reserve:0,legacyTarget:0,...overrides});
}
export function validateGoal(value) {
  allowed(value,['type','retirementAge','monthlySpending','reserve','legacyTarget'],'goal');
  if(!Object.hasOwn(GOAL_TYPES,value.type)||!(value.retirementAge===null||Number.isInteger(value.retirementAge)&&value.retirementAge>=18&&value.retirementAge<=100)||!(value.monthlySpending===null||money(value.monthlySpending))||!money(value.reserve)||!money(value.legacyTarget))throw new Error('Check your goal, target age, spending and reserve.');
  return copy(value);
}
export function createJourney(goal={}) {
  return {version:1,goal:createGoal(goal),baseline:null,previousBaselines:[],checkpoints:[]};
}

function checkTree(value,depth=0,seen=new WeakSet()) {
  if(depth>22)throw new Error('Journey history is too deeply nested.');
  if(typeof value==='number'&&!Number.isFinite(value)||typeof value==='string'&&value.length>2000||['function','symbol','bigint'].includes(typeof value))throw new Error('Invalid journey history value.');
  if(value&&typeof value==='object'){
    if(seen.has(value))throw new Error('Journey history must not contain circular records.');
    seen.add(value);
    if(Array.isArray(value)&&value.length>200)throw new Error('Journey history contains too many entries.');
    for(const [key,child]of Object.entries(value)){
      if(['__proto__','prototype','constructor'].includes(key)||key.length>128)throw new Error('Unsupported journey history field.');
      checkTree(child,depth+1,seen);
    }
    seen.delete(value);
  }
}

/** History includes inputs and scenario only; saved alternatives and history never nest. */
function freezePicture(picture) {
  if(!record(picture)||!record(picture.holdings)||!record(picture.flow)||!record(picture.planning))throw new Error('A household picture is required.');
  const result={version:1,holdings:copy(picture.holdings),flow:copy(picture.flow),planning:copy(picture.planning)};
  if(picture.example!=null)result.example=picture.example;
  if(picture.inheritance!=null)result.inheritance=copy(picture.inheritance);
  if(picture.insights!=null)result.insights=copy(picture.insights);
  delete result.planning.experiments;
  return result;
}

/** Reported opening balances; eligible pensions follow the engine's existing access rules. */
export function recordedTotals(picture) {
  const holdings=picture.holdings,context={month:picture.flow.asOfMonth,pensionAccessAge:picture.planning?.scenario?.pensionAccessAge??55,ages:{primary:holdings.age,partner:holdings.partnerAge}};
  const totals={assets:0,debts:0,netWorth:0,accessible:0,byPerson:{primary:{assets:0,debts:0,netWorth:0,accessible:0},partner:{assets:0,debts:0,netWorth:0,accessible:0}}};
  function add(item,key,value){
    totals[key]=round(totals[key]+value);
    const owner=item.owner||'primary',shares=owner==='shared'?{primary:round(value/2),partner:round(value-round(value/2))}:{[owner]:value};
    for(const [person,part]of Object.entries(shares))if(totals.byPerson[person])totals.byPerson[person][key]=round(totals.byPerson[person][key]+part);
  }
  for(const asset of holdings.assets){add(asset,'assets',asset.value);if(eligibleWithdrawalBucket(asset,context))add(asset,'accessible',asset.value);}
  for(const debt of holdings.debts)add(debt,'debts',debt.balance);
  totals.netWorth=round(totals.assets-totals.debts);
  for(const value of Object.values(totals.byPerson))value.netWorth=round(value.assets-value.debts);
  return totals;
}
function evidenceFor(picture) {
  const summary=summarizeMonthlyFlow(picture.flow,picture.holdings);
  return {income:summary.incomeTotal,spending:summary.spendingTotal,surplus:round(summary.incomeTotal-summary.spendingTotal)};
}
function projectionSummary(projection) {
  if(!record(projection)||!Array.isArray(projection.months)||!projection.months.length||projection.months.length>JOURNEY_LIMITS.months)throw new Error('A monthly projection is required.');
  const last=projection.months.at(-1);
  return {endMonth:projection.endMonth,firstGap:projection.firstUnfundedMonth??null,unfunded:round(projection.months.reduce((sum,row)=>sum+row.unfunded/row.deflator,0)),accessibleAtEnd:round(last.withdrawableAssets/last.deflator)};
}
function verifyProjectionOpening(projection,totals) {
  if(!record(projection?.opening)||!modelAmount(projection.opening.assetsTotal)||!modelAmount(projection.opening.debtsTotal)||Math.abs(projection.opening.assetsTotal-totals.assets)>.01||Math.abs(projection.opening.debtsTotal-totals.debts)>.01)throw new Error('Recalculate your outlook from the current recorded balances before saving.');
}
function projectionPath(projection) {
  const result={};
  for(const [index,row]of projection.months.entries()){
    if(!validMonth(row.month)||row.month!==monthAt(projection.startMonth,index))throw new Error('A baseline needs a continuous monthly projection.');
    result[row.month]={assets:row.assetsTotal,debts:row.debtsTotal,netWorth:round(row.assetsTotal-row.debtsTotal),accessible:row.withdrawableAssets,deflator:row.deflator,income:row.incomeTotal,spending:row.spendingTotal,tax:row.taxTotal,unfunded:row.unfunded};
  }
  return result;
}
function metadata(picture,options,prefix) {
  const date=options.date??`${picture.flow.asOfMonth}-01`;
  if(!validDate(date))throw new Error('Choose a valid update date.');
  const recordedAt=options.recordedAt??new Date().toISOString();
  const id=options.id??`${prefix}-${globalThis.crypto?.randomUUID?.()??`${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
  return {id,date,month:date.slice(0,7),recordedAt};
}
function assertUnique(state,id) {
  if([state.baseline,...state.previousBaselines,...state.checkpoints].filter(Boolean).some(item=>item.id===id))throw new Error('History identifiers must be unique.');
}

export function saveBaseline(journey,picture,projection,options={}) {
  const state=validateJourney(journey??createJourney()),input=freezePicture(picture),meta=metadata(input,options,'baseline');
  verifyProjectionOpening(projection,recordedTotals(input));
  assertUnique(state,meta.id);
  if(state.baseline&&meta.date<state.baseline.date||state.checkpoints.length&&meta.date<state.checkpoints.at(-1).date)throw new Error('A new baseline cannot be before your latest confirmed update.');
  if(state.baseline){if(state.previousBaselines.length>=JOURNEY_LIMITS.previousBaselines)throw new Error('Keep up to four previous baselines. Download your history before starting another.');state.previousBaselines.push(state.baseline);}
  state.baseline={...meta,label:options.label?.trim()||'Starting plan',picture:input,goal:copy(state.goal),totals:recordedTotals(input),evidence:evidenceFor(input),path:projectionPath(projection),summary:projectionSummary(projection)};
  return validateJourney(state);
}
export function saveCheckpoint(journey,picture,projection,options={}) {
  const state=validateJourney(journey);
  if(!state.baseline)throw new Error('Save your starting baseline before recording an update.');
  if(state.checkpoints.length>=JOURNEY_LIMITS.checkpoints)throw new Error('Keep up to 60 confirmed updates. Download your history before adding more.');
  const input=freezePicture(picture),meta=metadata(input,options,'update');assertUnique(state,meta.id);
  verifyProjectionOpening(projection,recordedTotals(input));
  if(meta.date<state.baseline.date||state.checkpoints.length&&meta.date<state.checkpoints.at(-1).date)throw new Error('An update cannot be before your baseline or latest confirmed update.');
  state.checkpoints.push({...meta,baselineId:state.baseline.id,note:options.note?.trim()||'',picture:input,goal:copy(state.goal),totals:recordedTotals(input),evidence:evidenceFor(input),contributions:options.contributions??null,withdrawals:options.withdrawals??null,summary:projectionSummary(projection)});
  return validateJourney(state);
}

function validateTotals(totals) {
  allowed(totals,['assets','debts','netWorth','accessible','byPerson'],'recorded totals');
  if(!modelAmount(totals.assets)||!modelAmount(totals.debts)||!modelAmount(totals.accessible)||!Number.isFinite(totals.netWorth)||Math.abs(totals.netWorth-round(totals.assets-totals.debts))>.01)throw new Error('Invalid recorded balances.');
  allowed(totals.byPerson,['primary','partner'],'owner totals');
  for(const person of ['primary','partner']){
    const item=totals.byPerson[person];allowed(item,['assets','debts','netWorth','accessible'],'owner balances');
    if(!modelAmount(item.assets)||!modelAmount(item.debts)||!modelAmount(item.accessible)||!Number.isFinite(item.netWorth)||Math.abs(item.netWorth-round(item.assets-item.debts))>.01)throw new Error('Invalid owner balances.');
  }
}
function validateSummary(summary) {
  allowed(summary,['endMonth','firstGap','unfunded','accessibleAtEnd'],'frozen outlook');
  if(!validMonth(summary.endMonth)||!(summary.firstGap===null||validMonth(summary.firstGap))||!modelAmount(summary.unfunded)||!modelAmount(summary.accessibleAtEnd))throw new Error('Invalid frozen outlook.');
}
function validateSnapshot(item,baseline,validatePicture) {
  allowed(item,['id','baselineId','date','month','recordedAt','label','note','picture','goal','totals','evidence','path','summary','contributions','withdrawals'],'history record');
  if(typeof item.id!=='string'||!item.id||item.id.length>100||!validDate(item.date)||item.month!==item.date.slice(0,7)||typeof item.recordedAt!=='string'||!Number.isFinite(Date.parse(item.recordedAt)))throw new Error('Invalid history date or identifier.');
  if(baseline?(typeof item.label!=='string'||!item.label.trim()||item.label.length>80):(typeof item.baselineId!=='string'||typeof item.note!=='string'||item.note.length>280||!['contributions','withdrawals'].every(key=>item[key]===null||money(item[key]))))throw new Error('Check the update notes and actual additions or withdrawals.');
  if(!record(item.picture)||item.picture.journey!=null||item.picture.planning?.experiments!=null)throw new Error('Frozen household pictures must not contain nested history or alternatives.');
  allowed(item.picture,['version','example','holdings','flow','planning','inheritance','insights'],'frozen household picture');
  if(item.picture.version!==1||!record(item.picture.flow)||!record(item.picture.planning)||!record(item.picture.planning.scenario))throw new Error('A frozen household picture needs its inputs and scenario.');
  const draft=validateDraft(item.picture.holdings);if(!draft.valid)throw new Error(draft.errors[0].message);
  if(validatePicture)validatePicture(item.picture);
  validateGoal(item.goal);validateTotals(item.totals);validateSummary(item.summary);
  const expected=recordedTotals(item.picture);
  for(const key of ['assets','debts','netWorth','accessible']){
    if(Math.abs(expected[key]-item.totals[key])>.001)throw new Error('Frozen balances must match the recorded household.');
    for(const owner of ['primary','partner'])if(Math.abs(expected.byPerson[owner][key]-item.totals.byPerson[owner][key])>.001)throw new Error('Frozen owner balances must match the recorded household.');
  }
  allowed(item.evidence,['income','spending','surplus'],'recorded monthly flow');
  if(!money(item.evidence.income)||!money(item.evidence.spending)||!Number.isFinite(item.evidence.surplus)||Math.abs(item.evidence.surplus-round(item.evidence.income-item.evidence.spending))>.01)throw new Error('Invalid recorded income or spending.');
  if(baseline){
    if(!record(item.path)||!Object.keys(item.path).length||Object.keys(item.path).length>JOURNEY_LIMITS.months)throw new Error('Invalid frozen monthly path.');
    const entries=Object.entries(item.path).sort(([a],[b])=>a.localeCompare(b));
    for(const [index,[month,row]]of entries.entries()){
      if(!validMonth(month)||index&&month!==monthAt(entries[index-1][0],1))throw new Error('Invalid monthly baseline dates.');
      allowed(row,['assets','debts','netWorth','accessible','deflator','income','spending','tax','unfunded'],'frozen monthly balance');
      if(!['assets','debts','accessible','income','spending','unfunded'].every(key=>modelAmount(row[key]))||!Number.isFinite(row.tax)||!Number.isFinite(row.deflator)||row.deflator<=0||!Number.isFinite(row.netWorth)||Math.abs(row.netWorth-round(row.assets-row.debts))>.01)throw new Error('Invalid frozen monthly amounts.');
    }
    if(entries.at(-1)[0]!==item.summary.endMonth)throw new Error('Frozen path and outlook must end in the same month.');
  }else if(item.path!=null)throw new Error('Updates keep reported facts, not another projection path.');
}
export function validateJourney(value,{validatePicture}={}) {
  checkTree(value);allowed(value,['version','goal','baseline','previousBaselines','checkpoints'],'journey');
  if(value.version!==1||!Array.isArray(value.previousBaselines)||value.previousBaselines.length>JOURNEY_LIMITS.previousBaselines||!Array.isArray(value.checkpoints)||value.checkpoints.length>JOURNEY_LIMITS.checkpoints)throw new Error('Keep up to four previous baselines and 60 confirmed updates.');
  validateGoal(value.goal);
  const ids=new Set(),all=[...value.previousBaselines,...(value.baseline?[value.baseline]:[])];
  if(value.baseline!==null&&!record(value.baseline)||!value.baseline&&(value.previousBaselines.length||value.checkpoints.length))throw new Error('History needs its baseline.');
  let priorDate='';
  for(const item of all){validateSnapshot(item,true,validatePicture);if(item.date<priorDate)throw new Error('Baselines must be in date order.');priorDate=item.date;}
  priorDate='';
  for(const item of value.checkpoints){validateSnapshot(item,false,validatePicture);const sourceBaseline=all.find(b=>b.id===item.baselineId);if(!sourceBaseline||item.date<sourceBaseline.date||item.date<priorDate)throw new Error('Updates cannot be before their baseline or previous update.');priorDate=item.date;}
  for(const item of [...all,...value.checkpoints]){if(ids.has(item.id))throw new Error('History identifiers must be unique.');ids.add(item.id);}
  if(new TextEncoder().encode(JSON.stringify(value)).length>JOURNEY_LIMITS.bytes)throw new Error('Journey history is too large. Download a copy before adding more records.');
  return copy(value);
}

function changedEntries(before,after,key) {
  const a=new Map(before.map(item=>[item.id,item])),b=new Map(after.map(item=>[item.id,item]));
  return [...new Set([...a.keys(),...b.keys()])].map(id=>({id,label:b.get(id)?.label||a.get(id)?.label||b.get(id)?.kind||a.get(id)?.kind,before:a.get(id)?.[key]??0,after:b.get(id)?.[key]??0})).filter(item=>item.before!==item.after).map(item=>({...item,change:round(item.after-item.before)}));
}
/** Baseline forecast is month-resolution; never imply exact daily investment performance. */
export function compareWithBaseline(journey,checkpoint=journey?.checkpoints?.at(-1)) {
  const state=validateJourney(journey);if(!state.baseline||!checkpoint||checkpoint.baselineId!==state.baseline.id)return null;
  const baseline=state.baseline,actual=checkpoint.totals;
  const expected=checkpoint.month===baseline.month?baseline.totals:checkpoint.month>baseline.month?baseline.path[monthAt(checkpoint.month,-1)]??null:null;
  const fields=['assets','debts','netWorth','accessible'],delta=before=>Object.fromEntries(fields.map(key=>[key,round(actual[key]-before[key])]));
  const index=state.checkpoints.findIndex(item=>item.id===checkpoint.id);
  const intervals=state.checkpoints.slice(0,index+1).filter(item=>item.baselineId===baseline.id);
  const known=intervals.length>0&&intervals.every(item=>item.contributions!==null&&item.withdrawals!==null);
  const contributions=known?round(intervals.reduce((sum,item)=>sum+item.contributions,0)):null,withdrawals=known?round(intervals.reduce((sum,item)=>sum+item.withdrawals,0)):null;
  const net=known?round(contributions-withdrawals):null;
  return {baselineId:baseline.id,checkpointId:checkpoint.id,date:checkpoint.date,month:checkpoint.month,expected:expected?Object.fromEntries(fields.map(key=>[key,expected[key]])):null,actual:copy(actual),difference:expected?delta(expected):null,recordedChange:delta(baseline.totals),movements:{contributions,withdrawals,net,unexplainedAssetChange:known?round(actual.assets-baseline.totals.assets-net):null},changes:{assets:changedEntries(baseline.picture.holdings.assets,checkpoint.picture.holdings.assets,'value'),debts:changedEntries(baseline.picture.holdings.debts,checkpoint.picture.holdings.debts,'balance'),income:{before:baseline.evidence.income,after:checkpoint.evidence.income,change:round(checkpoint.evidence.income-baseline.evidence.income)},spending:{before:baseline.evidence.spending,after:checkpoint.evidence.spending,change:round(checkpoint.evidence.spending-baseline.evidence.spending)},scenarioChanged:JSON.stringify(baseline.picture.planning.scenario)!==JSON.stringify(checkpoint.picture.planning.scenario),goalChanged:JSON.stringify(baseline.goal)!==JSON.stringify(checkpoint.goal)},comparisonBasis:'opening-month',comparisonNote:expected?`Compared with the baseline illustration at the start of ${checkpoint.month}. Reported values may be dated later in that month. Differences are not investment returns.`:'This update is outside the frozen baseline projection. Recorded changes remain available; a forecast comparison is unavailable.'};
}
