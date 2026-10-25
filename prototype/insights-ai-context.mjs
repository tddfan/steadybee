/** Build an explicitly reviewed, anonymised description; no identities or free-text labels. */
import {buildAnalysisBrief,validateAnalysisBrief} from './insights-ai.mjs?v=20261024context4';
import {buildInsights,createInsightPreview,insightSummary} from './insights.mjs?v=20261024context4';
import {summarizeMonthlyFlow,ISA_ALLOWANCE_2026_27,DEFAULT_RESERVE_MONTHS} from './monthly-flow.mjs?v=20261024persona1';
const rounded=value=>Number.isFinite(value)?Math.round(value):null;
const assets=()=>({cash:0,isa:0,pension:0,general:0,property:0,other:0});
const kindOf=kind=>({cash:'cash',isa:'isa','dc-pension':'pension',general:'general',shares:'general',home:'property','other-property':'property'})[kind] || 'other';
const summary=value=>Object.fromEntries(Object.entries(value).map(([key,v])=>[key,typeof v==='number'?Math.round(v):v]));
export const AI_FOLLOW_UPS=Object.freeze({
 pensionVsIsa:{title:'Compare extra pension saving with ISA saving',detail:'Check how much accessible money you need before pension access, employer matching and your contribution allowance. This review has not calculated an optimal contribution.',section:'flow'},
 isaCapacity:{title:'Check this year’s ISA saving capacity',detail:'Confirm subscriptions already made across your ISAs before changing where new savings go. The allowance is per person; a recorded balance is not a subscription.',section:'flow'},
 cashReserve:{title:'Review your accessible cash reserve',detail:'Compare cash with near-term spending and debt payments before locking away more money or repaying a mortgage. A suitable reserve depends on your circumstances.',section:'assets'},
 pensionRelief:{title:'Check pension contribution tax relief',detail:'Confirm the contribution method, employer matching and remaining allowance. Salary sacrifice, annual-allowance charges and relief claims are not calculated by these experiments.',section:'flow'}
});
// Critical model limitations stay visible even if the AI omits them from its prose.
export function reviewObservations(brief,result){
 return [...new Set([...brief.facts.filter(f=>f.flag && ['uncertainty','gap','liquidity'].includes(f.id)).map(f=>f.id),...result.observations])];
}
export function candidateEffects(candidate){
 const money=value=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(Math.abs(value));
 const change=(value,label)=>Math.abs(value)<1?`No change in ${label}`:`${money(value)} ${value>0?'more':'less'} ${label}`;
 return [change(candidate.delta.unfunded,'unfunded spending over the plan'),change(candidate.delta.accessible,'accessible investments at end, before withdrawal tax'),change(candidate.delta.netAssets,'net assets at end'),change(candidate.delta.tax,'tax & NI over the plan'),`First spending gap: ${candidate.before.firstGap || 'none'} → ${candidate.after.firstGap || 'none in this calculation'}`];
}
export const AI_LIMITATIONS=Object.freeze({
 taxRulesHeldFixed:'Current tax rules and thresholds stay fixed throughout the projection.',
 salarySacrificeNotModelled:'Salary sacrifice and its effect on pay and National Insurance are not modelled.',
 contributionLimitsNotModelled:'Pension contribution allowances, charges and extra relief claims are not calculated.',
 survivorNotModelled:'These comparisons do not project survivor income or inheritance after either person dies.',
 taxInputsIncomplete:'Tax estimates have incomplete inputs or opening-year history. After-tax income cannot be used to reconstruct gross pay and tax.',
 debtPaymentsIncomplete:'Some debts have no complete repayment schedule, so spending coverage is incomplete.'
});
export function buildContextualAnalysis(flow,holdings,planning,projection,goal){
 const scenario=planning.scenario,baseline=summary(insightSummary(projection)),available=buildInsights(flow,holdings,scenario,projection,goal).available;
 const snapshot=summarizeMonthlyFlow({...flow,asOfMonth:projection.startMonth},holdings),first=projection.months[0];
 const byOwner={primary:assets(),partner:assets(),shared:assets()};
 for(const asset of holdings.assets){const owner=['primary','partner','shared'].includes(asset.owner)?asset.owner:'primary';byOwner[owner][kindOf(asset.kind)]+=asset.value;}
 for(const group of Object.values(byOwner))for(const key of Object.keys(group))group[key]=Math.round(group[key]);
 const people=(holdings.partnerName?['primary','partner']:['primary']).map(owner=>{
  const pay=snapshot.payDetails.find(item=>item.owner===owner),pension=projection.statePensions[owner],working=!projection.retirementDates[owner] || projection.retirementDates[owner]>=projection.startMonth;
  return {person:owner,age:rounded(projection.ages[owner]),finalPayMonth:projection.retirementDates[owner] || null,payBasis:pay.enteredTakeHome?'takeHomeOnly':'grossEstimate',annualGrossPay:!working?0:pay.enteredTakeHome?null:rounded(pay.annualGross),annualTakeHomePay:working?rounded(pay.annualTakeHome):0,employeePensionAnnual:working?rounded(pay.employeePension):0,employerPensionAnnual:working?rounded(pay.employerPension):0,statePensionAnnual:rounded(pension?.annualGross),statePensionStartMonth:pension?.startMonth || null,pensionAccessAges:[...new Set(holdings.assets.filter(a=>a.owner===owner && a.kind==='dc-pension').map(a=>Math.max(projection.startMonth>='2028-04'?57:55,a.pensionAccessAge || 0,scenario.pensionAccessAge || 0)))],pensionTaxFreeRemaining:Math.round(scenario.taxFreeRemaining?.[owner] ?? 268275),isaSubscribedThisYear:rounded(flow.assumptions[owner==='primary'?'isaUsedPrimary':'isaUsedPartner'])};
 });
 const current={month:projection.startMonth,monthlyIncome:rounded(first.incomeTotal),monthlySpending:rounded(first.householdSpending),monthlyDebtPayments:rounded(first.debtPayment),monthlySurplus:rounded(first.remainder)};
 const debts=holdings.debts.slice(0,20).map(debt=>({kind:debt.kind==='mortgage'?'mortgage':'otherDebt',balance:rounded(debt.balance),annualRate:Number.isFinite(debt.interestRate)?debt.interestRate:null,remainingYears:Number.isFinite(debt.remainingYears)?debt.remainingYears:null,mortgageType:debt.kind==='mortgage'?(debt.mortgageType || 'repayment'):'notApplicable'}));
 const milestones=[];
 function milestone(event,person,month){const row=projection.months.find(row=>row.month===month);if(!row)return;milestones.push({event,person,month,netAssets:rounded((row.assetsTotal-row.debtsTotal)/row.deflator),accessible:rounded(row.withdrawableAssets/row.deflator),monthlyTax:rounded(row.taxTotal/row.deflator),monthlySpending:rounded(row.spendingTotal/row.deflator)});}
 for(const person of people){if(person.finalPayMonth)milestone('finalPay',person.person,person.finalPayMonth);if(person.statePensionStartMonth)milestone('statePension',person.person,person.statePensionStartMonth);}
 if(baseline.firstGap)milestone('fundingGap','household',baseline.firstGap);
 const paid=projection.months.find(row=>row.debtsTotal<=0);if(paid && holdings.debts.some(d=>d.balance>0))milestone('debtPaid','household',paid.month);
 const tested=[];
 const choices=available.map(recipe=>({id:recipe,recipe,options:{}}));
 if(people.length===2)for(const recipe of ['retireEarlier','retireLater'])if(available.includes(recipe))for(const person of people)choices.push({id:`${recipe}_${person.person}`,recipe,options:{retirementOwner:person.person}});
 for(const candidate of choices){try{const preview=createInsightPreview(flow,holdings,scenario,candidate.recipe,projection,candidate.options);if(preview.changed)tested.push({...candidate,preview});}catch{/* Unsupported or out-of-range scenarios are not offered to the model. */}}
 const cash=Object.values(byOwner).reduce((sum,group)=>sum+group.cash,0),reserveMonths=flow.assumptions.cashReserveMonths ?? DEFAULT_RESERVE_MONTHS;
 const opportunities=[];
 if(people.some(p=>p.annualGrossPay>0 || p.annualTakeHomePay>0)){opportunities.push('pensionRelief');if(current.monthlySurplus>0)opportunities.push('pensionVsIsa','isaCapacity');}
 if(cash<(current.monthlySpending+current.monthlyDebtPayments)*reserveMonths)opportunities.push('cashReserve');
 const brief={...buildAnalysisBrief(baseline,goal,available),version:2,context:{startMonth:projection.startMonth,people,assets:byOwner,debts,current,baseline,assumptions:{inflation:projection.assumptions.inflation,incomeGrowth:projection.assumptions.incomeGrowth,growth:projection.assumptions.growth,cashReserveMonths:reserveMonths,isaAllowancePerPerson:flow.assumptions.isaAllowance ?? ISA_ALLOWANCE_2026_27,withdrawalOrder:scenario.withdrawalOrder || 'generalFirst',savingRouting:scenario.savingsDestination==='general'?'general':'existing',retirementStress:Boolean(scenario.retirementStress)},milestones,scheduled:flow.datedEntries.filter(entry=>!entry.endMonth || entry.endMonth>=projection.startMonth).slice(0,12).map(entry=>({side:entry.side,amount:rounded(entry.amount),frequency:entry.frequency,startMonth:entry.startMonth || null,endMonth:entry.endMonth || null})),limitations:['taxRulesHeldFixed','salarySacrificeNotModelled','contributionLimitsNotModelled','survivorNotModelled',...(projection.taxLimitations.length?['taxInputsIncomplete']:[]),...(projection.unmodelledDebt>0?['debtPaymentsIncomplete']:[])]},candidates:tested.map(item=>({id:item.id,recipe:item.recipe,person:item.options.retirementOwner || 'household',after:summary(item.preview.after),delta:Object.fromEntries(Object.entries(item.preview.delta).map(([key,v])=>[key,Math.round(v)])),spendingYear:item.preview.spendingYear ?? null,monthlySpendingReduction:Math.round(item.preview.monthlySpendingReduction || 0),payoff:item.preview.payoff?{paid:Math.round(item.preview.payoff.paid),remaining:Math.round(item.preview.payoff.remaining),tax:Math.round(item.preview.payoff.tax)}:null})),opportunities};
 validateAnalysisBrief(brief);
 return {brief,tested};
}
