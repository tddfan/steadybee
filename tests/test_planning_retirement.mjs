import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveRetirementYears} from '../prototype/planning-retirement.mjs';
import {createBlankMonthlyFlow} from '../prototype/monthly-flow.mjs';
import {projectPlan} from '../prototype/planning.mjs';

test('displayed retirement defaults stop both partners pay and contributions without touching a slider',()=>{
  const flow=createBlankMonthlyFlow();flow.asOfMonth=flow.timelineStartMonth='2026-10';
  const holdings={name:'Test A',age:44,partnerName:'Test B',partnerAge:42,assets:[],debts:[]};
  for(const owner of ['primary','partner'])Object.assign(flow.pay[owner],{annualGross:36000,employeePensionRate:5,employerPensionRate:4});
  const retirementYears=resolveRetirementYears(flow,holdings,{});
  assert.deepEqual(retirementYears,{primary:2046,partner:2046});
  assert.equal(holdings.partnerAge+retirementYears.partner-2026,62);
  const projection=projectPlan(flow,holdings,{years:26,retirementYears,inflation:0,incomeGrowth:0,growth:{cash:0,isa:0,pension:0,property:0,shares:0}});
  assert.equal(projection.retirementDates.partner,'2046-12');
  assert.ok(projection.months.find(row=>row.month==='2046-12').pensionContributions>0);
  for(const row of projection.months.filter(row=>row.month>'2046-12')){
    assert.equal(row.pensionContributions,0);
    assert.equal(row.taxByType.employmentTax,0);
    assert.equal(row.taxByType.employeeNI,0);
    assert.equal(row.incomeByType.pay || 0,0);
  }
  assert.equal(flow.pay.partner.endDate,'');
});

test('recorded pay ends, explicit changes, saved scenarios and single households keep their dates',()=>{
  const flow=createBlankMonthlyFlow();flow.asOfMonth=flow.timelineStartMonth='2026-10';
  flow.pay.primary.endDate='2041-03';flow.pay.partner.endDate='2044-09';
  const household={partnerName:'Test'};
  assert.deepEqual(resolveRetirementYears(flow,household),{primary:2041,partner:2044});
  const restored=JSON.parse(JSON.stringify(resolveRetirementYears(flow,household,{partner:2046})));
  assert.deepEqual(resolveRetirementYears(flow,household,restored),{primary:2041,partner:2046});
  assert.deepEqual(resolveRetirementYears(flow,{}, {partner:2050}),{primary:2041});
});
