import {calculateEstate,createInheritanceIllustration,estateDefaults,validateEstateSettings,equalChildren,estateOwnership,estateOwnedValue,RELATIONSHIPS} from './inheritance.mjs?v=20261024inheritance1';
import {projectPlan} from './planning.mjs?v=20261024persona1';
import {ASSET_TYPES,DEBT_TYPES} from './asset-ledger.mjs?v=20261022cashflow2';
import {formatGroupedNumberInputs,groupedNumberValue} from './grouped-number-input.mjs?v=20261022grouped1';
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
const money=value=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(value);
export function mountInheritance(root,getInputs) {
  const initial=()=>createInheritanceIllustration(getInputs().holdings,getInputs().flow.timelineStartMonth || getInputs().flow.asOfMonth);
  let state=initial(),cacheKey='',projection=null,lastResult=null;
  const $=id=>root.querySelector(`#${id}`);
  root.innerHTML=`<div class="estate-heading"><div><h1 id="inheritance-title" tabindex="-1">What could your family inherit?</h1><p id="estate-description" class="muted">A simple estimate, using your recorded assets.</p></div><button id="estate-method" class="heading-action" type="button" aria-label="Inheritance calculation details and export" title="Calculation details and export">ⓘ</button></div>
    <section class="estate-card estate-setup" aria-label="Inheritance scenario">
      <div class="estate-simple-inputs"><label>Whose assets?<select id="estate-owner"></select></label><label class="estate-child-control">Children<input id="estate-child-count" type="number" min="1" max="20" step="1" value="2" aria-label="Number of children"></label><label id="estate-relationship-field">Your relationship<select id="estate-couple-relationship"><option value="unconfirmed">Choose relationship</option><option value="married">Married / civil partners</option><option value="unmarried">Unmarried partners</option></select></label></div>
      <p id="estate-simple-assumptions" class="estate-assumption-line"></p>
      <details id="estate-scenario-settings" class="estate-details"><summary>Change assumptions</summary>
        <div class="estate-toolbar"><label>Asset values<select id="estate-basis"><option value="current">Today’s recorded balances</option><option value="projected">Planning scenario balances</option></select></label><label><span id="estate-date-label">Assumed death date</span><input id="estate-date" type="date" min="2026-04-06" max="2200-12-31"></label></div>
        <div id="estate-couple-options" hidden><div class="estate-toolbar"><label>Who dies first?<select id="estate-first-owner"></select></label><label>First death date<input id="estate-first-date" type="date" min="2026-04-06" max="2200-12-31"></label><label>Who inherits first?<select id="estate-couple-route"><option value="survivor">Surviving partner, then children</option><option value="direct">Children at each death</option></select></label></div>
        <label class="estate-check"><input id="estate-route-confirmed" type="checkbox">Assume wills, ownership and pension nominations follow this route</label><label class="estate-check"><input id="estate-descendants-confirmed" type="checkbox">Assume children are descendants of both parents and both lived in the selected home</label>
        <details class="estate-details"><summary>Funeral costs</summary><div class="estate-fields"><label><span id="estate-primary-cost-label">First person</span><input id="estate-primary-costs" type="text" data-grouped-number inputmode="decimal" min="0" max="1000000000" step=".01"></label><label><span id="estate-partner-cost-label">Other person</span><input id="estate-partner-costs" type="text" data-grouped-number inputmode="decimal" min="0" max="1000000000" step=".01"></label></div></details></div>
        <label class="estate-field">Home left to children<select id="estate-home"><option value="">No qualifying home</option></select></label><p id="estate-home-help" class="muted"></p>
        <label class="estate-check"><input id="estate-uk" type="checkbox">Assume standard UK estate rules apply</label><div id="estate-pension-confirmations"><label class="estate-check"><input id="estate-pensions" type="checkbox">Assume pensions are standard unused defined contribution funds</label><label class="estate-check"><input id="estate-nominations" type="checkbox">Assume pension nominations follow the same inheritance split</label></div>
        <details class="estate-details"><summary>Earlier spouse’s allowances &amp; funeral costs</summary><div class="estate-fields"><label>Unused basic allowance transferred (%)<input id="estate-transfer-basic" type="number" min="0" max="100" step=".01"></label><label>Unused home allowance transferred (%)<input id="estate-transfer-residence" type="number" min="0" max="100" step=".01"></label><label>Deductible funeral costs (£)<input id="estate-costs" type="text" data-grouped-number inputmode="decimal" min="0" max="1000000000" step=".01"></label></div><p class="muted">Only include verified unused allowances from a late spouse or civil partner.</p></details>
        <label class="estate-check"><input id="estate-complex" type="checkbox">Gifts in the last 7 years, trusts, overseas assets or special reliefs apply</label><p id="estate-pension-rule" class="muted"></p>
      </details>
    </section>
    <p id="estate-error" class="form-error" role="alert" hidden></p>
    <section class="estate-card estate-answer" aria-label="Inheritance estimate">
      <div class="estate-answer-heading"><h2>What’s left to pass on</h2><span id="estate-value-basis" class="muted">Today’s balances · future death rules</span></div>
      <div class="estate-kpis"><div><span>After debts, before tax</span><strong id="estate-before-tax">—</strong></div><div><span>Inheritance Tax</span><strong id="estate-tax">—</strong></div><div class="estate-net"><span id="estate-net-label">To your children</span><strong id="estate-net">—</strong></div></div>
      <div id="estate-tax-visual" class="estate-tax-visual" hidden><div class="estate-tax-track" aria-hidden="true"><span id="estate-kept-bar"></span><span id="estate-tax-bar"></span></div><p id="estate-tax-caption" class="muted"></p></div>
      <p id="estate-status" class="estate-status" role="status"></p><p id="estate-pension-tax" class="estate-result-footnote" hidden>Pension beneficiaries may also pay Income Tax; that is not included.</p>
    </section>
    <section class="estate-card"><div class="estate-section-heading"><h2 id="estate-recipients-title">Each child receives</h2></div><div id="estate-distribution" aria-live="polite"></div>
      <details id="estate-recipient-settings" class="estate-details"><summary>Names &amp; custom shares</summary><p class="muted">Shares are before Inheritance Tax. The estate pays the tax from non-exempt shares.</p><div class="estate-section-heading"><span id="estate-share-total" class="muted"></span><button id="estate-add-person" type="button" class="heading-action">＋ Add recipient</button></div><div id="estate-beneficiaries"></div><button id="estate-split-children" type="button" class="heading-action">Use equal child shares</button><p id="estate-replace-note" class="muted" hidden>Changing the number of children replaces custom shares.</p></details>
    </section>
    <details class="estate-card estate-details"><summary>Assets &amp; calculation breakdown</summary><div class="estate-amounts"><span id="estate-gross-label">Estate assets</span><strong id="estate-gross">—</strong><span>Debts &amp; costs</span><strong id="estate-deductions">—</strong></div><div id="estate-stages" class="estate-grid" hidden></div><div class="estate-section-heading"><h2>Assets included</h2><span id="estate-ownership-label" class="muted"></span></div><div id="estate-assets"></div><details class="estate-details"><summary>Adjust ownership &amp; debt shares</summary><p class="muted">Joint items default to 50% each. Changes here apply only to this illustration.</p><div id="estate-ownership"></div></details></details>
    <details id="estate-limits" class="estate-card estate-details"><summary id="estate-warnings-title">Assumptions &amp; limits</summary><p id="estate-snapshot-note" class="muted"></p><ul id="estate-warnings"></ul><p>UK rules, no recent gifts or special reliefs. Current balances stay fixed between deaths: no future growth, survivor spending or income is modelled. Choosing Planning balances uses the first death month; values still stay fixed afterwards. Tax thresholds are held constant. Home and pension gifts follow the selected shares; actual wills and pension nominations may differ. Beneficiary pension Income Tax is excluded.</p><p><a href="https://www.gov.uk/inheritance-tax" target="_blank" rel="noopener noreferrer">GOV.UK Inheritance Tax rules ↗</a> · <a href="https://www.gov.uk/government/publications/inheritance-tax-on-pensions-technical-note/technical-note-inheritance-tax-on-pensions" target="_blank" rel="noopener noreferrer">Pension rules ↗</a></p></details>
    <dialog id="estate-method-dialog" class="form-dialog"><div class="estate-section-heading"><h2>Inheritance calculation</h2><button id="estate-method-close" type="button" class="heading-action" aria-label="Close inheritance calculation">×</button></div><p id="estate-method-basis" class="muted"></p><dl id="estate-calculation" class="estate-calculation"></dl><p>Nominal pounds. Before any beneficiary pension Income Tax.</p><button id="estate-export" class="button button-primary" type="button">Export CSV for Excel</button><p id="estate-export-status" role="status"></p></dialog>`;
  function holdingsForDate(){
    const {holdings,flow,planning}=getInputs();
    if(state.basis==='current')return {holdings,note:state.owner==='couple' ? `Current recorded balances held fixed between ${state.couple.firstDeathDate} and ${state.deathDate}. No survivor income/spending.` : `Current recorded balances · death-date rules for ${state.deathDate}. No growth applied.`};
    const key=JSON.stringify([holdings,flow,planning.scenario]);
    if(key!==cacheKey){projection=projectPlan(flow,holdings,{...planning.scenario,captureEstateBalances:true});cacheKey=key;}
    const month=(state.owner==='couple' ? state.couple.firstDeathDate : state.deathDate).slice(0,7),row=projection.months.find(item=>item.month===month);
    if(!row)throw new Error(`Choose a date within Planning: ${projection.startMonth} to ${projection.endMonth}.`);
    return {holdings:{...holdings,assets:row.estateAssets,debts:row.estateDebts},note:state.owner==='couple' ? `Planning · ${month} closing balances held fixed to ${state.deathDate}. No survivor income/spending.` : `Planning scenario · ${month} closing balances · future pounds. Not a survivor projection.`,projection};
  }
  function error(message){$('estate-error').textContent=message;$('estate-error').hidden=!message;}
  function renderBeneficiaries(){
    const list=$('estate-beneficiaries');list.replaceChildren();
    if(!state.beneficiaries.length)list.append(el('p','estate-empty','Choose a number of children, or add a beneficiary.'));
    for(const person of state.beneficiaries){
      const row=el('div','estate-person');row.dataset.beneficiary=person.id;
      const name=el('input');name.value=person.name;name.maxLength=60;name.dataset.beneficiaryField='name';name.setAttribute('aria-label','Beneficiary name');
      const relationship=el('select');relationship.dataset.beneficiaryField='relationship';relationship.setAttribute('aria-label',`${person.name}: relationship`);
      for(const [value,label] of Object.entries(RELATIONSHIPS))relationship.add(new Option(label,value));relationship.value=person.relationship;
      const percent=el('input');percent.type='number';percent.min=0;percent.max=100;percent.step='any';percent.value=Number(person.percent.toFixed(3));percent.dataset.beneficiaryField='percent';percent.setAttribute('aria-label',`${person.name}: share percent`);
      const amount=el('label','estate-percent');amount.append(percent,document.createTextNode('%'));
      const remove=el('button','heading-action','×');remove.type='button';remove.dataset.removeBeneficiary=person.id;remove.setAttribute('aria-label',`Remove ${person.name}`);
      row.append(name,relationship,amount,remove);list.append(row);
    }
    $('estate-replace-note').hidden=!state.beneficiaries.length;
  }
  function sync(){
    const {holdings}=getInputs();if(['partner','couple'].includes(state.owner) && !holdings.partnerName)state.owner='primary';
    const owner=$('estate-owner');owner.replaceChildren(new Option(holdings.name || 'You','primary'));if(holdings.partnerName){owner.add(new Option(holdings.partnerName,'partner'));owner.add(new Option('Both of us','couple'));}owner.value=state.owner;
    const pair=state.owner==='couple';$('estate-couple-options').hidden=!pair;$('estate-description').textContent='A simple estimate of what reaches your family after Inheritance Tax.';$('estate-relationship-field').hidden=!pair;$('estate-date-label').textContent=pair ? 'Second death date' : 'Assumed death date';$('estate-gross-label').textContent=pair ? 'Family assets' : 'Estate in scope';
    const first=$('estate-first-owner');first.replaceChildren(new Option(holdings.name || 'You','primary'),new Option(holdings.partnerName || 'Other parent','partner'));first.value=state.couple.firstOwner;
    for(const [id,key] of [['estate-couple-route','route'],['estate-couple-relationship','relationship'],['estate-first-date','firstDeathDate'],['estate-primary-costs','primaryCosts'],['estate-partner-costs','partnerCosts']])$(id).value=state.couple[key];
    for(const [id,key] of [['estate-route-confirmed','routeConfirmed'],['estate-descendants-confirmed','descendantsConfirmed']])$(id).checked=state.couple[key];
    $('estate-primary-cost-label').textContent=`${holdings.name || 'First person'} · deductible funeral costs (£)`;$('estate-partner-cost-label').textContent=`${holdings.partnerName || 'Other person'} · deductible funeral costs (£)`;
    $('estate-costs').closest('details').hidden=pair;$('estate-home-help').textContent=pair ? 'Select only a home both parents lived in. Descendant shares and eligibility are checked at each estate.' : 'Select only a home this person lived in. Its share follows the beneficiary percentages.';$('estate-costs').closest('label').hidden=pair;$('estate-transfer-basic').closest('label').hidden=pair;$('estate-transfer-residence').closest('label').hidden=pair;
    for(const [id,key] of [['estate-basis','basis'],['estate-date','deathDate'],['estate-transfer-basic','transferBasicPercent'],['estate-transfer-residence','transferResidencePercent'],['estate-costs','costs']])$(id).value=state[key];
    for(const [id,key] of [['estate-uk','ukScopeConfirmed'],['estate-pensions','standardPensionsConfirmed'],['estate-nominations','pensionSplitConfirmed'],['estate-complex','complexEstate']])$(id).checked=state[key];
    if(state.beneficiaries.length && state.beneficiaries.every(person=>person.relationship==='child'))$('estate-child-count').value=state.beneficiaries.length;
    renderBeneficiaries();renderAssumptions();formatGroupedNumberInputs(root);
  }
  function renderAssumptions(){
    const {holdings,flow}=getInputs(),base=flow.timelineStartMonth || flow.asOfMonth || '2026-10';
    const name=owner=>owner==='primary' ? holdings.name || 'You' : holdings.partnerName || 'Partner';
    const ageAt=(owner,date)=>{const age=owner==='primary' ? holdings.age : holdings.partnerAge;return Number.isFinite(age) ? age+Math.floor((Number(date.slice(0,4))*12+Number(date.slice(5,7))-Number(base.slice(0,4))*12-Number(base.slice(5,7)))/12) : null;};
    const at=(owner,date)=>{const age=ageAt(owner,date);return `${name(owner)} ${age===null ? date.slice(0,4) : `at ${age}`}`;};
    const pair=state.owner==='couple',second=state.couple.firstOwner==='primary' ? 'partner' : 'primary';
    const timing=pair ? `${at(state.couple.firstOwner,state.couple.firstDeathDate)}, then ${at(second,state.deathDate)}` : at(state.owner,state.deathDate);
    const route=pair ? state.couple.route==='survivor' ? 'Partner first, then children' : 'Children at each death' : 'Selected recipients';
    const home=holdings.assets.find(a=>a.id===state.residenceAssetId);
    const summary=el('span','',`Assumed deaths: ${timing}. ${route}.`);
    const basis=el('span','',state.basis==='current' ? 'Today’s balances held fixed; no future spending or growth.' : 'Planning balances at the first death, held fixed afterwards.');
    const homeNote=el('span','',home ? `Home allowance assumed for ${home.label || 'your home'}.` : 'No home allowance selected.');
    $('estate-simple-assumptions').replaceChildren(summary,basis,homeNote);
    const children=state.beneficiaries.length>0 && state.beneficiaries.every(p=>p.relationship==='child');
    $('estate-net-label').textContent=children ? 'To your children' : 'To your recipients';
    $('estate-recipients-title').textContent=children ? 'Each child receives' : 'Who receives it';
    $('estate-value-basis').textContent=state.basis==='current' ? 'Today’s balances · future death rules' : 'Planning balances · future pounds';
  }
  function methodRows(result){if(result.couple){const rows=[];for(const [label,r] of [['First estate',result.first],['Second estate',result.second]])rows.push([`${label}: assets in scope`,r.grossEstate],[`${label}: debts / costs`,-(r.debt+r.costs)],[`${label}: basic band`,r.basicBand],[`${label}: residence band`,r.residenceBand],[`${label}: estate tax`,r.estateTax],[`${label}: after estate tax`,r.afterEstateTax]);return [...rows,['Unused basic band transferred',325000*result.transferBasicPercent/100],['Unused residence band transferred',175000*result.transferResidencePercent/100],['Family estate tax total',result.estateTax],['Children after estate tax',result.afterEstateTax]];}return [
    ['Estate assets in scope',result.grossEstate],['Debts',-result.debt],['Deductible funeral costs',-result.costs],['Net estate before exemptions',result.netEstate],['Spouse / civil partner exemption',-result.spouseExemption],['Basic nil-rate band',result.basicBand],['Residence band after taper / home cap',result.residenceBand],['Taxable estate',result.taxableEstate],['Estate tax at 40%',result.estateTax],['Pensions outside estate',result.outsideEstate],['After estate tax',result.afterEstateTax],
  ];}
  function renderResult(){
    error('');lastResult=null;$('estate-export').disabled=true;$('estate-distribution').replaceChildren();
    renderAssumptions();$('estate-tax-visual').hidden=true;$('estate-pension-tax').hidden=true;
    for(const id of ['estate-gross','estate-deductions','estate-tax','estate-net','estate-before-tax'])$(id).textContent='—';
    $('estate-share-total').textContent=`Shares: ${Number(state.beneficiaries.reduce((sum,p)=>sum+p.percent,0).toFixed(2))}% of 100%`;
    $('estate-status').textContent='Add beneficiaries whose shares total 100% to see the estimate.';
    $('estate-stages').replaceChildren();$('estate-stages').hidden=true;
    $('estate-calculation').replaceChildren();$('estate-assets').replaceChildren();$('estate-ownership').replaceChildren();$('estate-warnings').replaceChildren();
    try{
      const snapshot=holdingsForDate(),holdings=snapshot.holdings;
      $('estate-snapshot-note').textContent=snapshot.note;$('estate-method-basis').textContent=snapshot.note;
      $('estate-ownership-label').textContent=state.owner==='couple' ? 'Both parents’ shares' : `${state.owner==='primary' ? holdings.name || 'You' : holdings.partnerName}’s share`;
      const home=$('estate-home');home.replaceChildren(new Option('No qualifying home selected',''));
      for(const asset of holdings.assets.filter(item=>['home','other-property'].includes(item.kind) && estateOwnership(item,state)>0))home.add(new Option(asset.label || ASSET_TYPES[asset.kind].label,asset.id));
      home.value=state.residenceAssetId;
      const hasPension=holdings.assets.some(item=>item.kind==='dc-pension' && estateOwnership(item,state)>0);
      $('estate-pension-confirmations').hidden=!hasPension;$('estate-pension-tax').hidden=!hasPension;
      $('estate-pension-rule').textContent=hasPension ? (state.owner==='couple' ? 'Pension IHT rules are applied separately at each death date.' : state.deathDate>='2027-04-06' ? 'Standard unused DC funds included in IHT from 6 April 2027.' : 'Before 6 April 2027: standard discretionary DC funds assumed outside IHT.') : '';
      const ownership=$('estate-ownership');ownership.replaceChildren();
      if(state.owner==='couple')ownership.append(el('p','muted',`Ownership fields: ${holdings.name || 'First parent'} %, then ${holdings.partnerName} %.`));
      for(const [items,debt] of [[holdings.assets,false],[holdings.debts,true]])for(const item of items){
        const row=el('label','estate-ownership-row');row.append(el('span','',`${item.label || (debt ? DEBT_TYPES : ASSET_TYPES)[item.kind]?.label || item.kind}${debt ? ' · debt' : ''}`));
        for(const owner of state.owner==='couple' ? ['primary','partner'] : [state.owner]){const input=el('input');input.type='number';input.min=0;input.max=100;input.step='.01';input.value=estateOwnership(item,{...state,owner})*100;input.dataset.ownershipId=item.id;input.dataset.shareOwner=owner;input.setAttribute('aria-label',`${item.label || item.kind}: ${owner==='primary' ? holdings.name || 'You' : holdings.partnerName} ownership percent`);row.append(input,document.createTextNode('%'));}ownership.append(row);
      }
      const groups=new Map();
      for(const asset of holdings.assets){const amount=estateOwnedValue(asset,state);if(!amount)continue;const old=groups.get(asset.kind)||0;groups.set(asset.kind,old+amount);}
      const assetList=$('estate-assets');assetList.replaceChildren();
      for(const [kind,value] of groups){const line=el('div','estate-type-row');line.append(el('span','',ASSET_TYPES[kind]?.label || kind),el('strong','',money(value)),el('span','muted',state.owner==='couple' ? 'Starting value' : kind==='dc-pension' && state.deathDate<'2027-04-06' ? 'Outside IHT*' : 'In scope'));assetList.append(line);}
      if(!groups.size)assetList.append(el('p','muted','No assets belong to this person in this snapshot.'));
      const result=calculateEstate(holdings,state);lastResult=result;
      for(const [id,value] of [['estate-gross',result.familyGross ?? result.grossEstate],['estate-deductions',result.debt+result.costs],['estate-tax',result.estateTax],['estate-net',result.afterEstateTax]])$(id).textContent=money(value);
      $('estate-before-tax').textContent=money(result.afterEstateTax+result.estateTax);
      const total=result.afterEstateTax+result.estateTax,taxShare=total>0 ? result.estateTax/total*100 : 0;
      $('estate-tax-visual').hidden=total<=0;$('estate-kept-bar').style.width=`${100-taxShare}%`;$('estate-tax-bar').style.width=`${taxShare}%`;$('estate-tax-caption').textContent=`${Number((100-taxShare).toFixed(1))}% passes on · ${Number(taxShare.toFixed(1))}% Inheritance Tax`;
      if(result.couple){const stages=$('estate-stages');stages.hidden=false;for(const [title,owner,date,r] of [['First estate',result.firstOwner,state.couple.firstDeathDate,result.first],['Second estate',result.secondOwner,state.deathDate,result.second]]){const card=el('section','estate-card'),who=owner==='primary' ? holdings.name || 'You' : holdings.partnerName;card.append(el('h2','',`${title} · ${who}`),el('p','muted',date),el('p','',`Estate tax ${money(r.estateTax)}`),el('strong','',`${money(r.afterEstateTax)} → ${title==='First estate' && result.route==='survivor' ? 'surviving partner' : 'children'}`));stages.append(card);}}
      const warnings=[...result.warnings];
      if(snapshot.projection?.unmodelledDebt>0)warnings.push('Planning has unmodelled debt repayments; projected estate balances are incomplete.');
      if(snapshot.projection?.taxLimitations?.length)warnings.push('Planning has incomplete tax inputs or opening-year history; projected estate balances inherit those assumptions.');
      if(snapshot.projection?.firstUnfundedMonth && snapshot.projection.firstUnfundedMonth<=state.deathDate.slice(0,7))warnings.push('Planning has an earlier funding gap; this estate snapshot is not a fully funded household plan.');
      lastResult={...result,warnings,incomplete:warnings.length>0};
      const actionable=warnings.filter(w=>!w.startsWith('Beneficiary pension Income Tax'));
      $('estate-status').replaceChildren(document.createTextNode(actionable.length ? 'Some details need checking. ' : 'Estimate under the assumptions above. '));
      const limits=el('button','estate-inline-link','Assumptions & limits');limits.type='button';limits.addEventListener('click',()=>{$('estate-limits').open=true;$('estate-limits').scrollIntoView({block:'start',behavior:'smooth'});});$('estate-status').append(limits);
      $('estate-warnings-title').textContent=actionable.length ? `Assumptions & limits · ${actionable.length} to check` : 'Assumptions & limits';
      $('estate-warnings').replaceChildren(...warnings.map(text=>el('li','',text)));
      if(result.liquidityGap>0)$('estate-warnings').append(el('li','',`${money(result.liquidityGap)} of tax exceeds cash and ISAs left after debts and costs. Other assets may need to fund it.`));
      const distribution=$('estate-distribution');
      for(const person of result.beneficiaries){const row=el('div','estate-benefit');const text=el('div');text.append(el('strong','',person.name),el('small','muted',`${Number(person.percent.toFixed(3))}% share · after Inheritance Tax`));row.append(text,el('strong','',money(person.afterEstateTax)));distribution.append(row);}
      const calculation=$('estate-calculation');for(const [label,value] of methodRows(result))calculation.append(el('dt','',label),el('dd','',money(value)));
      $('estate-export').disabled=false;
    }catch(e){if(state.beneficiaries.length)error(e.message);$('estate-status').textContent=!state.beneficiaries.length && e.message.includes('shares must add up') ? 'Choose children or add beneficiaries to see the estimate.' : e.message;}
  }
  function change(mutator,{redraw=false}={}){
    const next=structuredClone(state);mutator(next);
    try{validateEstateSettings(next);state=next;if(redraw)sync();renderResult();document.dispatchEvent(new Event('picture-updated'));}catch(e){error(e.message);}
  }
  function splitChildren(count){
    const children=equalChildren(count);
    if(state.beneficiaries.length===count && state.beneficiaries.every(p=>p.relationship==='child' && Math.abs(p.percent-100/count)<.000001))return;
    change(next=>next.beneficiaries=children.map((p,i)=>({...p,name:next.beneficiaries[i]?.relationship==='child' ? next.beneficiaries[i].name : p.name})),{redraw:true});
  }
  $('estate-child-count').addEventListener('input',event=>{
    const count=Number(event.target.value);
    if(Number.isInteger(count) && count>=1 && count<=20)splitChildren(count);
  });
  root.addEventListener('change',event=>{
    const input=event.target;
    if(input.id==='estate-child-count'){try{splitChildren(Number(input.value));}catch(e){error(e.message);}return;}
    if(input.dataset.beneficiaryField){change(next=>{const person=next.beneficiaries.find(p=>p.id===input.closest('[data-beneficiary]').dataset.beneficiary);person[input.dataset.beneficiaryField]=input.dataset.beneficiaryField==='percent' ? Number(input.value) : input.value;});return;}
    if(input.dataset.ownershipId){change(next=>{const owner=input.dataset.shareOwner || next.owner;next.shares[owner] ||= {};next.shares[owner][input.dataset.ownershipId]=Number(input.value);});return;}
    const coupleKeys={'estate-couple-route':'route','estate-couple-relationship':'relationship','estate-first-owner':'firstOwner','estate-first-date':'firstDeathDate','estate-primary-costs':'primaryCosts','estate-partner-costs':'partnerCosts','estate-route-confirmed':'routeConfirmed','estate-descendants-confirmed':'descendantsConfirmed'};if(coupleKeys[input.id]){change(next=>next.couple[coupleKeys[input.id]]=input.type==='checkbox' ? input.checked : input.hasAttribute('data-grouped-number') ? groupedNumberValue(input) : input.value);return;}
    const keys={'estate-owner':'owner','estate-basis':'basis','estate-date':'deathDate','estate-home':'residenceAssetId','estate-transfer-basic':'transferBasicPercent','estate-transfer-residence':'transferResidencePercent','estate-costs':'costs','estate-uk':'ukScopeConfirmed','estate-pensions':'standardPensionsConfirmed','estate-nominations':'pensionSplitConfirmed','estate-complex':'complexEstate'};
    const key=keys[input.id];if(!key)return;
    change(next=>{
      next[key]=input.type==='checkbox' ? input.checked : input.id==='estate-costs' ? groupedNumberValue(input) : input.type==='number' ? Number(input.value) : input.value;
      if(key==='owner'){
        const {holdings,flow}=getInputs(),month=flow.timelineStartMonth || flow.asOfMonth;
        const people=next.owner==='couple' ? holdings : {...holdings,partnerName:'',age:next.owner==='partner' ? holdings.partnerAge : holdings.age};
        const defaults=createInheritanceIllustration(people,month);
        next.deathDate=defaults.deathDate;
        if(next.owner==='couple'){next.couple.firstOwner=defaults.couple.firstOwner;next.couple.firstDeathDate=defaults.couple.firstDeathDate;}
        const home=holdings.assets.find(a=>a.id===next.residenceAssetId);
        if(home && estateOwnership(home,next)<=0)next.residenceAssetId='';
      }
    },{redraw:key==='owner'});
  });
  $('estate-split-children').addEventListener('click',()=>{try{const children=equalChildren(Number($('estate-child-count').value));change(next=>next.beneficiaries=children,{redraw:true});}catch(e){error(e.message);}});
  $('estate-add-person').addEventListener('click',()=>change(next=>next.beneficiaries.push({id:crypto.randomUUID(),name:`Beneficiary ${next.beneficiaries.length+1}`,relationship:'other',percent:next.beneficiaries.length ? 0 : 100}),{redraw:true}));
  root.addEventListener('click',event=>{const button=event.target.closest('[data-remove-beneficiary]');if(button)change(next=>next.beneficiaries=next.beneficiaries.filter(p=>p.id!==button.dataset.removeBeneficiary),{redraw:true});});
  $('estate-method').addEventListener('click',()=>$('estate-method-dialog').showModal());$('estate-method-close').addEventListener('click',()=>$('estate-method-dialog').close());
  $('estate-export').addEventListener('click',()=>{
    if(!lastResult)return;const rows=[['Section','Item','Amount / value','Notes'],['Basis','Assumed death date',state.deathDate,$('estate-snapshot-note').textContent],...methodRows(lastResult).map(([label,value])=>['Calculation',label,value,'Nominal pounds']),...lastResult.beneficiaries.map(p=>['Beneficiary',p.name,p.afterEstateTax,`${p.percent}%; ${p.relationship}; before beneficiary pension Income Tax`]),...lastResult.assets.map(a=>['Asset',a.label || a.kind,a.value,a.inEstate ? 'Included in estate' : 'Outside IHT']),...lastResult.warnings.map(w=>['Limitation',w,'',''])];
    const quote=v=>{const text=String(v??'');return `"${(typeof v==='string' && /^\s*[=+@\-]|^[\t\r\n]/.test(text) ? "'"+text : text).replaceAll('"','""')}"`;};const blob=new Blob(['\uFEFF'+rows.map(row=>row.map(quote).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),link=el('a');link.href=url;link.download='steadybee-inheritance.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('estate-export-status').textContent='Downloaded. Open the CSV in Excel.';
  });
  function refresh(){sync();renderResult();}
  function restore(value){
    const saved=value ? validateEstateSettings(value) : null;
    const month=getInputs().flow.timelineStartMonth || getInputs().flow.asOfMonth;
    // Upgrade only the old, untouched empty scaffold. Keep customised saved estates.
    state=saved && JSON.stringify(saved)!==JSON.stringify(estateDefaults(month)) ? saved : initial();
    cacheKey='';refresh();
  }
  refresh();return {refresh,restore,snapshot:()=>structuredClone(state)};
}
