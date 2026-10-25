/** Goal progress from the monthly ledger. These indicators are not probabilities. */
import {projectPlan} from './planning.mjs';
import {resolveRetirementYears} from './planning-retirement.mjs';
import {agesAt} from './coverage.mjs';
import {calculateEstate,createInheritanceIllustration} from './inheritance.mjs';
import {createGoal,validateGoal} from './journey-state.mjs';
import {eligibleWithdrawalBucket} from './withdrawals.mjs';

const round=value=>Math.round(value*100)/100;
const sum=values=>values.reduce((total,value)=>total+(Number.isFinite(value)?value:0),0);
const startOf=picture=>picture.flow.timelineStartMonth || picture.flow.asOfMonth;
const ageOf=picture=>picture.planning?.scenario?.ages?.primary ?? picture.holdings.age;

/** Recorded regular costs only; separately scheduled costs and debt remain separate. */
export function regularMonthlySpending(flow){
  return round(sum(Object.values(flow.spending || {}))+sum((flow.customSpending || []).map(item=>item.amount)));
}

/** Explicit setup action. Never call this to silently reapply a goal after an experiment. */
export function goalScenario(picture,input=picture.journey?.goal){
  const goal=validateGoal(input || createGoal()),scenario=structuredClone(picture.planning?.scenario || {});
  const flow=picture.flow,start=startOf(picture),startYear=Number(start.slice(0,4)),age=ageOf(picture);
  scenario.retirementYears=resolveRetirementYears(flow,picture.holdings,scenario.retirementYears);
  if(goal.retirementAge!=null && Number.isFinite(age)){
    const month=Number(flow.pay.primary.endDate?.slice(5) || 12),elapsedMonth=(month-Number(start.slice(5)))/12;
    // Ages can include elapsed months after a checkpoint. Choose the last
    // supported pay year whose approximate whole age meets the target.
    const year=Math.max(startYear-1,Math.floor(startYear+goal.retirementAge+1-age-elapsedMonth-1e-8));
    if(year>startYear+60)throw new RangeError('Choose a work-stop target within the next 60 years.');
    scenario.retirementYears.primary=year;
  }
  const base=regularMonthlySpending(flow);
  if(goal.monthlySpending!=null && base>0){
    const year=Math.max(startYear,scenario.retirementYears.primary+1);
    const changes=structuredClone(scenario.spendingChanges ?? (scenario.spendingChange?[scenario.spendingChange]:[])).sort((a,b)=>a.year-b.year);
    const previous=changes.filter(item=>item.year<=year).at(-1)?.percent ?? 100,target=goal.monthlySpending/base*100;
    if(target>200)throw new RangeError('The target is more than twice your recorded regular budget. Update that budget before applying this target.');
    const ratio=previous>0?target/previous:1;
    scenario.spendingChanges=changes.filter(item=>item.year!==year).map(item=>item.year>year?{...item,percent:item.percent*ratio}:item);
    if(scenario.spendingChanges.some(item=>item.percent>200))throw new RangeError('A later spending phase would exceed the supported range. Review the spending phases first.');
    scenario.spendingChanges.push({year,percent:target});scenario.spendingChanges.sort((a,b)=>a.year-b.year);delete scenario.spendingChange;
  }
  return scenario;
}

function retirementTiming(picture,projection,goal){
  const pay=picture.flow.pay.primary,employed=(pay.annualGross || pay.annualTakeHome || 0)>0;
  const finalMonth=projection.retirementDates.primary;
  const age=ageOf(picture),start=startOf(picture),elapsedMonth=(Number(finalMonth?.slice(5) || 12)-Number(start.slice(5)))/12;
  const retirementAge=employed && finalMonth && Number.isFinite(age)?Math.floor(age+Number(finalMonth.slice(0,4))-Number(start.slice(0,4))+elapsedMonth+1e-8):null;
  return {retirementAge,retirementMonth:employed?finalMonth:null,timingMet:goal.retirementAge==null || !employed || (retirementAge!=null && retirementAge<=goal.retirementAge)};
}

