/** Deterministic findings and bounded experiments. No AI or account writes. */
import {projectPlan} from './planning.mjs?v=20261024persona1';
import {resolveRetirementYears} from './planning-retirement.mjs?v=20261024persona1';
import {goalCheckpoint,validatePlanGoal,validateReviewHistory} from './plan-review.mjs?v=20261025review1';
import {lifelineMoney} from './lifeline.mjs?v=20261025lifeline1';
export const INSIGHT_GOALS=Object.freeze({security:'Spending security',retirement:'Earlier retirement',legacy:'Future assets'});
export const PLAN_GOALS=Object.freeze({
  retireBy:{title:'Stop work by a chosen date',description:'Compare the date in your current plan and its funding path.'},
  spending:{title:'Maintain a chosen monthly spend',description:'Compare household costs, excluding debt payments, around your chosen date.'},
  event:{title:'Fund a future goal',description:'Compare the target with accessible investments at that date, before withdrawal tax.'},
  legacy:{title:'Leave a chosen amount',description:'Compare projected net assets with your target; estate tax is not included.'}
});
export const INSIGHT_RECIPES=Object.freeze({
  spendLess:{title:'Spend 5% less after retirement',tradeoff:'Reduces regular household spending, including existing spending phases. Debt payments and separately scheduled costs stay unchanged.'},
  retireLater:{title:'Work one more year',tradeoff:'Adds one working year for each person with future pay. It also delays their retirement; extra income is not a free gain.'},
  retireEarlier:{title:'Retire one year earlier',tradeoff:'Removes one year of pay and workplace pension contributions. Check funding gaps and accessible assets.'},
  stress:{title:'Test a 20% retirement market fall',tradeoff:'Applies the existing one-off investment shock at the first retirement. It is an illustration, not a likelihood estimate.'},
  withdrawalOrder:{title:'Try another withdrawal order',tradeoff:'Changes eligible account order only. Tax, account access and later balances can change; lower tax alone does not mean a better plan.'},
  mortgagePayoff:{title:'Test mortgage payoff from cash & shares',tradeoff:'Uses eligible cash and shares now, preserving ISAs and pensions. May be partial and can reduce the liquid reserve; sale taxes are modelled.'},
});
export function validateInsightSettings(value){
  if(!value || typeof value!=='object' || Array.isArray(value) || Object.keys(value).some(key=>!['version','goal','planGoal','review'].includes(key)) || value.version!==1 || !Object.hasOwn(INSIGHT_GOALS,value.goal))throw new Error('Invalid Insights settings.');
  if(value.planGoal!=null)validatePlanGoal(value.planGoal);
  if(value.review!=null)validateReviewHistory(value.review);
  return structuredClone(value);
}
/** A goal checkpoint, not a score or a claim that the goal is guaranteed. */
export function evaluatePlanGoal(goal,flow,holdings,projection,basis={}){
  if(!goal)return null;
  const checkpoint=goalCheckpoint(goal,projection,{...basis,reserveMonths:flow.assumptions.cashReserveMonths??6});
  if(checkpoint.status==='outside')return {label:PLAN_GOALS[goal.type].title,target:goal.targetMonth,measure:'Projection coverage',value:'Date outside this forecast',context:`Choose a date from ${projection.startMonth} to ${projection.endMonth}, or extend the horizon in Lifeline.`,warning:''};
  if(!goal.targetMonth)return {label:PLAN_GOALS[goal.type].title,target:'Choose a target month',measure:'Goal checkpoint',value:'Not set',context:'Choose when you want to compare this goal.',warning:''};
  const month=goal.targetMonth||projection.startMonth;
  if(goal.type==='retireBy'){
    const people=goal.person==='household'?['primary',...(holdings.partnerName?['partner']:[])]:[goal.person==='partner'?'partner':'primary'],dates=people.map(owner=>({owner,date:projection.retirementDates?.[owner]||null})),allRecorded=dates.every(item=>item.date),meets=allRecorded&&dates.every(item=>item.date<=month);
    const value=dates.map(item=>`${item.owner==='primary'?(holdings.name||'You'):(holdings.partnerName||'Partner')}: ${item.date||'date not recorded'}`).join(' · ');
    return {title:PLAN_GOALS.retireBy.title,label:people.length>1?'Household retirement':people[0]==='partner'?(holdings.partnerName||'Partner'):(holdings.name||'You'),target:`By ${month}`,measure:'Plan’s expected final pay',value,context:allRecorded?(meets?'The recorded plan ends work by your target date. This compares assumptions; it does not confirm the plan is fundable.':'At least one recorded work-end date is after your target. Review the dates and funding path.'):'Add retirement dates in Lifeline to compare this goal.',warning:projection.firstUnfundedMonth?`First modelled funding gap: ${projection.firstUnfundedMonth}.`:''};
  }
  const row=projection.months.find(item=>item.month===month)||projection.months.at(-1);
  if(goal.type==='spending'){
    const rows=projection.months.filter(item=>item.month>=month&&item.month<shiftMonth(month,12));
    const actual=checkpoint.value;
    const target=goal.targetMonthly;
    const difference=target==null?'':Math.abs(actual-target)<.5?'At your monthly target':`${moneyText(Math.abs(actual-target))} ${actual>target?'above':'below'} your monthly target`;
    return {title:PLAN_GOALS.spending.title,label:'Household costs · excluding debt payments',target:target==null?'Add your target/month':`Target ${moneyText(target)}/month`,measure:`Monthly average from ${month}`,value:`${moneyText(actual)}/month`,difference,context:`Includes scheduled costs across ${checkpoint.months} modelled month(s). Debt payments are separate. This compares the configured spending level; it does not establish that it can be funded.`,warning:projection.firstUnfundedMonth?`First modelled funding gap: ${projection.firstUnfundedMonth}.`:''};
  }
  if(goal.type==='event'){
    const available=checkpoint.value,target=goal.targetAmount;
    const difference=target==null?'':Math.abs(available-target)<.5?'At target before tax':`${moneyText(Math.abs(available-target))} ${available>target?'above':'below'} target before tax`;
    return {title:PLAN_GOALS.event.title,label:'Accessible investments',target:target==null?`Add an amount · ${month}`:`Target ${moneyText(target)} · ${month}`,measure:`Projected at ${row?.month||month}`,value:moneyText(available),difference,context:'Before withdrawal tax. This does not reserve money for other spending or confirm that every holding is accessible on that date.',warning:projection.firstUnfundedMonth?`First modelled funding gap: ${projection.firstUnfundedMonth}.`:''};
  }
  const net=checkpoint.value,target=goal.targetAmount;
  const difference=target==null?'':Math.abs(net-target)<.5?'At target before estate tax':`${moneyText(Math.abs(net-target))} ${net>target?'above':'below'} target before estate tax`;
  return {title:PLAN_GOALS.legacy.title,label:'Projected net assets',target:target==null?`Add an amount · ${month}`:`Target ${moneyText(target)} · ${month}`,measure:`Projected at ${row?.month||month}`,value:moneyText(net),difference,context:'Before estate tax and any unmodelled costs. Use Inheritance to review the current simplified estate illustration.',warning:'Estate tax, survivor cash flows and asset-specific inheritance treatment are not fully modelled.'};
}
function shiftMonth(month,offset){const [year,number]=month.split('-').map(Number);return new Date(Date.UTC(year,number-1+offset,1)).toISOString().slice(0,7);}
function moneyText(value){return new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(value||0);}
export function insightSourceKey(flow,holdings,scenario){return JSON.stringify([flow,holdings,scenario]);}
export function insightSummary(projection,basis=null){
  const end=projection.months.at(-1);
  const money=(value,row)=>basis?lifelineMoney(value,row.month,{...basis,real:true}):value/row.deflator;
  return {endMonth:projection.endMonth,firstGap:projection.firstUnfundedMonth,unfunded:projection.months.reduce((sum,row)=>sum+money(row.unfunded,row),0),tax:projection.months.reduce((sum,row)=>sum+money(row.taxTotal,row),0),netAssets:money(end.assetsTotal-end.debtsTotal,end),accessible:money(end.withdrawableAssets,end),cash:money(end.assetsByType.cash || 0,end),incomplete:projection.unmodelledDebt>0 || projection.taxLimitations.length>0,unmodelledDebt:projection.unmodelledDebt};
}
export function insightScenario(flow,holdings,current,recipe,options={}){
  if(!Object.hasOwn(INSIGHT_RECIPES,recipe))throw new Error('Choose a supported experiment.');
  const next=structuredClone(current),startYear=Number((flow.timelineStartMonth || flow.asOfMonth).slice(0,4));
  next.retirementYears=resolveRetirementYears(flow,holdings,next.retirementYears);
  if(recipe==='retireLater' || recipe==='retireEarlier'){
    let changed=false;const delta=recipe==='retireLater' ? 1 : -1;
    if(Object.keys(options).some(key=>key!=='retirementOwner') || (options.retirementOwner && !['primary','partner'].includes(options.retirementOwner)))throw new Error('Choose a recorded person for this retirement experiment.');
    for(const owner of Object.keys(next.retirementYears).filter(owner=>!options.retirementOwner || owner===options.retirementOwner)){
      const pay=flow.pay[owner],year=next.retirementYears[owner];
      if((pay.annualGross || pay.annualTakeHome) && year>=startYear){const target=year+delta;if(target<startYear-1 || target>startYear+60)throw new Error('That retirement date is outside the supported range.');next.retirementYears[owner]=target;changed=true;}
    }
    if(!changed)throw new Error('No future employment is recorded to move by a year.');
  }
  if(recipe==='spendLess'){
    const years=Object.entries(next.retirementYears).filter(([owner])=>flow.pay[owner].annualGross || flow.pay[owner].annualTakeHome).map(([,year])=>year),year=years.length ? Math.max(startYear,Math.min(...years)+1) : startYear;
    const changes=structuredClone(next.spendingChanges ?? (next.spendingChange ? [next.spendingChange] : [])).sort((a,b)=>a.year-b.year);
    const base=changes.filter(item=>item.year<=year).at(-1)?.percent ?? 100;
    next.spendingChanges=changes.filter(item=>item.year!==year).map(item=>item.year>year ? {...item,percent:item.percent*.95} : item);
    next.spendingChanges.push({year,percent:base*.95});next.spendingChanges.sort((a,b)=>a.year-b.year);delete next.spendingChange;
  }
  if(recipe==='stress'){if(next.retirementStress)throw new Error('The retirement market shock is already enabled.');next.retirementStress=true;}
  if(recipe==='withdrawalOrder')next.withdrawalOrder=(next.withdrawalOrder || 'generalFirst')==='isaFirst' ? 'generalFirst' : 'isaFirst';
  if(recipe==='mortgagePayoff'){
    if(next.mortgagePayoffNow)throw new Error('Mortgage payoff is already enabled.');
    if(!holdings.debts.some(item=>item.kind==='mortgage' && item.balance>0))throw new Error('No outstanding mortgage is recorded.');
    next.mortgagePayoffNow=true;next.mortgagePayoffSource='cashShares';
  }
  return next;
}
export function createInsightPreview(flow,holdings,scenario,recipe,baseline=null,options={},goalContext=null){
  const candidate=insightScenario(flow,holdings,scenario,recipe,options),before=baseline || projectPlan(flow,holdings,scenario),after=projectPlan(flow,holdings,candidate);
  if(before.endMonth!==after.endMonth)throw new Error('The experiment must use the same comparison horizon.');
  const summary=insightSummary(before,goalContext),trial=insightSummary(after,goalContext);
  // Compare the whole path: identical end balances can conceal earlier changes.
  const measures=['householdSpending','taxTotal','incomeTotal','assetsTotal','debtsTotal','unfunded','pensionContributions'];
  const changed=after.months.some((row,index)=>measures.some(key=>Math.abs((row[key] || 0)-(before.months[index]?.[key] || 0))>=.01));
  const spendingYear=recipe==='spendLess' ? candidate.spendingChanges.find(item=>!scenario.spendingChanges?.some(old=>old.year===item.year && old.percent===item.percent))?.year : null;
  const noChangeReason=changed ? '' : recipe==='spendLess' ? 'No regular spending changes within this plan. Check your regular budget and retirement dates; debt payments and dated costs are excluded.' : 'This experiment has no effect on the modelled monthly results.';
  const spendingMonths=spendingYear==null ? [] : after.months.map((row,index)=>({row,before:before.months[index]})).filter(item=>item.row.month.startsWith(`${spendingYear}-`));
  const monthlySpendingReduction=spendingMonths.length ? Math.max(0,spendingMonths.reduce((sum,item)=>sum+(item.before.householdSpending-item.row.householdSpending)/item.row.deflator,0)/spendingMonths.length) : 0;
  const resolved=resolveRetirementYears(flow,holdings,scenario.retirementYears);
  const changedPeople=recipe==='retireLater' || recipe==='retireEarlier' ? Object.entries(candidate.retirementYears).filter(([owner,year])=>year!==resolved[owner]).map(([owner])=>owner==='primary' ? holdings.name || 'You' : owner==='partner' ? holdings.partnerName || 'Partner' : owner) : [];
  return {changed,noChangeReason,spendingYear,monthlySpendingReduction,changedPeople,recipe,scenario:candidate,sourceKey:insightSourceKey(flow,holdings,scenario),before:summary,after:trial,delta:Object.fromEntries(['unfunded','tax','netAssets','accessible','cash'].map(key=>[key,trial[key]-summary[key]])),warnings:[...new Set([...before.taxLimitations,...after.taxLimitations,...(after.unmodelledDebt>0 ? ['Some debt repayments are unmodelled. Coverage is incomplete.'] : [])])],payoff:after.mortgagePayoff,stress:after.stressTest,...(goalContext?{goalBefore:goalCheckpoint(goalContext.goal,before,goalContext),goalAfter:goalCheckpoint(goalContext.goal,after,goalContext)}:{})};
}
export function buildInsights(flow,holdings,scenario,projection,goal='security'){
  if(!Object.hasOwn(INSIGHT_GOALS,goal))throw new Error('Choose a supported goal.');
  const cards=[];
  if(projection.unmodelledDebt>0)cards.push({id:'debt-details',priority:'Check inputs',title:'Some repayments are missing',detail:'Debt balances are being held unchanged. Add repayment details before relying on spending coverage.',amount:projection.unmodelledDebt,section:'assets'});
  if(projection.firstUnfundedMonth)cards.push({id:'funding-gap',priority:'Funding gap',title:`First shortfall: ${projection.firstUnfundedMonth}`,detail:'Try lower regular spending and compare the size and timing of the remaining gap.',recipe:'spendLess'});
  if(projection.taxLimitations.length)cards.push({id:'tax-inputs',priority:'Partial estimate',title:'Tax assumptions need a check',detail:projection.taxLimitations[0],section:'flow'});
  const available=Object.keys(INSIGHT_RECIPES).filter(recipe=>{try{insightScenario(flow,holdings,scenario,recipe);return true;}catch{return false;}});
  const order=goal==='retirement' ? ['retireEarlier','retireLater','spendLess','stress','withdrawalOrder','mortgagePayoff'] : goal==='legacy' ? ['withdrawalOrder','mortgagePayoff','spendLess','stress','retireLater'] : ['stress','spendLess','retireLater','mortgagePayoff','withdrawalOrder'];
  for(const recipe of order)if(available.includes(recipe) && !cards.some(card=>card.recipe===recipe))cards.push({id:recipe,priority:'Experiment',title:INSIGHT_RECIPES[recipe].title,detail:INSIGHT_RECIPES[recipe].tradeoff,recipe});
  return {cards:cards.slice(0,3),available};
}
