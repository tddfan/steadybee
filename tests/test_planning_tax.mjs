import test from 'node:test';
import assert from 'node:assert/strict';
import {createBlankMonthlyFlow,summarizeMonthlyFlow} from '../prototype/monthly-flow.mjs';
import {projectPlan,annualPlanView} from '../prototype/planning.mjs';
import {taxPeriodView} from '../prototype/planning-tax.mjs';
import {createWithdrawalState,withdrawForSpending} from '../prototype/withdrawals.mjs';
const zero={years:1,inflation:0,incomeGrowth:0,growth:{cash:0,isa:0,pension:0,property:0,shares:0}};
const setup=(age=40)=>{const flow=createBlankMonthlyFlow();flow.timelineStartMonth=flow.asOfMonth='2026-04';return {flow,holdings:{name:'Test',age,assets:[],debts:[]}};};
const close=(actual,expected,tolerance=.15)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} vs ${expected}`);
test('salary tax and NI are reported without being deducted twice from savings',()=>{
 const {flow,holdings}=setup();flow.pay.primary.annualGross=24000;
 const p=projectPlan(flow,holdings,zero),year=taxPeriodView(p,{real:false,taxYears:true})[0];
 close(year.components.employmentTax,2286);close(year.components.employeeNI,914.4);close(year.total,3200.4);
 close(p.months.at(-1).assetsTotal,20799.6);assert.equal(year.incomplete,false);
 for(const month of p.months)close(Object.values(month.taxByType).reduce((a,b)=>a+b,0),Object.values(month.taxByPerson).reduce((a,b)=>a+b,0),.01);
});
test('NI stops at State Pension age and an explicit exemption month controls a partial year',()=>{
 const {flow,holdings}=setup(67);flow.pay.primary.annualGross=24000;
 close(taxPeriodView(projectPlan(flow,holdings,zero),{real:false})[0].components.employeeNI,0);
 holdings.age=66;flow.pay.primary.niExemptFrom='2026-10';
 const p=projectPlan(flow,holdings,zero);close(p.months.slice(0,6).reduce((sum,m)=>sum+m.taxByType.employeeNI,0),457.2);
 assert.equal(p.months[6].taxByType.employeeNI,0);
 flow.asOfMonth='2026-10';assert.equal(summarizeMonthlyFlow(flow,holdings).payDetails[0].estimate.employeeNI,0);
});
test('midyear retirement uses the year total rather than twelve months of salary for Income Tax',()=>{
 const {flow,holdings}=setup(60);flow.pay.primary.annualGross=24000;flow.pay.primary.endDate='2026-09';
 const p=projectPlan(flow,holdings,zero);close(taxPeriodView(p,{real:false})[0].components.employmentTax,0);
 close(p.months.at(-1).assetsTotal,11542.8);
});
test('pay and State Pension share one annual allowance in the modelled year',()=>{
 const {flow,holdings}=setup(67);flow.pay.primary.annualGross=20000;
 flow.statePensions.primary={qualifyingYears:35,mode:'official',weeklyForecast:241.3,startMonth:'2026-04',assessmentMonth:'2026-04',otherTaxableIncome:0};
 const p=projectPlan(flow,holdings,zero),row=taxPeriodView(p,{real:false,taxYears:true})[0];
 close(row.components.employmentTax,1486);close(row.components.statePensionTax,2509.52);close(row.total,3995.52);
 close(p.months.at(-1).assetsTotal,28552.08,.25);
});
test('one-off mortgage payoff from a pension does not invent twelve repeated pension withdrawals',()=>{
 const {flow,holdings}=setup(60);holdings.assets=[{id:'p',kind:'dc-pension',owner:'primary',value:100000}];holdings.debts=[{id:'m',kind:'mortgage',balance:12000,interestRate:0,remainingYears:10}];
 const p=projectPlan(flow,holdings,{...zero,mortgagePayoffNow:true});
 assert.equal(p.mortgagePayoff.paid,12000);assert.equal(p.mortgagePayoff.gross,12000);assert.equal(p.mortgagePayoff.tax,0);
});
test('same net pension need once or monthly has the same final tax-year liability',()=>{
 const run=spread=>{const assets=[{id:'p',kind:'dc-pension',owner:'primary',value:100000}],state=createWithdrawalState(assets);let tax=0,gross=0;
  for(let i=0;i<(spread ? 12 : 1);i++){const month=new Date(Date.UTC(2026,3+i,1)).toISOString().slice(0,7),r=withdrawForSpending(assets,spread ? 2000 : 24000,state,{month,ages:{primary:60},taxYearIncome:{primary:0,partner:0}});tax+=r.tax;gross+=r.gross;assert.equal(r.unfunded,0);}
  return {tax,gross};};
 const once=run(false),monthly=run(true);close(once.gross,25277.65,.25);close(once.tax,1277.65,.25);close(monthly.tax,once.tax,.25);close(monthly.gross,once.gross,.25);
});
test('tax-year pension allowance resets at April, and cumulative tables sum monthly entries',()=>{
 const assets=[{id:'p',kind:'dc-pension',owner:'primary',value:100000}],state=createWithdrawalState(assets);
 for(const month of ['2027-03','2027-04'])assert.equal(withdrawForSpending(assets,12000,state,{month,ages:{primary:60},taxYearIncome:{primary:0,partner:0}}).tax,0);
 const {flow,holdings}=setup();flow.pay.primary.annualGross=24000;const p=projectPlan(flow,holdings,{...zero,years:2});
 const calendar=taxPeriodView(p,{real:false}),fiscal=taxPeriodView(p,{real:false,taxYears:true});
 assert.equal(fiscal[0].year,'2026/27');assert.equal(fiscal[0].months,12);
 close(calendar.at(-1).cumulativeTotal,p.months.reduce((sum,m)=>sum+m.taxTotal,0),.01);
 close(annualPlanView(p,'tax','type',false).reduce((sum,row)=>sum+row.total,0),calendar.at(-1).cumulativeTotal,.01);
 const real=taxPeriodView({...p,months:p.months.map((m,i)=>({...m,deflator:1+i/100}))});close(real.at(-1).cumulativeTotal,p.months.reduce((sum,m,i)=>sum+m.taxTotal/(1+i/100),0),.01);
});
test('actual take-home and unidentified private pensions remain explicitly incomplete tax totals',()=>{
 const {flow,holdings}=setup();flow.pay.primary.annualTakeHome=24000;flow.income.pensionIncome=100;
 const p=projectPlan(flow,holdings,zero);assert.equal(taxPeriodView(p)[0].incomplete,true);assert.ok(p.taxLimitations.some(note=>note.includes('take-home')));assert.ok(p.taxLimitations.some(note=>note.includes('private pension')));
});

test('scenario age overrides also apply to employee NI exemption timing',()=>{
 const {flow,holdings}=setup(40);flow.pay.primary.annualGross=24000;
 const p=projectPlan(flow,holdings,{...zero,ages:{primary:67}});
 assert.equal(p.months[0].taxByType.employeeNI,0);
});
