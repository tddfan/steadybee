/** Auditable explanation evidence, derived from existing monthly results. No new financial rules. */
import {lifelineMoney,shiftLifelineMonth} from './lifeline.mjs?v=20261025lifeline1';
import {EVIDENCE_LABELS} from './explanation-fields.mjs?v=20261027explain1';
export {EVIDENCE_LABELS};

const round=n=>Math.round(n*100)/100;
const limits=p=>[...(p.taxLimitations?.length?['taxIncomplete']:[]),...(p.unmodelledDebt>0?['debtIncomplete']:[])];
const fields=['incomeTotal','spendingTotal','withdrawalNet','unfunded','taxTotal','debtPayment','pensionContributions'];
function totals(rows,basis){
 const sum=fn=>round(rows.reduce((s,r)=>s+lifelineMoney(fn(r)||0,r.month,basis),0)),last=rows.at(-1),result={};
 for(const key of fields)result[key]=sum(r=>r[key]);
 result.paid=sum(r=>Math.max(0,r.spendingTotal-r.unfunded));
 for(const key of ['pay','statePension','rent','pensionIncome','other'])result[key]=sum(r=>r.incomeByType?.[key]);
 result.pensionGross=sum(r=>(r.withdrawals||[]).filter(w=>w.bucket==='pension').reduce((s,w)=>s+w.gross,0));
 for(const key of ['employmentTax','employeeNI','statePensionTax','pensionDrawdownTax','capitalGainsTax','savingsInterestTax'])result[key]=sum(r=>r.taxByType?.[key]);
 result.accessible=last?round(lifelineMoney(last.withdrawableAssets,last.month,basis)):null;result.locked=last?round(lifelineMoney(last.lockedPensions||0,last.month,basis)):null;result.netAssets=last?round(lifelineMoney(last.assetsTotal-last.debtsTotal,last.month,basis)):null;
 return result;
}
function briefBase(task,projection,rows,basis,recipe=null,path='current'){
 return {version:4,task,path,moneyBasis:basis.real===false?'nominal':'today',basisMonth:basis.basisMonth,startMonth:rows[0]?.month||projection.startMonth,endMonth:rows.at(-1)?.month||projection.endMonth,comparisonStartMonth:null,comparisonEndMonth:null,recipe,facts:[],limitations:limits(projection)};
}
const add=(brief,id,amount,month=null)=>brief.facts.push({id,amount:amount==null?null:round(amount),month});
export function periodEvidence(projection,month,{view='month',real=true,basisMonth=month,inflation=projection.assumptions.inflation,path='current'}={}){
 const rows=projection.months.filter(r=>view==='life'?r.month.slice(0,4)===month.slice(0,4):r.month===month),basis={real,basisMonth,inflation},brief=briefBase('period',projection,rows,basis,null,path);
 if(!rows.length)return {brief,empty:true,status:'outside',comparable:false};
 const firstGap=rows.find(r=>r.unfunded>.01);if(firstGap)add(brief,'periodGap',null,firstGap.month);
 const c=totals(rows,basis),offset=view==='life'?-12:-1,previous=rows.map(r=>projection.months.find(p=>p.month===shiftLifelineMonth(r.month,offset))),comparable=previous.every(Boolean);
 for(const [id,key] of [['income','incomeTotal'],['costs','spendingTotal'],['paid','paid'],['withdrawals','withdrawalNet'],['unpaid','unfunded'],['tax','taxTotal'],['accessible','accessible'],['locked','locked'],['pensionGross','pensionGross'],['pensionTax','pensionDrawdownTax'],['employmentTax','employmentTax'],['employeeNI','employeeNI'],['statePensionTax','statePensionTax'],['capitalGainsTax','capitalGainsTax'],['savingsInterestTax','savingsInterestTax']])add(brief,id,c[key]);
 if(comparable){const p=totals(previous,basis);brief.comparisonStartMonth=previous[0].month;brief.comparisonEndMonth=previous.at(-1).month;for(const [id,key] of [['deltaIncome','incomeTotal'],['deltaCosts','spendingTotal'],['deltaPay','pay'],['deltaStatePension','statePension'],['deltaRent','rent'],['deltaOtherIncome','other'],['deltaPensionIncome','pensionIncome'],['deltaDebt','debtPayment'],['deltaWithdrawals','withdrawalNet'],['deltaTax','taxTotal']])add(brief,id,c[key]-p[key]);}
 return {brief,empty:false,comparable,status:rows.some(r=>r.unfunded>.01)?'shortfall':rows.some(r=>r.withdrawalNet>.01)?'assets':'income'};
}
export function scenarioEvidence(current,scenario,{real=true,basisMonth=current.startMonth,inflation=current.assumptions.inflation,recipe=null}={}){
 const basis={real,basisMonth,inflation},brief=briefBase('scenario',scenario,scenario.months,basis,recipe,'preview'),comparable=current.months.map(r=>r.month).join()===scenario.months.map(r=>r.month).join();
 brief.limitations=[...new Set([...limits(current),...limits(scenario)])];
 if(!comparable){brief.limitations.push('coverageDiffers');return {brief,comparable:false,empty:false};}
 brief.comparisonStartMonth=current.startMonth;brief.comparisonEndMonth=current.endMonth;
 const a=totals(current.months,basis),b=totals(scenario.months,basis);
 for(const [prefix,values] of [['current',a],['scenario',b]])for(const [suffix,key] of [['Unpaid','unfunded'],['Tax','taxTotal'],['Accessible','accessible'],['NetAssets','netAssets'],['Income','incomeTotal']])add(brief,prefix+suffix,values[key]);
 for(const [id,key] of [['deltaIncome','incomeTotal'],['deltaCosts','spendingTotal'],['deltaTax','taxTotal'],['deltaUnpaid','unfunded'],['deltaAccessible','accessible'],['deltaNetAssets','netAssets'],['deltaContributions','pensionContributions']])add(brief,id,b[key]-a[key]);
 const gap=p=>p.months.find(r=>r.unfunded>.01)?.month||null;
 add(brief,'currentGap',null,gap(current));add(brief,'scenarioGap',null,gap(scenario));
 const changed=scenario.months.find((r,i)=>fields.some(k=>Math.abs((r[k]||0)-(current.months[i][k]||0))>.01)||Math.abs(r.assetsTotal-current.months[i].assetsTotal)>.01||Math.abs(r.debtsTotal-current.months[i].debtsTotal)>.01);
 add(brief,'firstChange',null,changed?.month||null);
 return {brief,comparable,empty:false,status:gap(scenario)?'shortfall':'covered'};
}
export const evidenceFact=(report,id)=>report.brief.facts.find(f=>f.id===id);
