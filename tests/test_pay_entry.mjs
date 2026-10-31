import test from 'node:test';
import assert from 'node:assert/strict';
import {annualisePay,pensionInputIncomplete} from '../prototype/pay-entry.mjs';
test('payslip frequencies normalise to annual values without treating four weeks as a month',()=>{
 assert.equal(annualisePay(500,'weekly'),26000);
 assert.equal(annualisePay(2000,'fourWeekly'),26000);
 assert.equal(annualisePay(2000,'monthly'),24000);
 assert.equal(annualisePay(24000,'yearly'),24000);
 assert.equal(annualisePay(123.45,'weekly'),6419.4);
 assert.equal(annualisePay(0,'monthly'),0);
});
test('invalid pay is rejected',()=>{for(const [value,frequency] of [[-1,'weekly'],[NaN,'monthly'],[100000000,'weekly'],[1,'daily']])assert.throws(()=>annualisePay(value,frequency));});
test('unknown pensions remain distinct from known zero contributions',()=>{
 assert.equal(pensionInputIncomplete({employeePension:0}),false);
 for(const key of ['employeePensionUnknown','employerPensionUnknown','pensionBalanceUnknown'])assert.equal(pensionInputIncomplete({[key]:true}),true);
});
import {createBlankMonthlyFlow,summarizeMonthlyFlow} from '../prototype/monthly-flow.mjs';
test('entered four-weekly net pay reaches cash flow without deducting pension a second time',()=>{
 const flow=createBlankMonthlyFlow();flow.pay.primary={...flow.pay.primary,annualTakeHome:annualisePay(2000,'fourWeekly'),annualGross:35000,employeePensionRate:5,takeHomeFrequency:'fourWeekly'};
 const result=summarizeMonthlyFlow(flow,{assets:[],debts:[],name:'Test'});
 assert.equal(result.payDetails[0].annualTakeHome,26000);
 assert.equal(result.payDetails[0].monthlyTakeHome,2166.67);
});
import {pensionEntryEquivalent} from '../prototype/pay-entry.mjs';
test('pension unit conversion preserves value and refuses to erase contributions without salary',()=>{
 assert.equal(pensionEntryEquivalent({annualGross:47000,employeePensionRate:5},'employee','amount'),2350);
 assert.equal(pensionEntryEquivalent({annualGross:47000,employeePension:2350},'employee','percent'),5);
 assert.equal(pensionEntryEquivalent({annualGross:0,employeePension:2350},'employee','percent'),null);
 assert.equal(pensionEntryEquivalent({annualGross:0,employeePensionRate:5},'employee','amount'),null);
});
test('explicit zero take-home does not fall back to gross salary estimation',()=>{
 const flow=createBlankMonthlyFlow();Object.assign(flow.pay.primary,{annualTakeHome:annualisePay(0,'weekly'),annualGross:35000});
 const result=summarizeMonthlyFlow(flow,{assets:[],debts:[],name:'Test'});assert.equal(result.payDetails[0].monthlyTakeHome,0);assert.equal(result.payDetails[0].enteredTakeHome,true);
});
