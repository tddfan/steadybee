/** Dated manual records. Pure replay only; no storage, network or financial recommendations. */
import {validateDraft} from './asset-ledger.mjs?v=20261022cashflow2';
const clone=value=>structuredClone(value??null),same=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null);
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const monthPattern=/^\d{4}-(0[1-9]|1[0-2])$/;
const payFields=['annualGross','annualBonus','annualTakeHome','employeePension','employeePensionRate','employerPension','employerPensionRate','endDate','niExemptFrom'];
const amountFields=new Set(['annualGross','annualBonus','annualTakeHome','employeePension','employerPension']);
const key=t=>JSON.stringify([t.kind,t.id,t.field]);
const round=value=>Math.round(value*100)/100;
export const trackingMonthOffset=(start,end)=>(Number(end.slice(0,4))-Number(start.slice(0,4)))*12+Number(end.slice(5))-Number(start.slice(5));
export function validTrackingDate(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&value>='1900-01-01'&&value<='2200-12-31'&&Number.isFinite(Date.parse(`${value}T12:00:00Z`))&&new Date(`${value}T12:00:00Z`).toISOString().slice(0,10)===value;}
export function activeTrackingEntries(history){const superseded=new Set((history?.entries||[]).map(e=>e.corrects).filter(Boolean));return (history?.entries||[]).filter(e=>!superseded.has(e.id)).sort((a,b)=>a.effectiveDate.localeCompare(b.effectiveDate)||history.entries.indexOf(a)-history.entries.indexOf(b));}
export function recordedPayReceipts(history,month){const result={};for(const e of activeTrackingEntries(history))if(e.mode==='period'&&e.effectiveDate.startsWith(month))for(const c of e.changes)if(c.target.kind==='pay'&&c.target.field==='annualTakeHome'&&c.value!==null)result[c.target.id]=round(c.value/12);return result;}
function write(inputs,t,value){
 if(['asset','debt','custom','dated'].includes(t.kind)){
  const list=t.kind==='custom'?inputs.flow.customSpending:t.kind==='dated'?inputs.flow.datedEntries:inputs.holdings[t.kind==='asset'?'assets':'debts'],index=list.findIndex(x=>x.id===t.id);
  if(value===null){if(index>=0)list.splice(index,1);}else if(index>=0)list[index]=clone(value);else list.push(clone(value));
 }else if(t.kind==='pay')inputs.flow.pay[t.id][t.field]=value===null&&amountFields.has(t.field)&&t.field!=='annualTakeHome'?0:value===null&&t.field.endsWith('Rate')?0:clone(value);
 else inputs.flow[t.kind][t.id]=clone(value);
}
export function rewindTrackedInputs(flow,holdings){
 const {tracking,...facts}=flow;const result={flow:structuredClone(facts),holdings:structuredClone(holdings)};
 const seen=new Set();for(const entry of flow.tracking?.entries||[])for(const c of entry.changes){const k=key(c.target);if(!seen.has(k)){write(result,c.target,c.before);seen.add(k);}}
 return result;
}
export function trackedInputsAt(flow,holdings,month=flow.asOfMonth,{includePeriods=true}={}){
 if(!flow.tracking)return {flow,holdings};
 const result=rewindTrackedInputs(flow,holdings);result.flow.asOfMonth=month;
 for(const entry of activeTrackingEntries(flow.tracking))if(entry.effectiveDate.slice(0,7)<=month&&(entry.mode!=='period'||includePeriods&&entry.effectiveDate.startsWith(month)))for(const c of entry.changes)write(result,c.target,c.value);
 return result;
}
export function diffTrackedInputs(before,after){
 const changes=[],push=(target,a,b)=>{if(!same(a,b))changes.push({target,before:clone(a),value:clone(b)});};
 for(const [kind,list] of [['asset','assets'],['debt','debts']]){
  const ids=new Set([...before.holdings[list],...after.holdings[list]].map(x=>x.id));
  for(const id of ids)push({kind,id,field:'item'},before.holdings[list].find(x=>x.id===id),after.holdings[list].find(x=>x.id===id));
 }
 for(const owner of ['primary','partner'])for(const field of payFields){const a=before.flow.pay[owner][field],b=after.flow.pay[owner][field];if(['endDate','niExemptFrom'].includes(field)&&(a??'')===(b??''))continue;if(field!=='annualTakeHome'&&!['endDate','niExemptFrom'].includes(field)&&(a??0)===(b??0))continue;push({kind:'pay',id:owner,field},a,b);}
 for(const kind of ['income','spending'])for(const id of Object.keys(before.flow[kind]))push({kind,id,field:'amount'},before.flow[kind][id],after.flow[kind][id]);
 const ids=new Set([...before.flow.customSpending,...after.flow.customSpending].map(x=>x.id));for(const id of ids)push({kind:'custom',id,field:'item'},before.flow.customSpending.find(x=>x.id===id),after.flow.customSpending.find(x=>x.id===id));
 const datedIds=new Set([...before.flow.datedEntries,...after.flow.datedEntries].map(x=>x.id));for(const id of datedIds)push({kind:'dated',id,field:'item'},before.flow.datedEntries.find(x=>x.id===id),after.flow.datedEntries.find(x=>x.id===id));
 return changes;
}
export function appendTrackingUpdate(before,after,{id=crypto.randomUUID(),effectiveDate,recordedAt=new Date().toISOString(),mode='change',label='Household update',reason='',startMonth,observedTarget,changeSet}={}){
 if(before.example||after.example)throw new Error('The public example is separate from personal tracking.');
 const history=structuredClone(before.flow.tracking||{version:1,startMonth:startMonth||before.flow.timelineStartMonth||before.flow.asOfMonth,entries:[]}),changes=changeSet?structuredClone(changeSet):diffTrackedInputs(before,after);
 if(observedTarget&&!changes.some(c=>key(c.target)===key(observedTarget))){const list=observedTarget.kind==='asset'?'assets':'debts';const item=after.holdings[list].find(x=>x.id===observedTarget.id);if(item)changes.push({target:observedTarget,before:clone(before.holdings[list].find(x=>x.id===item.id)),value:clone(item)});}
 if(!changes.length&&!before.flow.tracking)return structuredClone(after);
 if(changes.length)history.entries.push({id,effectiveDate,recordedAt,mode,label,reason,source:'manual',changes});validateTrackingHistory(history);
 const result={...structuredClone(after),flow:{...structuredClone(after.flow),timelineStartMonth:history.startMonth,tracking:history}},current=trackedInputsAt(result.flow,result.holdings,recordedAt.slice(0,7));
 return {...result,holdings:current.holdings,flow:{...current.flow,asOfMonth:after.flow.asOfMonth,tracking:history}};
}
export function correctTrackingUpdate(flow,entryId,values,{id=crypto.randomUUID(),effectiveDate,recordedAt=new Date().toISOString(),reason=''}={}){
 const history=structuredClone(flow.tracking),entry=activeTrackingEntries(history).find(e=>e.id===entryId);
 if(!entry)throw new Error('Choose an active tracking update to correct.');
 if(!Array.isArray(values)||values.length!==entry.changes.length)throw new Error('Check every value in this correction.');
 history.entries.push({...entry,id,effectiveDate:effectiveDate||entry.effectiveDate,recordedAt,reason,corrects:entry.id,changes:entry.changes.map((c,i)=>({...c,value:clone(values[i])}))});validateTrackingHistory(history);
 return {...structuredClone(flow),tracking:history};
}
function validateValue(target,value,{before=false}={}){
 if(before&&value===null&&target.kind==='pay')return;
 if(['asset','debt'].includes(target.kind)){
  if(value===null)return;
  if(!record(value)||value.id!==target.id)throw new Error('A tracked item is invalid.');
  const h={name:'Validation',age:40,partnerName:'Partner',partnerAge:40,assets:[],debts:[]};h[target.kind==='asset'?'assets':'debts']=[{...value,linkedAssetId:undefined}];const check=validateDraft(h);if(!check.valid)throw new Error(check.errors[0].message);return;
 }
 if(target.kind==='dated'){
  if(value===null)return;if(!record(value)||value.id!==target.id||typeof value.label!=='string'||!value.label.trim()||value.label.length>80||!['income','spending'].includes(value.side)||!['monthly','yearly','once'].includes(value.frequency)||(value.startMonth&&!monthPattern.test(value.startMonth))||(value.endMonth&&!monthPattern.test(value.endMonth))||(value.startMonth&&value.endMonth&&value.endMonth<value.startMonth)||value.frequency==='once'&&(!value.startMonth||value.endMonth))throw new Error('A tracked dated entry is invalid.');value=value.amount;
 }
 if(target.kind==='custom'){
  if(value===null)return;if(!record(value)||value.id!==target.id||typeof value.label!=='string'||!value.label.trim()||value.label.length>48)throw new Error('A tracked spending category is invalid.');value=value.amount;
 }
 if(target.kind==='pay'&&['endDate','niExemptFrom'].includes(target.field)){if(value!==null&&value!==''&&!monthPattern.test(value))throw new Error('A tracked pay date is invalid.');return;}
 if(value===null&&target.kind==='pay'&&target.field==='annualTakeHome')return;
 if(!Number.isFinite(value)||value<0||value>(target.field.endsWith('Rate')?100:100_000_000)||Math.abs(value*100-Math.round(value*100))>.001)throw new Error('Enter a valid non-negative tracking amount or percentage.');
}
export function validateTrackingHistory(history){
 if(!record(history)||history.version!==1||!monthPattern.test(history.startMonth)||!Array.isArray(history.entries)||!history.entries.length||history.entries.length>200||Object.keys(history).some(k=>!['version','startMonth','entries'].includes(k)))throw new Error('Tracking history is invalid or full. Existing records were kept.');
 const ids=new Set(),superseded=new Set();
 for(const e of history.entries){
  if(!record(e)||typeof e.id!=='string'||!e.id||e.id.length>80||ids.has(e.id)||!validTrackingDate(e.effectiveDate)||e.effectiveDate.slice(0,7)<history.startMonth||typeof e.recordedAt!=='string'||!Number.isFinite(Date.parse(e.recordedAt))||new Date(e.recordedAt).toISOString()!==e.recordedAt||!['change','period'].includes(e.mode)||e.source!=='manual'||typeof e.label!=='string'||!e.label.trim()||e.label.length>100||typeof e.reason!=='string'||e.reason.length>200||!Array.isArray(e.changes)||!e.changes.length||e.changes.length>80)throw new Error('Check the tracking date, label and update values. Updates must start within the recorded timeline.');
  if(e.corrects){const previous=history.entries.find(x=>x.id===e.corrects);if(!ids.has(e.corrects)||superseded.has(e.corrects)||e.mode!==previous.mode||JSON.stringify(e.changes.map(c=>key(c.target)))!==JSON.stringify(previous.changes.map(c=>key(c.target))))throw new Error('A tracking correction is invalid.');superseded.add(e.corrects);}
  ids.add(e.id);const targets=new Set();
  for(const c of e.changes){
   const t=c?.target,k=t&&key(t);if(!record(t)||typeof t.id!=='string'||!t.id||t.id.length>100||targets.has(k)||Object.keys(t).some(k=>!['kind','id','field'].includes(k)))throw new Error('A tracking target is invalid.');targets.add(k);
   const valid=['asset','debt','custom','dated'].includes(t.kind)?t.field==='item':t.kind==='pay'?['primary','partner'].includes(t.id)&&payFields.includes(t.field):t.kind==='income'?['pensionIncome','otherIncome'].includes(t.id)&&t.field==='amount':t.kind==='spending'?['everyday','carPayment'].includes(t.id)&&t.field==='amount':false;
   if(!valid||e.mode==='period'&&['asset','debt'].includes(t.kind))throw new Error('This field does not support that tracking update.');
   if(['asset','debt'].includes(t.kind)&&e.effectiveDate>e.recordedAt.slice(0,10))throw new Error('Record balances for today or an earlier date. Use a scenario for future balances.');
   if(e.mode==='period'&&e.effectiveDate>e.recordedAt.slice(0,10))throw new Error('Record actual monthly amounts for today or an earlier date. Use a scheduled entry for future amounts.');
   validateValue(t,c.before,{before:true});validateValue(t,c.value);
  }
 }
 return structuredClone(history);
}

