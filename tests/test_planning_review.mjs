import test from 'node:test';
import assert from 'node:assert/strict';
import {startingPictureKey} from '../prototype/planning-review.mjs';
import {createPublicDemoHousehold} from '../prototype/asset-ledger.mjs';
import {createExampleMonthlyFlow} from '../prototype/monthly-flow.mjs';
import {validatePicture} from '../prototype/picture-storage.mjs';

test('the review marker survives save/restore and ignores object key order and browsing month',()=>{
  const holdings=createPublicDemoHousehold(),flow=createExampleMonthlyFlow();
  const marker=startingPictureKey(holdings,flow);
  const reordered=Object.fromEntries(Object.entries(holdings).reverse());
  assert.equal(startingPictureKey(reordered,{...flow,asOfMonth:'2040-01'}),marker);
  const picture={version:1,example:false,holdings,flow,planning:{scenario:{years:1},metric:'income',group:'person',style:'bars',real:true,reviewedInputs:marker}};
  const restored=validatePicture(JSON.parse(JSON.stringify(picture)));
  assert.equal(restored.planning.reviewedInputs,startingPictureKey(restored.holdings,restored.flow));
  delete picture.planning.reviewedInputs;assert.doesNotThrow(()=>validatePicture(picture));
  picture.planning.reviewedInputs={};assert.throws(()=>validatePicture(picture),/review marker/);
});

test('changed balances, income, access ages or opening month require a new review',()=>{
  const holdings=createPublicDemoHousehold(),flow=createExampleMonthlyFlow(),marker=startingPictureKey(holdings,flow);
  for(const change of [
    (h,f)=>{h.assets[0].value+=1;},
    (h,f)=>{f.pay.primary.annualGross+=1;},
    (h,f)=>{h.assets.find(a=>a.kind==='dc-pension').pensionAccessAge=58;},
    (h,f)=>{f.timelineStartMonth='2027-01';},
  ]){
    const h=structuredClone(holdings),f=structuredClone(flow);change(h,f);
    assert.notEqual(startingPictureKey(h,f),marker);
  }
});
