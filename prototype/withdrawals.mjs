/** User-directed drawdown illustration; current tax assumptions, not an optimal strategy. */
import { capitalGainsTax, incomeTaxWithSavings } from './investment-tax.mjs?v=20261015coverage6';
const round=value=>Math.round(value*100)/100;
export const WITHDRAWAL_ORDERS=Object.freeze({
  generalFirst:['cash','general','isa','pension'],
  pensionFirst:['cash','pension','general','isa'],
  isaFirst:['cash','isa','general','pension'],
});
export function createWithdrawalState(assets,{taxFreeRemaining={},openingGainPercent=100}={}) {
  if(!Number.isFinite(openingGainPercent)||openingGainPercent<0||openingGainPercent>100)throw new RangeError('Opening investment gain must be from 0% to 100%.');
  for(const value of Object.values(taxFreeRemaining))if(!Number.isFinite(value)||value<0||value>268275)throw new RangeError('Remaining pension lump-sum allowance must be from £0 to £268,275.');
  return {gains:{primary:0,partner:0},taxFreeRemaining:{primary:taxFreeRemaining.primary ?? 268275,partner:taxFreeRemaining.partner ?? 268275},basis:Object.fromEntries(assets.filter(item=>item.kind==='general'||item.kind==='shares').map(item=>[item.id,item.costBasis ?? round(item.value*(1-openingGainPercent/100))]))};
}

/** Same eligibility rule for drawdown and the coverage balance. Amounts remain before tax. */
export function eligibleWithdrawalBucket(asset,context={}) {
  const owner=asset.owner || 'primary';
  if(asset.kind==='dc-pension')return ['primary','partner'].includes(owner) && Number.isFinite(context.ages?.[owner]) && context.ages[owner]>=Math.max(context.pensionAccessAge ?? 57,asset.pensionAccessAge || 0) ? 'pension' : null;
  if(asset.kind==='isa')return owner==='shared' ? null : 'isa';
  if(asset.kind==='cash')return 'cash';
  if(asset.kind==='general' || (asset.kind==='shares' && (asset.accessBucket==='accessible' || (asset.accessBucket==='illiquid' && context.saleAssetIds?.includes(asset.id)))))return 'general';
  return null;
}

export function withdrawForSpending(assets,needed,state,context={}) {
  if(!Number.isFinite(needed)||needed<0)throw new RangeError('The spending gap must be non-negative.');
  const order=context.order || WITHDRAWAL_ORDERS.generalFirst;
  if(order.length!==4||new Set(order).size!==4||order.some(key=>!['cash','general','isa','pension'].includes(key)))throw new RangeError('Choose each withdrawal bucket once.');
  const pensionAccessAge=context.pensionAccessAge ?? 57;
  if(context.month && state.taxMonth!==context.month){state.taxMonth=context.month;state.monthlyTaxable={primary:0,partner:0};}
  const monthlyTaxable=context.month ? state.monthlyTaxable : {primary:0,partner:0},items=[];
  let left=round(needed),grossTotal=0,taxTotal=0;
  const bucketOf=asset=>eligibleWithdrawalBucket(asset,context);
  const ownerOf=asset=>asset.owner || 'primary';
  function quote(asset,gross,bucket) {
    const owner=ownerOf(asset);
    if(bucket==='cash'||bucket==='isa')return {gross,net:gross,tax:0,gain:0,taxFree:0,owner,bucket};
    if(bucket==='general') {
      const gain=round(gross*Math.max(0,1-(state.basis[asset.id] ?? asset.value)/asset.value));
      const owners=owner==='shared' ? ['primary','partner'] : [owner];
      const gainsByOwner={},tax=round(owners.reduce((sum,person,index)=>{
        const portion=owners.length===1 ? gain : index===0 ? round(gain/2) : round(gain-round(gain/2));gainsByOwner[person]=portion;
        const income=(context.annualTaxableIncome?.[person] || 0)+(context.annualInterest?.[person] || 0)+(monthlyTaxable[person] || 0)*12;
        return sum+capitalGainsTax((state.gains[person] || 0)+portion,income)-capitalGainsTax(state.gains[person] || 0,income);
      },0));
      return {gross,net:round(gross-tax),tax,gain,gainsByOwner,taxFree:0,owner,bucket};
    }
    const taxFree=round(Math.min(gross*.25,state.taxFreeRemaining[owner] || 0));
    const taxable=round(gross-taxFree),base=(context.annualTaxableIncome?.[owner] || 0)+monthlyTaxable[owner]*12;
    const interest=context.annualInterest?.[owner] || 0;
    const tax=round((incomeTaxWithSavings(base+taxable*12,interest)-incomeTaxWithSavings(base,interest))/12);
    return {gross,net:round(gross-tax),tax,taxFree,taxable,gain:0,owner,bucket};
  }
  function grossFor(asset,net,bucket) {
    const max=Math.round(asset.value*100);
    if(quote(asset,max/100,bucket).net<=net)return quote(asset,max/100,bucket);
    let low=0,high=max;
    while(low<high){const middle=Math.floor((low+high)/2);if(quote(asset,middle/100,bucket).net>=net)high=middle;else low=middle+1;}
    return quote(asset,low/100,bucket);
  }
  for(const bucket of order) {
    while(left>0) {
      const candidates=assets.filter(asset=>{
        if(asset.value<=0 || bucketOf(asset)!==bucket)return false;
        const owner=ownerOf(asset);
        if(bucket==='pension')return ['primary','partner'].includes(owner) && Number.isFinite(context.ages?.[owner]) && context.ages[owner]>=Math.max(pensionAccessAge,asset.pensionAccessAge || 0);
        if(bucket==='isa')return owner!=='shared';
        return true;
      });
      if(!candidates.length)break;
      // Small steps use lower estimated immediate tax within the selected bucket, without claiming a lifetime optimum.
      const target=Math.min(left,1000);
      const choices=candidates.map(asset=>({asset,quote:grossFor(asset,target,bucket)})).filter(item=>item.quote.net>0);
      choices.sort((a,b)=>a.quote.tax/a.quote.net-b.quote.tax/b.quote.net);
      const choice=choices[0];if(!choice)break;
      const {asset,quote:q}=choice,oldValue=asset.value;
      asset.value=round(asset.value-q.gross);
      if(bucket==='general') {
        state.basis[asset.id]=round((state.basis[asset.id] ?? oldValue)*(1-q.gross/oldValue));
        for(const [owner,gain] of Object.entries(q.gainsByOwner))state.gains[owner]=round((state.gains[owner] || 0)+gain);
      }
      if(bucket==='pension'){state.taxFreeRemaining[q.owner]=round(state.taxFreeRemaining[q.owner]-q.taxFree);monthlyTaxable[q.owner]=round(monthlyTaxable[q.owner]+q.taxable);}
      const existing=items.find(item=>item.assetId===asset.id);
      if(existing)for(const key of ['gross','net','tax','taxFree'])existing[key]=round(existing[key]+q[key]);
      else items.push({assetId:asset.id,label:asset.label || bucket,owner:q.owner,bucket,gross:q.gross,net:q.net,tax:q.tax,taxFree:q.taxFree});
      left=round(Math.max(0,left-q.net));grossTotal=round(grossTotal+q.gross);taxTotal=round(taxTotal+q.tax);
    }
  }
  return {gross:grossTotal,tax:taxTotal,net:round(grossTotal-taxTotal),unfunded:left,items};
}