/** Override only fields explicitly recorded; all other already-scaled assumptions continue. */
export function applyTrackedFlow(current,history,month,{incomeGrowth=0,inflation=0,householdFactor=1}={}){
 if(!history)return current;
 for(const entry of activeTrackingEntries(history)){
  const start=entry.effectiveDate.slice(0,7);if(start>month||entry.mode==='period'&&start!==month)continue;
  const elapsed=Math.max(0,trackingMonthOffset(start,month))/12;
  for(const c of entry.changes){const t=c.target;if(['asset','debt'].includes(t.kind))continue;
   let value=clone(c.value),rate=t.kind==='pay'?incomeGrowth:t.kind==='income'?0:inflation;
   if(entry.mode!=='period'){
    if(typeof value==='number'&&(t.kind!=='pay'||amountFields.has(t.field)))value=round(value*(1+rate/100)**elapsed*(t.kind==='spending'?householdFactor:1));
    if(t.kind==='custom'&&value)value.amount=round(value.amount*(1+inflation/100)**elapsed*householdFactor);
    if(t.kind==='dated'&&value)value.amount=round(value.amount*(1+(value.side==='spending'?inflation:incomeGrowth)/100)**elapsed);
   }
   write({flow:current,holdings:{}},t,value);
  }
 }
 current.recordedPayReceipts=recordedPayReceipts(history,month);return current;
}
/** Whole-month convention: metadata at opening, observed balances at closing. */
export function applyTrackedBalances(holdings,history,month,{closing=false,beforeStart=false}={}){
 const adjustments=[];
 for(const e of activeTrackingEntries(history))if(beforeStart?e.effectiveDate.slice(0,7)<month:e.effectiveDate.startsWith(month))for(const c of e.changes){
  const t=c.target;if(!['asset','debt'].includes(t.kind))continue;
  const list=holdings[t.kind==='asset'?'assets':'debts'],field=t.kind==='asset'?'value':'balance',old=list.find(x=>x.id===t.id);
  if(closing||beforeStart){
   const recorded=c.value?.[field]??0,estimated=old?.[field]??0;
   if(c.value===null){if(old)old[field]=0;const index=list.findIndex(x=>x.id===t.id);if(index>=0)list.splice(index,1);}
   else if(old)Object.assign(old,clone(c.value));else list.push(clone(c.value));
   adjustments.push({kind:t.kind,id:t.id,estimated,recorded,difference:round(recorded-estimated),effectiveDate:e.effectiveDate});
  }else if(c.value){if(old)Object.assign(old,{...clone(c.value),[field]:old[field]});else list.push({...clone(c.value),[field]:0});}
 }
 return adjustments;
}
