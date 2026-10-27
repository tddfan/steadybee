/** Read-only asset grouping. Linked liabilities stay beside their underlying asset. */
import {accessBucket} from './asset-ledger.mjs?v=20261022cashflow2';
export function filterHoldings(holdings,group,key){
 if(!key||key==='all')return {assets:[...holdings.assets],debts:[...holdings.debts]};
 const matches=a=>group==='owner'?(a.owner||'primary')===key:group==='type'?a.kind===key:accessBucket(a)===key;
 const assets=holdings.assets.filter(matches),ids=new Set(assets.map(a=>a.id));
 return {assets,debts:holdings.debts.filter(d=>group==='owner'?(d.owner||'primary')===key:ids.has(d.linkedAssetId))};
}
