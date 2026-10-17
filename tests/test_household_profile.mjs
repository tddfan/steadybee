import test from 'node:test';
import assert from 'node:assert/strict';
import {removePartnerFromPicture} from '../prototype/household-profile.mjs';
import {createBlankMonthlyFlow} from '../prototype/monthly-flow.mjs';

test('removing a partner with linked or shared records is blocked without changing inputs',()=>{
  for(const owner of ['partner','shared'])for(const kind of ['assets','debts']){
    const holdings={name:'Person',partnerName:'Partner',assets:[],debts:[]};holdings[kind]=[{id:'linked',owner,value:100}];
    const before=structuredClone(holdings);
    assert.throws(()=>removePartnerFromPicture(holdings,createBlankMonthlyFlow(),{}),/Reassign or remove/);
    assert.deepEqual(holdings,before);
  }
});

test('removing an unlinked partner keeps balances and costs and clears their income and scenario settings',()=>{
  const holdings={name:'Person',age:40,partnerName:'Partner',partnerAge:38,assets:[{id:'cash',kind:'cash',owner:'primary',value:123}],debts:[]};
  const flow=createBlankMonthlyFlow();flow.pay.partner.annualGross=30000;flow.statePensions.partner={qualifyingYears:10};flow.spending.everyday=2000;flow.assumptions.isaUsedPartner=1000;
  const planning={scenario:{retirementYears:{primary:2050,partner:2052},ages:{partner:38},taxFreeRemaining:{partner:1000}},experiments:[{name:'Earlier',state:{scenario:{retirementYears:{partner:2051}}}}]};
  const originals=structuredClone({holdings,flow,planning});
  const result=removePartnerFromPicture(holdings,flow,planning);
  assert.equal(result.holdings.partnerName,'');assert.equal(result.holdings.partnerAge,null);
  assert.deepEqual(result.holdings.assets,holdings.assets);assert.deepEqual(result.flow.spending,flow.spending);
  assert.equal(result.flow.pay.partner.annualGross,0);assert.equal(result.flow.statePensions.partner,null);assert.equal(result.flow.assumptions.isaUsedPartner,0);
  assert.deepEqual(result.planning.scenario.retirementYears,{primary:2050});assert.deepEqual(result.planning.experiments[0].state.scenario.retirementYears,{});
  assert.deepEqual({holdings,flow,planning},originals);
});
