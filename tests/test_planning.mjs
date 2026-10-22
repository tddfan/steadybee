import test from 'node:test';
import assert from 'node:assert/strict';
import { projectPlan } from '../prototype/planning.mjs';
import { createBlankMonthlyFlow } from '../prototype/monthly-flow.mjs';
const zero={inflation:0,incomeGrowth:0,growth:{cash:0,isa:0,pension:0,property:0,shares:0},years:1};
function setup(){const flow=createBlankMonthlyFlow();flow.timelineStartMonth=flow.asOfMonth='2026-10';flow.pay.primary.annualTakeHome=12000;return {flow,holdings:{name:'Sam',assets:[{id:'c',kind:'cash',owner:'primary',value:1000}],debts:[]}};}
test('zero growth conserves cash and leaves source inputs unchanged',()=>{const {flow,holdings}=setup();const before=JSON.stringify({flow,holdings});const p=projectPlan(flow,holdings,zero);assert.equal(p.months.length,12);assert.equal(p.months.at(-1).assetsTotal,13000);assert.equal(p.months.at(-1).incomeTotal,1000);assert.equal(JSON.stringify({flow,holdings}),before);});
test('ISA deposits fill annual allowance and reset in April',()=>{const {flow,holdings}=setup();flow.pay.primary.annualTakeHome=48000;flow.assumptions.allocationEnabled=true;flow.assumptions.isaUsedPrimary=18000;const p=projectPlan(flow,holdings,zero);assert.equal(p.months[0].savingByType.isa,2000);assert.equal(p.months[0].savingByType.general,2000);assert.equal(p.months[1].savingByType.general,4000);assert.equal(p.months[6].savingByType.isa,4000);});
test('retirement ends pay and DC contributions after the chosen year',()=>{const {flow,holdings}=setup();flow.pay.primary.annualTakeHome=null;flow.pay.primary.annualGross=12000;flow.pay.primary.employeePension=1200;flow.pay.primary.employerPension=600;const p=projectPlan(flow,holdings,{...zero,retirementYears:{primary:2026}});assert.equal(p.months[0].pensionContributions,150);assert.equal(p.months[3].pensionContributions,0);assert.equal(p.months[3].incomeTotal,0);});
test('dated cost uses cash once and unfunded costs remain visible alongside balances',()=>{const {flow,holdings}=setup();const p=projectPlan(flow,holdings,{...zero,oneOff:{month:'2027-01',amount:6000}});assert.equal(p.months[3].cashDrawn,4000);assert.equal(p.months[3].unfunded,1000);assert.equal(p.firstUnfundedMonth,'2027-01');assert.equal(p.months[3].assetsTotal,0);assert.equal(p.months[4].assetsTotal,1000);});
test('zero-rate repayment amortises and an earlier term increases payment',()=>{const {flow,holdings}=setup();flow.pay.primary.annualTakeHome=240000;flow.includeLinkedMortgage=true;holdings.debts=[{id:'m',kind:'mortgage',balance:12000,interestRate:0,remainingYears:2,owner:'primary'}];const p=projectPlan(flow,holdings,zero);assert.equal(p.months[0].mortgagePayment,500);assert.equal(p.months.at(-1).debtsTotal,6000);const shorter=projectPlan(flow,holdings,{...zero,mortgageYearsEarlier:1});assert.equal(shorter.months[0].mortgagePayment,1000);assert.equal(shorter.months.at(-1).debtsTotal,0);});
test('inflation raises recurring costs and real values use the same deflator',()=>{const {flow,holdings}=setup();flow.spending.everyday=100;const p=projectPlan(flow,holdings,{...zero,inflation:12});assert.ok(p.months[11].spendingTotal>100);assert.equal(p.months[11].deflator,1.12);});

