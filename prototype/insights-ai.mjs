// V2 adds reviewed financial context; identities and user-entered text remain excluded.
export const AI_REASONS={
 gap:'Spending exceeds accessible funding in part of this plan. Compare the timing and size of the shortfall.',
 tax:'This is modelled tax across the whole plan, rather than tax on one income source. Lower tax alone is not a better outcome.',
 liquidity:'Accessible assets exclude locked pensions and assets that need a sale. A positive estate can coexist with a spending gap.',
 uncertainty:'Some inputs or tax treatments are incomplete. Resolve these before relying on a comparison.',
 resilience:'These balances depend on the selected assumptions. A market-fall experiment helps explore sensitivity, without assigning a probability.'
};
export function buildAnalysisBrief(summary,goal,recipes){
 return {version:1,goal,endMonth:summary.endMonth,moneyBasis:'today',facts:[
  {id:'gap',value:Math.round(summary.unfunded),flag:!!summary.firstGap},
  {id:'tax',value:Math.round(summary.tax),flag:summary.tax>0},
  {id:'liquidity',value:Math.round(summary.accessible),flag:summary.accessible<=0},
  {id:'uncertainty',value:0,flag:summary.incomplete},
  {id:'resilience',value:Math.round(summary.netAssets),flag:true}
 ],recipes:[...recipes]};
}
const recipes=['spendLess','retireLater','retireEarlier','stress','withdrawalOrder','mortgagePayoff'];
export function validateAnalysisBrief(v){
 if(!v || Object.keys(v).sort().join()!==(v.version===2?'candidates,context,endMonth,facts,goal,moneyBasis,opportunities,recipes,version':'endMonth,facts,goal,moneyBasis,recipes,version') || ![1,2].includes(v.version) || !['security','retirement','legacy'].includes(v.goal) || v.moneyBasis!=='today' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(v.endMonth) || !Array.isArray(v.facts) || v.facts.length!==5 || !Array.isArray(v.recipes) || v.recipes.length>6)throw Error('Invalid analysis summary.');
 if(new Set(v.recipes).size!==v.recipes.length || v.recipes.some(r=>!recipes.includes(r)))throw Error('Invalid experiments.');
 for(const [index,id] of Object.keys(AI_REASONS).entries()){const f=v.facts[index];if(!f || Object.keys(f).sort().join()!=='flag,id,value' || f.id!==id || typeof f.flag!=='boolean' || !Number.isSafeInteger(f.value) || Math.abs(f.value)>1e12)throw Error('Invalid calculation fact.');}
 if(v.version===2)validateContext(v);
 return structuredClone(v);
}
export function validateAnalysisResult(result,brief){
 validateAnalysisBrief(brief);
 if(brief.version===2)return validateContextResult(result,brief);
 if(!result || Object.keys(result).sort().join()!=='experiments,observations' || !Array.isArray(result.observations) || result.observations.length<1 || result.observations.length>3 || !Array.isArray(result.experiments) || result.experiments.length>2)throw Error('Unsupported analysis response.');
 if(new Set(result.observations).size!==result.observations.length || result.observations.some(id=>!brief.facts.some(f=>f.id===id && f.flag)) || new Set(result.experiments).size!==result.experiments.length || result.experiments.some(id=>!brief.recipes.includes(id)))throw Error('Analysis references unsupported facts or experiments.');
 return structuredClone(result);
}

