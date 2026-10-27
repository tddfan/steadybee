/** Version-four explanation protocol: fixed evidence only, no identities or user-entered labels. */
import {EVIDENCE_LABELS} from './explanation-fields.mjs?v=20261027explain1';
const own=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join()===keys.split(',').sort().join();
const month=v=>typeof v==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(v);
const recipes=['spendLess','retireEarlier','retireLater','mortgagePayoff','withdrawalOrder','stress'];
const dateFacts=['currentGap','scenarioGap','firstChange','periodGap'];
export function validateExplanationBrief(v){
 const fail=()=>{throw Error('Invalid calculated explanation evidence.');};
 if(!own(v,'version,task,path,moneyBasis,basisMonth,startMonth,endMonth,comparisonStartMonth,comparisonEndMonth,recipe,facts,limitations')||v.version!==4||!['period','scenario'].includes(v.task)||!['current','preview'].includes(v.path)||!['today','nominal'].includes(v.moneyBasis)||![v.basisMonth,v.startMonth,v.endMonth].every(month)||v.startMonth>v.endMonth)fail();
 if((v.comparisonStartMonth===null)!==(v.comparisonEndMonth===null)||v.comparisonStartMonth!==null&&(!month(v.comparisonStartMonth)||!month(v.comparisonEndMonth)||v.comparisonStartMonth>v.comparisonEndMonth)||v.recipe!==null&&!recipes.includes(v.recipe)||!Array.isArray(v.facts)||v.facts.length<1||v.facts.length>40||new Set(v.facts.map(f=>f.id)).size!==v.facts.length)fail();
 for(const f of v.facts)if(!own(f,'id,amount,month')||!Object.hasOwn(EVIDENCE_LABELS,f.id)||(dateFacts.includes(f.id)?f.amount!==null||f.month!==null&&!month(f.month):!Number.isFinite(f.amount)||Math.abs(f.amount)>1e12||f.month!==null))fail();
 if(!Array.isArray(v.limitations)||new Set(v.limitations).size!==v.limitations.length||v.limitations.some(x=>!['taxIncomplete','debtIncomplete','coverageDiffers'].includes(x)))fail();
 return structuredClone(v);
}
const unsafe=/[\p{N}£$€%<>{}]|\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundreds?|thousands?|millions?|billions?|trillions?|dozen|half|quarter|doubles?|twice|triple|guarantee\w*|secure|safely|comfortably|optimal\w*|should|recommend\w*|buy|sell|afford\w*|tax.free|allowance|salary.sacrifice)\b|https?:|www\./iu;
export function validateExplanationResult(result,brief){
 validateExplanationBrief(brief);
 if(!own(result,'notes')||!Array.isArray(result.notes)||result.notes.length<1||result.notes.length>3)throw Error('Unsupported AI explanation.');
 for(const n of result.notes)if(!own(n,'factIds,text')||!Array.isArray(n.factIds)||n.factIds.length<1||n.factIds.length>3||new Set(n.factIds).size!==n.factIds.length||n.factIds.some(id=>!brief.facts.some(f=>f.id===id))||typeof n.text!=='string'||n.text.trim().length<12||n.text.length>240||unsafe.test(n.text))throw Error('The AI explanation included unsupported wording or evidence.');
 return structuredClone(result);
}
export function explanationResponseSchema(brief){
 return {type:'object',additionalProperties:false,required:['notes'],properties:{notes:{type:'array',minItems:1,maxItems:3,items:{type:'object',additionalProperties:false,required:['factIds','text'],properties:{factIds:{type:'array',minItems:1,maxItems:3,items:{type:'string',enum:brief.facts.map(f=>f.id)}},text:{type:'string'}}}}}};
}
export const EXPLANATION_INSTRUCTIONS=`Explain only the supplied calculated evidence for an educational financial illustration. Return up to three short notes with factIds and text. Every note must cite supplied fact IDs. The interface renders all amounts and dates: text must contain NO digits, numeric words, currency symbols, percentages, external links, advice, guarantees or claims about affordability. Do not introduce tax rules, allowances, products or an optimum. Describe measured changes and trade-offs, not guesses about their underlying cause. Unpaid costs are not incoming funds. Income is after modelled deductions and excludes net asset withdrawals. Tax is already accounted for; it must not be deducted again. A lower tax total may accompany lost earnings or extra unpaid costs. Accessible investments exclude locked pensions and items needing sale and are before withdrawal tax. Scenario end balances exclude estate tax. Contextual events and labels are absent: never invent a purpose for spending or infer an event. Partial or different coverage cannot establish an improvement. Prioritise incomplete inputs and unpaid costs. Use calm, brief language. ${JSON.stringify(EVIDENCE_LABELS)}`;