test('asset growth and employee/employer pension contributions accrue separately from income',()=>{const {flow,holdings}=setup();flow.pay.primary.annualTakeHome=0;holdings.assets=[{id:'i',kind:'isa',owner:'primary',value:10000}];const p=projectPlan(flow,holdings,{...zero,growth:{...zero.growth,isa:12}});assert.ok(Math.abs(p.months.at(-1).assetsTotal-11200)<.1);assert.equal(p.months[0].incomeTotal,0);});
test('configured State Pension starts on its recorded month and keeps its owner',()=>{const {flow,holdings}=setup();flow.statePensions={primary:{qualifyingYears:35,assessmentMonth:'2026-10',startMonth:'2027-02',mode:'official',weeklyForecast:200,otherTaxableIncome:0}};const p=projectPlan(flow,holdings,zero);assert.equal(p.months[3].incomeByType.statePension,undefined);assert.ok(p.months[4].incomeByType.statePension>0);assert.equal(p.months[4].incomeByPerson.primary,p.months[4].incomeTotal);});
test('shortening a mortgage changes spending and saves less cash before payoff',()=>{const {flow,holdings}=setup();flow.pay.primary.annualTakeHome=120000;flow.includeLinkedMortgage=true;holdings.debts=[{id:'m',kind:'mortgage',balance:12000,interestRate:5,remainingYears:2,owner:'shared'}];const original=projectPlan(flow,holdings,zero),shorter=projectPlan(flow,holdings,{...zero,mortgageYearsEarlier:1});assert.ok(shorter.months[0].spendingTotal>original.months[0].spendingTotal);assert.ok(shorter.months[0].savingByType.cash<original.months[0].savingByType.cash);assert.equal(shorter.months.at(-1).debtsTotal,0);});
test('real annual flows discount monthly amounts and report funding gaps separately',async()=>{const {annualPlanView}=await import('../prototype/planning.mjs');const {flow,holdings}=setup();const p=projectPlan(flow,holdings,{...zero,inflation:5,oneOff:{month:'2027-01',amount:100000}});const nominal=annualPlanView(p,'income','person',false),real=annualPlanView(p,'income','person',true);assert.ok(real[0].total<nominal[0].total);assert.equal(annualPlanView(p,'assets')[1].valid,true);assert.ok(annualPlanView(p,'assets')[1].unfunded>0);});

test('NI-years illustration starts at 67 and adds future working years only',()=>{const {flow,holdings}=setup();holdings.age=66;flow.statePensions={primary:{qualifyingYears:20,assessmentMonth:'2026-10',mode:'record'}};flow.pay.primary.endDate='2026-12';const p=projectPlan(flow,holdings,{...zero,years:2});assert.equal(p.months[11].incomeByType.statePension,undefined);assert.ok(p.months[12].incomeByType.statePension>0);assert.equal(p.statePensions.primary.totalYears,20);assert.equal(p.statePensions.primary.startMonth,'2027-10');});
test('future working years can reach the 35-year cap and retirement changes the estimate',()=>{const {flow,holdings}=setup();holdings.age=43;flow.statePensions={primary:{qualifyingYears:16,assessmentMonth:'2026-10',mode:'record'}};const p=projectPlan(flow,holdings,{...zero,retirementYears:{primary:2045}});assert.equal(p.statePensions.primary.totalYears,35);const early=projectPlan(flow,holdings,{...zero,retirementYears:{primary:2035}});assert.equal(early.statePensions.primary.totalYears,25);});
test('household spending changes keep mortgage payments intact',()=>{const {flow,holdings}=setup();flow.spending.everyday=1000;flow.includeLinkedMortgage=true;holdings.debts=[{id:'m',kind:'mortgage',balance:12000,interestRate:0,remainingYears:2}];const p=projectPlan(flow,holdings,{...zero,spendingChange:{year:2026,percent:50}});assert.equal(p.months[0].householdSpending,500);assert.equal(p.months[0].mortgagePayment,500);assert.equal(p.months[0].spendingTotal,1000);});
test('asset withdrawals fund post-work spending and are shown as funding, without being saved again',()=>{const {flow,holdings}=setup();flow.pay.primary.annualTakeHome=0;flow.spending.everyday=100;holdings.assets=[{id:'i',kind:'isa',owner:'primary',value:2000}];const p=projectPlan(flow,holdings,zero);assert.equal(p.firstUnfundedMonth,null);assert.equal(p.months[0].withdrawalNet,100);assert.equal(p.months[0].incomeByType.withdrawIsa,100);assert.equal(p.months.at(-1).assetsTotal,800);assert.deepEqual(p.months[0].savingByType,{});});

