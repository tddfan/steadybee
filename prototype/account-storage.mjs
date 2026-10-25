import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from './cloud-config.mjs?v=20261017account1';
import {validatePicture} from './picture-storage.mjs?v=20261025baseline1';
import {updateSaveStatus} from './save-status.mjs?v=20261017profile1';
import {startGoogleRedirectSignIn,googleProviderEnabled,completeGoogleOAuthPopup} from './google-sign-in.mjs?v=20261024redirect1';

import {saveSignInDraft} from './sign-in-draft.mjs?v=20261025baseline1';

const sdkUrl='https://esm.sh/@supabase/supabase-js@2.118.0?bundle';

/** Restore each account's default household; never leave a public demo as its default. */
export function createAccountPictureLoader({getPicture,fetchPicture,applyPicture,onEmpty,onAvailable,onError,restoreOnLogin=()=>true}) {
  let activeUserId=null,lastAccountId=null,generation=0,pending=null;
  return {setUser(userId){
    if(userId!==activeUserId){activeUserId=userId;generation++;pending=null;}
    if(!userId)return Promise.resolve();
    if(pending)return pending;
    const switchedAccount=Boolean(lastAccountId&&lastAccountId!==userId);
    lastAccountId=userId;
    const requestGeneration=generation;
    pending=Promise.resolve().then(()=>fetchPicture(userId)).then(saved=>{
      if(requestGeneration!==generation)return;
      // Explicit example/setup routes are intentional choices and must not be
      // replaced by the signed-in account's default during initialization.
      if(!restoreOnLogin()){onAvailable(saved);return;}
      // An account's saved default takes precedence over the public example (and
      // any local edits to it). This is the reliable sign-in path on every device.
      if(saved)applyPicture(saved);
      else {
        const current=getPicture();
        // The first account can adopt a customized example as its household.
        // When changing accounts, clear the previous user's data before the new
        // account's empty state is shown.
        if(current?.example||switchedAccount)onEmpty?.({forceReset:switchedAccount});
        onAvailable(saved);
      }
    }).catch(e=>{
      if(requestGeneration!==generation)return;
      pending=null;onError(e);
    });
    return pending;
  }};
}

/** Retry an expired access token once; never loop or replay other errors. */
export async function queryWithSessionRefresh(run,refreshSession){
  const result=await run();
  if(!/jwt.*expired/i.test(result.error?.message||''))return result;
  const {data,error}=await refreshSession();
  if(error?.name==='AuthRetryableFetchError')return {data:null,error:new Error('Could not reconnect to account saving. Check your connection and try again.')};
  if(error||!data?.session)return {data:null,error:Object.assign(new Error('Your sign-in expired. Continue with Google to reconnect.'),{code:'STEADYBEE_REAUTH_REQUIRED'})};
  return run();
}

