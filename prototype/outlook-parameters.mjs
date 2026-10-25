/** Comparable assumptions only. Reading a reference never reruns its archived forecast. */
import {PLANNING_DEFAULTS} from './planning.mjs?v=20261024persona1';
import {resolveRetirementYears} from './planning-retirement.mjs?v=20261024persona1';
const clone=x=>structuredClone(x);
const money=n=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(n);
const stable=x=>JSON.stringify(x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,JSON.parse(stable(x[k]))])):Array.isArray(x)?x.map(v=>JSON.parse(stable(v))):x??null);
export const sameOutlookParameter=(a,b)=>stable(a)===stable(b);
export function outlookParameters(picture,{forecast}={}){
 const {flow,holdings}=picture,s=picture.planning.scenario,values={},set=(key,value,label,inputValue=value)=>{values[key]={value:clone(value),label:label??String(value),inputValue};};
 const start=forecast?.startMonth||flow.tracking?.startMonth||flow.timelineStartMonth||flow.asOfMonth,startYear=Number(start.slice(0,4));
 const years=resolveRetirementYears({...flow,timelineStartMonth:start},holdings,s.retirementYears);
 for(const owner of holdings.partnerName?['primary','partner']:['primary']){
  const age=s.ages?.[owner]??(owner==='primary'?holdings.age:holdings.partnerAge),offset=Number(flow.pay[owner].endDate?.slice(5)||12)<Number(start.slice(5))?1:0;
  const retirementAge=Number.isFinite(age)?age+years[owner]-startYear-offset:null;
  set(`retirement.${owner}`,years[owner],retirementAge==null?String(years[owner]):`Age ${retirementAge} · ${years[owner]}`,retirementAge??years[owner]);
  set(`ages.${owner}`,age,age==null?'Not recorded':String(age));set(`taxFreeRemaining.${owner}`,s.taxFreeRemaining?.[owner]??268275,money(s.taxFreeRemaining?.[owner]??268275));
 }
 const horizon=s.planToAge==null?{mode:'years',value:s.years??30}:{mode:'age',value:s.planToAge};set('horizon',horizon,horizon.mode==='age'?`Age ${horizon.value}`:`${horizon.value} years`,horizon.value);
 for(const [key,value] of [['inflation',forecast?.assumptions.inflation??s.inflation??flow.assumptions.annualInflation??PLANNING_DEFAULTS.inflation],['incomeGrowth',forecast?.assumptions.incomeGrowth??s.incomeGrowth??flow.assumptions.incomeGrowthRate??PLANNING_DEFAULTS.incomeGrowth]])set(key,value,`${value}%`);
 for(const key of Object.keys(PLANNING_DEFAULTS.growth)){const value=forecast?.assumptions.growth[key]??s.growth?.[key]??flow.assumptions.assetGrowthRates?.[key]??PLANNING_DEFAULTS.growth[key];set(`growth.${key}`,value,`${value}%`);}
 for(const [key,value] of [['statePensionAge',s.statePensionAge??67],['pensionAccessAge',s.pensionAccessAge??55],['openingGainPercent',s.openingGainPercent??100]])set(key,value,`${value}${key==='openingGainPercent'?'%':''}`);
 for(const [key,value] of [['futureNI',s.futureNI!==false],['statePensionUprating',s.statePensionUprating!==false],['retirementStress',Boolean(s.retirementStress)],['mortgagePayoffNow',Boolean(s.mortgagePayoffNow)]])set(key,value,value?'On':'Off');
 const order=s.withdrawalOrder||'generalFirst';set('withdrawalOrder',order,({generalFirst:'Cash → General → ISA → Pension',pensionFirst:'Cash → Pension → General → ISA',isaFirst:'Cash → ISA → General → Pension'})[order]);
 set('savingsDestination',s.savingsDestination||'existing',s.savingsDestination==='general'?'General account only':'Existing cash → ISA → General');
 set('mortgagePayoffSource',s.mortgagePayoffSource||'automatic',s.mortgagePayoffSource==='cashShares'?'Cash + shares':'Use funding order');
 const mortgage=holdings.debts.find(d=>d.kind==='mortgage');if(mortgage){set('mortgageRate',s.mortgageRate??mortgage.interestRate??0,`${s.mortgageRate??mortgage.interestRate??0}%`);const term=s.mortgageTermYears??Math.ceil(mortgage.remainingYears||30);set('mortgageTermYears',term,`${term} years`);}
 for(const debt of holdings.debts.filter(d=>d.kind!=='mortgage'))for(const key of ['monthlyPayment','annualRate']){const value=s.debtPayments?.[debt.id]?.[key]??(key==='annualRate'?debt.interestRate:null)??null;set(`debtPayments.${debt.id}.${key}`,value,value==null?'Not entered':key==='monthlyPayment'?money(value):`${value}%`);}
 const phases=s.spendingChanges??[{year:Math.max(...Object.values(years))+1,percent:100}];set('spendingChanges',phases,phases.length?phases.map(p=>`${p.year}: ${p.percent}%`).join(' · '):'No spending phases');
 set('oneOff.amount',s.oneOff?.amount??0,money(s.oneOff?.amount??0));set('oneOff.month',s.oneOff?.amount?s.oneOff.month:null,s.oneOff?.amount?s.oneOff.month:'No extra cost');
 return values;
}
export function baselineOutlookScenario(reference){
 if(!reference?.inputs)return null;const p=reference.inputs,original=clone(p.planning.scenario),v=outlookParameters(p,{forecast:reference.forecast});
 // Materialise defaults from the saved inputs, rather than today's edited rates.
 original.inflation=v.inflation.value;original.incomeGrowth=v.incomeGrowth.value;
 original.growth=Object.fromEntries(Object.keys(PLANNING_DEFAULTS.growth).map(k=>[k,v[`growth.${k}`].value]));
 original.retirementYears=Object.fromEntries((p.holdings.partnerName?['primary','partner']:['primary']).map(owner=>[owner,v[`retirement.${owner}`].value]));
 for(const key of ['statePensionAge','pensionAccessAge','openingGainPercent','futureNI','statePensionUprating','retirementStress','mortgagePayoffNow','withdrawalOrder','savingsDestination','mortgagePayoffSource','mortgageRate','mortgageTermYears'])if(v[key])original[key]=clone(v[key].value);
 original.spendingChanges=clone(v.spendingChanges.value);return original;
}