test('other debt repayments sit alongside household spending and reduce their balances',()=>{const {flow,holdings}=setup();flow.spending.everyday=100;holdings.debts=[{id:'loan',kind:'loan',balance:1200,owner:'primary'}];const p=projectPlan(flow,holdings,{...zero,debtPayments:{loan:{annualRate:0,monthlyPayment:100}}});assert.equal(p.months[0].householdSpending,100);assert.equal(p.months[0].debtPayment,100);assert.equal(p.months[0].spendingTotal,200);assert.equal(p.months.at(-1).debtsTotal,0);});

test('a funding gap does not hide pension assets or prevent later accessible drawdown',()=>{const {flow,holdings}=setup();flow.pay.primary.annualTakeHome=0;flow.spending.everyday=100;holdings.age=56;holdings.assets=[{id:'p',kind:'dc-pension',owner:'primary',value:1000}];const p=projectPlan(flow,holdings,{...zero,years:2,pensionAccessAge:57});assert.equal(p.firstUnfundedMonth,'2026-10');assert.equal(p.months[0].assetsTotal,1000);assert.equal(p.months[11].assetsByType.pension,1000);assert.equal(p.months[12].withdrawalNet,100);assert.equal(p.months[12].assetsTotal,900);});
test('multiple spending changes replace the original percentage rather than compound it',()=>{const {flow,holdings}=setup();flow.pay.primary.annualTakeHome=120000;flow.spending.everyday=1000;const p=projectPlan(flow,holdings,{...zero,years:3,spendingChanges:[{year:2027,percent:50},{year:2028,percent:75}]});assert.equal(p.months[0].householdSpending,1000);assert.equal(p.months[3].householdSpending,500);assert.equal(p.months[15].householdSpending,750);});
test('paying off now uses accessible opening assets and ends mortgage installments',()=>{const {flow,holdings}=setup();flow.pay.primary.annualTakeHome=0;flow.includeLinkedMortgage=true;holdings.age=43;holdings.assets=[{id:'c',kind:'cash',value:10000},{id:'i',kind:'isa',value:5000},{id:'p',kind:'dc-pension',value:100000}];holdings.debts=[{id:'m',kind:'mortgage',balance:12000,interestRate:5,remainingYears:2}];const p=projectPlan(flow,holdings,{...zero,mortgagePayoffNow:true});assert.equal(p.mortgagePayoff.paid,12000);assert.equal(p.months[0].debtsTotal,0);assert.equal(p.months[0].assetsByType.isa,3000);assert.equal(p.months[0].assetsByType.pension,100000);assert.equal(p.months[1].mortgagePayment,0);assert.equal(p.months[0].withdrawalNet,12000);});
test('insufficient accessible assets produce a partial payoff and keep the remaining mortgage',()=>{const {flow,holdings}=setup();flow.pay.primary.annualTakeHome=0;holdings.age=43;holdings.assets=[{id:'c',kind:'cash',value:1000},{id:'p',kind:'dc-pension',value:100000}];holdings.debts=[{id:'m',kind:'mortgage',balance:12000,interestRate:0,remainingYears:2}];const p=projectPlan(flow,holdings,{...zero,mortgagePayoffNow:true});assert.equal(p.mortgagePayoff.paid,1000);assert.equal(p.mortgagePayoff.remaining,11000);assert.equal(p.months[0].debtsTotal,11000);});
test('mortgage term can be set directly to ten years',()=>{const {flow,holdings}=setup();flow.pay.primary.annualTakeHome=240000;flow.includeLinkedMortgage=true;holdings.debts=[{id:'m',kind:'mortgage',balance:12000,interestRate:0,remainingYears:21}];const p=projectPlan(flow,holdings,{...zero,mortgageTermYears:10});assert.equal(p.months[0].mortgagePayment,100);});
test('unfunded debt installments remain outstanding rather than being repaid from missing money',()=>{const {flow,holdings}=setup();flow.pay.primary.annualTakeHome=0;flow.includeLinkedMortgage=true;holdings.assets=[];holdings.debts=[{id:'m',kind:'mortgage',balance:12000,interestRate:0,remainingYears:2}];const p=projectPlan(flow,holdings,zero);assert.equal(p.months[0].unfunded,500);assert.equal(p.months[0].debtsTotal,12000);assert.equal(p.months.at(-1).debtsTotal,12000);});
test('cash interest is taxed as earned while ISA growth and cash principal withdrawals are untaxed',()=>{
  const {flow,holdings}=setup();flow.pay.primary.annualTakeHome=null;flow.pay.primary.annualGross=150000;
  holdings.assets=[{id:'c',kind:'cash',owner:'primary',value:100000},{id:'i',kind:'isa',owner:'primary',value:100000}];
  const p=projectPlan(flow,holdings,{...zero,growth:{...zero.growth,cash:12,isa:12}}),m=p.months[0];
  const interest=Math.round((100000*1.12**(1/12)-100000)*100)/100;
  assert.equal(m.cashInterestGross,interest);assert.equal(m.cashInterestTax,Math.round(interest*.45*100)/100);
  assert.ok(m.assetsByType.isa>100000);
});
test('all cash accounts share one savings allowance and joint interest is divided equally',()=>{
  const {flow,holdings}=setup();flow.pay.primary.annualTakeHome=null;flow.pay.primary.annualGross=60000;
  const options={...zero,growth:{...zero.growth,cash:12}};
  holdings.assets=[{id:'c',kind:'cash',owner:'primary',value:100000}];
  const single=projectPlan(flow,holdings,options).months[0];
  holdings.assets=[{id:'c1',kind:'cash',owner:'primary',value:50000},{id:'c2',kind:'cash',owner:'primary',value:50000}];
  const split=projectPlan(flow,holdings,options).months[0];
  assert.ok(Math.abs(single.cashInterestTax-split.cashInterestTax)<.02);
  holdings.partnerName='Priya';holdings.assets=[{id:'joint',kind:'cash',owner:'shared',value:100000}];
  const joint=projectPlan(flow,holdings,options).months[0];
  assert.ok(joint.cashInterestTax<single.cashInterestTax);
});
test('retiring changes cash-interest tax and annual views expose the deduction',async()=>{
  const {annualPlanView}=await import('../prototype/planning.mjs');
  const {flow,holdings}=setup();flow.pay.primary.annualTakeHome=null;flow.pay.primary.annualGross=150000;
  holdings.assets=[{id:'c',kind:'cash',owner:'primary',value:100000}];
  const p=projectPlan(flow,holdings,{...zero,growth:{...zero.growth,cash:2},retirementYears:{primary:2026}});
  assert.ok(p.months[0].cashInterestTax>0);assert.equal(p.months[3].cashInterestTax,0);
  const rows=annualPlanView(p,'assets','type',false);
  assert.equal(rows[0].cashInterestTax,p.months.slice(0,3).reduce((sum,m)=>sum+m.cashInterestTax,0));
});
test('cash and share payoff sells needs-sale shares, includes CGT, and preserves ISA',()=>{
  const {flow,holdings}=setup();flow.pay.primary.annualTakeHome=null;flow.pay.primary.annualGross=150000;
  holdings.assets=[{id:'cash',kind:'cash',owner:'primary',value:10000},{id:'shares',kind:'shares',owner:'primary',accessBucket:'illiquid',value:20000,costBasis:10000},{id:'isa',kind:'isa',owner:'primary',value:50000}];
  holdings.debts=[{id:'m',kind:'mortgage',balance:20000,interestRate:0,remainingYears:21}];
  const p=projectPlan(flow,holdings,{...zero,mortgagePayoffNow:true,mortgagePayoffSource:'cashShares',savingsDestination:'general'});
  assert.equal(p.mortgagePayoff.paid,20000);assert.ok(p.mortgagePayoff.tax>0);
  assert.deepEqual(p.mortgagePayoff.items.map(item=>item.assetId),['cash','shares']);
  assert.equal(p.months[0].assetsByType.isa,50000);assert.ok(p.months[0].savingByType.general>0);assert.equal(p.months[0].savingByType.cash,0);
  assert.equal(holdings.assets[1].accessBucket,'illiquid');
});
test('cash and shares payoff never falls back to ISA or pension when insufficient',()=>{
  const {flow,holdings}=setup();flow.pay.primary.annualTakeHome=0;flow.includeLinkedMortgage=false;
  holdings.assets=[{id:'cash',kind:'cash',value:1000},{id:'s',kind:'shares',owner:'primary',value:1000,accessBucket:'illiquid',costBasis:1000},{id:'i',kind:'isa',value:20000}];
  holdings.debts=[{id:'m',kind:'mortgage',balance:10000,interestRate:0,remainingYears:21}];
  const p=projectPlan(flow,holdings,{...zero,mortgagePayoffNow:true,mortgagePayoffSource:'cashShares'});
  assert.equal(p.mortgagePayoff.paid,2000);assert.equal(p.mortgagePayoff.remaining,8000);assert.equal(p.months[0].assetsByType.isa,20000);
});
test('recorded SAYE purchase cost taxes only the realised gain and preserves ISA',async()=>{
  const flow=createBlankMonthlyFlow(),holdings={name:'Sam',assets:[{id:'cash',kind:'cash',value:1_000},{id:'test-shares',kind:'shares',owner:'primary',value:40_000,costBasis:25_000,employeeScheme:'saye',accessBucket:'illiquid'},{id:'test-isa',kind:'isa',owner:'primary',value:20_000}],debts:[{id:'test-mortgage',kind:'mortgage',balance:25_000,interestRate:0,remainingYears:15}]};
  const p=projectPlan(flow,holdings,{years:1,mortgagePayoffNow:true,mortgagePayoffSource:'cashShares',savingsDestination:'general'});
  assert.equal(p.mortgagePayoff.paid,25_000);assert.ok(p.mortgagePayoff.tax>0);
  assert.ok(p.mortgagePayoff.items.find(item=>item.assetId==='test-shares').gross>0);
  assert.equal(p.mortgagePayoff.items.some(item=>item.bucket==='isa'),false);
});
test('net-worth annual view subtracts debt at year end in the selected money basis',async()=>{
 const {annualPlanView}=await import('../prototype/planning.mjs');const {flow,holdings}=setup();holdings.debts=[{id:'loan',kind:'loan',balance:5000}];
 const p=projectPlan(flow,holdings,{...zero,inflation:2});const last=p.months[2];
 assert.equal(annualPlanView(p,'netWorth','person',false)[0].total,last.assetsTotal-last.debtsTotal);
 assert.equal(annualPlanView(p,'netWorth','person',true)[0].total,(last.assetsTotal-last.debtsTotal)/last.deflator);
});

