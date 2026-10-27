/** Bars for flows, lines elsewhere for balances. All amounts come from deterministic monthly rows. */
const money=n=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(n);
const compact=n=>'£'+new Intl.NumberFormat('en-GB',{notation:'compact',maximumFractionDigits:1}).format(n);
const make=(tag,attrs={},text)=>{const e=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);if(text!=null)e.textContent=text;return e;};
export function appendLifelineFlags(svg,events,{x,top,bottom,onEvent}){
 const clustered=[];
 for(const event of events.filter(e=>['cash','depleted','gap','exhausted'].includes(e.kind))){const at=x(event.date.slice(0,7));let cluster=clustered.find(c=>Math.abs(c.at-at)<18);if(!cluster){cluster={at,events:[]};clustered.push(cluster);}cluster.events.push(event);}
 const priority={gap:0,exhausted:1,depleted:2,cash:3};
 for(const cluster of clustered){
  const items=cluster.events.sort((a,b)=>priority[a.kind]-priority[b.kind]),event=items[0],at=cluster.at,label=items.map(e=>`${e.label} · ${e.date.slice(0,7)}`).join('; '),g=make('g',{class:`lifeline-chart-flag is-${event.kind}`,role:'button',tabindex:0,'aria-label':label});
  g.append(make('line',{x1:at,x2:at,y1:top+14,y2:bottom}),make('circle',{cx:at,cy:top,r:12}),make('text',{x:at,y:top+4,'text-anchor':'middle'},event.kind==='cash'?'C':event.kind==='gap'?'!':'A'),make('title',{},items.map(e=>`${e.label} · ${e.date.slice(0,7)}. ${e.detail}`).join('\n')));
  g.prepend(make('rect',{x:at-22,y:top-22,width:44,height:44,fill:'transparent'}));
  g.addEventListener('pointerdown',e=>e.stopPropagation());g.addEventListener('pointermove',e=>e.stopPropagation());g.addEventListener('click',()=>onEvent(event));g.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();onEvent(event);}});svg.append(g);
 }
}
export function drawLifelineFlowChart(host,{groups,series=[],cashflow=true,comparisonGroups=[],view,selectedMonth,events=[],onInspect,onEvent}){
 host.replaceChildren();host.classList.remove('lifeline-month-bars');host.classList.add('lifeline-flow-chart');
 if(!groups.length){const message=document.createElement('p');message.textContent='No current forecast for this period.';host.append(message);return;}
 const width=Math.max(host.clientWidth,Math.min(760,groups.length*18+72),320),height=320,left=52,right=18,top=50,bottom=46,plot=width-left-right,slot=plot/groups.length;
 const values=cashflow?[...groups,...comparisonGroups].flatMap(r=>[r.moneyIn,r.costs]):series.flatMap(s=>s.rows.map(r=>r.value).filter(Number.isFinite));
 const min=Math.min(0,...values),max=Math.max(1,...values),span=max-min,y=v=>height-bottom-(v-min)/span*(height-top-bottom),x=i=>left+(i+.5)*slot;
 const svg=make('svg',{viewBox:`0 0 ${width} ${height}`,width,role:'img','aria-label':cashflow?'Money in and costs, paired bars. Green: income received; purple: assets used; charcoal: costs paid; red: unpaid costs. Drag to inspect a period.':'Period totals. Use the month control or drag to inspect.'});
 svg.style.minWidth=`${width}px`;
 const defs=make('defs'),pattern=make('pattern',{id:'lifeline-unpaid-hatch',width:6,height:6,patternUnits:'userSpaceOnUse'});pattern.append(make('rect',{width:6,height:6,fill:'#FF3B30'}),make('path',{d:'M-1 1L1 -1 M0 6L6 0 M5 7L7 5',stroke:'white','stroke-width':1,opacity:.55}));defs.append(pattern);svg.append(defs);
 for(let i=0;i<4;i++){const v=min+span*i/3;svg.append(make('line',{x1:left,x2:width-right,y1:y(v),y2:y(v),class:'lifeline-grid'}),make('text',{x:left-8,y:y(v)+4,'text-anchor':'end',class:'lifeline-axis'},compact(v)));}
 const selected=view==='life'?selectedMonth.slice(0,4):selectedMonth;
 function select(key){svg.querySelector('.lifeline-selection-band')?.remove();const i=groups.findIndex(r=>r.key===key);if(i>=0)svg.prepend(make('rect',{x:left+i*slot,y:top-18,width:slot,height:height-bottom-top+18,class:'lifeline-selection-band'}));}
 select(selected);
 const bands=make('g'),outlines=make('g',{class:'lifeline-before-layer'}),layer=make('g',{class:comparisonGroups.length?'lifeline-scenario-layer':'lifeline-flow-layer'});svg.append(bands,outlines,layer);
 const bar=(i,dx,w,value,base,kind,title)=>{if(!Number.isFinite(value)||Math.abs(value)<.001)return;const rect=make('rect',{x:x(i)+dx,y:y(Math.max(base,base+value)),width:w,height:Math.max(.5,Math.abs(y(base)-y(base+value))),rx:2,class:`lifeline-bar is-${kind}`});rect.append(make('title',{},title));layer.append(rect);};
 groups.forEach((r,i)=>{
  if(cashflow){
   const w=Math.max(1,Math.min(28,slot*.32)),gap=Math.max(1,slot*.06),title=`${r.key} · ${r.months} modelled month${r.months===1?'':'s'}`;
   if(r.shortfall>.01)bands.append(make('rect',{x:left+i*slot,y:top-8,width:slot,height:height-bottom-top+8,class:'lifeline-shortfall-band'}));
   const before=comparisonGroups.find(p=>p.key===r.key&&p.startMonth===r.startMonth&&p.endMonth===r.endMonth);if(before)for(const [kind,total,dx] of [['moneyIn',before.moneyIn,-w-gap],['costs',before.costs,gap]]){const outline=make('rect',{x:x(i)+dx-1,y:y(total),width:w+2,height:Math.max(0,y(0)-y(total)),rx:2,class:'lifeline-current-outline','data-kind':kind,'data-key':r.key,'data-total':total});outline.append(make('title',{},`Current outlook ${r.key} · ${kind==='costs'?'costs':'money in'} ${money(total)}`));outlines.append(outline);}
   bar(i,-w-gap,w,r.income,0,'income',`${title}: income received ${money(r.income)}`);bar(i,-w-gap,w,r.withdrawals,r.income,'withdrawals',`${title}: taken from assets ${money(r.withdrawals)}`);
   bar(i,gap,w,r.paid,0,'paid',`${title}: costs paid ${money(r.paid)}`);bar(i,gap,w,r.shortfall,r.paid,'unpaid',`${title}: unpaid costs ${money(r.shortfall)} in ${r.shortMonths} month(s)`);
  }else{const count=series.length,w=Math.min(25,slot*.8/count);series.forEach((s,j)=>{const point=s.rows.find(p=>p.key===r.key);bar(i,-count*w/2+j*w,w*.88,point?.value,0,s.kind,`${r.key} · ${s.label}: ${point?.value==null?'Not available':money(point.value)}`);});}
  const skip=Math.max(1,Math.ceil(groups.length/(width/85)));if(i%skip===0||i===groups.length-1)svg.append(make('text',{x:x(i),y:height-15,'text-anchor':'middle',class:'lifeline-axis'},view==='life'?r.key:new Intl.DateTimeFormat('en-GB',{month:'short',timeZone:'UTC'}).format(new Date(`${r.key}-15T12:00:00Z`))));
 });
 let last=null;const inspect=e=>{const bounds=svg.getBoundingClientRect(),at=(e.clientX-bounds.left)*width/bounds.width,i=Math.max(0,Math.min(groups.length-1,Math.floor((at-left)/slot))),r=groups[i];if(r.key===last)return;last=r.key;select(r.key);onInspect(r.endMonth);};
 svg.addEventListener('pointermove',e=>{if(e.pointerType==='mouse'||e.buttons)inspect(e);});svg.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse')svg.setPointerCapture(e.pointerId);inspect(e);});svg.addEventListener('pointerup',()=>{last=null;});
 const visible=events.filter(e=>e.date.slice(0,7)>=groups[0].startMonth&&e.date.slice(0,7)<=groups.at(-1).endMonth);
 appendLifelineFlags(svg,visible,{x:month=>x(groups.findIndex(r=>month>=r.startMonth&&month<=r.endMonth)),top:24,bottom:height-bottom,onEvent});host.append(svg);
}
