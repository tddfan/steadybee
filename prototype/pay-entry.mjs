// Pay is stored annually so changing entry frequency never changes engine units.
export const PAY_PERIODS = Object.freeze({weekly:52,fourWeekly:13,monthly:12,yearly:1});
export function annualisePay(amount,frequency) {
  if(!Object.hasOwn(PAY_PERIODS,frequency)||!Number.isFinite(amount)||amount<0||amount>100_000_000/PAY_PERIODS[frequency])throw new RangeError('Enter a valid take-home amount and pay frequency.');
  return Math.round(amount*PAY_PERIODS[frequency]*100)/100;
}
export function pensionEntryEquivalent(pay,kind,unit) {
  if(unit==='unknown')return 0;
  if(!(pay.annualGross>0) && (pay[`${kind}Pension`]>0 || pay[`${kind}PensionRate`]>0))return null;
  return unit==='percent'?(pay.annualGross?(pay[`${kind}Pension`]||0)/pay.annualGross*100:0):(pay.annualGross||0)*(pay[`${kind}PensionRate`]||0)/100;
}
export function pensionInputIncomplete(pay) {
  return Boolean(pay.pensionBalanceUnknown || pay.employeePensionUnknown || pay.employerPensionUnknown);
}
export function mountPayEntry(card,owner,{getPay,update,readAmount}) {
  const create=(tag,text)=>{const node=document.createElement(tag);if(text)node.textContent=text;return node;};
  const annual=card.querySelector(`[data-flow-pay-key="annualTakeHome"]`);
  const annualRow=annual.closest('label');annualRow.hidden=true;
  const label=create('label','Take-home pay (£)'),amount=create('input');amount.id=`pay-received-${owner}`;amount.type='number';amount.min='0';amount.step='.01';amount.placeholder='Use salary estimate';label.htmlFor=amount.id;label.append(amount);
  const frequencyLabel=create('label','Paid'),frequency=create('select');frequency.id=`pay-frequency-${owner}`;frequencyLabel.htmlFor=frequency.id;
  for(const [value,text] of Object.entries({weekly:'Weekly',fourWeekly:'Every four weeks',monthly:'Monthly',yearly:'Yearly'}))frequency.add(new Option(text,value));frequencyLabel.append(frequency);
  const entry=create('div');entry.className='pay-period-entry';entry.append(label,frequencyLabel);card.querySelector('legend').after(entry);
  const help=create('small','After tax and pension. Include typical overtime; blank uses the salary estimate.');help.className='pay-entry-help';entry.after(help);
  const apply=()=>{if(!amount.checkValidity())return;try{annual.value=amount.value===''?'':String(annualisePay(Number(amount.value),frequency.value));update({takeHomeFrequency:frequency.value});annual.dispatchEvent(new Event('input',{bubbles:true}));amount.setCustomValidity('');}catch(error){amount.setCustomValidity(error.message);amount.reportValidity();}};
  amount.addEventListener('input',()=>{amount.setCustomValidity('');apply();});
  frequency.addEventListener('change',()=>{update({takeHomeFrequency:frequency.value});amount.value=annual.value===''?'':String(Math.round(readAmount(annual)/PAY_PERIODS[frequency.value]*100)/100);});
  const pensionControls=[];
  for(const kind of ['employee','employer']) {
    const rate=card.querySelector(`[data-flow-pay-key="${kind}PensionRate"]`),cash=card.querySelector(`[data-flow-pay-key="${kind}Pension"]`);
    const rateRow=rate.closest('label'),cashRow=cash.closest('label');
    const selectorLabel=create('label',kind==='employee'?'Your pension contribution':'Employer pension contribution'),selector=create('select');selector.id=`pension-unit-${owner}-${kind}`;selectorLabel.htmlFor=selector.id;
    for(const [value,text] of Object.entries({percent:'Percentage of base pay',amount:'Yearly amount',unknown:'I don’t know yet'}))selector.add(new Option(text,value));selectorLabel.append(selector);rateRow.before(selectorLabel);
    const equivalent=create('small');equivalent.className='pay-entry-help';cashRow.after(equivalent);
    function show(){const p=getPay();rateRow.hidden=selector.value!=='percent';cashRow.hidden=selector.value!=='amount';equivalent.textContent=selector.value==='unknown'?'Not included until you add it. Check your payslip or pension statement.':selector.value==='percent'?`Equivalent: £${new Intl.NumberFormat('en-GB',{maximumFractionDigits:2}).format((p.annualGross||0)*(p[`${kind}PensionRate`]||0)/100)} per year`:(p.annualGross?`Equivalent: ${Math.round((p[`${kind}Pension`]||0)/p.annualGross*10000)/100}% of base pay`:'Add base salary to see the equivalent percentage.');}
    selector.addEventListener('change',()=>{const p=getPay(),key=selector.value==='percent'?`${kind}PensionRate`:`${kind}Pension`,other=key.endsWith('Rate')?`${kind}Pension`:`${kind}PensionRate`;const converted=pensionEntryEquivalent(p,kind,selector.value);if(converted===null){selector.value=p[`${kind}Pension`]>0?'amount':'percent';show();equivalent.textContent='Add base salary before changing contribution units.';return;}update({[`${kind}PensionUnknown`]:selector.value==='unknown',[`${kind}PensionUnit`]:selector.value});if(selector.value==='unknown'){rate.value='';cash.value='';rate.dispatchEvent(new Event('input',{bubbles:true}));}else {const target=key.endsWith('Rate')?rate:cash,paired=other.endsWith('Rate')?rate:cash;paired.value='';target.value=String(Math.round(converted*100)/100);target.dispatchEvent(new Event('input',{bubbles:true}));}show();});
    pensionControls.push({sync(){const p=getPay();selector.value=p[`${kind}PensionUnknown`]?'unknown':['amount','percent'].includes(p[`${kind}PensionUnit`])?p[`${kind}PensionUnit`]:p[`${kind}Pension`]>0?'amount':'percent';show();},show});
  }
  const balanceLabel=create('label'),balance=create('input');balance.type='checkbox';balance.id=`pension-balance-unknown-${owner}`;balanceLabel.className='pay-unknown-check';balanceLabel.append(balance,document.createTextNode('Pension balance still to add'));
  const finding=create('small','Find your current pension value on your provider’s statement or website. Unentered balances are excluded from the projection.');finding.className='pay-entry-help';card.append(balanceLabel,finding);
  balance.addEventListener('change',()=>update({pensionBalanceUnknown:balance.checked}));
  return {sync(){const p=getPay();frequency.value=Object.hasOwn(PAY_PERIODS,p.takeHomeFrequency)?p.takeHomeFrequency:(p.annualTakeHome==null?'monthly':'yearly');amount.value=p.annualTakeHome==null?'':String(Math.round(p.annualTakeHome/PAY_PERIODS[frequency.value]*100)/100);balance.checked=Boolean(p.pensionBalanceUnknown);pensionControls.forEach(control=>control.sync());},refresh(){pensionControls.forEach(control=>control.show());}};
}
