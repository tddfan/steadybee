/** Decorative feedback only: never interpolate financial values or delay content. */
export const motionAllowed=({reduced=false,hidden=false}={})=>!reduced&&!hidden;
export function hasMeaningfulSaveChange(before,after){
 const content=p=>({holdings:p?.holdings,flow:p?.flow?Object.fromEntries(Object.entries(p.flow).filter(([key])=>key!=='asOfMonth')):null,scenario:p?.planning?.scenario,experiments:p?.planning?.experiments,baselines:p?.baselines,inheritance:p?.inheritance,insights:p?.insights});
 return JSON.stringify(content(before))!==JSON.stringify(content(after));
}
const active=new Set();let preference=null;
function enabled(){if(typeof document==='undefined'||typeof matchMedia!=='function')return false;if(!preference){preference=matchMedia('(prefers-reduced-motion: reduce)');preference.addEventListener('change',()=>{if(preference.matches)for(const animation of [...active])animation.cancel();});document.addEventListener('visibilitychange',()=>{if(document.hidden)for(const animation of [...active])animation.cancel();});}return motionAllowed({reduced:preference.matches,hidden:document.hidden});}
function play(node,frames,duration,kind){
 if(!node||!enabled()||typeof node.animate!=='function')return;
 for(const animation of node.getAnimations())if(active.has(animation))animation.cancel();
 const animation=node.animate(frames,{duration,easing:'cubic-bezier(.2,.7,.3,1)',iterations:1});active.add(animation);animation.finished.catch(()=>{}).finally(()=>active.delete(animation));
 if(kind)document.dispatchEvent(new CustomEvent('steadybee-motion-start',{detail:{kind}}));
}
export function revealAddedItem(row){if(row){row.focus({preventScroll:true});row.scrollIntoView({block:'nearest',behavior:'instant'});}play(row,[{backgroundColor:'#E5F1FF'},{backgroundColor:'#FFFFFF'}],420,'item');play(row?.querySelector('.asset-icon'),[{opacity:.65,transform:'scale(.94)'},{opacity:1,transform:'scale(1)'}],180);}
export function revealScenario(chart){const layer=chart?.querySelector('.lifeline-scenario-layer,.lifeline-fill-scenario');if(layer)play(layer,[{opacity:.6},{opacity:1}],180,'scenario');else play(chart?.closest('.lifeline-chart-card'),[{boxShadow:'0 0 0 2px rgba(0,122,255,.22)'},{boxShadow:'0 4px 20px rgba(0,0,0,.04)'}],240,'scenario');}
export function completedAction(message,{spoken=false,kind='local'}={}){if(typeof document!=='undefined')document.dispatchEvent(new CustomEvent('steadybee-action-complete',{detail:{message,spoken,kind}}));}
export function mountActionFeedback(){
 if(document.getElementById('action-feedback'))return;
 const host=document.createElement('div');host.id='action-feedback';host.className='action-feedback';host.hidden=true;host.setAttribute('aria-hidden','true');const icon=document.createElement('span');icon.className='action-feedback-icon';icon.textContent='✓';const label=document.createElement('span');host.append(icon,label);
 const live=document.createElement('span');live.id='action-feedback-live';live.className='visually-hidden';live.setAttribute('role','status');live.setAttribute('aria-live','polite');live.setAttribute('aria-atomic','true');document.body.append(host,live);let timer,sequence=0;
 document.addEventListener('steadybee-action-complete',event=>{const detail=event.detail,current=++sequence;clearTimeout(timer);host.hidden=false;host.dataset.kind=detail.kind;label.textContent=detail.message;live.textContent='';if(detail.spoken)requestAnimationFrame(()=>{if(sequence===current)live.textContent=detail.message;});play(icon,[{opacity:.6,transform:'scale(.85)'},{opacity:1,transform:'scale(1)'}],160,'confirmation');timer=setTimeout(()=>{host.hidden=true;},2800);});
}
