import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from './cloud-config.mjs?v=20261017account1';
import {validatePicture} from './picture-storage.mjs?v=20261017review1';
import {updateSaveStatus} from './save-status.mjs?v=20261017profile1';
import {startGoogleSignIn,googleProviderEnabled} from './google-sign-in.mjs?v=20261017google1';

const sdkUrl='https://esm.sh/@supabase/supabase-js@2.118.0?bundle';

/** Restore once per account, only while the opening example remains untouched. */
export function createAccountPictureLoader({getPicture,fetchPicture,applyPicture,onEmpty,onAvailable,onError}) {
  const opening=getPicture(),openingSerial=JSON.stringify(opening);
  let activeUserId=null,generation=0,pending=null;
  return {setUser(userId){
    if(userId!==activeUserId){activeUserId=userId;generation++;pending=null;}
    if(!userId)return Promise.resolve();
    if(pending)return pending;
    const requestGeneration=generation;
    pending=Promise.resolve().then(()=>fetchPicture(userId)).then(saved=>{
      if(requestGeneration!==generation)return;
      if(saved && opening.example && JSON.stringify(getPicture())===openingSerial)applyPicture(saved);
      else {
        if(!saved && opening.example && JSON.stringify(getPicture())===openingSerial)onEmpty?.();
        onAvailable(saved);
      }
    }).catch(e=>{
      if(requestGeneration!==generation)return;
      pending=null;onError(e);
    });
    return pending;
  }};
}

