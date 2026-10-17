/** Coverage is a deterministic cash-flow result under the supplied assumptions. */
export function planHorizon(holdings,options={}) {
  const owners=holdings.partnerName ? ['primary','partner'] : ['primary'];
  const ages=Object.fromEntries(owners.map(owner=>[owner,options.ages?.[owner] ?? (owner==='primary' ? holdings.age : holdings.partnerAge)]));
  const known=Object.values(ages).filter(Number.isFinite),missingOwners=owners.filter(owner=>!Number.isFinite(ages[owner]));
  const targetAge=options.planToAge ?? 95;
  if(!Number.isInteger(targetAge)||targetAge<70||targetAge>120)throw new RangeError('Choose a plan age from 70 to 120.');
  const youngestAge=known.length ? Math.min(...known) : null;
  const years=youngestAge==null ? options.years ?? 30 : Math.max(1,targetAge-youngestAge);
  if(!Number.isInteger(years)||years<1||years>100)throw new RangeError('The plan horizon must be from 1 to 100 years.');
  return {years,targetAge,youngestAge,missingOwners};
}
export function agesAt(projection,month,{closing=false}={}) {
  const [sy,sm]=projection.startMonth.split('-').map(Number),[y,m]=month.split('-').map(Number);
  const elapsed=((y-sy)*12+m-sm+(closing ? 1 : 0))/12;
  return Object.fromEntries(Object.entries(projection.ages).filter(([,age])=>Number.isFinite(age)).map(([owner,age])=>[owner,Math.floor(age+elapsed+1e-8)]));
}
export function summarizeCoverage(projection,{real=true}={}) {
  const last=projection.months.at(-1),gapIndex=projection.months.findIndex(month=>month.unfunded>0),gap=projection.months[gapIndex];
  const divisor=real ? last.deflator : 1;
  return {covered:gapIndex<0,endMonth:last.month,endAges:agesAt(projection,last.month,{closing:true}),coveredThrough:gapIndex<0 ? last.month : gapIndex===0 ? null : projection.months[gapIndex-1].month,
    firstGap:gap ? {month:gap.month,ages:agesAt(projection,gap.month),amount:gap.unfunded/(real ? gap.deflator : 1)} : null,
    accessibleAtEnd:last.withdrawableAssets/divisor,lockedAtEnd:last.lockedPensions/divisor,otherAtEnd:last.otherAssets/divisor,debtAtEnd:last.debtsTotal/divisor,unmodelledDebt:(projection.unmodelledDebt || 0)/divisor};
}