test('retirement stress applies once before growth and withdrawals, preserving non-investment assets and inputs',()=>{
 const {flow,holdings}=setup();flow.pay.primary.annualTakeHome=0;flow.pay.primary.endDate='2026-12';holdings.age=45;
 holdings.assets=[{id:'c',kind:'cash',value:1000},{id:'i',kind:'isa',owner:'primary',value:1000},{id:'p',kind:'dc-pension',owner:'primary',value:1000},{id:'g',kind:'general',owner:'primary',value:1000,costBasis:1000},{id:'s',kind:'shares',owner:'primary',value:1000},{id:'h',kind:'home',value:1000}];
 const before=JSON.stringify({flow,holdings}),p=projectPlan(flow,holdings,{...zero,retirementStress:true});
 assert.equal(p.stressTest.month,'2027-01');assert.equal(p.stressTest.loss,800);assert.equal(p.months[2].assetsTotal,6000);assert.equal(p.months[3].assetsTotal,5200);assert.equal(p.months.at(-1).assetsTotal,5200);assert.equal(p.months[3].assetsByType.cash,1000);assert.equal(p.months[3].assetsByType.property,1000);assert.equal(p.months[3].lockedPensions,800);assert.equal(JSON.stringify({flow,holdings}),before);
});
test('stress off equals the existing model and missing retirement dates do not invent a shock',()=>{
 const {flow,holdings}=setup();assert.deepEqual(projectPlan(flow,holdings,zero),projectPlan(flow,holdings,{...zero,retirementStress:false}));
 const p=projectPlan(flow,holdings,{...zero,retirementStress:true});assert.equal(p.stressTest.month,null);assert.equal(p.stressTest.loss,0);assert.match(p.warnings.join(' '),/no recorded final-pay date/i);
 assert.throws(()=>projectPlan(flow,holdings,{...zero,retirementStress:'yes'}),/stress/i);
});
test('stress follows earliest household retirement, clamps past retirement to opening and can create an earlier shortfall',()=>{
 const {flow,holdings}=setup();flow.pay.primary.annualTakeHome=0;flow.spending.everyday=100;flow.pay.primary.endDate='2025-12';holdings.assets=[{id:'i',kind:'isa',owner:'primary',value:1200}];
 const p=projectPlan(flow,holdings,{...zero,retirementStress:true});assert.equal(p.stressTest.month,'2026-10');assert.equal(p.months[0].assetsTotal,860);assert.equal(p.firstUnfundedMonth,'2027-07');assert.equal(projectPlan(flow,holdings,zero).firstUnfundedMonth,null);
 flow.pay.primary.endDate='2027-05';flow.pay.partner.endDate='2026-11';holdings.partnerName='Priya';assert.equal(projectPlan(flow,holdings,{...zero,retirementStress:true}).stressTest.month,'2026-12');
});

