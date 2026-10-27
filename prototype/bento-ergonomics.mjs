/** Native-dialog semantics remain intact; touch gestures are confined to the grab handle. */
export function mountBentoErgonomics(){
 const mobile=()=>matchMedia('(max-width:767px)').matches;
 const bind=dialog=>{
  if(dialog.dataset.bentoSheet)return;dialog.dataset.bentoSheet='true';
  const handle=document.createElement('button');handle.type='button';handle.className='bento-sheet-grab';handle.setAttribute('aria-label','Close sheet');dialog.prepend(handle);
  let drag=null;const dismiss=()=>{if(dialog.dispatchEvent(new Event('cancel',{cancelable:true})))dialog.close();};
  handle.addEventListener('click',()=>{if(mobile()&&!handle.dataset.dragged)dismiss();});
  handle.addEventListener('pointerdown',event=>{if(!mobile()||event.button!==0)return;drag={y:event.clientY,delta:0};delete handle.dataset.dragged;handle.setPointerCapture(event.pointerId);});
  handle.addEventListener('pointermove',event=>{if(!drag)return;drag.delta=Math.max(0,event.clientY-drag.y);if(drag.delta>6)handle.dataset.dragged='true';dialog.style.transform=`translateY(${drag.delta}px)`;});
  for(const type of ['pointerup','pointercancel'])handle.addEventListener(type,()=>{const close=type==='pointerup'&&drag?.delta>90;drag=null;dialog.style.removeProperty('transform');if(close)dismiss();setTimeout(()=>delete handle.dataset.dragged,0);});
  dialog.addEventListener('close',()=>{drag=null;dialog.style.removeProperty('transform');});
 };
 document.querySelectorAll('dialog').forEach(bind);new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1){if(node.matches('dialog'))bind(node);node.querySelectorAll('dialog').forEach(bind);}}).observe(document.body,{childList:true,subtree:true});
}
