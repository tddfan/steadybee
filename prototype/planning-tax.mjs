/** Shared tax reporting and recurring-income forecast. April is treated as the start of a tax year. */
import {incomeTaxWithSavings} from './investment-tax.mjs';
const round=value=>Math.round(value*100)/100;
export const TAX_COMPONENTS=Object.freeze({employmentTax:'Employment Income Tax',statePensionTax:'State Pension Income Tax',pensionDrawdownTax:'Pension withdrawal Income Tax',capitalGainsTax:'Capital Gains Tax',savingsInterestTax:'Savings-interest tax',employeeNI:'Employee National Insurance'});
export const taxYearFor=month=>Number(month.slice(0,4))-(Number(month.slice(5))<4 ? 1 : 0);
export function employeeNIExempt(flow,holdings,owner,month) {
 const pay=flow.pay[owner];
 if(pay.niExemptFrom){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(pay.niExemptFrom))throw new RangeError('Enter a valid NI exemption month.');return month>=pay.niExemptFrom;}
 const age=owner==='primary' ? holdings.age : holdings.partnerAge;
 if(!Number.isFinite(age))return false;
 const start=flow.timelineStartMonth || flow.asOfMonth,birthYear=Number(start.slice(0,4))-age,pensionAge=birthYear>=1978 ? 68 : 67;
 const elapsed=(Number(month.slice(0,4))-Number(start.slice(0,4)))*12+Number(month.slice(5))-Number(start.slice(5));
 return age+elapsed/12>=pensionAge;
}
export function forecastTaxYear(flow,pensions,startMonth,year,{incomeGrowth=0,inflation=0,statePensionUprating=true}={}) {
 const result={};
 for(const owner of ['primary','partner']) {
  const pay=flow.pay[owner],pension=pensions[owner];let employment=0,state=0;
  for(let i=0;i<12;i++) {
   const date=new Date(Date.UTC(year,3+i,1)).toISOString().slice(0,7);
   const elapsed=Math.max(0,(Number(date.slice(0,4))-Number(startMonth.slice(0,4)))*12+Number(date.slice(5))-Number(startMonth.slice(5)))/12;
   const factor=(1+incomeGrowth/100)**elapsed;
   if(!pay.endDate || date<=pay.endDate)employment+=Math.max(0,(pay.annualGross+pay.annualBonus-(pay.employeePensionRate ? pay.annualGross*pay.employeePensionRate/100 : pay.employeePension))*factor)/12;
   if(pension && date>=pension.startMonth)state+=pension.annualGross*(statePensionUprating ? (1+inflation/100)**elapsed : 1)/12;
  }
  const other=(flow.statePensions?.[owner]?.otherTaxableIncome || 0)+(flow.income.pensionIncome || 0)*12/(flow.pay.partner && flow.hasPartner ? 2 : 1);
  employment=round(employment);state=round(state);
  result[owner]={employment,state,employmentTax:incomeTaxWithSavings(employment),statePensionTax:round(incomeTaxWithSavings(employment+state+other)-incomeTaxWithSavings(employment+other)),taxableIncome:round(employment+state+other)};
 }
 return result;
}
export function taxPeriodView(projection,{real=true,taxYears=false}={}) {
 const rows=new Map(),cumulative=Object.fromEntries(Object.keys(TAX_COMPONENTS).map(key=>[key,0]));
 for(const month of projection.months) {
  const key=taxYears ? `${taxYearFor(month.month)}/${String(taxYearFor(month.month)+1).slice(-2)}` : month.month.slice(0,4);
  if(!rows.has(key))rows.set(key,{year:key,months:0,components:{},byPerson:{},incomplete:false});
  const row=rows.get(key),divisor=real ? month.deflator : 1;row.months++;row.incomplete ||= Boolean(month.taxIncomplete);
  for(const component of Object.keys(TAX_COMPONENTS))row.components[component]=(row.components[component] || 0)+(month.taxByType?.[component] || 0)/divisor;
  for(const [person,value] of Object.entries(month.taxByPerson || {}))row.byPerson[person]=(row.byPerson[person] || 0)+value/divisor;
 }
 let total=0;
 return [...rows.values()].map(row=>{for(const key of Object.keys(TAX_COMPONENTS))cumulative[key]+=row.components[key] || 0;const taxTotal=Object.values(row.components).reduce((sum,value)=>sum+value,0);total+=taxTotal;return {...row,total:taxTotal,cumulativeTotal:total,cumulative:{...cumulative}};});
}