/** Signed-in cloud storage for named household pictures per account. */
export function mountAccountStorage({button,getPicture,restorePicture,editPeople,startHousehold,onEmpty,restoreOnLogin=()=>true,finishSignIn=()=>{}}) {
  let clientPromise=null,client=null,user=null,cloudEnabled=false,cloudUpdatedAt='',activePictureId=null,activePictureName='',cloudPictures=[],lastSaved='',timer=null,saving=Promise.resolve(),mainCreation=null,errorMessage='',householdGeneration=0;
  const dialog=document.createElement('dialog');dialog.id='account-dialog';dialog.className='form-dialog storage-dialog account-dialog';dialog.setAttribute('aria-labelledby','account-title');
  dialog.innerHTML=`<div class="dialog-heading"><h2 id="account-title">Account</h2><button id="account-close" class="icon-button" type="button" aria-label="Close account options">×</button></div>
    <p class="account-intro">Sign in to save your household and return on another device.</p>
    <p id="account-error" class="form-error" role="alert" hidden></p><p id="account-message" role="status" aria-live="polite"></p>
    <div id="account-google-option" hidden><button id="account-google-sign-in" class="button button-primary" type="button">Continue with Google</button><p class="field-help">Use the same Google email as your existing Steadybee account.</p></div>
    <p id="account-sign-in-unavailable" class="field-help" hidden>Google sign-in is temporarily unavailable. Please try again later.</p>
    <section id="account-session" hidden><p id="account-email-label" class="account-email-label"></p>
      <div id="account-cloud-summary" class="account-cloud-summary"></div>
      <h3 class="account-section-title">Your households</h3>
      <label class="account-picture-choice" for="account-picture-select">Choose a version<select id="account-picture-select" aria-label="Choose a saved household version"></select></label>
      <div class="account-actions"><button id="account-open-picture" class="button button-primary" type="button" hidden>Open household</button><button id="account-save-picture" class="button button-secondary" type="button">Save a version…</button></div>
      <form id="account-picture-name-form" class="account-picture-name-form" hidden><label for="account-picture-name">Name this version</label><div><input id="account-picture-name" maxlength="60" required placeholder="e.g. Retire at 60" /><label class="account-main-choice"><input id="account-picture-make-main" type="checkbox" /> Make this my default household</label><button type="submit" class="button button-primary">Save version</button></div></form>
      <div class="account-picture-manage"><button id="account-set-main" class="text-button" type="button" hidden>Make default</button><button id="account-rename-picture" class="text-button" type="button" hidden>Rename</button><button id="account-delete-picture" class="text-button text-button-danger" type="button" hidden>Delete version</button></div>
      <div id="account-restore-confirm" class="account-restore-confirm" hidden><p id="account-restore-copy">This will replace the household open in this tab.</p><button id="account-confirm-open" class="button button-primary" type="button">Open selected version</button><button id="account-cancel-open" class="button button-secondary" type="button">Keep this tab</button></div>
      <button id="account-sign-out" class="text-button" type="button">Sign out</button>
    </section>
    <p class="account-privacy">Cloud household data is private to your account. It is not end-to-end encrypted.</p>`;
  document.body.append(dialog);const $=id=>dialog.querySelector(`#${id}`);
  const status=document.getElementById('picture-save-status');
  const exampleNotice=document.createElement('aside');exampleNotice.className='account-example-notice';exampleNotice.hidden=true;exampleNotice.setAttribute('aria-label','Sample household');
  exampleNotice.innerHTML='<span>You’re exploring a sample household.</span><button type="button" class="button button-primary"></button><span class="form-error" role="status" hidden></span>';
  document.querySelector('main').prepend(exampleNotice);
  function renderExampleNotice(){exampleNotice.hidden=!user||!getPicture().example;exampleNotice.querySelector('button').textContent=cloudPictures.some(item=>item.is_main)?'Open my household':'Set up my household';}
  exampleNotice.querySelector('button').addEventListener('click',async()=>{
    if(!cloudPictures.some(item=>item.is_main)){startHousehold?.();renderExampleNotice();return;}
    const action=exampleNotice.querySelector('button'),noticeError=exampleNotice.querySelector('[role=status]');action.disabled=true;noticeError.hidden=true;const userId=user.id;
    try{const {data,error:loadError}=await accountQuery(()=>client.from('user_pictures').select('id,name,is_main,picture,updated_at').eq('user_id',userId).eq('is_main',true).single());if(loadError)throw loadError;if(user?.id===userId)applySavedHousehold(data);}
    catch(e){noticeError.textContent=`Could not open your household. ${e.message}`;noticeError.hidden=false;}
    finally{action.disabled=false;}
  });
  function message(text){$('account-message').textContent=text;}
  function error(text){errorMessage=text;$('account-error').textContent=text;$('account-error').hidden=!text;}
  function setStatus(text){updateSaveStatus(status,'account',user?text:(getPicture().example?'Example · not saved':'Not saved · sign in to save'));renderExampleNotice();}
  let googleEnabled=false,providerRequest=null,googlePopup=null;
  window.addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==googlePopup||event.data?.type!=='steadybee-google-sign-in-complete')return;
    googlePopup?.close();googlePopup=null;message('Signed in. Opening your default household…');
  });
  function refreshProviders(){
    if(!providerRequest)providerRequest=googleProviderEnabled({url:SUPABASE_URL,key:SUPABASE_PUBLISHABLE_KEY}).then(enabled=>{
      googleEnabled=enabled;renderSession();
    }).catch(()=>{providerRequest=null;});
    return providerRequest;
  }
  const peopleButton=document.createElement('button');peopleButton.type='button';peopleButton.className='button button-secondary account-people-button';peopleButton.textContent='Manage people';peopleButton.addEventListener('click',()=>{dialog.close();editPeople?.();});$('account-email-label').after(peopleButton);
  function selectedPicture(){return cloudPictures.find(item=>item.id===$('account-picture-select').value)||null;}
  function renderPictureList(){
    const select=$('account-picture-select'),chosen=select.value||activePictureId;
    select.replaceChildren(...cloudPictures.map(item=>new Option(`${item.name}${item.is_main?' · Default':''}`,item.id)));
    if(chosen && cloudPictures.some(item=>item.id===chosen))select.value=chosen;
    else if(cloudPictures.length)select.value=(cloudPictures.find(item=>item.is_main)||cloudPictures[0]).id;
    select.closest('label').hidden=!cloudPictures.length;
    const selected=selectedPicture();
    $('account-open-picture').hidden=!selected;
    $('account-set-main').hidden=!selected||selected.is_main;
    $('account-rename-picture').hidden=!selected;
    $('account-delete-picture').hidden=!selected||selected.is_main;
    const main=cloudPictures.find(item=>item.is_main);
    $('account-cloud-summary').textContent=cloudEnabled&&activePictureId?`Currently open · ${activePictureName}${cloudPictures.find(item=>item.id===activePictureId)?.is_main?' · Default':''} · changes save automatically`:main?`Default household · ${main.name}`:cloudPictures.length?'No default selected · choose a version and make it default':'No household saved yet · your first saved household becomes the default';
  }
  function renderCloudSummary(data){
    cloudPictures=data||[];renderPictureList();renderExampleNotice();
  }
  function hasHouseholdProfile(){
    const picture=getPicture(),holdings=picture?.holdings;
    return Boolean(user&&!picture?.example&&holdings?.name?.trim()&&Number.isInteger(holdings.age));
  }
  async function createMainFromCurrent(){
    if(mainCreation)return mainCreation;
    if(!hasHouseholdProfile()||cloudEnabled||cloudPictures.some(item=>item.is_main))return;
    const userId=user.id,picture={...validatePicture(getPicture()),example:false},id=crypto.randomUUID(),now=new Date().toISOString(),requestGeneration=householdGeneration;
    mainCreation=(async()=>{
      const {error:insertError}=await accountQuery(()=>client.from('user_pictures').insert({id,user_id:userId,name:'My household',is_main:true,picture,updated_at:now}));
      if(insertError){await refreshPicture();if(!cloudPictures.some(item=>item.is_main))throw insertError;return;}
      if(user?.id!==userId||requestGeneration!==householdGeneration)return;
      activePictureId=id;activePictureName='My household';cloudUpdatedAt=now;lastSaved=JSON.stringify(picture);cloudEnabled=true;
      await refreshPicture();setStatus('Default household · saved');message('Your default household is saved. Future changes save automatically.');
      if(JSON.stringify(validatePicture(getPicture()))!==lastSaved)scheduleCloudSave();
    })().catch(e=>{setStatus('Default household could not save');if(dialog.open)error(`Your default household could not be saved. ${e.message}`);}).finally(()=>{mainCreation=null;});
    return mainCreation;
  }
  function applySavedHousehold(saved){
    const picture=validatePicture(saved.picture);
    householdGeneration++;clearTimeout(timer);cloudEnabled=false;
    restorePicture(picture);
    activePictureId=saved.id;activePictureName=saved.name;cloudUpdatedAt=saved.updatedAt||saved.updated_at;lastSaved=JSON.stringify(validatePicture(getPicture()));cloudEnabled=true;
    const cleanUrl=new URL(location.href);cleanUrl.searchParams.delete('example');cleanUrl.searchParams.delete('start');history.replaceState(null,'',cleanUrl);
    $('account-picture-select').value=saved.id;renderPictureList();setStatus(`${saved.is_main?'Default household':'Household'} · ${saved.name}`);message(`“${saved.name}” is open. Changes save automatically.`);
    if(dialog.open)dialog.close();
  }
  const pictureLoader=createAccountPictureLoader({
    getPicture,
    restoreOnLogin,
    fetchPicture:async userId=>{
      const {data,error:dbError}=await accountQuery(()=>client.from('user_pictures').select('id,name,is_main,picture,updated_at').eq('user_id',userId).eq('is_main',true).maybeSingle());
      if(dbError)throw dbError;
      if(user?.id!==userId)return null;
      const {data:list,error:listError}=await accountQuery(()=>client.from('user_pictures').select('id,name,is_main,updated_at').eq('user_id',userId).order('is_main',{ascending:false}).order('name'));
      if(listError)throw listError;
      if(user?.id!==userId)return null;
      renderCloudSummary(list||[]);
      return data?{...data,picture:validatePicture(data.picture),updatedAt:data.updated_at}:null;
    },
    applyPicture:applySavedHousehold,
    onAvailable:saved=>{
      if(!cloudEnabled){activePictureId=null;activePictureName='';cloudUpdatedAt='';renderPictureList();setStatus(getPicture().example?'Example · not saved':saved?'Not saved · save a version in Account':'Signed in · no default household saved');if(!saved)createMainFromCurrent();}
    },
    onEmpty:details=>{onEmpty?.(details);},
    onError:e=>{error(`Could not open your saved household. ${e.message}`);setStatus('Saved household could not load · open Account');},
  });
  function setUser(nextUser){
    const changed=user?.id!==nextUser?.id;
    if(changed){householdGeneration++;clearTimeout(timer);cloudEnabled=false;cloudUpdatedAt='';activePictureId=null;activePictureName='';cloudPictures=[];lastSaved='';}
    user=nextUser;renderSession();
    if(user && googlePopup){googlePopup.close();googlePopup=null;}
    if(user){error('');message('');}
    if(!user){pictureLoader.setUser(null);setStatus(`${getPicture().example?'Example · not saved':'Not saved · this tab only'}`);refreshProviders();return;}
    if(changed)setStatus(restoreOnLogin()?'Opening your default household…':getPicture().example?'Example · not saved':'New household · not saved');
    // Defer database requests until Supabase has released its auth callback lock.
    const userId=user.id;setTimeout(()=>{if(user?.id===userId)pictureLoader.setUser(userId);},0);
  }
  async function accountQuery(run){
    const expectedUserId=user?.id;
    const result=await queryWithSessionRefresh(run,async()=>{
      const refreshed=await client.auth.refreshSession();
      if(refreshed.data?.session?.user?.id!==expectedUserId&&refreshed.data?.session)throw new Error('The account changed. Reopen Account before saving.');
      return refreshed;
    });
    if(result.error?.code==='STEADYBEE_REAUTH_REQUIRED'){
      await client.auth.signOut({scope:'local'});setUser(null);
      error('');message('Your sign-in expired. Continue with Google to reconnect. Your open household stays here.');
    }
    return result;
  }
  async function getClient(){
    if(!clientPromise)clientPromise=import(sdkUrl).then(({createClient})=>{
      if(!SUPABASE_URL||!SUPABASE_PUBLISHABLE_KEY)throw new Error('Account saving is not configured yet.');
      client=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
      completeGoogleOAuthPopup({client,windowRef:window});
      client.auth.onAuthStateChange((event,session)=>{
        if(event==='SIGNED_IN'||event==='INITIAL_SESSION')finishSignIn();
        setUser(session?.user||null);
      });
      return client;
    });
    return clientPromise;
  }
  function renderSession(){
    renderExampleNotice();
    dialog.querySelector('.account-intro').hidden=Boolean(user);
    const setupNote=document.querySelector('#welcome-screen .privacy-note');
    if(setupNote)setupNote.textContent=user?'Your account is connected. Complete your household details to continue.':'Sign in to save your household and return on another device.';
    $('account-google-option').hidden=Boolean(user)||!googleEnabled;
    $('account-sign-in-unavailable').hidden=Boolean(user)||googleEnabled;$('account-session').hidden=!user;
    $('account-email-label').textContent=user?.email?`Signed in as ${user.email}`:'';
    button.textContent=user?'Account':'Sign in';button.title=user?'Signed in. Open account options and cloud save.':'Sign in to save your household to your account.';
    if(!user){$('account-open-picture').hidden=true;$('account-set-main').hidden=true;$('account-rename-picture').hidden=true;$('account-delete-picture').hidden=true;$('account-cloud-summary').textContent='';}
  }
  async function refreshPicture(){
    if(!client||!user)return;
    const userId=user.id;
    try{
      const {data,error:dbError}=await accountQuery(()=>client.from('user_pictures').select('id,name,is_main,updated_at').eq('user_id',userId).order('is_main',{ascending:false}).order('name'));
      if(dbError)throw dbError;
      if(user?.id!==userId)return;
      renderCloudSummary(data||[]);
    }catch(e){error(`Could not check your saved household. ${e.message}`);}
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
    const signIn=$('account-google-sign-in');if(signIn.disabled)return;
    error('');message('Continuing to Google…');signIn.disabled=true;
    try{
      const result=await startGoogleRedirectSignIn({client,redirectTo:new URL('app.html',location.href).toString(),beforeNavigate:()=>saveSignInDraft(sessionStorage,getPicture(),location.href),navigate:url=>location.assign(url)});
      if(result.user){setUser(result.user);message('You’re already signed in.');}
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
      const {data,error:dbError}=await accountQuery(()=>client.from('user_pictures').select('id,name,is_main,picture,updated_at').eq('user_id',user.id).eq('id',selected.id).single());
      if(dbError)throw dbError;
      const picture=validatePicture(data.picture);
      $('account-restore-copy').textContent=`Open “${data.name}” saved ${new Date(data.updated_at).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'})}? It replaces the household in this tab.`;
      $('account-restore-confirm').hidden=false;$('account-open-picture').hidden=true;$('account-confirm-open').focus();dialog.dataset.cloudPicture=JSON.stringify(picture);dialog.dataset.cloudUpdatedAt=data.updated_at;dialog.dataset.cloudPictureId=data.id;dialog.dataset.cloudPictureName=data.name;dialog.dataset.cloudPictureIsMain=String(data.is_main);message('Review before opening.');
    }catch(e){error(`Could not open this version. ${e.message}`);message('');}
  });
  $('account-confirm-open').addEventListener('click',()=>{
    let picture;try{picture=validatePicture(JSON.parse(dialog.dataset.cloudPicture||'null'));}catch(e){error(`Saved version could not be opened. ${e.message}`);return;}
    applySavedHousehold({picture,id:dialog.dataset.cloudPictureId,name:dialog.dataset.cloudPictureName,updated_at:dialog.dataset.cloudUpdatedAt,is_main:dialog.dataset.cloudPictureIsMain==='true'});
  });
  $('account-cancel-open').addEventListener('click',()=>{$('account-restore-confirm').hidden=true;renderPictureList();});
  async function setMainPicture(id){
    const previous=cloudPictures.find(item=>item.is_main);
    if(previous?.id===id)return;
    if(previous){const {error:unsetError}=await accountQuery(()=>client.from('user_pictures').update({is_main:false}).eq('user_id',user.id).eq('id',previous.id));if(unsetError)throw unsetError;}
    const {error:setError}=await accountQuery(()=>client.from('user_pictures').update({is_main:true}).eq('user_id',user.id).eq('id',id));
    if(setError){if(previous)await accountQuery(()=>client.from('user_pictures').update({is_main:true}).eq('user_id',user.id).eq('id',previous.id));throw setError;}
    await refreshPicture();message('Default household updated. It opens automatically next time you sign in.');
  }
  $('account-set-main').addEventListener('click',async()=>{try{const selected=selectedPicture();if(selected)await setMainPicture(selected.id);}catch(e){error(`Could not change the default household. ${e.message}`);}});
  $('account-rename-picture').addEventListener('click',()=>{
    const selected=selectedPicture();if(!selected)return;
    const form=$('account-picture-name-form');form.hidden=false;form.dataset.mode='rename';form.dataset.pictureId=selected.id;
    $('account-picture-name').value=selected.name;$('account-picture-make-main').checked=selected.is_main;$('account-picture-name').focus();
  });
  $('account-picture-name-form').addEventListener('submit',async event=>{
    event.preventDefault();error('');message('');
    const form=$('account-picture-name-form'),name=$('account-picture-name').value.trim(),makeMain=$('account-picture-make-main').checked||!cloudPictures.some(item=>item.is_main);
    if(!name){error('Enter a name for this version.');return;}
    if(cloudPictures.some(item=>item.name.toLocaleLowerCase()===name.toLocaleLowerCase()&&item.id!==form.dataset.pictureId)){error('A saved version already uses that name. Choose a different name.');return;}
    try{
      if(!user)throw new Error('Sign in before saving.');
      if(form.dataset.mode==='rename'){
        const id=form.dataset.pictureId,{error:renameError}=await accountQuery(()=>client.from('user_pictures').update({name}).eq('user_id',user.id).eq('id',id));if(renameError)throw renameError;
        if(activePictureId===id)activePictureName=name;
        await refreshPicture();$('account-picture-select').value=id;if(makeMain)await setMainPicture(id);message(`Version renamed to “${name}”.`);
      }else{
        const picture={...validatePicture(getPicture()),example:false},id=crypto.randomUUID(),now=new Date().toISOString();
        const {error:insertError}=await accountQuery(()=>client.from('user_pictures').insert({id,user_id:user.id,name,is_main:false,picture,updated_at:now}));if(insertError)throw insertError;
        if(makeMain)await setMainPicture(id);
        cloudEnabled=false;restorePicture(picture);activePictureId=id;activePictureName=name;cloudUpdatedAt=now;lastSaved=JSON.stringify(validatePicture(getPicture()));cloudEnabled=true;
        await refreshPicture();$('account-picture-select').value=id;renderPictureList();setStatus(`Household · ${name}`);message(`“${name}” saved. Changes now sync to this version.`);
      }
      form.hidden=true;form.reset();
    }catch(e){error(`Your household version was not saved. ${e.message}`);}
  });
  $('account-delete-picture').addEventListener('click',async()=>{
    const selected=selectedPicture();if(!selected||selected.is_main)return;
    if(!window.confirm(`Delete the “${selected.name}” version from your account? This cannot be undone.`))return;
    error('');
    try{const {error:dbError}=await accountQuery(()=>client.from('user_pictures').delete().eq('user_id',user.id).eq('id',selected.id));if(dbError)throw dbError;if(activePictureId===selected.id){cloudEnabled=false;activePictureId=null;activePictureName='';cloudUpdatedAt='';lastSaved='';setStatus('Current household is not saved to your account');}message(`“${selected.name}” version deleted.`);await refreshPicture();}
    catch(e){error(`Could not delete this version. ${e.message}`);}
  });
  $('account-sign-out').addEventListener('click',async()=>{
    try{await getClient();const {error:authError}=await client.auth.signOut();if(authError)throw authError;setUser(null);message('Signed out. The open tab remains here.');setStatus('Signed out');}
    catch(e){error(`Could not sign out. ${e.message}`);}
  });
  function scheduleCloudSave(){
    if(!user){setStatus();return;}
    const current=getPicture();
    if(current?.example){setStatus('Public example · not saved');return;}
    if(!current?.holdings?.name?.trim()||!Number.isInteger(current.holdings.age)){setStatus('Finish your household details to save');return;}
    if(!cloudEnabled){setStatus(cloudPictures.some(item=>item.is_main)?'Not saved · save a version in Account':'Preparing your default household…');createMainFromCurrent();return;}
    if(JSON.stringify(getPicture())===lastSaved){setStatus(`Household · ${activePictureName}`);return;}
    setStatus('Saving to your account…');clearTimeout(timer);timer=setTimeout(()=>{const task=saving.then(autoSave);saving=task.catch(()=>{});},650);
  }
  async function autoSave(){
    if(!cloudEnabled||!user)return;
    const userId=user.id,pictureId=activePictureId,requestGeneration=householdGeneration,expectedUpdatedAt=cloudUpdatedAt;
    const currentRequest=()=>user?.id===userId&&activePictureId===pictureId&&householdGeneration===requestGeneration;
    try{
      const picture=validatePicture(getPicture()),serial=JSON.stringify(picture);if(serial===lastSaved)return;
      const timestamp=new Date().toISOString();
      if(!activePictureId)throw new Error('Choose or save a named version before syncing changes.');
      const request=()=>{
        if(!currentRequest())return Promise.resolve({data:null,error:new Error('The open household changed before saving.')});
        return client.from('user_pictures').update({picture,updated_at:timestamp}).eq('user_id',userId).eq('id',pictureId).eq('updated_at',expectedUpdatedAt).select('updated_at').maybeSingle();
      };
      const {data,error:dbError}=await accountQuery(request);
      if(!currentRequest())return;
      if(dbError)throw dbError;
      if(!data){cloudEnabled=false;setStatus('Cloud version changed elsewhere');if(dialog.open)error('Another tab updated this saved version. Reopen it before continuing so you do not overwrite newer changes.');return;}
      cloudUpdatedAt=data.updated_at;lastSaved=serial;setStatus(`Household · ${activePictureName}`);
    }catch(e){if(!currentRequest())return;cloudEnabled=false;setStatus('Cloud save needs attention');if(dialog.open)error(`Latest changes were not saved to your account. ${e.message}`);}
  }
  document.addEventListener('picture-updated',scheduleCloudSave);
  getClient().then(async()=>{const {data}=await client.auth.getSession();setUser(data.session?.user||null);}).catch(()=>{});
  renderSession();
  return {open:openAccount,async analysisToken(){await getClient();const {data,error}=await client.auth.getSession();if(error || !data.session)throw new Error('Sign in to request AI review.');return data.session.access_token;},detach(){householdGeneration++;clearTimeout(timer);cloudEnabled=false;activePictureId=null;activePictureName='';cloudUpdatedAt='';lastSaved='';setStatus('Not saved · save a version in Account');}};
}
