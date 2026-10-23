/** Single-person UK estate illustration. Rule snapshot: 22 October 2026. */
export const ESTATE_RULES=Object.freeze({basicBand:325000,residenceBand:175000,taperThreshold:2000000,rate:.4,pensionChange:'2027-04-06'});
export const RELATIONSHIPS=Object.freeze({child:'Child',grandchild:'Grandchild',spouse:'Spouse / civil partner',other:'Other / unmarried partner'});
const round=value=>Math.round(value*100)/100;
const record=value=>value!==null && typeof value==='object' && !Array.isArray(value);
const percentage=value=>Number.isFinite(value) && value>=0 && value<=100;
export function estateDefaults(month='2026-10') {
  return {version:1,owner:'primary',basis:'current',deathDate:`${month}-28`,beneficiaries:[],residenceAssetId:'',transferBasicPercent:0,transferResidencePercent:0,costs:0,shares:{primary:{},partner:{}},ukScopeConfirmed:false,standardPensionsConfirmed:false,pensionSplitConfirmed:false,complexEstate:false,couple:{route:'direct',relationship:'unconfirmed',firstOwner:'primary',firstDeathDate:`${month}-27`,primaryCosts:0,partnerCosts:0,routeConfirmed:false,descendantsConfirmed:false}};
}
export function validateEstateSettings(input) {
  if(!record(input))throw new Error('Inheritance settings must be an object.');
  input={...estateDefaults(),...input};
  const allowed=new Set(Object.keys(estateDefaults()));
  if(Object.keys(input).some(key=>!allowed.has(key)) || input.version!==1 || !['primary','partner','couple'].includes(input.owner) || !['current','projected'].includes(input.basis))throw new Error('Unsupported inheritance settings.');
  const date=input.deathDate;
  if(typeof date!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(`${date}T12:00:00Z`).toISOString().slice(0,10)!==date || date<'2026-04-06' || date>'2200-12-31')throw new Error('Choose an assumed death date from 6 April 2026 to 2200.');
  if(typeof input.residenceAssetId!=='string' || input.residenceAssetId.length>100)throw new Error('Choose a valid qualifying home.');
  const c=input.couple;
  if(!record(c) || Object.keys(c).some(key=>!Object.hasOwn(estateDefaults().couple,key)) || !['direct','survivor'].includes(c.route) || !['unconfirmed','married','unmarried'].includes(c.relationship) || !['primary','partner'].includes(c.firstOwner) || typeof c.firstDeathDate!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(c.firstDeathDate) || !Number.isFinite(Date.parse(c.firstDeathDate)) || new Date(`${c.firstDeathDate}T12:00:00Z`).toISOString().slice(0,10)!==c.firstDeathDate || c.firstDeathDate<'2026-04-06' || c.firstDeathDate>'2200-12-31')throw new Error('Check the couple scenario and first death date.');
  for(const key of ['primaryCosts','partnerCosts'])if(!Number.isFinite(c[key]) || c[key]<0 || c[key]>1e9)throw new Error('Check each person’s deductible funeral costs.');
  for(const key of ['routeConfirmed','descendantsConfirmed'])if(typeof c[key]!=='boolean')throw new Error('Check the couple confirmations.');
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
  if(settings.owner==='couple')return estateOwnership(item,{...settings,owner:'primary'})+estateOwnership(item,{...settings,owner:'partner'});
  const other=settings.owner==='primary' ? 'partner' : 'primary',otherShare=settings.shares[other]?.[item.id];
  return (settings.shares[settings.owner]?.[item.id] ?? (otherShare!=null ? 100-otherShare : (item.owner || 'primary')===settings.owner ? 100 : item.owner==='shared' ? 50 : 0))/100;
}
export function estateOwnedValue(item,settings,key='value'){
  const primary=estateOwnership(item,{...settings,owner:'primary'}),partner=estateOwnership(item,{...settings,owner:'partner'});
  const combined=round(item[key]*(primary+partner)),first=round(item[key]*primary);
  return settings.owner==='couple' ? combined : settings.owner==='primary' ? first : round(combined-first);
}
/** Amounts and thresholds are nominal. Pension benefits follow the entered split by assumption. */
export function calculateEstate(holdings,input) {
  const settings=validateEstateSettings(input),warnings=[];
  if(settings.owner==='couple')return calculateCoupleEstate(holdings,settings);
  if(settings.owner==='partner' && !holdings.partnerName)throw new Error('Add the other person before selecting their estate.');
  if(!settings.beneficiaries.length || Math.abs(settings.beneficiaries.reduce((sum,item)=>sum+item.percent,0)-100)>.000001)throw new Error('Beneficiary shares must add up to 100%.');
  const postPensionChange=settings.deathDate>=ESTATE_RULES.pensionChange;
  const assets=(holdings.assets || []).map(item=>{
    if(!Number.isFinite(item.value) || item.value<0)throw new Error('Check asset values.');
    const share=estateOwnership(item,settings),value=estateOwnedValue(item,settings),pension=item.kind==='dc-pension';
    return {...item,share,value,inEstate:!pension || postPensionChange};
  }).filter(item=>item.value>0);
  const debts=(holdings.debts || []).map(item=>{
    if(!Number.isFinite(item.balance) || item.balance<0)throw new Error('Check debt balances.');
    return {...item,balance:estateOwnedValue(item,settings,'balance')};
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

/** Two ordered estates at fixed values, not a survivor income/spending projection. */
export function calculateCoupleEstate(holdings,input){
  const s=validateEstateSettings(input),c=s.couple;
  if(!holdings.partnerName)throw new Error('Add both parents to use a couple scenario.');
  if(c.relationship==='unconfirmed')throw new Error('Choose married / civil partners or unmarried partners.');
  if(c.firstDeathDate>=s.deathDate)throw new Error('The first death date must be before the second. Simultaneous-death rules are not modelled.');
  if(!s.beneficiaries.length || s.beneficiaries.some(p=>!['child','grandchild'].includes(p.relationship)))throw new Error('The couple scenario supports children and grandchildren as final beneficiaries.');
  const firstOwner=c.firstOwner,secondOwner=firstOwner==='primary' ? 'partner' : 'primary',married=c.relationship==='married';
  const cost=owner=>c[`${owner}Costs`];
  const homeFor=owner=>holdings.assets.some(a=>a.id===s.residenceAssetId && estateOwnership(a,{...s,owner})>0) ? s.residenceAssetId : '';
  const firstSettings={...s,owner:firstOwner,deathDate:c.firstDeathDate,costs:cost(firstOwner),residenceAssetId:homeFor(firstOwner),transferBasicPercent:0,transferResidencePercent:0};
  if(c.route==='survivor')firstSettings.beneficiaries=[{id:'surviving-parent',name:secondOwner==='primary' ? holdings.name || 'Other parent' : holdings.partnerName,relationship:married ? 'spouse' : 'other',percent:100}];
  const first=calculateEstate(holdings,firstSettings);
  if(first.warnings.some(w=>w.startsWith('Debts and costs exceed')))throw new Error('The first estate has insufficient assets for its debts and costs; settle that assumption before combining estates.');
  const usedBasic=Math.min(first.basicBand,Math.max(0,first.netEstate-first.spouseExemption-first.residenceBand));
  const transferBasicPercent=married ? Math.max(0,1-usedBasic/ESTATE_RULES.basicBand)*100 : 0;
  const transferResidencePercent=married ? Math.max(0,1-(first.residenceTaper+first.residenceBand)/ESTATE_RULES.residenceBand)*100 : 0;
  let finalHoldings=holdings,secondShares=s.shares,secondHome=homeFor(secondOwner),settlement=[];
  if(c.route==='survivor'){
    const assets=holdings.assets.map(a=>({...a,owner:secondOwner,value:estateOwnedValue(a,{...s,owner:'couple'})}));
    const debts=holdings.debts.map(d=>({...d,owner:secondOwner,balance:estateOwnedValue(d,{...s,owner:'couple'},'balance')}));
    // Carry recorded liabilities to the survivor. Settle first-estate tax and
    // funeral costs from the first parent's share only, cash/investments first.
    let left=round(first.estateTax+first.costs);
    const order=['cash','isa','general','shares','other','car','other-property','home','dc-pension'];
    const originals=[...holdings.assets].sort((a,b)=>order.indexOf(a.kind)-order.indexOf(b.kind));
    for(const original of originals){
      if(left<=0)break;const asset=assets.find(a=>a.id===original.id),available=estateOwnedValue(original,firstSettings),paid=Math.min(available,left);
      if(paid>0){asset.value=round(asset.value-paid);left=round(left-paid);settlement.push({id:original.id,label:original.label || original.kind,amount:paid});}
    }
    if(left>0)throw new Error('The first parent’s assets cannot fund the assumed tax and funeral costs.');
    finalHoldings={...holdings,assets,debts};secondShares={primary:{},partner:{}};
    secondHome=assets.some(a=>a.id===s.residenceAssetId && a.value>0) ? s.residenceAssetId : '';
  }
  const second=calculateEstate(finalHoldings,{...s,owner:secondOwner,costs:cost(secondOwner),shares:secondShares,residenceAssetId:secondHome,transferBasicPercent,transferResidencePercent});
  const estateTax=round(first.estateTax+second.estateTax),costs=round(first.costs+second.costs);
  const assets=c.route==='direct' ? [...first.assets,...second.assets] : second.assets;
  const debt=c.route==='direct' ? round(first.debt+second.debt) : second.debt;
  const familyGross=round(holdings.assets.reduce((sum,a)=>sum+estateOwnedValue(a,{...s,owner:'couple'}),0));
  const afterEstateTax=c.route==='direct' ? round(first.afterEstateTax+second.afterEstateTax) : second.afterEstateTax;
  const beneficiaries=s.beneficiaries.map(person=>{
    const final=second.beneficiaries.find(p=>p.id===person.id),earlier=c.route==='direct' ? first.beneficiaries.find(p=>p.id===person.id) : null;
    return {...person,gross:round((earlier?.gross || 0)+final.gross),estateTax:round((earlier?.estateTax || 0)+final.estateTax),afterEstateTax:round((earlier?.afterEstateTax || 0)+final.afterEstateTax)};
  });
  // The earlier tax in the survivor route is shown at the estate stage rather
  // than assigned a second time to the eventual children's already-net shares.
  const warnings=[...new Set([...first.warnings,...second.warnings])];
  if(!c.routeConfirmed)warnings.push('Confirm the route matches ownership, survivorship, wills and pension nominations. Joint tenancy can prevent a direct-to-children gift.');
  if(!c.descendantsConfirmed)warnings.push('Confirm recipients are direct descendants of both parents and both lived in any selected qualifying home.');
  const liquidAssets=round(holdings.assets.filter(a=>['cash','isa'].includes(a.kind)).reduce((sum,a)=>sum+estateOwnedValue(a,{...s,owner:'couple'}),0));
  const liquidAfterDeductions=Math.max(0,round(liquidAssets-debt-costs));
  return {couple:true,route:c.route,firstOwner,secondOwner,first,second,transferBasicPercent,transferResidencePercent,settlement,assets,debts:c.route==='direct' ? [...first.debts,...second.debts] : second.debts,familyGross,grossEstate:c.route==='direct' ? round(first.grossEstate+second.grossEstate) : second.grossEstate,outsideEstate:c.route==='direct' ? round(first.outsideEstate+second.outsideEstate) : second.outsideEstate,debt,costs,estateTax,afterEstateTax,beneficiaries,pensionValue:c.route==='direct' ? round(first.pensionValue+second.pensionValue) : second.pensionValue,liquidAssets,liquidAfterDeductions,liquidityGap:Math.max(0,round(estateTax-liquidAfterDeductions)),warnings,incomplete:warnings.length>0};
}
