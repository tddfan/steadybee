/** Keep device-save updates from replacing the active account-save status. */
export function updateSaveStatus(element,source,message){
  if(!element)return;
  const key=source==='account'?'accountSaveStatus':'deviceSaveStatus';
  if(message==null)delete element.dataset[key];else element.dataset[key]=message;
  element.textContent=element.dataset.accountSaveStatus||element.dataset.deviceSaveStatus||'';
}
