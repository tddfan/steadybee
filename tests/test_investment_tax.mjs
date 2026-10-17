import test from 'node:test';
import assert from 'node:assert/strict';
import { savingsTax, capitalGainsTax } from '../prototype/investment-tax.mjs';
test('savings use personal allowance, starting-rate band and personal savings allowance',()=>{
  assert.equal(savingsTax(0,18570),0);
  assert.equal(savingsTax(0,19570),200);
  assert.equal(savingsTax(16000,2570),0);
  assert.equal(savingsTax(16000,3570),200);
});
test('savings rates follow total income, including allowance taper',()=>{
  assert.equal(savingsTax(30000,1300),60);
  assert.equal(savingsTax(60000,1500),400);
  assert.equal(savingsTax(150000,1000),450);
  assert.equal(savingsTax(100000,1000),400); // £500 allowance + £500 lost personal allowance
});
test('interest can cross a savings band and uses total income to choose the allowance',()=>{
  assert.equal(savingsTax(50000,1000),200); // £500 nil-rate occupies the remaining basic band
});
test('CGT matches HMRC example spanning both rates',()=>{
  assert.equal(capitalGainsTax(52600,32570),10842);
  assert.equal(capitalGainsTax(12600,32570),1728);
});
test('CGT taxes gains, with separate annual exemption and income bands',()=>{
  assert.equal(capitalGainsTax(3000,150000),0);
  assert.equal(capitalGainsTax(4000,0),180);
  assert.equal(capitalGainsTax(4000,60000),240);
});
test('invalid inputs are rejected',()=>{
  assert.throws(()=>savingsTax(-1,100),RangeError);
  assert.throws(()=>capitalGainsTax(NaN,100),RangeError);
});
