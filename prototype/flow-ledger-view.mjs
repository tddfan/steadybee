/** One dated entry list; amounts and statuses are supplied by the existing cash-flow engine. */
const make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;};
export function mountFlowLedger(host,{money,monthLabel,editEntry,editDated,addEntry,editIncome,editSpending}){
 let filter='all',summary=null;
 host.querySelector('.flow-input-heading').innerHTML='<div><h2 id="flow-input-title">Monthly Entries</h2><small id="flow-entry-period"></small></div><button id="flow-entry-add" class="button button-secondary" type="button">+ Add entry</button>';
 const filters=make('div','entry-filter-pills');filters.setAttribute('role','group');filters.setAttribute('aria-label','Filter monthly entries');
 for(const [key,label] of [['all','All'],['income','Income'],['spending','Spending'],['scheduled','Scheduled']]){const b=make('button','',label);b.type='button';b.dataset.entryFilter=key;b.addEventListener('click',()=>{filter=key;draw();});filters.append(b);}
 host.querySelector('.flow-input-heading').after(filters);
 const overview=host.querySelector('#flow-entry-overview'),state=host.querySelector('#flow-state-records'),scheduled=host.querySelector('#flow-dated-list');host.append(state,scheduled);const oldPair=host.querySelector('.flow-record-pair');if(oldPair)oldPair.hidden=true;
 host.querySelector('#flow-entry-add').addEventListener('click',()=>addEntry(filter,filter==='scheduled'));
 function button(item,side,note,onEdit){const row=make('button','flow-entry-row');row.type='button';row.dataset.direction=side==='spending'?'out':'in';row.setAttribute('aria-label',`Edit ${item.label}, ${money(item.amount)}`);if(item.key?.startsWith('entry:'))row.dataset.flowScheduleEntry=item.key.slice(6);const title=make('span','flow-entry-name',item.label.replace(/ estimated payment$/,''));if(note)title.append(make('small','',note));if(['rent','mortgage'].includes(item.kind))title.append(make('small','flow-linked-badge','Linked'));row.append(title,make('span','flow-entry-money',`${side==='spending'?'−':''}${money(item.amount)}`),make('span','flow-entry-arrow','›'));row.addEventListener('click',()=>onEdit?onEdit(row):editEntry(item,side));return row;}
 function draw(){
  if(!summary)return;for(const b of filters.children)b.setAttribute('aria-pressed',String(b.dataset.entryFilter===filter));host.querySelector('#flow-entry-period').textContent=`${monthLabel(summary.asOfMonth)} · monthly amounts`;
  overview.replaceChildren();state.hidden=!['all','income'].includes(filter);scheduled.replaceChildren();scheduled.hidden=!['all','scheduled'].includes(filter);
  for(const [title,side,items] of [['Income','income',summary.sources.filter(x=>!['gap','statePension'].includes(x.kind))],['Spending','spending',summary.uses.filter(x=>!['unallocated','saving'].includes(x.kind))]]){
   if(!['all',side].includes(filter))continue;const group=make('section','flow-entry-column');group.append(make('h3','',title));
   for(const item of items){const dated=summary.entryDetails.find(e=>`entry:${e.id}`===item.key);group.append(button(item,side,dated?`${dated.startMonth?monthLabel(dated.startMonth):'Already started'}${dated.endMonth?` – ${monthLabel(dated.endMonth)}`:' · ongoing'}`:null));}
   if(!items.length)group.append(make('p','flow-entry-empty',`No ${side==='income'?'income':'spending'} entered.`));
   const edit=make('button','flow-entry-add',side==='income'?'Salary & other income':'Manage spending categories');edit.type='button';edit.addEventListener('click',side==='income'?editIncome:editSpending);group.append(edit);overview.append(group);
  }

  // The active monthly row already represents an active dated entry; never duplicate it in All.
  const dated=summary.entryDetails.filter(e=>filter==='scheduled'||e.status!=='active');
  if(!scheduled.hidden){scheduled.append(make('h3','',filter==='scheduled'?'Scheduled entries':'Upcoming & past entries'));for(const entry of dated){const note=`${entry.status==='future'?'Starts':entry.status==='ended'?'Ended':'Active'} ${entry.startMonth?monthLabel(entry.startMonth):'now'}${entry.endMonth?` – ${monthLabel(entry.endMonth)}`:''}${entry.frequency==='once'?' · one-off':' · monthly average'}`,row=button({label:entry.label,amount:entry.frequency==='once'?entry.amount:entry.monthlyAmount},entry.side,note,row=>editDated(entry.side,entry.id,row));row.dataset.flowEntry=entry.id;scheduled.append(row);}
   if(!dated.length)scheduled.append(make('p','flow-entry-empty','No scheduled entries.'));
  }
  host.querySelector('#flow-scheduled-card')?.setAttribute('hidden','');
 }
 return {update:value=>{summary=value;draw();},get filter(){return filter;}};
}