/** Signed-in cloud storage for named household pictures per account. */
export function mountAccountStorage({button,getPicture,restorePicture,editPeople,onEmpty}) {
  let clientPromise=null,client=null,user=null,cloudEnabled=false,cloudUpdatedAt='',activePictureId=null,activePictureName='',cloudPictures=[],lastSaved='',timer=null,saving=Promise.resolve(),errorMessage='';
  const dialog=document.createElement('dialog');dialog.id='account-dialog';dialog.className='form-dialog storage-dialog account-dialog';dialog.setAttribute('aria-labelledby','account-title');
  dialog.innerHTML=`<div class="dialog-heading"><h2 id="account-title">Your Steadybee account</h2><button id="account-close" class="icon-button" type="button" aria-label="Close account options">×</button></div>
    <p class="account-intro">Your main picture opens automatically when you sign in. Save other households by name and choose one whenever you want. Account pictures sync without a passphrase; encrypted device backups are optional.</p>
    <p id="account-error" class="form-error" role="alert" hidden></p><p id="account-message" role="status" aria-live="polite"></p>
    <div id="account-google-option" hidden><button id="account-google-sign-in" class="button button-primary" type="button">Continue with Google</button><p class="field-help">Use the same Google email as your existing Steadybee account.</p></div>
    <p id="account-sign-in-unavailable" class="field-help" hidden>Google sign-in is temporarily unavailable. Please try again later.</p>
    <section id="account-session" hidden><p id="account-email-label" class="account-email-label"></p>
      <div id="account-cloud-summary" class="account-cloud-summary"></div>
      <label class="account-picture-choice" for="account-picture-select">Saved pictures<select id="account-picture-select" aria-label="Choose a saved picture"></select></label>
      <div class="account-actions"><button id="account-open-picture" class="button button-primary" type="button" hidden>Open selected picture</button><button id="account-save-picture" class="button button-secondary" type="button">Save current picture as…</button></div>
      <form id="account-picture-name-form" class="account-picture-name-form" hidden><label for="account-picture-name">Picture name</label><div><input id="account-picture-name" maxlength="60" required placeholder="e.g. Our household" /><label class="account-main-choice"><input id="account-picture-make-main" type="checkbox" /> Make this my main picture</label><button type="submit" class="button button-primary">Save picture</button></div></form>
      <div class="account-picture-manage"><button id="account-set-main" class="text-button" type="button" hidden>Make selected picture the main one</button><button id="account-rename-picture" class="text-button" type="button" hidden>Rename selected</button><button id="account-delete-picture" class="text-button text-button-danger" type="button" hidden>Delete selected picture</button></div>
      <div id="account-restore-confirm" class="account-restore-confirm" hidden><p id="account-restore-copy">This will replace the picture open in this tab.</p><button id="account-confirm-open" class="button button-primary" type="button">Open selected picture</button><button id="account-cancel-open" class="button button-secondary" type="button">Keep this tab</button></div>
      <button id="account-sign-out" class="text-button" type="button">Sign out</button>
    </section>
    <p class="account-privacy">Your account picture is stored in Supabase cloud storage. App access rules restrict it to your signed-in account, but this is not end-to-end encryption: project administrators can access the record. For a passphrase-encrypted copy, use <strong>Save picture</strong> and download a device backup.</p>`;
  document.body.append(dialog);const $=id=>dialog.querySelector(`#${id}`);
  const status=document.getElementById('picture-save-status');
  function message(text){$('account-message').textContent=text;}
  function error(text){errorMessage=text;$('account-error').textContent=text;$('account-error').hidden=!text;}
  function setStatus(text){updateSaveStatus(status,'account',user?text:null);}
  let googleEnabled=false,providerRequest=null,googlePopup=null;
  function refreshProviders(){
    if(!providerRequest)providerRequest=googleProviderEnabled({url:SUPABASE_URL,key:SUPABASE_PUBLISHABLE_KEY}).then(enabled=>{
      googleEnabled=enabled;renderSession();
    }).catch(()=>{providerRequest=null;});
    return providerRequest;
  }
  const peopleButton=document.createElement('button');peopleButton.type='button';peopleButton.className='button button-secondary';peopleButton.textContent='Manage people';peopleButton.addEventListener('click',()=>{dialog.close();editPeople?.();});$('account-session').prepend(peopleButton);
  function selectedPicture(){return cloudPictures.find(item=>item.id===$('account-picture-select').value)||null;}
  function renderPictureList(){
    const select=$('account-picture-select'),chosen=activePictureId||select.value;
    select.replaceChildren(...cloudPictures.map(item=>new Option(`${item.name}${item.is_main?' · Main':''}`,item.id)));
    if(chosen && cloudPictures.some(item=>item.id===chosen))select.value=chosen;
    else if(cloudPictures.length)select.value=(cloudPictures.find(item=>item.is_main)||cloudPictures[0]).id;
    const selected=selectedPicture();
    $('account-open-picture').hidden=!selected;
    $('account-set-main').hidden=!selected||selected.is_main;
    $('account-rename-picture').hidden=!selected;
    $('account-delete-picture').hidden=!selected||selected.is_main;
    $('account-cloud-summary').textContent=cloudPictures.length?`${cloudPictures.length} saved ${cloudPictures.length===1?'picture':'pictures'} · main picture opens automatically`:'No saved account pictures yet. Save this picture with a name.';
  }
  function renderCloudSummary(data){
    cloudPictures=data||[];renderPictureList();
  }
  const pictureLoader=createAccountPictureLoader({
    getPicture,
    fetchPicture:async userId=>{
      const {data,error:dbError}=await client.from('user_pictures').select('id,name,is_main,picture,updated_at').eq('user_id',userId).eq('is_main',true).maybeSingle();
      if(dbError)throw dbError;
      if(user?.id!==userId)return null;
      const {data:list,error:listError}=await client.from('user_pictures').select('id,name,is_main,updated_at').eq('user_id',userId).order('is_main',{ascending:false}).order('name');
      if(listError)throw listError;
      if(user?.id!==userId)return null;
      renderCloudSummary(list||[]);
      return data?{...data,picture:validatePicture(data.picture),updatedAt:data.updated_at}:null;
    },
    applyPicture:saved=>{
      clearTimeout(timer);cloudEnabled=false;
      restorePicture(saved.picture);
      activePictureId=saved.id;activePictureName=saved.name;cloudUpdatedAt=saved.updatedAt;lastSaved=JSON.stringify(validatePicture(getPicture()));cloudEnabled=true;
      renderPictureList();setStatus(`Main picture · ${activePictureName}`);message(`Main picture “${activePictureName}” is open. Changes save automatically.`);
      if(dialog.open)dialog.close();
    },
    onAvailable:saved=>{
      if(!cloudEnabled){activePictureId=null;activePictureName='';cloudUpdatedAt='';renderPictureList();setStatus(saved?'Main picture available · open Account':'Signed in · no main picture saved');}
    },
    onEmpty:()=>{onEmpty?.();},
    onError:e=>{error(`Could not open your saved picture. ${e.message}`);setStatus('Saved picture could not load · open Account');},
  });
  function setUser(nextUser){
    const changed=user?.id!==nextUser?.id;
    if(changed){clearTimeout(timer);cloudEnabled=false;cloudUpdatedAt='';activePictureId=null;activePictureName='';cloudPictures=[];lastSaved='';}
    user=nextUser;renderSession();
    if(user && googlePopup){googlePopup.close();googlePopup=null;}
    if(user){error('');message('');}
    if(!user){pictureLoader.setUser(null);setStatus(`${getPicture().example?'Example · not saved':'Not saved · this tab only'}`);refreshProviders();return;}
    if(changed)setStatus('Opening your main picture…');
    // Defer database requests until Supabase has released its auth callback lock.
    const userId=user.id;setTimeout(()=>{if(user?.id===userId)pictureLoader.setUser(userId);},0);
  }
  async function getClient(){
    if(!clientPromise)clientPromise=import(sdkUrl).then(({createClient})=>{
      if(!SUPABASE_URL||!SUPABASE_PUBLISHABLE_KEY)throw new Error('Account saving is not configured yet.');
      client=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
      client.auth.onAuthStateChange((event,session)=>{
        setUser(session?.user||null);
      });
      return client;
    });
    return clientPromise;
  }
  function renderSession(){
    dialog.querySelector('.account-intro').hidden=Boolean(user);
    $('account-google-option').hidden=Boolean(user)||!googleEnabled;
    $('account-sign-in-unavailable').hidden=Boolean(user)||googleEnabled;$('account-session').hidden=!user;
    $('account-email-label').textContent=user?.email||'';
    button.textContent=user?'Account':'Sign in';button.title=user?'Signed in. Open account options and cloud save.':'Sign in to save a picture to your account.';
    if(!user){$('account-open-picture').hidden=true;$('account-set-main').hidden=true;$('account-rename-picture').hidden=true;$('account-delete-picture').hidden=true;$('account-cloud-summary').textContent='';}
  }
  async function refreshPicture(){
    if(!client||!user)return;
    const userId=user.id;
    try{
      const {data,error:dbError}=await client.from('user_pictures').select('id,name,is_main,updated_at').eq('user_id',userId).order('is_main',{ascending:false}).order('name');
      if(dbError)throw dbError;
      if(user?.id!==userId)return;
      renderCloudSummary(data||[]);
    }catch(e){error(`Could not check your saved picture. ${e.message}`);}
  }
  async function openAccount(){
    error('');message('');$('account-restore-confirm').hidden=true;
    try{await getClient();const {data}=await client.auth.getSession();setUser(data.session?.user||null);if(user)await refreshPicture();}
    catch(e){error(`Account sign-in is unavailable. ${e.message}`);}
    dialog.showModal();
  }
  button.addEventListener('click',openAccount);
  $('account-close').addEventListener('click',()=>dialog.close());
  $('account-google-sign-in').addEventListener('click',async()=>{
    if(googlePopup && !googlePopup.closed){googlePopup.focus();return;}
    const signIn=$('account-google-sign-in');if(signIn.disabled)return;
    error('');message('Opening Google sign-in…');signIn.disabled=true;
    try{
      // The SDK has already initialized before this enabled provider is offered.
      const result=await startGoogleSignIn({client,redirectTo:new URL('app.html',location.href).toString(),openWindow:()=>window.open('about:blank','steadybee-google-sign-in','popup,width=520,height=720')});
      if(result.user){setUser(result.user);message('You’re already signed in.');}
      else{googlePopup=result.popup;if(user){googlePopup.close();googlePopup=null;}message('Complete sign-in in the Google window. Your picture stays open here.');}
    }catch(e){error(`Could not start Google sign-in. ${e.message}`);message('');}
    finally{signIn.disabled=false;}
  });
  $('account-save-picture').addEventListener('click',()=>{
    const form=$('account-picture-name-form');form.hidden=!form.hidden;form.dataset.mode='save';form.dataset.pictureId='';
    $('account-picture-name').value='';$('account-picture-make-main').checked=!cloudPictures.some(item=>item.is_main);
    if(!form.hidden)$('account-picture-name').focus();
  });
  $('account-picture-select').addEventListener('change',()=>{$('account-restore-confirm').hidden=true;renderPictureList();});
  $('account-open-picture').addEventListener('click',async()=>{
    const selected=selectedPicture();if(!selected)return;
    error('');message(`Loading “${selected.name}”…`);
    try{
      const {data,error:dbError}=await client.from('user_pictures').select('id,name,is_main,picture,updated_at').eq('user_id',user.id).eq('id',selected.id).single();
      if(dbError)throw dbError;
      const picture=validatePicture(data.picture);
      $('account-restore-copy').textContent=`Open “${data.name}” saved ${new Date(data.updated_at).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'})}? It replaces the picture in this tab.`;
      $('account-restore-confirm').hidden=false;$('account-confirm-open').focus();dialog.dataset.cloudPicture=JSON.stringify(picture);dialog.dataset.cloudUpdatedAt=data.updated_at;dialog.dataset.cloudPictureId=data.id;dialog.dataset.cloudPictureName=data.name;message('Review before opening.');
    }catch(e){error(`Could not open this picture. ${e.message}`);message('');}
  });
  $('account-confirm-open').addEventListener('click',()=>{
    let picture;try{picture=validatePicture(JSON.parse(dialog.dataset.cloudPicture||'null'));}catch(e){error(`Saved picture could not be opened. ${e.message}`);return;}
    cloudEnabled=false;restorePicture(picture);activePictureId=dialog.dataset.cloudPictureId;activePictureName=dialog.dataset.cloudPictureName;cloudUpdatedAt=dialog.dataset.cloudUpdatedAt||'';lastSaved=JSON.stringify(getPicture());cloudEnabled=true;setStatus(`Picture · ${activePictureName}`);dialog.close();
  });
  $('account-cancel-open').addEventListener('click',()=>{$('account-restore-confirm').hidden=true;});
  async function setMainPicture(id){
    const previous=cloudPictures.find(item=>item.is_main);
    if(previous?.id===id)return;
    if(previous){const {error:unsetError}=await client.from('user_pictures').update({is_main:false}).eq('user_id',user.id).eq('id',previous.id);if(unsetError)throw unsetError;}
    const {error:setError}=await client.from('user_pictures').update({is_main:true}).eq('user_id',user.id).eq('id',id);
    if(setError){if(previous)await client.from('user_pictures').update({is_main:true}).eq('user_id',user.id).eq('id',previous.id);throw setError;}
    await refreshPicture();message('Main picture updated. It opens automatically next time you sign in.');
  }
  $('account-set-main').addEventListener('click',async()=>{try{const selected=selectedPicture();if(selected)await setMainPicture(selected.id);}catch(e){error(`Could not change the main picture. ${e.message}`);}});
  $('account-rename-picture').addEventListener('click',()=>{
    const selected=selectedPicture();if(!selected)return;
    const form=$('account-picture-name-form');form.hidden=false;form.dataset.mode='rename';form.dataset.pictureId=selected.id;
    $('account-picture-name').value=selected.name;$('account-picture-make-main').checked=selected.is_main;$('account-picture-name').focus();
  });
  $('account-picture-name-form').addEventListener('submit',async event=>{
    event.preventDefault();error('');message('');
    const form=$('account-picture-name-form'),name=$('account-picture-name').value.trim(),makeMain=$('account-picture-make-main').checked||!cloudPictures.some(item=>item.is_main);
    if(!name){error('Enter a name for this picture.');return;}
    if(cloudPictures.some(item=>item.name.toLocaleLowerCase()===name.toLocaleLowerCase()&&item.id!==form.dataset.pictureId)){error('A saved picture already uses that name. Choose a different name.');return;}
    try{
      if(!user)throw new Error('Sign in before saving.');
      if(form.dataset.mode==='rename'){
        const id=form.dataset.pictureId,{error:renameError}=await client.from('user_pictures').update({name}).eq('user_id',user.id).eq('id',id);if(renameError)throw renameError;
        if(activePictureId===id)activePictureName=name;
        await refreshPicture();$('account-picture-select').value=id;if(makeMain)await setMainPicture(id);message(`Picture renamed to “${name}”.`);
      }else{
        const picture={...validatePicture(getPicture()),example:false},id=crypto.randomUUID(),now=new Date().toISOString();
        const {error:insertError}=await client.from('user_pictures').insert({id,user_id:user.id,name,is_main:false,picture,updated_at:now});if(insertError)throw insertError;
        if(makeMain)await setMainPicture(id);
        cloudEnabled=false;restorePicture(picture);activePictureId=id;activePictureName=name;cloudUpdatedAt=now;lastSaved=JSON.stringify(validatePicture(getPicture()));cloudEnabled=true;
        await refreshPicture();$('account-picture-select').value=id;setStatus(`Picture · ${name}`);message(`“${name}” saved. Changes now sync to this account picture.`);
      }
      form.hidden=true;form.reset();
    }catch(e){error(`Your picture was not saved. ${e.message}`);}
  });
  $('account-delete-picture').addEventListener('click',async()=>{
    const selected=selectedPicture();if(!selected||selected.is_main)return;
    if(!window.confirm(`Delete “${selected.name}” from your account? This cannot be undone.`))return;
    error('');
    try{const {error:dbError}=await client.from('user_pictures').delete().eq('user_id',user.id).eq('id',selected.id);if(dbError)throw dbError;if(activePictureId===selected.id){cloudEnabled=false;activePictureId=null;activePictureName='';cloudUpdatedAt='';lastSaved='';setStatus('Current picture is not saved to your account');}message(`“${selected.name}” deleted.`);await refreshPicture();}
    catch(e){error(`Could not delete this picture. ${e.message}`);}
  });
  $('account-sign-out').addEventListener('click',async()=>{
    try{await getClient();const {error:authError}=await client.auth.signOut();if(authError)throw authError;user=null;cloudEnabled=false;renderSession();message('Signed out. The open tab remains here.');setStatus('Signed out');}
    catch(e){error(`Could not sign out. ${e.message}`);}
  });
  function scheduleCloudSave(){
    if(!cloudEnabled||!user)return;
    if(JSON.stringify(getPicture())===lastSaved){setStatus(`Picture · ${activePictureName}`);return;}
    setStatus('Saving to your account…');clearTimeout(timer);timer=setTimeout(()=>{const task=saving.then(autoSave);saving=task.catch(()=>{});},650);
  }
  async function autoSave(){
    if(!cloudEnabled||!user)return;
    try{
      const picture=validatePicture(getPicture()),serial=JSON.stringify(picture);if(serial===lastSaved)return;
      const timestamp=new Date().toISOString();
      if(!activePictureId)throw new Error('Choose or save a named picture before syncing changes.');
      const request=client.from('user_pictures').update({picture,updated_at:timestamp}).eq('user_id',user.id).eq('id',activePictureId).eq('updated_at',cloudUpdatedAt).select('updated_at').maybeSingle();
      const {data,error:dbError}=await request;
      if(dbError)throw dbError;
      if(!data){cloudEnabled=false;setStatus('Cloud copy changed elsewhere');if(dialog.open)error('Another tab updated this saved picture. Reopen it before continuing so you do not overwrite newer changes.');return;}
      cloudUpdatedAt=data.updated_at;lastSaved=serial;setStatus(`Picture · ${activePictureName}`);
    }catch(e){cloudEnabled=false;setStatus('Cloud save needs attention');if(dialog.open)error(`Latest changes were not saved to your account. ${e.message}`);}
  }
  document.addEventListener('picture-updated',scheduleCloudSave);
  getClient().then(async()=>{const {data}=await client.auth.getSession();setUser(data.session?.user||null);}).catch(()=>{});
  renderSession();
  return {open:openAccount};
}
