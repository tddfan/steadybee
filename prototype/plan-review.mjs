/** Numerical goal checkpoints and explicitly completed reviews. No storage or AI. */
import {createLifelineModel,lifelineMoney,lifelineToday,shiftLifelineMonth} from './lifeline.mjs?v=20261025lifeline1';
import {activeBaseline,baselineMonths,validBaselineDate} from './baseline-history.mjs?v=20261025baseline1';
import {activeTrackingEntries} from './tracking.mjs?v=20261025tracking1';
import {startingPictureKey} from './planning-review.mjs?v=20261017review1';
export const PLAN_GOAL_TYPES=['retireBy','spending','event','legacy'];
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const validMonth=m=>typeof m==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(m)&&validBaselineDate(`${m}-01`);
const round=n=>n==null?null:Math.round(n*100)/100;
const offset=(a,b)=>(Number(b.slice(0,4))-Number(a.slice(0,4)))*12+Number(b.slice(5))-Number(a.slice(5));
export function validatePlanGoal(goal){
 if(!record(goal)||Object.keys(goal).some(k=>!['type','person','targetMonth','targetAmount','targetMonthly'].includes(k))||!PLAN_GOAL_TYPES.includes(goal.type)||goal.person!=null&&!['primary','partner','household'].includes(goal.person)||goal.targetMonth!=null&&!validMonth(goal.targetMonth))throw Error('Choose a supported goal, person and month.');
 for(const k of ['targetAmount','targetMonthly'])if(goal[k]!=null&&(!Number.isFinite(goal[k])||goal[k]<0||goal[k]>100_000_000))throw Error('Enter a goal amount from £0 to £100,000,000.');
 return structuredClone(goal);
}
export function goalCheckpoint(goal,projection,{basisMonth=projection.startMonth,inflation=projection.assumptions.inflation,reserveMonths=6}={}){
 if(!goal)return null;validatePlanGoal(goal);
 const month=goal.targetMonth||null,metric={retireBy:'retirement',spending:'spending',event:'accessible',legacy:'netAssets'}[goal.type],money=(n,m)=>lifelineMoney(n,m,{basisMonth,inflation,real:true});
 const result={status:'missing',metric,month,value:null,target:goal.type==='retireBy'?0:goal.type==='spending'?goal.targetMonthly??null:goal.targetAmount??null,difference:null,months:0,finalPay:{primary:null,partner:null},firstGap:projection.firstUnfundedMonth||null,unfunded:round(projection.months.reduce((sum,r)=>sum+money(r.unfunded||0,r.month),0)),reserve:null,cash:null};
 if(!month)return result;
 const row=projection.months.find(r=>r.month===month);if(!row){result.status='outside';return result;}
 result.reserve=round(money(row.spendingTotal*(reserveMonths??6),month));result.cash=round(money(row.assetsByType?.cash||0,month));
 if(goal.type==='retireBy'){
  const owners=goal.person==='household'?Object.keys(projection.retirementDates).filter(owner=>owner==='primary'||projection.ages?.partner!=null||projection.retirementDates.partner):[goal.person==='partner'?'partner':'primary'];
  for(const owner of owners)result.finalPay[owner]=projection.retirementDates[owner]||null;
  if(owners.some(owner=>!result.finalPay[owner]))return result;
  result.value=Math.max(...owners.map(owner=>offset(month,result.finalPay[owner])));result.months=1;
 }else if(goal.type==='spending'){
  const rows=projection.months.filter(r=>r.month>=month&&r.month<shiftLifelineMonth(month,12));result.months=rows.length;result.value=round(rows.reduce((sum,r)=>sum+money(r.householdSpending,r.month),0)/rows.length);
 }else{result.months=1;result.value=round(money(goal.type==='event'?row.withdrawableAssets:row.assetsTotal-row.debtsTotal,month));}
 if(result.target!==null){result.status='ready';result.difference=round(result.value-result.target);}return result;
}
export function describeGoalCheckpoint(checkpoint){
 if(!checkpoint)return 'No primary goal selected';
 if(checkpoint.status==='outside')return 'Goal date is outside this forecast';
 if(checkpoint.status==='missing')return 'Goal needs a target amount, date or work-end record';
 const money=n=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(n);
 if(checkpoint.metric==='retirement')return checkpoint.value===0?'Final pay matches the target month':`${Math.abs(checkpoint.value)} month(s) ${checkpoint.value>0?'after':'before'} the target work-end month`;
 if(checkpoint.metric==='spending')return `${money(checkpoint.value)}/month household costs · target ${money(checkpoint.target)} · ${checkpoint.months} modelled month(s)`;
 return `${money(checkpoint.value)} ${checkpoint.metric==='accessible'?'accessible before withdrawal tax':'net assets before estate tax'} · target ${money(checkpoint.target)}`;
}
function taxYear(date){const year=Number(date.slice(0,4))-(date.slice(5)<='04-05'?1:0);return `${year}-${year+1}`;}
export function isaSubscriptionChecks(flow,hasPartner,today=lifelineToday()){
 if(!validBaselineDate(today))throw Error('Choose a valid review date.');
 const sourceMonth=flow.tracking?.startMonth||flow.timelineStartMonth||flow.asOfMonth,sourceYear=taxYear(`${sourceMonth}-06`),currentYear=taxYear(today),supported=sourceYear==='2026-2027',ambiguous=sourceMonth.endsWith('-04');
 return (hasPartner?['primary','partner']:['primary']).map(person=>{
  const recorded=flow.assumptions[person==='primary'?'isaUsedPrimary':'isaUsedPartner'];let status=!supported?'unsupported':sourceYear!==currentYear?'stale':ambiguous?'unknown':!Number.isFinite(recorded)?'unknown':recorded>20000?'over':'recorded';
  return {person,taxYear:sourceYear,sourceMonth,status,recorded:Number.isFinite(recorded)?recorded:null,limit:supported?20000:null,remaining:['recorded','over'].includes(status)?Math.max(0,20000-recorded):null};
 });
}
export function nextReviewDate(date,cadence='quarterly'){
 if(!validBaselineDate(date)||!['quarterly','annual'].includes(cadence))throw Error('Choose a valid review date and cadence.');
 const month=shiftLifelineMonth(date.slice(0,7),cadence==='annual'?12:3),[y,m]=month.split('-').map(Number),day=Math.min(Number(date.slice(8)),new Date(Date.UTC(y,m,0)).getUTCDate());return `${month}-${String(day).padStart(2,'0')}`;
}
export function validateReviewHistory(value){
 if(!record(value)||Object.keys(value).some(k=>!['cadence','entries'].includes(k))||!['quarterly','annual'].includes(value.cadence)||!Array.isArray(value.entries)||value.entries.length>40)throw Error('Invalid review history.');
 let previous='';for(const r of value.entries){if(!record(r)||Object.keys(r).sort().join()!=='date,key,recordedAt'||!validBaselineDate(r.date)||typeof r.recordedAt!=='string'||!Number.isFinite(Date.parse(r.recordedAt))||new Date(r.recordedAt).toISOString()!==r.recordedAt||r.recordedAt<previous||! /^[a-f0-9]{16}$/.test(r.key))throw Error('Invalid completed review.');previous=r.recordedAt;}return structuredClone(value);
}
export function buildPlanReview(picture,{today=lifelineToday(),projection=null}={}){
 if(!validBaselineDate(today))throw Error('Choose a valid review date.');
 const current=projection||createLifelineModel(picture,{today}).current,basisMonth=today.slice(0,7),basis={basisMonth,inflation:current.assumptions.inflation},goal=picture.insights?.planGoal||null,archive=activeBaseline(picture.baselines,today),row=current.months.find(r=>r.month===basisMonth),frozen=archive?baselineMonths(archive).find(r=>r.month===basisMonth):null,money=(n,m)=>round(lifelineMoney(n,m,{...basis,real:true}));
 const currentValue=row?money(row.assetsTotal-row.debtsTotal,row.month):null,baselineValue=frozen?money(frozen.assetsTotal-frozen.debtsTotal,frozen.month):null;
 const review=picture.insights?.review?validateReviewHistory(picture.insights.review):{cadence:'quarterly',entries:[]},lastReview=review.entries.at(-1)||null;
 const key=startingPictureKey({holdings:picture.holdings,scenario:picture.planning.scenario,goal,baselineVersions:(picture.baselines?.entries||[]).map(b=>[b.id,b.createdAt])},picture.flow);
 return {asOfDate:today,basisMonth,inflation:basis.inflation,goal:goal?validatePlanGoal(goal):null,checkpoint:goalCheckpoint(goal,current,{...basis,reserveMonths:picture.flow.assumptions.cashReserveMonths??6}),progress:{month:basisMonth,current:currentValue,baseline:baselineValue,difference:currentValue==null||baselineValue==null?null:round(currentValue-baselineValue),baselineNumber:archive?.number||null,baselineDate:archive?.startDate||null},recordedUpdates:activeTrackingEntries(picture.flow.tracking).filter(e=>e.effectiveDate<=today).length,isaChecks:isaSubscriptionChecks(picture.flow,Boolean(picture.holdings.partnerName),today),key,lastReview,cadence:review.cadence,dueDate:lastReview?nextReviewDate(lastReview.date,review.cadence):null,inputsChanged:Boolean(lastReview&&lastReview.key!==key),incomplete:current.taxLimitations.length>0||current.unmodelledDebt>0,firstGap:current.firstUnfundedMonth||null};
}
export function completePlanReview(history,review,{recordedAt=new Date().toISOString()}={}){
 const next=history?validateReviewHistory(history):{cadence:'quarterly',entries:[]};if(next.entries.some(r=>r.date===review.asOfDate&&r.key===review.key))return next;
 if(next.entries.length>=40)throw Error('This household has 40 completed reviews. Existing review history has been kept.');
 next.entries.push({date:review.asOfDate,recordedAt,key:review.key});return validateReviewHistory(next);
}
