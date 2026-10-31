/** Native dialog semantics, with an interruptible spring confined to the grab handle. */
export function sheetShouldDismiss(distance,velocity,height){return distance>Math.max(90,height*.22)||(distance>12&&velocity>.6);}
export function mountBentoErgonomics(){
 const mobile=()=>matchMedia('(max-width:767px)').matches,reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 const bind=dialog=>{
  if(dialog.dataset.bentoSheet)return;dialog.dataset.bentoSheet='true';
  const handle=document.createElement('button');handle.type='button';handle.className='bento-sheet-grab';handle.setAttribute('aria-label','Close sheet');dialog.prepend(handle);
  let drag=null,position=0,frame=0;
  const stop=()=>{cancelAnimationFrame(frame);frame=0;};
  const paint=()=>{dialog.style.transform=`translateY(${position}px)`;};
  const dismiss=()=>{if(dialog.dispatchEvent(new Event('cancel',{cancelable:true})))dialog.close();else settle(0,0,false);};
  function settle(target,velocity,closing){
   stop();if(reduced()){position=0;dialog.style.removeProperty('transform');if(closing)dismiss();return;}
   let previous=performance.now(),speed=velocity*1000;
   const step=now=>{const dt=Math.min(.025,(now-previous)/1000);previous=now;speed+=((target-position)*360-speed*38)*dt;position+=speed*dt;paint();if(Math.abs(target-position)<.5&&Math.abs(speed)<6){frame=0;if(closing)dismiss();else{position=0;dialog.style.removeProperty('transform');}return;}frame=requestAnimationFrame(step);};frame=requestAnimationFrame(step);
  }
  handle.addEventListener('click',()=>{if(mobile()&&!handle.dataset.dragged)dismiss();});
  handle.addEventListener('pointerdown',event=>{if(!mobile()||event.button!==0)return;stop();drag={start:event.clientY,base:position,last:event.clientY,time:performance.now(),velocity:0,distance:0};delete handle.dataset.dragged;handle.setPointerCapture(event.pointerId);});
  handle.addEventListener('pointermove',event=>{if(!drag)return;const now=performance.now(),dt=Math.max(1,now-drag.time);drag.velocity=(event.clientY-drag.last)/dt;drag.last=event.clientY;drag.time=now;drag.distance=event.clientY-drag.start;if(Math.abs(drag.distance)>6)handle.dataset.dragged='true';position=Math.max(0,drag.base+drag.distance);paint();});
  for(const type of ['pointerup','pointercancel'])handle.addEventListener(type,()=>{if(!drag)return;const velocity=performance.now()-drag.time>90?0:drag.velocity,close=type==='pointerup'&&sheetShouldDismiss(position,velocity,dialog.getBoundingClientRect().height);drag=null;settle(close?dialog.getBoundingClientRect().height+24:0,velocity,close);setTimeout(()=>delete handle.dataset.dragged,0);});
  dialog.addEventListener('close',()=>{stop();drag=null;position=0;dialog.style.removeProperty('transform');});
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',()=>{stop();position=0;dialog.style.removeProperty('transform');});
 };
 document.querySelectorAll('dialog').forEach(bind);new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1){if(node.matches('dialog'))bind(node);node.querySelectorAll('dialog').forEach(bind);}}).observe(document.body,{childList:true,subtree:true});
}
