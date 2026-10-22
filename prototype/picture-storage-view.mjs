import {PICTURE_STORAGE_KEY,createProtection,encryptPicture,decryptPicture} from './picture-storage.mjs?v=20261022retirement1';
import {updateSaveStatus} from './save-status.mjs?v=20261017profile1';

/** Optional local persistence; callers supply facts and scenario inputs, never results. */
export function mountPictureStorage({button,getPicture,restorePicture,clearTab}) {
  let store;try{store=window.localStorage;}catch{store=null;}
  let protection=null,enabled=false,epoch=0,timer=null,activeSave=Promise.resolve(),again=false,lastSaved='',failed=false,staged=null;
  const dialog=document.createElement('dialog');dialog.id='picture-storage-dialog';dialog.className='form-dialog storage-dialog';dialog.setAttribute('aria-labelledby','storage-title');
  dialog.innerHTML=`<div class="dialog-heading"><h2 id="storage-title">Encrypted device backup</h2><button id="storage-close" class="icon-button" type="button" aria-label="Close backup options">×</button></div>
    <p id="storage-message">This optional backup is encrypted on this device, so it needs a passphrase. To save online without a passphrase, use your Steadybee account.</p>
    <p id="storage-error" class="form-error" role="alert" hidden></p><p id="storage-result" role="status"></p>
    <section id="storage-resume"><h3>Resume saved picture</h3><form id="storage-unlock-form"><label>Passphrase<input id="storage-unlock-password" type="password" autocomplete="current-password" required maxlength="1024" /></label><button class="button button-primary" type="submit">Unlock saved picture</button></form></section>
    <details id="storage-new"><summary id="storage-new-label">Create encrypted backup</summary><form id="storage-create-form"><p>Choose at least 12 characters. Keep the passphrase safe: it cannot be recovered. Changes save automatically while this picture is unlocked.</p><label>New passphrase<input id="storage-new-password" type="password" autocomplete="new-password" minlength="12" maxlength="1024" required /></label><label>Confirm passphrase<input id="storage-confirm-password" type="password" autocomplete="new-password" minlength="12" maxlength="1024" required /></label><label id="storage-replace-label" class="storage-check"><input id="storage-replace" type="checkbox" /> Replace this browser’s existing saved picture with the current tab</label><button class="button button-primary" type="submit">Save encrypted copy</button></form></details>
    <div id="storage-active"><p>Saved with encryption. Returning to this picture needs your passphrase.</p><div class="storage-actions"><button id="storage-backup" class="button button-secondary" type="button">Download encrypted backup</button><button id="storage-lock" class="button button-secondary" type="button">Lock picture</button></div></div>
    <details id="storage-import"><summary>Import an encrypted backup</summary><form id="storage-import-form"><label>Steadybee backup (.json)<input id="storage-file" type="file" accept="application/json,.json" required /></label><label>Backup passphrase<input id="storage-import-password" type="password" autocomplete="off" required maxlength="1024" /></label><button class="button button-secondary" type="submit">Check backup</button></form></details>
    <section id="storage-preview" hidden><h3>Ready to open</h3><p id="storage-preview-text"></p><p>This replaces entries in the current tab. Review the starting figures before planning.</p><div class="storage-actions"><button id="storage-open" class="button button-primary" type="button">Open picture</button><button id="storage-cancel-preview" class="button button-secondary" type="button">Cancel</button></div></section>
    <div class="storage-actions"><button id="storage-stored-backup" class="text-button" type="button">Download stored backup</button><button id="storage-delete" class="text-button text-button-danger" type="button">Delete saved picture & tab data</button></div>
    <section id="storage-delete-confirm" hidden><p>Delete the saved picture from this browser and clear the current tab? Downloaded backups are separate files.</p><button id="storage-delete-final" class="button button-danger" type="button">Delete saved picture and clear tab</button></section>
    <p class="field-help">An unlocked tab is visible to anyone using this browser. Browser storage can be cleared by the browser; download an encrypted backup to keep a separate copy.</p>`;
  document.body.append(dialog);const $=id=>dialog.querySelector(`#${id}`);
  function raw(){try{return store?.getItem(PICTURE_STORAGE_KEY) || null;}catch{return null;}}
  function status(){
    const saved=enabled && JSON.stringify(getPicture())===lastSaved;
    button.textContent=failed ? 'Backup failed' : enabled ? (saved ? 'Backed up' : 'Backing up…') : 'Encrypted backup';
    button.title=enabled ? 'Encrypted device saving is on. Open saving, backup and deletion options.' : 'Optional encrypted device saving and backup';
    const indicator=document.getElementById('picture-save-status');
    const message=failed ? 'Latest changes not saved' : enabled ? (saved ? 'Saved in this browser' : 'Saving in this browser…') : `${getPicture().example ? 'Example · not saved' : 'Not saved · this tab only'}${raw() ? ' · saved copy available' : ''}`;
    updateSaveStatus(indicator,'device',message);
  }
  function error(message){$('storage-error').textContent=message;$('storage-error').hidden=!message;}
  function showOptions(){const exists=Boolean(raw());$('storage-resume').hidden=!exists || enabled;$('storage-active').hidden=!protection;$('storage-new').hidden=enabled;$('storage-new').open=!exists && !enabled;$('storage-new-label').textContent=exists ? 'Save current tab instead' : 'Save this picture';$('storage-replace-label').hidden=!exists;$('storage-replace').required=exists;$('storage-replace').checked=false;$('storage-stored-backup').hidden=!exists || Boolean(protection);$('storage-delete').hidden=!exists && !enabled;}
  function pause(){epoch++;clearTimeout(timer);protection=null;enabled=false;lastSaved='';failed=false;staged=null;status();}
  function schedule(){status();if(!enabled || !protection || JSON.stringify(getPicture())===lastSaved)return;clearTimeout(timer);timer=setTimeout(saveNow,450);}
  function saveNow(){const task=activeSave.then(performSave);activeSave=task.catch(()=>{});return task;}
  async function performSave(){
    if(!enabled || !protection)return;
    const ticket=epoch;
    try{const picture=getPicture(),serial=JSON.stringify(picture);if(serial===lastSaved)return;button.textContent='Saving…';const encrypted=await encryptPicture(picture,protection);
      if(ticket!==epoch || !enabled)return;
      if(serial!==JSON.stringify(getPicture())){again=true;return;}
      if(!store)throw new Error('Device storage is unavailable. Download an encrypted backup instead.');
      store.setItem(PICTURE_STORAGE_KEY,encrypted);lastSaved=serial;failed=false;error('');status();
    }catch(e){if(ticket===epoch){failed=true;error(`Your latest changes are not saved. ${e.message}`);status();}}
    finally{if(again){again=false;schedule();}}
  }
  function download(value){const url=URL.createObjectURL(new Blob([value],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='steadybee-encrypted-picture.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  async function run(action){error('');dialog.setAttribute('aria-busy','true');for(const button of dialog.querySelectorAll('button[type=submit]'))button.disabled=true;try{await action();}catch(e){error(e.message);}finally{dialog.removeAttribute('aria-busy');for(const button of dialog.querySelectorAll('button[type=submit]'))button.disabled=false;status();}}
  function preview(result,kind){staged={...result,kind};const p=result.picture;$('storage-preview-text').textContent=`${p.holdings.assets.length} assets · ${p.holdings.debts.length} debt${p.holdings.debts.length===1 ? '' : 's'} · starts ${p.flow.timelineStartMonth}. ${kind==='import' ? 'Import opens in this tab only; the existing saved copy is kept.' : 'Opening enables encrypted saving for this picture.'}`;$('storage-preview').hidden=false;$('storage-open').textContent=kind==='import' ? 'Open backup in this tab' : 'Open saved picture';$('storage-preview').scrollIntoView({block:'nearest'});}
  button.addEventListener('click',()=>{error('');$('storage-result').textContent='';$('storage-delete-confirm').hidden=true;$('storage-preview').hidden=true;showOptions();dialog.showModal();});
  $('storage-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{for(const input of dialog.querySelectorAll('input[type=password]'))input.value='';$('storage-file').value='';staged=null;});
  $('storage-create-form').addEventListener('submit',event=>{event.preventDefault();run(async()=>{
    const password=$('storage-new-password').value;if(password!==$('storage-confirm-password').value)throw new Error('The passphrases do not match.');
    const ticket=epoch,previousRaw=raw(),candidate=getPicture(),newProtection=await createProtection(password),encrypted=await encryptPicture(candidate,newProtection);
    if(ticket!==epoch || !dialog.open)return;
    if(!store)throw new Error('This browser cannot save device data. Enable browser storage or import a backup into a tab.');
    // Only start auto-saving once the explicit first save has succeeded.
    if(raw()!==previousRaw)throw new Error('The saved picture changed in another tab. Resume it before replacing it.');
    store.setItem(PICTURE_STORAGE_KEY,encrypted);epoch++;protection=newProtection;enabled=true;failed=false;lastSaved=JSON.stringify(candidate);$('storage-create-form').reset();showOptions();$('storage-result').textContent='Encrypted picture saved on this device.';if(lastSaved!==JSON.stringify(getPicture()))schedule();
  });});
  $('storage-unlock-form').addEventListener('submit',event=>{event.preventDefault();run(async()=>{const ticket=epoch,result=await decryptPicture(raw(),$('storage-unlock-password').value);$('storage-unlock-password').value='';if(ticket!==epoch || !dialog.open)return;preview(result,'device');});});
  $('storage-import-form').addEventListener('submit',event=>{event.preventDefault();run(async()=>{const file=$('storage-file').files[0];if(!file || file.size>2_000_000)throw new Error('Choose a Steadybee backup under 2 MB.');const ticket=epoch,result=await decryptPicture(await file.text(),$('storage-import-password').value);$('storage-import-password').value='';if(ticket!==epoch || !dialog.open)return;preview(result,'import');});});
  $('storage-open').addEventListener('click',()=>{if(!staged)return;const next=staged;pause();restorePicture(next.picture);if(next.kind==='device'){protection=next.protection;enabled=true;lastSaved='';schedule();}dialog.close();status();});
  $('storage-cancel-preview').addEventListener('click',()=>{staged=null;$('storage-preview').hidden=true;});
  $('storage-backup').addEventListener('click',()=>run(async()=>{if(!protection)throw new Error('Unlock your picture first.');download(await encryptPicture(getPicture(),protection));$('storage-result').textContent='Encrypted backup downloaded. It needs the same passphrase.';}));
  $('storage-stored-backup').addEventListener('click',()=>{if(raw())download(raw());});
  $('storage-lock').addEventListener('click',()=>run(async()=>{await saveNow();if(failed || lastSaved!==JSON.stringify(getPicture()))throw new Error('The latest changes are not saved. Download a backup before locking.');pause();clearTab();dialog.close();}));
  $('storage-delete').addEventListener('click',()=>{$('storage-delete-confirm').hidden=false;$('storage-delete-final').focus();});
  $('storage-delete-final').addEventListener('click',()=>{try{store?.removeItem(PICTURE_STORAGE_KEY);}catch{error('The browser could not delete the saved picture. Nothing in this tab was cleared.');return;}pause();clearTab();dialog.close();status();});
  document.addEventListener('picture-updated',schedule);
  window.addEventListener('beforeunload',event=>{if(enabled && JSON.stringify(getPicture())!==lastSaved){event.preventDefault();event.returnValue='';}});
  window.addEventListener('storage',event=>{if(event.key===PICTURE_STORAGE_KEY){pause();error('The saved picture changed in another tab. Resume it before saving here.');}});
  status();return {pause,saveNow};
}
