/** Single-person UK estate illustration. Rule snapshot: 22 October 2026. */
export const ESTATE_RULES=Object.freeze({basicBand:325000,residenceBand:175000,taperThreshold:2000000,rate:.4,pensionChange:'2027-04-06'});
export const RELATIONSHIPS=Object.freeze({child:'Child',grandchild:'Grandchild',spouse:'Spouse / civil partner',other:'Other / unmarried partner'});
const round=value=>Math.round(value*100)/100;
const record=value=>value!==null && typeof value==='object' && !Array.isArray(value);
const percentage=value=>Number.isFinite(value) && value>=0 && value<=100;
export function estateDefaults(month='2026-10') {
  return {version:1,owner:'primary',basis:'current',deathDate:`${month}-28`,beneficiaries:[],residenceAssetId:'',transferBasicPercent:0,transferResidencePercent:0,costs:0,shares:{primary:{},partner:{}},ukScopeConfirmed:false,standardPensionsConfirmed:false,pensionSplitConfirmed:false,complexEstate:false};
}
export function validateEstateSettings(input) {
  if(!record(input))throw new Error('Inheritance settings must be an object.');
  const allowed=new Set(Object.keys(estateDefaults()));
  if(Object.keys(input).some(key=>!allowed.has(key)) || input.version!==1 || !['primary','partner'].includes(input.owner) || !['current','projected'].includes(input.basis))throw new Error('Unsupported inheritance settings.');
  const date=input.deathDate;
  if(typeof date!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(`${date}T12:00:00Z`).toISOString().slice(0,10)!==date || date<'2026-04-06' || date>'2200-12-31')throw new Error('Choose an assumed death date from 6 April 2026 to 2200.');
  if(typeof input.residenceAssetId!=='string' || input.residenceAssetId.length>100)throw new Error('Choose a valid qualifying home.');
  for(const key of ['transferBasicPercent','transferResidencePercent'])if(!percentage(input[key]))throw new Error('Transferred allowances must be from 0% to 100%.');
  if(!Number.isFinite(input.costs) || input.costs<0 || input.costs>1e9)throw new Error('Enter qualifying estate costs from £0 to £1 billion.');
  for(const key of ['ukScopeConfirmed','standardPensionsConfirmed','pensionSplitConfirmed','complexEstate'])if(typeof input[key]!=='boolean')throw new Error('An inheritance confirmation is invalid.');
  if(!record(input.shares) || Object.keys(input.shares).some(key=>!['primary','partner'].includes(key)))throw new Error('Invalid ownership shares.');
  for(const shares of Object.values(input.shares))if(!record(shares) || Object.entries(shares).some(([id,value])=>!id || id.length>100 || ['__proto__','constructor','prototype'].includes(id) || !percentage(value)))throw new Error('Ownership shares must be from 0% to 100%.');
  for(const [id,value] of Object.entries(input.shares.primary || {}))if(input.shares.partner?.[id]!=null && value+input.shares.partner[id]>100)throw new Error('Combined ownership shares cannot exceed 100%.');
  if(!Array.isArray(input.beneficiaries) || input.beneficiaries.length>20)throw new Error('Add up to 20 beneficiaries.');
  const ids=new Set();
  for(const person of input.beneficiaries){
    if(!record(person) || Object.keys(person).some(key=>!['id','name','relationship','percent'].includes(key)) || typeof person.id!=='string' || !person.id || person.id.length>80 || ids.has(person.id) || typeof person.name!=='string' || !person.name.trim() || person.name.length>60 || !Object.hasOwn(RELATIONSHIPS,person.relationship) || !percentage(person.percent))throw new Error('Check beneficiary names, relationships and percentages.');
    ids.add(person.id);
  }
  return structuredClone(input);
}
export function equalChildren(count) {
  if(!Number.isInteger(count) || count<1 || count>20)throw new Error('Choose between 1 and 20 children.');
  return Array.from({length:count},(_,i)=>({id:`child-${i+1}`,name:`Child ${i+1}`,relationship:'child',percent:100/count}));
}
export function estateOwnership(item,settings) {
  const other=settings.owner==='primary' ? 'partner' : 'primary',otherShare=settings.shares[other]?.[item.id];
  return (settings.shares[settings.owner]?.[item.id] ?? (otherShare!=null ? 100-otherShare : (item.owner || 'primary')===settings.owner ? 100 : item.owner==='shared' ? 50 : 0))/100;
}
/** Amounts and thresholds are nominal. Pension benefits follow the entered split by assumption. */
export function calculateEstate(holdings,input) {
  const settings=validateEstateSettings(input),warnings=[];
  if(settings.owner==='partner' && !holdings.partnerName)throw new Error('Add the other person before selecting their estate.');
  if(!settings.beneficiaries.length || Math.abs(settings.beneficiaries.reduce((sum,item)=>sum+item.percent,0)-100)>.000001)throw new Error('Beneficiary shares must add up to 100%.');
  const postPensionChange=settings.deathDate>=ESTATE_RULES.pensionChange;
  const assets=(holdings.assets || []).map(item=>{
    if(!Number.isFinite(item.value) || item.value<0)throw new Error('Check asset values.');
    const share=estateOwnership(item,settings),value=round(item.value*share),pension=item.kind==='dc-pension';
    return {...item,share,value,inEstate:!pension || postPensionChange};
  }).filter(item=>item.value>0);
  const debts=(holdings.debts || []).map(item=>{
    if(!Number.isFinite(item.balance) || item.balance<0)throw new Error('Check debt balances.');
    return {...item,balance:round(item.balance*estateOwnership(item,settings))};
  }).filter(item=>item.balance>0);
  const total=items=>round(items.reduce((sum,item)=>sum+item.value,0));
  const grossEstate=total(assets.filter(item=>item.inEstate)),outsideEstate=total(assets.filter(item=>!item.inEstate)),debt=round(debts.reduce((sum,item)=>sum+item.balance,0));
  const deductions=round(debt+settings.costs),netEstate=Math.max(0,round(grossEstate-deductions));
  const spousePercent=settings.beneficiaries.filter(item=>item.relationship==='spouse').reduce((sum,item)=>sum+item.percent,0);
  const descendantPercent=settings.beneficiaries.filter(item=>['child','grandchild'].includes(item.relationship)).reduce((sum,item)=>sum+item.percent,0);
  const spouseExemption=round(netEstate*spousePercent/100);
  const home=assets.find(item=>item.id===settings.residenceAssetId);
  if(settings.residenceAssetId && (!home || !['home','other-property'].includes(home.kind)))throw new Error('The selected qualifying home is not in this person’s estate.');
  const homeDebt=home ? debts.filter(item=>item.linkedAssetId===home.id).reduce((sum,item)=>sum+item.balance,0) : 0;
  const qualifyingHome=home ? round(Math.max(0,home.value-homeDebt)*descendantPercent/100) : 0;
  const basicBand=round(ESTATE_RULES.basicBand*(1+settings.transferBasicPercent/100));
  const residenceMaximum=round(ESTATE_RULES.residenceBand*(1+settings.transferResidencePercent/100));
  const residenceTaper=round(Math.max(0,netEstate-ESTATE_RULES.taperThreshold)/2);
  const residenceBand=round(Math.min(qualifyingHome,Math.max(0,residenceMaximum-residenceTaper)));
  const taxableEstate=Math.max(0,round(netEstate-spouseExemption-basicBand-residenceBand)),estateTax=round(taxableEstate*ESTATE_RULES.rate);
  const afterEstateTax=round(netEstate-estateTax+outsideEstate);
  // Spouse-exempt gifts retain their gross share; allocate estate tax only to
  // non-exempt residual shares. Cent residuals are assigned deterministically.
  function allocate(amount,weights){
    const result=weights.map(weight=>Math.floor(amount*100*weight/100)/100);
    let pennies=Math.round((amount-result.reduce((a,b)=>a+b,0))*100);
    for(let i=0;pennies>0;i=(i+1)%result.length)if(weights[i]>0){result[i]=round(result[i]+.01);pennies--;}
    return result;
  }
  const grossShares=allocate(netEstate+outsideEstate,settings.beneficiaries.map(item=>item.percent));
  const burden=100-spousePercent,taxes=burden ? allocate(estateTax,settings.beneficiaries.map(item=>item.relationship==='spouse' ? 0 : item.percent/burden*100)) : settings.beneficiaries.map(()=>0);
  const beneficiaries=settings.beneficiaries.map((item,i)=>({...item,gross:grossShares[i],estateTax:taxes[i],afterEstateTax:round(grossShares[i]-taxes[i])}));
  if(!settings.ukScopeConfirmed)warnings.push('Confirm this is a standard UK-scope estate and any spouse exemption is unrestricted. Residence or overseas assets can change the result.');
  if(settings.complexEstate)warnings.push('Recent gifts, trusts, charities, business/agricultural relief, foreign assets and special reliefs are not calculated.');
  const pensionValue=total(assets.filter(item=>item.kind==='dc-pension'));
  if(pensionValue && !settings.standardPensionsConfirmed)warnings.push('Pensions assume standard unused discretionary DC funds; confirm scheme terms. Other death benefits need a different calculation.');
  if(pensionValue && !settings.pensionSplitConfirmed)warnings.push('Confirm pension nominations follow the beneficiary split. A will does not automatically control pension benefits.');
  if(pensionValue)warnings.push('Beneficiary pension Income Tax is not included. Results are after estate tax only; age at death, scheme terms and benefit timing can affect further tax.');
  if(deductions>grossEstate)warnings.push('Debts and costs exceed the estate in scope. Debt recovery and pension protection are not modelled.');
  if(debts.some(item=>item.kind==='mortgage' && !item.linkedAssetId) && home)warnings.push('A mortgage is not linked to a property; check qualifying home equity before using the residence allowance.');
  const liquidAssets=total(assets.filter(item=>['cash','isa'].includes(item.kind)));
  const liquidAfterDeductions=Math.max(0,round(liquidAssets-deductions));
  return {assets,debts,grossEstate,outsideEstate,debt,costs:settings.costs,netEstate,spouseExemption,basicBand,residenceBand,residenceTaper,qualifyingHome,taxableEstate,estateTax,afterEstateTax,beneficiaries,pensionValue,liquidAssets,liquidAfterDeductions,liquidityGap:round(Math.max(0,estateTax-liquidAfterDeductions)),warnings,incomplete:warnings.length>0,postPensionChange};
}
