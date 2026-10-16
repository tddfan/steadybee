/** Local encrypted pictures. No network, credentials or clear-text storage. */
import {validateDraft} from './asset-ledger.mjs?v=20261015coverage6';
import {computeAllocationWaterfall} from './monthly-flow.mjs?v=20261015coverage6';
import {projectPlan} from './planning.mjs?v=20261015coverage6';
import {planHorizon} from './coverage.mjs?v=20261015coverage6';
export const PICTURE_STORAGE_KEY='steadybee.protected-picture.v1';
const MAX_BYTES=2_000_000,ITERATIONS=310_000;
const record=value=>value!==null && typeof value==='object' && !Array.isArray(value);
function safeTree(value,depth=0) {
  if(depth>12)throw new Error('This picture is too deeply nested.');
  if(typeof value==='number' && !Number.isFinite(value))throw new Error('Use finite numbers in a picture.');
  if(typeof value==='string' && value.length>2000)throw new Error('A picture field is too long.');
  if(Array.isArray(value) && value.length>200)throw new Error('A picture contains too many entries.');
  if(value && typeof value==='object')for(const [key,child] of Object.entries(value)){
    if(['__proto__','constructor','prototype'].includes(key)||key.length>128)throw new Error('This picture contains an unsupported field.');
    safeTree(child,depth+1);
  }
}
export function validatePicture(input) {
  safeTree(input);
  if(!record(input)||input.version!==1||!record(input.flow)||!record(input.planning))throw new Error('This is not a supported Steadybee picture.');
  if(new TextEncoder().encode(JSON.stringify(input)).length>1_000_000)throw new Error('This picture is too large.');
  if(input.example!=null && typeof input.example!=='boolean')throw new Error('The picture label is invalid.');
  const validation=validateDraft(input.holdings);if(!validation.valid)throw new Error(validation.errors[0].message);
  if(input.holdings.partnerAge!=null && (!Number.isInteger(input.holdings.partnerAge)||input.holdings.partnerAge<18||input.holdings.partnerAge>120))throw new Error('Enter a partner age from 18 to 120.');
  const p=input.planning,s=p.scenario;
  if(!record(s)||!['netWorth','income','saving','assets','debts'].includes(p.metric)||!['person','type'].includes(p.group)||!['bars','lines'].includes(p.style)||typeof p.real!=='boolean'||(p.selectedYear!=null && !/^\d{4}$/.test(p.selectedYear)))throw new Error('This picture has unsupported chart settings.');
  const allowed=new Set(['years','planToAge','retirementYears','mortgageYearsEarlier','inflation','incomeGrowth','growth','mortgageRate','mortgageTermYears','mortgagePayoffNow','mortgagePayoffSource','oneOff','ages','pensionAccessAge','statePensionAge','futureNI','statePensionUprating','spendingChanges','spendingChange','savingsDestination','withdrawalOrder','openingGainPercent','taxFreeRemaining','debtPayments']);
  if(Object.keys(s).some(key=>!allowed.has(key)))throw new Error('This picture has unsupported scenario settings.');
  for(const key of ['mortgagePayoffNow','futureNI','statePensionUprating'])if(s[key]!=null && typeof s[key]!=='boolean')throw new Error('A scenario switch is invalid.');
  if(s.withdrawalOrder!=null && !['generalFirst','pensionFirst','isaFirst'].includes(s.withdrawalOrder))throw new Error('Choose a supported withdrawal order.');
  if(s.years!=null && (!Number.isInteger(s.years)||s.years<1||s.years>100))throw new Error('The horizon is invalid.');
  if(s.planToAge!=null)planHorizon(input.holdings,s);
  const flow=input.flow;
  for(const key of ['pay','income','spending','assumptions'])if(!record(flow[key]))throw new Error('This picture is missing monthly inputs.');
  if(!record(flow.pay.primary)||!record(flow.pay.partner)||!Array.isArray(flow.datedEntries)||!Array.isArray(flow.customSpending))throw new Error('This picture has incomplete monthly inputs.');
  computeAllocationWaterfall(flow,input.holdings);
  // Validate all scenario options without projecting decades of imported data.
  projectPlan(flow,input.holdings,{...s,planToAge:undefined,years:1});
  return structuredClone(input);
}
const encode=bytes=>btoa(String.fromCharCode(...bytes));
function decode(value,size) {
  if(typeof value!=='string'||value.length>MAX_BYTES||!/^[-A-Za-z0-9+/]*={0,2}$/.test(value))throw new Error('Invalid encrypted picture.');
  const bytes=Uint8Array.from(atob(value),c=>c.charCodeAt(0));
  if(size && bytes.length!==size)throw new Error('Invalid encrypted picture.');return bytes;
}
export function parseEncryptedPicture(raw) {
  if(typeof raw!=='string'||raw.length>MAX_BYTES)throw new Error('The encrypted picture is absent or too large.');
  let data;try{data=JSON.parse(raw);}catch{throw new Error('Choose a Steadybee encrypted JSON backup.');}
  if(!record(data)||data.format!=='steadybee-encrypted'||data.version!==1||data.algorithm!=='AES-GCM'||data.iterations!==ITERATIONS)throw new Error('This encrypted picture format is not supported. Keep the original file.');
  decode(data.salt,16);decode(data.iv,12);if(decode(data.ciphertext).length<16)throw new Error('Invalid encrypted picture.');
  return data;
}
async function derive(passphrase,salt) {
  if(!globalThis.crypto?.subtle)throw new Error('Protected saving needs HTTPS or localhost and a browser with Web Crypto.');
  const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(passphrase),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:ITERATIONS,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
export async function createProtection(passphrase) {
  if(typeof passphrase!=='string'||passphrase.length<12||passphrase.length>1024)throw new Error('Use a passphrase of 12 to 1,024 characters.');
  const salt=crypto.getRandomValues(new Uint8Array(16));return {salt,key:await derive(passphrase,salt)};
}
export async function encryptPicture(picture,protection) {
  const valid=validatePicture(picture),iv=crypto.getRandomValues(new Uint8Array(12));
  const data=await crypto.subtle.encrypt({name:'AES-GCM',iv},protection.key,new TextEncoder().encode(JSON.stringify(valid)));
  // Chunk the base64 conversion so a large but valid picture cannot exceed the argument stack.
  const bytes=new Uint8Array(data);let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return JSON.stringify({format:'steadybee-encrypted',version:1,algorithm:'AES-GCM',iterations:ITERATIONS,salt:encode(protection.salt),iv:encode(iv),ciphertext:btoa(binary)});
}
export async function decryptPicture(raw,passphrase) {
  if(typeof passphrase!=='string'||passphrase.length>1024)throw new Error('Use a valid passphrase.');
  const data=parseEncryptedPicture(raw),salt=decode(data.salt),key=await derive(passphrase,salt);
  let bytes;try{bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(data.iv)},key,decode(data.ciphertext));}catch{throw new Error('The passphrase did not unlock this picture, or the file is damaged. Nothing was changed.');}
  let picture;try{picture=JSON.parse(new TextDecoder().decode(bytes));}catch{throw new Error('The picture inside this backup is not valid.');}
  return {picture:validatePicture(picture),protection:{salt,key}};
}