function legacyAtHorizon(picture,projection){
  const last=projection.months.at(-1);
  if(!last.estateAssets || !last.estateDebts)throw new Error('Projected estate balances are required to assess the inheritance target.');
  const holdings={...picture.holdings,assets:last.estateAssets,debts:last.estateDebts};
  const settings=structuredClone(picture.inheritance || createInheritanceIllustration(holdings,projection.endMonth));
  settings.basis='projected';settings.deathDate=`${projection.endMonth}-28`;
  if(settings.couple.firstDeathDate>=settings.deathDate)settings.couple.firstDeathDate=`${projection.endMonth}-27`;
  if(settings.residenceAssetId && !holdings.assets.some(asset=>asset.id===settings.residenceAssetId))settings.residenceAssetId='';
  const estate=calculateEstate(holdings,settings);
  return {amount:round(estate.afterEstateTax/last.deflator),warnings:estate.warnings,settings,estate};
}

function summarise(picture,goal,projection){
  const months=projection.months,last=months.at(-1),first=months.find(month=>month.unfunded>0);
  const requiredSpending=sum(months.map(month=>month.spendingTotal/month.deflator));
  const unfunded=sum(months.map(month=>month.unfunded/month.deflator)),fundedSpending=Math.max(0,requiredSpending-unfunded);
  // Preserve visible evidence of a small gap even when normal rounding reaches 100%.
  const raw=requiredSpending>0?Math.max(0,Math.min(100,fundedSpending/requiredSpending*100)):null;
  const coveragePercent=raw==null?null:round(unfunded>0?Math.min(99.99,raw):raw);
  const context={month:projection.startMonth,pensionAccessAge:projection.pensionAccessAge,ages:projection.ages};
  const openingAccessible=sum(picture.holdings.assets.filter(asset=>eligibleWithdrawalBucket(asset,context)).map(asset=>asset.value));
  const minimumAccessible=Math.min(openingAccessible,...months.map(month=>month.withdrawableAssets/month.deflator));
  const timing=retirementTiming(picture,projection,goal),regular=regularMonthlySpending(picture.flow);
  const retirementMonth=timing.retirementMonth && timing.retirementMonth>=projection.startMonth?timing.retirementMonth:projection.startMonth;
  const phases=projection.spendingChanges || [];
  const regularAfterWork=months.filter(month=>month.month>retirementMonth || retirementMonth===projection.startMonth).map(month=>{
    const percent=phases.filter(phase=>phase.year<=Number(month.month.slice(0,4))).at(-1)?.percent ?? 100;
    return regular*percent/100;
  });
  const spendingTargetMet=goal.monthlySpending==null || !regularAfterWork.length || regularAfterWork.every(value=>value+.01>=goal.monthlySpending);
  let legacyAmount=null,legacyWarnings=[],legacyError='';
  if(goal.type==='legacy' || goal.legacyTarget>0){
    try{const legacy=legacyAtHorizon(picture,projection);legacyAmount=legacy.amount;legacyWarnings=legacy.warnings;}
    catch(error){legacyError=error.message;}
  }
  const reserveMet=minimumAccessible+.01>=goal.reserve,legacyMet=goal.legacyTarget<=0 || (legacyAmount!=null && legacyAmount+.01>=goal.legacyTarget);
  const firstGap=first?{month:first.month,ages:agesAt(projection,first.month),amount:round(first.unfunded/first.deflator)}:null;
  return {...timing,coveragePercent,requiredSpending:round(requiredSpending),fundedSpending:round(fundedSpending),unfunded:round(unfunded),firstGap,
    accessibleAtEnd:round(last.withdrawableAssets/last.deflator),minimumAccessible:round(minimumAccessible),reserveTarget:goal.reserve,reserveMet,
    legacyTarget:goal.legacyTarget,legacyAmount,legacyMet,legacyWarnings,legacyError,spendingTargetMet,
    meetsGoal:!firstGap && reserveMet && legacyMet && spendingTargetMet && timing.timingMet};
}

