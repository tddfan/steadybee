// Deliberately excludes names, ages, pay records, labels and account identifiers.
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
 if(!v || Object.keys(v).sort().join()!=='endMonth,facts,goal,moneyBasis,recipes,version' || v.version!==1 || !['security','retirement','legacy'].includes(v.goal) || v.moneyBasis!=='today' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(v.endMonth) || !Array.isArray(v.facts) || v.facts.length!==5 || !Array.isArray(v.recipes) || v.recipes.length>6)throw Error('Invalid analysis summary.');
 if(new Set(v.recipes).size!==v.recipes.length || v.recipes.some(r=>!recipes.includes(r)))throw Error('Invalid experiments.');
 for(const [index,id] of Object.keys(AI_REASONS).entries()){const f=v.facts[index];if(!f || Object.keys(f).sort().join()!=='flag,id,value' || f.id!==id || typeof f.flag!=='boolean' || !Number.isSafeInteger(f.value) || Math.abs(f.value)>1e12)throw Error('Invalid calculation fact.');}
 return structuredClone(v);
}
export function validateAnalysisResult(result,brief){
 validateAnalysisBrief(brief);
 if(!result || Object.keys(result).sort().join()!=='experiments,observations' || !Array.isArray(result.observations) || result.observations.length<1 || result.observations.length>3 || !Array.isArray(result.experiments) || result.experiments.length>2)throw Error('Unsupported analysis response.');
 if(new Set(result.observations).size!==result.observations.length || result.observations.some(id=>!brief.facts.some(f=>f.id===id && f.flag)) || new Set(result.experiments).size!==result.experiments.length || result.experiments.some(id=>!brief.recipes.includes(id)))throw Error('Analysis references unsupported facts or experiments.');
 return structuredClone(result);
}
