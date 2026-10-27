/** Presentation checks derived from the existing monthly engine; no input mutations. */
import {eligibleWithdrawalBucket} from './withdrawals.mjs?v=20261024persona1';
export const WEALTH_COLORS=Object.freeze({liquid:'#1F8A5B',locked:'#7C5CBF',property:'#C58B3B',debt:'#FF3B30',warning:'#CC6600',neutral:'#8E8E93'});
export function assetTone(kind,debt=false){return debt?'debt':['cash','isa','general','shares'].includes(kind)?'liquid':kind==='dc-pension'?'locked':['home','other-property'].includes(kind)?'property':'neutral';}
export function liquidityAccessGaps(projection,holdings){
 const groups=[],owners=Object.keys(projection.ages).filter(o=>Number.isFinite(projection.ages[o]));
 for(const [index,row] of projection.months.entries()){
  if(!(row.unfunded>.01)||!row.estateAssets)continue;
  const ages=Object.fromEntries(owners.map(owner=>[owner,projection.ages[owner]+index/12])),context={month:row.month,pensionAccessAge:projection.pensionAccessAge,ages};
  const assets=row.estateAssets.map(a=>({...holdings.assets.find(original=>original.id===a.id),...a}));
  if(assets.some(a=>a.value>.01&&eligibleWithdrawalBucket(a,context)))continue;
  for(const owner of owners){
   if(!projection.retirementDates[owner]||projection.retirementDates[owner]>=row.month)continue;
   if(!assets.some(a=>a.kind==='dc-pension'&&(a.owner||'primary')===owner&&a.value>.01&&!eligibleWithdrawalBucket(a,context)))continue;
   const previous=groups.findLast(g=>g.owner===owner),[year,month]=row.month.split('-').map(Number),prior=new Date(Date.UTC(year,month-2,1)).toISOString().slice(0,7);
   if(previous?.endMonth===prior){previous.endMonth=row.month;previous.months++;}else groups.push({owner,startMonth:row.month,endMonth:row.month,months:1});
  }
 }
 return groups;
}
export function retirementControlBounds(flow,holdings,scenario,owner){
 const start=flow.timelineStartMonth||flow.asOfMonth,startYear=Number(start.slice(0,4)),pay=flow.pay[owner],age=scenario.ages?.[owner]??(owner==='primary'?holdings.age:holdings.partnerAge),year=scenario.retirementYears?.[owner]??(Number(pay.endDate?.slice(0,4))||startYear+20),ageOffset=Number(pay.endDate?.slice(5)||12)<Number(start.slice(5))?1:0;
 const retirementAge=Number.isFinite(age)?age+year-startYear-ageOffset:null,horizonAge=scenario.planToAge??null,working=Boolean((pay.annualGross||pay.annualTakeHome)&&(!pay.endDate||pay.endDate>=start));
 let issue=null;if(working&&retirementAge!=null&&retirementAge<=age)issue='Choose retirement after your current age.';else if(year>=startYear&&retirementAge!=null&&horizonAge!=null&&retirementAge>=horizonAge)issue='Choose retirement before the horizon age.';
 return {min:age==null?startYear-1:working?age+1:Math.min(age-1,retirementAge??age-1),max:age==null?startYear+45:Math.min(age+45,horizonAge==null?age+45:horizonAge-1),retirementAge,horizonAge,working,issue};
}
