import test from 'node:test';
import assert from 'node:assert/strict';
import { withdrawForSpending, createWithdrawalState } from '../prototype/withdrawals.mjs';
const asset=(kind,value,owner='primary',extra={})=>({id:kind+owner,kind,value,owner,...extra});
const context={ages:{primary:56,partner:60},pensionAccessAge:57,annualTaxableIncome:{primary:0,partner:0},order:['cash','general','isa','pension']};
test('ISA and trading investments bridge the period before personal pension access',()=>{const assets=[asset('cash',100),asset('general',200),asset('isa',300),asset('dc-pension',10000)];const state=createWithdrawalState(assets);const r=withdrawForSpending(assets,700,state,context);assert.equal(r.net,600);assert.equal(r.unfunded,100);assert.equal(assets[3].value,10000);assert.deepEqual(r.items.map(item=>item.bucket),['cash','general','isa']);});
test('personal pension is accessible only at the chosen age, and reports tax separately',()=>{const assets=[asset('dc-pension',100000)];const r=withdrawForSpending(assets,4000,createWithdrawalState(assets),{...context,ages:{primary:57}});assert.equal(r.unfunded,0);assert.equal(r.net,4000);assert.ok(r.tax>0);assert.ok(r.gross>r.net);assert.equal(Math.round((r.gross-r.tax)*100),400000);});
test('ISA withdrawals are tax-free and never exceed holdings',()=>{const assets=[asset('isa',1000)];const r=withdrawForSpending(assets,2000,createWithdrawalState(assets),context);assert.equal(r.gross,1000);assert.equal(r.tax,0);assert.equal(r.unfunded,1000);assert.equal(assets[0].value,0);});
test('unknown ages and unconfirmed employee shares are not assumed accessible',()=>{const assets=[asset('dc-pension',10000),asset('shares',10000)];const r=withdrawForSpending(assets,100,createWithdrawalState(assets),{...context,ages:{}});assert.equal(r.net,0);assert.equal(r.unfunded,100);});
test('CGT uses gains rather than sale proceeds and consumes annual allowance once',()=>{const assets=[asset('general',100000,'primary',{costBasis:0})],state=createWithdrawalState(assets);const r=withdrawForSpending(assets,4000,state,context);assert.ok(r.tax>0);assert.ok(state.gains.primary>3000);const second=withdrawForSpending(assets,1000,state,context);assert.ok(second.tax>0);});
test('a custom withdrawal order is applied and the pension tax-free allowance is capped',()=>{const assets=[asset('isa',10000),asset('dc-pension',10000)],state=createWithdrawalState(assets,{taxFreeRemaining:{primary:0}});const r=withdrawForSpending(assets,1000,state,{...context,ages:{primary:57},order:['pension','cash','general','isa']});assert.equal(r.items[0].bucket,'pension');assert.equal(r.items[0].taxFree,0);assert.equal(assets[0].value,10000);});

test('each person has a separate pension access check',()=>{const assets=[asset('dc-pension',1000,'primary'),asset('dc-pension',1000,'partner')];const r=withdrawForSpending(assets,1500,createWithdrawalState(assets),{...context,ages:{primary:57,partner:56}});assert.equal(r.net,1000);assert.equal(r.unfunded,500);assert.equal(assets[1].value,1000);});
test('pension tax-free cash stops at the entered remaining allowance',()=>{const assets=[asset('dc-pension',100000)],state=createWithdrawalState(assets,{taxFreeRemaining:{primary:100}});const r=withdrawForSpending(assets,2000,state,{...context,ages:{primary:57},annualTaxableIncome:{primary:50000}});assert.equal(r.items[0].taxFree,100);assert.equal(state.taxFreeRemaining.primary,0);assert.ok(r.tax>0);assert.equal(r.net,2000);});
test('a later scheme access age is respected even when the scenario allows age 57',()=>{const assets=[asset('dc-pension',10000,'primary',{pensionAccessAge:60})];const r=withdrawForSpending(assets,1000,createWithdrawalState(assets),{...context,ages:{primary:57}});assert.equal(r.net,0);assert.equal(r.unfunded,1000);});
test('CGT automatically uses remaining basic-rate band and higher income pays 24%',()=>{
  for(const [income,tax] of [[0,1800],[60000,2400]]){
    const assets=[asset('general',13000,'primary',{costBasis:0})];
    const r=withdrawForSpending(assets,20000,createWithdrawalState(assets),{...context,annualTaxableIncome:{primary:income}});
    assert.equal(r.tax,tax);
  }
});
