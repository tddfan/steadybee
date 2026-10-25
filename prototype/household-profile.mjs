import {createBlankMonthlyFlow} from './monthly-flow.mjs?v=20261024persona1';

/** Keep linked balances explicit; removing a person must never orphan their accounts. */
export function removePartnerFromPicture(holdings,flow,planning){
  const linked=[...holdings.assets,...holdings.debts].filter(item=>['partner','shared'].includes(item.owner));
  if(linked.length)throw new Error(`Reassign or remove the ${linked.length} partner or shared assets and debts in Assets & debt before removing this person.`);
  if(flow.tracking?.entries.some(e=>e.changes.some(c=>c.target.kind==='pay'&&c.target.id==='partner'||['partner','shared'].includes(c.value?.owner)||['partner','shared'].includes(c.before?.owner))))throw new Error('This person has tracking history. Keep their record and set the final pay month instead. Removing people with history is not supported yet.');
  const nextHoldings=structuredClone(holdings),nextFlow=structuredClone(flow),nextPlanning=structuredClone(planning);
  nextHoldings.partnerName='';nextHoldings.partnerAge=null;
  nextFlow.pay.partner=createBlankMonthlyFlow().pay.partner;
  nextFlow.statePensions.partner=null;nextFlow.savings.primaryShare=null;nextFlow.assumptions.isaUsedPartner=0;
  const clear=state=>{for(const key of ['ages','retirementYears','taxFreeRemaining'])if(state?.scenario?.[key])delete state.scenario[key].partner;};
  clear(nextPlanning);for(const experiment of nextPlanning.experiments||[])clear(experiment.state);
  return {holdings:nextHoldings,flow:nextFlow,planning:nextPlanning};
}
