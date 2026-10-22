import test from 'node:test';
import assert from 'node:assert/strict';
import {createBlankMonthlyFlow} from '../prototype/monthly-flow.mjs';
import {projectPlan} from '../prototype/planning.mjs';
import {incomeTaxWithSavings, savingsTax, capitalGainsTax} from '../prototype/investment-tax.mjs';
import {taxPeriodView} from '../prototype/planning-tax.mjs';
const options={years:1,inflation:0,incomeGrowth:0,growth:{cash:6,isa:0,pension:0,property:0,shares:0}};
const round=value=>Math.round(value*100)/100;
const sum=(rows,key)=>round(rows.reduce((total,row)=>total+(row[key] || 0),0));
const close=(actual,expected,tolerance=.1)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} vs ${expected}`);
function setup(salary=0,cash=100000){
  const flow=createBlankMonthlyFlow();flow.timelineStartMonth=flow.asOfMonth='2026-04';flow.pay.primary.annualGross=salary;
  return {flow,holdings:{name:'Test',age:60,assets:[{id:'cash',kind:'cash',owner:'primary',value:cash}],debts:[]}};
}
test('accountant retirement example has no savings tax when actual full-year income leaves enough allowance',()=>{
  const {flow,holdings}=setup(24000);flow.pay.primary.endDate='2026-09';
  const before=JSON.stringify({flow,holdings}),p=projectPlan(flow,holdings,options);
  assert.equal(sum(p.months,'cashInterestTax'),0);
  assert.equal(sum(p.months.map(row=>({value:row.taxByType.employmentTax})),'value'),0);
  const interest=sum(p.months,'cashInterestGross');assert.ok(interest>6000 && interest<6570);
  assert.equal(savingsTax(12000,interest),0);
  let balance=100000,expectedInterest=0;
  for(let month=0;month<12;month++){const next=round(balance*1.06**(1/12));expectedInterest=round(expectedInterest+next-balance);balance=round(next+(month<6 ? 1923.8 : 0));}
  close(interest,expectedInterest,.02);close(p.months.at(-1).assetsTotal,balance,.02);
  assert.equal(JSON.stringify({flow,holdings}),before);
});
test('tax uses actual interest across changing balances, not a monthly amount multiplied by twelve',()=>{
  const {flow,holdings}=setup(30000,10000);
  flow.datedEntries.push({id:'cost',side:'spending',label:'One-off',amount:18000,frequency:'once',startMonth:'2026-12',endMonth:''});
  const p=projectPlan(flow,holdings,options),interest=sum(p.months,'cashInterestGross');
  close(sum(p.months,'cashInterestTax'),Math.max(0,interest-1000)*.2,.02);
  for(const row of p.months)assert.ok(row.cashInterestTax>=0);
});
test('savings allowances reset in April, not January, and fiscal totals reconcile',()=>{
  const {flow,holdings}=setup(30000);const p=projectPlan(flow,holdings,{...options,years:2});
  for(const year of [p.months.slice(0,12),p.months.slice(12)]){
    close(sum(year,'cashInterestTax'),Math.max(0,sum(year,'cashInterestGross')-1000)*.2,.02);
    assert.equal(year[0].cashInterestTax,0);
  }
  assert.ok(p.months.find(row=>row.month==='2027-01').cashInterestTax>0);
  const fiscal=taxPeriodView(p,{real:false,taxYears:true});
  close(fiscal.at(-1).cumulative.savingsInterestTax,sum(p.months,'cashInterestTax'),.02);
});
test('joint and personal accounts use independent owner allowances without moving tax to the other person',()=>{
  const {flow,holdings}=setup(60000,0);holdings.partnerName='Test partner';holdings.partnerAge=60;
  holdings.assets=[{id:'a',kind:'cash',owner:'primary',value:10000},{id:'b',kind:'cash',owner:'partner',value:20000},{id:'j',kind:'cash',owner:'shared',value:30000}];
  const p=projectPlan(flow,holdings,options);let primaryInterest=0,partnerInterest=0,primaryTax=0,partnerTax=0;
  let a=10000,b=20000,j=30000;
  for(const row of p.months){
    const ai=round(a*(1.06**(1/12)-1)),bi=round(b*(1.06**(1/12)-1)),ji=round(j*(1.06**(1/12)-1));
    primaryInterest=round(primaryInterest+ai+round(ji/2));partnerInterest=round(partnerInterest+bi+round(ji-round(ji/2)));
    const expectedA=round(savingsTax(60000,primaryInterest)-primaryTax),expectedB=round(savingsTax(0,partnerInterest)-partnerTax);
    close(row.cashInterestTax,expectedA+expectedB,.02);
    close(row.taxByPerson.partner,expectedB,.02);
    primaryTax=round(primaryTax+expectedA);partnerTax=round(partnerTax+expectedB);
    const taxA=round(expectedA*a/(a+j/2)),taxB=round(expectedB*b/(b+j/2));
    a=round(a+ai-taxA+(row.savingByPerson.primary || 0));b=round(b+bi-taxB+(row.savingByPerson.partner || 0));j=round(j+ji-(expectedA-taxA)-(expectedB-taxB));
  }
  assert.equal(partnerTax,0);assert.ok(primaryTax>0);
  close(p.months.at(-1).assetsTotal,a+b+j,.05);
});
test('pension draws and later interest share tax bands exactly once, including the allowance taper',()=>{
  const {flow,holdings}=setup(100000,5000);holdings.assets.push({id:'p',kind:'dc-pension',owner:'primary',value:500000});
  flow.spending.everyday=10000;
  const p=projectPlan(flow,holdings,options);let taxablePension=0;
  for(const row of p.months)for(const item of row.withdrawals.filter(item=>item.bucket==='pension'))taxablePension=round(taxablePension+item.gross-item.taxFree);
  const interest=sum(p.months,'cashInterestGross');
  const taxes=p.months.reduce((total,row)=>total+row.taxByType.employmentTax+row.taxByType.savingsInterestTax+row.taxByType.pensionDrawdownTax,0);
  close(taxes,incomeTaxWithSavings(100000+taxablePension,interest),.2);
  assert.ok(taxablePension>0 && interest>0);
  // Growth and cash flows reconcile without deducting already-net payroll tax twice.
  close(p.months.at(-1).assetsTotal,505000+interest+sum(p.months,'incomeTotal')-sum(p.months,'spendingTotal')-sum(p.months,'withdrawalTax')-sum(p.months,'cashInterestTax'),.15);
});
test('later interest revalues earlier capital gains without hiding that adjustment as savings tax',()=>{
  const {flow,holdings}=setup(50000,0);holdings.assets=[{id:'g',kind:'general',owner:'primary',value:100000,costBasis:0}];
  flow.datedEntries.push({id:'cost',side:'spending',label:'Disposal',amount:30000,frequency:'once',startMonth:'2026-04',endMonth:''});
  const p=projectPlan(flow,holdings,options);
  const gains=round(p.months.flatMap(row=>row.withdrawals).filter(item=>item.bucket==='general').reduce((total,item)=>total+item.gross,0));
  const interest=sum(p.months,'cashInterestGross');assert.ok(interest>270);
  const cgt=round(p.months.reduce((total,row)=>total+row.taxByType.capitalGainsTax,0));
  close(cgt,capitalGainsTax(gains,50000+interest),.03);
  assert.ok(sum(p.months,'cashCapitalGainsTax')>0);
  close(sum(p.months,'cashInterestTax'),savingsTax(50000,interest),.02);
});
