import test from 'node:test';
import assert from 'node:assert/strict';
import { payrollFlow } from '../prototype/retirement-pay.mjs';
import { householdBaseExample } from '../prototype/retirement-example.mjs';
import { simulateHousehold, convertStreamFrequency } from '../prototype/retirement-household.mjs';
const pay=()=>({label:'Salary',amount:10000,frequency:'month',taxBasis:'payslip',takeHomeAmount:6500,pension:{employeePercent:5,employerPercent:5,employeeMode:'percent',employerMode:'percent',method:'included'}});
test('payslip take-home includes the employee deduction once and employer money enters separately',()=>{
 const p=pay(),r=payrollFlow(p,120000,1);assert.equal(r.net,78000);assert.equal(r.employee,6000);assert.equal(r.employer,6000);assert.equal(r.deductions,36000);p.amount=0;assert.throws(()=>payrollFlow(p,0,1),/gross/);
});
test('gross pay supports before-tax versus after-tax deductions without inventing relief',()=>{
 const p=pay();p.taxBasis='estimate';p.taxRate=30;p.pension.method='sacrifice';let r=payrollFlow(p,120000,1);assert.equal(r.net,79800);
 p.pension.method='after-tax';r=payrollFlow(p,120000,1);assert.equal(r.net,78000);
 p.taxBasis='excluded';r=payrollFlow(p,120000,1);assert.equal(r.net,114000);
 p.pension.employeePercent=101;assert.throws(()=>payrollFlow(p,120000,1));
});
test('fixed annual contributions prorate with work; percentage contributions follow pensionable growth',()=>{
 const p=pay();p.pension.employeeMode='annual';p.pension.employeeAnnual=8000;p.pension.basis='custom';p.pension.pensionableAnnual=60000;
 const r=payrollFlow(p,120000*1.01*.5,1.01);assert.equal(r.employee,4000);assert.equal(r.employer,1515);assert.equal(r.net,78000*1.01*.5);
});
test('net-only payroll uses an explicit pensionable reference and invalid deductions are rejected',()=>{
 const p=pay();p.taxBasis='net';p.amount=6500;p.pension.pensionableAnnual=120000;let r=payrollFlow(p,78000,1);assert.equal(r.net,78000);assert.equal(r.employee,6000);
 p.pension.method='after-tax';r=payrollFlow(p,78000,1);assert.equal(r.net,72000);
 p.pension.employeeMode='annual';p.pension.employeeAnnual=90000;assert.throws(()=>payrollFlow(p,78000,1),/exceeds/);
});
test('base net salaries stay supplied values; pension growth separates employee, employer and investment return',()=>{
 const i=householdBaseExample(),m=simulateHousehold(i),r=m.rows[0];assert.equal(r.sources.salary,144000);
 assert.equal(r.payrollEmployeeByOwner.primary,6000);assert.equal(r.payrollEmployerByOwner.primary,6000);assert.equal(r.payrollEmployeeByOwner.partner,5000);assert.equal(r.payrollEmployerByOwner.partner,5000);
 assert.equal(r.pensionByOwner.primary.opening,490000);assert.equal(r.pensionByOwner.primary.growth,24500);assert.equal(r.pensionByOwner.primary.closing,526500);
});
test('pension flows reconcile with bonus saving, redundancy, market losses and withdrawals',()=>{
 const i=householdBaseExample();i.incomes.find(r=>r.id==='bonus-a').pension={employeePercent:20,employerPercent:0,method:'after-tax'};
 for(const actions of [{},{job:true,jobPartner:true},{market:true,early:true},{pension:true},{parttime:true}]){
  const m=simulateHousehold(i,actions);for(const r of m.rows){for(const flow of Object.values(r.pensionByOwner))assert.ok(Math.abs(flow.opening+flow.growth-flow.marketLoss+flow.employee+flow.employer+flow.voluntary-flow.withdrawals-flow.closing)<1e-6);assert.ok(Math.abs(r.openingAssets+r.growth+r.additions-r.withdrawals-r.marketLoss+r.propertyChange+r.assetPurchased-r.closingAssets)<1e-6);}
 }
});
test('unit switches preserve payslip net and all pension contributions',()=>{
 const i=householdBaseExample(),before=simulateHousehold(i);const p=i.incomes.find(r=>r.id==='salary-a');convertStreamFrequency(p,'year');assert.equal(p.takeHomeAmount,78000);convertStreamFrequency(p,'month');
 const after=simulateHousehold(i);before.rows.forEach((r,n)=>{assert.ok(Math.abs(r.income-after.rows[n].income)<1e-6);assert.ok(Math.abs(r.closingAssets-after.rows[n].closingAssets)<1e-6);});
});
test('payroll and spending categories stop/prorate appropriately and chart budgets reconcile',()=>{
 const i=householdBaseExample(),m=simulateHousehold(i,{job:true,jobPartner:true});assert.equal(m.rows[1].payrollEmployeeByOwner.primary,6000*1.01*.5);assert.equal(m.rows[4].payrollEmployeeByOwner.primary,0);assert.equal(m.rows[4].payrollEmployerByOwner.partner,0);
 for(const r of m.rows)assert.ok(Math.abs(Object.values(r.spendingByCategory).reduce((s,v)=>s+v,0)-r.spending-r.payoff)<1e-6);
});