const own=(object,fields)=>object && typeof object==='object' && !Array.isArray(object) && Object.keys(object).sort().join()===fields.split(',').sort().join();
const amount=value=>Number.isSafeInteger(value) && Math.abs(value)<=1e12;
const numeric=value=>Number.isFinite(value) && Math.abs(value)<=1e12;
const month=value=>typeof value==='string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
const nullable=(check,value)=>value===null || check(value);
const oneOf=(value,values)=>values.includes(value);
const groupKeys='cash,isa,pension,general,property,other';
const summaryKeys='endMonth,firstGap,unfunded,tax,netAssets,accessible,cash,incomplete,unmodelledDebt';
function validSummary(value){return own(value,summaryKeys) && month(value.endMonth) && nullable(month,value.firstGap) && typeof value.incomplete==='boolean' && ['unfunded','tax','netAssets','accessible','cash','unmodelledDebt'].every(key=>amount(value[key]));}
function validateContext(v){
 const c=v.context,fail=()=>{throw Error('Invalid detailed analysis context.');};
 if(!own(c,'startMonth,people,assets,debts,current,baseline,assumptions,milestones,scheduled,limitations') || !month(c.startMonth) || !validSummary(c.baseline) || c.baseline.endMonth!==v.endMonth)fail();
 if(!Array.isArray(c.people) || c.people.length<1 || c.people.length>2 || new Set(c.people.map(p=>p.person)).size!==c.people.length)fail();
 for(const p of c.people){if(!own(p,'person,age,finalPayMonth,payBasis,annualGrossPay,annualTakeHomePay,employeePensionAnnual,employerPensionAnnual,statePensionAnnual,statePensionStartMonth,pensionAccessAges,pensionTaxFreeRemaining,isaSubscribedThisYear') || !oneOf(p.person,['primary','partner']) || !nullable(x=>Number.isInteger(x)&&x>=18&&x<=120,p.age) || !nullable(month,p.finalPayMonth) || !nullable(month,p.statePensionStartMonth) || !oneOf(p.payBasis,['takeHomeOnly','grossEstimate']) || !['annualGrossPay','annualTakeHomePay','employeePensionAnnual','employerPensionAnnual','statePensionAnnual','pensionTaxFreeRemaining','isaSubscribedThisYear'].every(key=>nullable(amount,p[key])) || !Array.isArray(p.pensionAccessAges) || p.pensionAccessAges.length>20 || !p.pensionAccessAges.every(x=>Number.isInteger(x)&&x>=55&&x<=120))fail();}
 if(!own(c.assets,'primary,partner,shared') || !Object.values(c.assets).every(group=>own(group,groupKeys)&&Object.values(group).every(amount)))fail();
 if(!Array.isArray(c.debts) || c.debts.length>20 || !c.debts.every(d=>own(d,'kind,balance,annualRate,remainingYears,mortgageType')&&oneOf(d.kind,['mortgage','otherDebt'])&&amount(d.balance)&&nullable(numeric,d.annualRate)&&nullable(numeric,d.remainingYears)&&oneOf(d.mortgageType,['repayment','interest-only','notApplicable'])))fail();
 if(!own(c.current,'month,monthlyIncome,monthlySpending,monthlyDebtPayments,monthlySurplus') || !month(c.current.month) || !['monthlyIncome','monthlySpending','monthlyDebtPayments','monthlySurplus'].every(key=>amount(c.current[key])))fail();
 const a=c.assumptions;if(!own(a,'inflation,incomeGrowth,growth,cashReserveMonths,isaAllowancePerPerson,withdrawalOrder,savingRouting,retirementStress') || !['inflation','incomeGrowth','cashReserveMonths','isaAllowancePerPerson'].every(key=>numeric(a[key])) || !own(a.growth,'cash,isa,pension,property,shares') || !Object.values(a.growth).every(numeric) || !oneOf(a.withdrawalOrder,['generalFirst','isaFirst','pensionFirst']) || !oneOf(a.savingRouting,['existing','general']) || typeof a.retirementStress!=='boolean')fail();
 if(!Array.isArray(c.milestones) || c.milestones.length>8 || !c.milestones.every(m=>own(m,'event,person,month,netAssets,accessible,monthlyTax,monthlySpending')&&oneOf(m.event,['finalPay','statePension','fundingGap','debtPaid'])&&oneOf(m.person,['primary','partner','household'])&&month(m.month)&&['netAssets','accessible','monthlyTax','monthlySpending'].every(key=>amount(m[key]))))fail();
 if(!Array.isArray(c.scheduled) || c.scheduled.length>12 || !c.scheduled.every(e=>own(e,'side,amount,frequency,startMonth,endMonth')&&oneOf(e.side,['income','spending'])&&amount(e.amount)&&oneOf(e.frequency,['monthly','yearly','once'])&&nullable(month,e.startMonth)&&nullable(month,e.endMonth)))fail();
 if(!Array.isArray(c.limitations) || c.limitations.length>6 || !c.limitations.every(key=>oneOf(key,['taxRulesHeldFixed','salarySacrificeNotModelled','contributionLimitsNotModelled','survivorNotModelled','taxInputsIncomplete','debtPaymentsIncomplete'])))fail();
 if(!Array.isArray(v.candidates) || v.candidates.length>10 || new Set(v.candidates.map(item=>item.id)).size!==v.candidates.length)fail();
 for(const item of v.candidates){if(!own(item,'id,recipe,person,after,delta,spendingYear,monthlySpendingReduction,payoff') || !v.recipes.includes(item.recipe) || !oneOf(item.person,['primary','partner','household']) || item.id!==(item.person==='household'?item.recipe:`${item.recipe}_${item.person}`) || (item.person!=='household' && !['retireEarlier','retireLater'].includes(item.recipe)) || !validSummary(item.after) || item.after.endMonth!==v.endMonth || !own(item.delta,'unfunded,tax,netAssets,accessible,cash') || !Object.values(item.delta).every(amount) || !nullable(x=>Number.isInteger(x)&&x>=1900&&x<=2200,item.spendingYear) || !amount(item.monthlySpendingReduction) || !nullable(p=>own(p,'paid,remaining,tax')&&Object.values(p).every(amount),item.payoff))fail();}
 if(!Array.isArray(v.opportunities) || v.opportunities.length>4 || new Set(v.opportunities).size!==v.opportunities.length || !v.opportunities.every(key=>oneOf(key,['pensionVsIsa','pensionRelief','isaCapacity','cashReserve'])))fail();
}
function validateContextResult(result,brief){
 const text=value=>typeof value==='string'&&value.trim().length>0&&value.length<=320&&!/[\d£$€%<>]|https?:|\b(?:hundred|thousand|million|billion|percent|pounds?|dollars?|euros?)\b/i.test(value);
 if(!own(result,'observations,recommendations,followUps') || !Array.isArray(result.observations) || result.observations.length>3 || !result.observations.length || new Set(result.observations).size!==result.observations.length || result.observations.some(id=>!brief.facts.some(f=>f.id===id && f.flag)) || !Array.isArray(result.recommendations) || result.recommendations.length>3 || new Set(result.recommendations.map(r=>r.candidateId)).size!==result.recommendations.length || !result.recommendations.every(r=>own(r,'candidateId,why,tradeoff')&&brief.candidates.some(c=>c.id===r.candidateId)&&text(r.why)&&text(r.tradeoff)) || !Array.isArray(result.followUps) || result.followUps.length>2 || new Set(result.followUps).size!==result.followUps.length || !result.followUps.every(id=>brief.opportunities.includes(id)))throw Error('Unsupported detailed analysis response.');
 return structuredClone(result);
}
export function analysisResponseSchema(brief){
 const picks=(values,fallback,max)=>({type:'array',maxItems:Math.min(max,values.length),items:{type:'string',enum:values.length?values:fallback}});
 const observations={type:'array',minItems:1,maxItems:3,items:{type:'string',enum:brief.facts.filter(f=>f.flag).map(f=>f.id)}};
 if(brief.version===1)return {type:'object',additionalProperties:false,required:['observations','experiments'],properties:{observations,experiments:picks(brief.recipes,recipes,2)}};
 return {type:'object',additionalProperties:false,required:['observations','recommendations','followUps'],properties:{observations,recommendations:{type:'array',maxItems:Math.min(3,brief.candidates.length),items:{type:'object',additionalProperties:false,required:['candidateId','why','tradeoff'],properties:{candidateId:{type:'string',enum:brief.candidates.length?brief.candidates.map(c=>c.id):recipes},why:{type:'string'},tradeoff:{type:'string'}}}},followUps:picks(brief.opportunities,['pensionVsIsa','pensionRelief','isaCapacity','cashReserve'],2)}};
}
