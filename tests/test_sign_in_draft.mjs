import test from 'node:test';
import assert from 'node:assert/strict';
import {saveSignInDraft,takeSignInDraft} from '../prototype/sign-in-draft.mjs';
import {createPublicDemoHousehold} from '../prototype/asset-ledger.mjs';
import {createExampleMonthlyFlow} from '../prototype/monthly-flow.mjs';
const store=()=>{const values=new Map();return {getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};};
const picture=()=>({version:1,example:true,holdings:createPublicDemoHousehold(),flow:createExampleMonthlyFlow(),planning:{scenario:{years:30,planToAge:95,retirementYears:{}},metric:'income',group:'person',style:'bars',real:true,selectedYear:'2050'}});
test('OAuth preserves the open example and section once without storing callback tokens',()=>{
 const storage=store(),p=picture(),url='https://preview--steadybee.netlify.app/app.html?example=1#insights';
 saveSignInDraft(storage,p,url,100);
 const draft=takeSignInDraft(storage,'https://preview--steadybee.netlify.app/app.html#access_token=not-stored',200);
 assert.equal(draft.returnUrl,url);assert.deepEqual(draft.picture,p);assert.equal(JSON.stringify(draft).includes('not-stored'),false);
 assert.equal(takeSignInDraft(storage,url,300),null);
});
test('unfinished personal setup resumes and stale or different-origin checkpoints are discarded',()=>{
 const storage=store(),p=picture(),url='http://127.0.0.1:8766/app.html?start=own#assets';p.example=false;p.holdings.assets=[];p.holdings.debts=[];
 saveSignInDraft(storage,p,url,100);assert.equal(takeSignInDraft(storage,url,101).returnUrl,url);
 saveSignInDraft(storage,p,url,100);assert.equal(takeSignInDraft(storage,url,1900000),null);
 saveSignInDraft(storage,p,url,100);assert.equal(takeSignInDraft(storage,'https://steadybee.netlify.app/app.html',101),null);
});