test('retirement shock precedes normal monthly investment growth',()=>{const {flow,holdings}=setup();flow.pay.primary.annualTakeHome=0;flow.pay.primary.endDate='2025-12';holdings.assets=[{id:'i',kind:'isa',owner:'primary',value:10000}];const p=projectPlan(flow,holdings,{...zero,retirementStress:true,growth:{...zero.growth,isa:12}});assert.equal(p.months[0].assetsTotal,Math.round(8000*1.12**(1/12)*100)/100);assert.equal(p.stressTest.loss,2000);});

test('interest-only retains capital until its term ends and then funds the capital payment',()=>{
 const {flow,holdings}=setup();flow.includeLinkedMortgage=true;flow.pay.primary.annualTakeHome=3600000;
 holdings.debts=[{id:'io',kind:'mortgage',balance:200000,interestRate:6,remainingYears:1,mortgageType:'interest-only'}];
 const plan=projectPlan(flow,holdings,{...zero,years:1});
 assert.equal(plan.months[0].mortgagePayment,1000);assert.equal(plan.months[0].debtsTotal,200000);
 assert.equal(plan.months[11].mortgagePayment,201000);assert.equal(plan.months[11].debtsTotal,0);
});

test('cash and shares payoff reports a partial payment when share-labelled assets have another type',()=>{
 const {flow,holdings}=setup();flow.pay.primary.annualTakeHome=0;flow.includeLinkedMortgage=true;
 holdings.assets=[{id:'cash',kind:'cash',value:1000},{id:'other',kind:'other',label:'Employee shares',value:5000,accessBucket:'illiquid'}];
 holdings.debts=[{id:'m',kind:'mortgage',balance:3000,interestRate:0,remainingYears:10}];
 const plan=projectPlan(flow,holdings,{...zero,mortgagePayoffNow:true,mortgagePayoffSource:'cashShares'});
 assert.equal(plan.mortgagePayoff.paid,1000);assert.equal(plan.mortgagePayoff.remaining,2000);
 assert.equal(plan.months[0].assetsByType.other,5000);
});
