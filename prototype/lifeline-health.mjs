/** Projection turning points. Cash, accessible funds and total assets are not interchangeable. */
import {eligibleWithdrawalBucket} from './withdrawals.mjs?v=20261024persona1';
const monthEnd=m=>{const [y,n]=m.split('-').map(Number);return new Date(Date.UTC(y,n,0)).toISOString().slice(0,10);};
export function lifelineTurningPoints(projection,openingHoldings){
 const assets=openingHoldings.assets||[],context={month:projection.startMonth,ages:projection.ages,pensionAccessAge:projection.pensionAccessAge};
 let cash=assets.filter(a=>a.kind==='cash').reduce((s,a)=>s+a.value,0),accessible=assets.filter(a=>eligibleWithdrawalBucket(a,context)).reduce((s,a)=>s+a.value,0),total=assets.reduce((s,a)=>s+a.value,0);
 const events=[],seen=new Set(),add=(kind,row,label,detail,start=false)=>{if(seen.has(kind))return;seen.add(kind);events.push({id:kind==='gap'?'first-gap':`first-${kind}`,kind,date:start?`${row.month}-01`:monthEnd(row.month),label,detail,precision:'month'});};
 for(const r of projection.months){
  const nextCash=r.assetsByType?.cash,nextAccessible=r.withdrawableAssets,nextTotal=r.assetsTotal;
  if(cash>.01&&nextCash<=.01)add('cash',r,'Cash used up','Cash reaches zero. Other accessible investments may still fund costs.');
  if(accessible>.01&&nextAccessible<=.01)add('depleted',r,'Accessible funds exhausted','Assets eligible for withdrawal reach zero before withdrawal tax. Property or locked pensions may remain.');
  if(total>.01&&nextTotal<=.01)add('exhausted',r,'All assets exhausted','All modelled asset balances reach zero.');
  if(r.unfunded>.01)add('gap',r,'First unpaid cost','Income and eligible withdrawals do not cover all costs in this month.',true);
  cash=nextCash;accessible=nextAccessible;total=nextTotal;
 }
 return events;
}