/** Evaluate the active plan. A changed goal never silently replaces scenario choices. */
export function evaluateGoalOutlook(picture,{goal:input=picture.journey?.goal,projection:provided,includeStress=true}={}){
  const goal=validateGoal(input || createGoal()),reasons=[],incomplete=[],warnings=[];
  const scenario=structuredClone(picture.planning?.scenario || {});
  scenario.retirementYears=resolveRetirementYears(picture.flow,picture.holdings,scenario.retirementYears);
  const needsEstate=goal.type==='legacy' || goal.legacyTarget>0;
  const projection=provided && (!needsEstate || provided.months.at(-1)?.estateAssets)?provided:projectPlan(picture.flow,picture.holdings,{...scenario,captureEstateBalances:needsEstate});
  const summary=summarise(picture,goal,projection);
  if(!picture.holdings.name?.trim())incomplete.push('Add your household details before assessing the goal.');
  if(!Number.isFinite(ageOf(picture)))incomplete.push('Add your age to assess retirement timing and pension access.');
  if(picture.holdings.partnerName && !Number.isFinite(scenario.ages?.partner ?? picture.holdings.partnerAge))incomplete.push('Add the other person’s age to assess their pension access.');
  if(summary.requiredSpending<=0)incomplete.push('Record your regular spending or scheduled costs to assess spending coverage.');
  if(goal.monthlySpending>0 && regularMonthlySpending(picture.flow)<=0)incomplete.push('Record a regular household budget to compare with your spending target.');
  if(projection.unmodelledDebt>0)incomplete.push('Some debt repayments are missing; add their rate and payment details.');
  const substantiveTax=(projection.taxLimitations || []).filter(message=>!message.startsWith('Opening tax year:'));
  if(substantiveTax.length)incomplete.push(...substantiveTax);
  if(goal.type==='legacy' && goal.legacyTarget<=0)incomplete.push('Add the amount you want to leave to assess this goal.');
  if(summary.retirementMonth && summary.retirementMonth>=projection.endMonth)incomplete.push('Extend the plan beyond your final working month to assess retirement spending.');
  if(summary.legacyError)incomplete.push(summary.legacyError);
  warnings.push(...(projection.warnings || []),...summary.legacyWarnings);
  if(summary.firstGap)reasons.push(`Spending first exceeds accessible funding in ${summary.firstGap.month}.`);
  if(!summary.timingMet)reasons.push(`The active plan’s final working age is ${summary.retirementAge}; your target is ${goal.retirementAge}.`);
  if(!summary.spendingTargetMet)reasons.push('Some regular spending phases are below your minimum monthly spending target.');
  if(!summary.reserveMet)reasons.push('Accessible funds fall below your selected minimum reserve.');
  if(!summary.legacyMet)reasons.push('The projected after-estate-tax inheritance is below your target.');
  let stress=null;
  if(includeStress && summary.meetsGoal){
    if(scenario.retirementStress){stress={applied:false,passes:null,reason:'The current plan already includes the retirement market fall; no second fall has been applied.'};}
    else{
      const tested=projectPlan(picture.flow,picture.holdings,{...scenario,retirementStress:true,captureEstateBalances:needsEstate}),testedSummary=summarise(picture,goal,tested);
      const applied=Boolean(tested.stressTest?.month && tested.stressTest.loss>0);
      stress={applied,passes:applied?testedSummary.meetsGoal:null,month:tested.stressTest?.month || null,loss:tested.stressTest?.loss || 0,
        reason:applied?'A one-off 20% investment fall at the first recorded retirement.':'The retirement market-fall test had no effect within this plan; it does not assess resilience.',
        outlook:testedSummary};
    }
  }
  let status,label;
  if(incomplete.length){status='incomplete';label='Incomplete';}
  else if(!summary.meetsGoal){status='needs-attention';label='Needs attention';}
  else if(stress?.applied && stress.passes){status='on-track';label='On track';reasons.push('The selected goals are met in the current plan and the stated market-fall test.');}
  else{status='sensitive';label=stress?.applied?'Sensitive':'Meets current plan';reasons.push(stress?.applied?'The current plan meets your goals, but the market-fall test misses a requirement.':stress?.reason || 'The current plan meets your goals; no downside test was assessed.');}
  return {...summary,status,label,goal,reasons:[...new Set([...incomplete,...reasons])],warnings:[...new Set(warnings)],
    taxIncomplete:Boolean(projection.taxLimitations?.length),incompleteReasons:[...new Set(incomplete)],projection,stress,
    basis:'Under your selected assumptions. Illustration, not advice. Current rules, subject to change.',
    coverageBasis:'Share of modelled spending funded over the horizon, in today’s money. Not a probability.',
    legacyBasis:'Projected closing estate after estate tax, before beneficiary pension Income Tax. Fixed-balance illustration.'};
}
