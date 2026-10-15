import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateStatePension } from '../prototype/state-pension.mjs';

test('NI years can be recorded without inventing a pension amount or start month',()=>{
 const result=estimateStatePension({qualifyingYears:20,mode:'record'},'2026-10');
 assert.equal(result.annualGross,null); assert.equal(result.startMonth,null);
});
test('simplified illustration adds assumed full future years only until qualifying stops',()=>{
 const result=estimateStatePension({qualifyingYears:20,startMonth:'2051-10',qualifyingUntil:'2040-10',mode:'simplified'},'2026-10');
 assert.equal(result.futureYears,14); assert.equal(result.totalYears,34);
 assert.equal(result.annualGross,12189.10);
});
test('simplified amount is capped at full rate and below ten years gives zero',()=>{
 assert.equal(estimateStatePension({qualifyingYears:35,startMonth:'2027-10',mode:'simplified'},'2026-10').annualGross,12547.60);
 assert.equal(estimateStatePension({qualifyingYears:8,startMonth:'2027-10',qualifyingUntil:'2026-10',mode:'simplified'},'2026-10').annualGross,0);
});
test('official weekly forecast replaces the simplified amount including protected amounts',()=>{
 const result=estimateStatePension({qualifyingYears:35,startMonth:'2050-01',weeklyForecast:260,mode:'official'},'2026-10');
 assert.equal(result.annualGross,13520);
});
test('pension net estimate includes incremental Income Tax but no NI',()=>{
 const result=estimateStatePension({qualifyingYears:35,startMonth:'2026-10',mode:'simplified',otherTaxableIncome:20000},'2026-10');
 assert.equal(result.annualTax,2509.52); assert.equal(result.monthlyNet,836.51);
});
test('invalid dates, negative years and incomplete amount estimates are rejected',()=>{
 for(const input of [{qualifyingYears:-1,mode:'record'},{qualifyingYears:3.5,mode:'record'},{qualifyingYears:20,startMonth:'2050-13',mode:'simplified'},{qualifyingYears:20,mode:'simplified'},{qualifyingYears:20,startMonth:'2050-01',mode:'official'}]) assert.throws(()=>estimateStatePension(input,'2026-10'),RangeError);
});
