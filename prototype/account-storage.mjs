import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from './cloud-config.mjs?v=20261017account1';
import {validatePicture} from './picture-storage.mjs?v=20261017account1';
import {updateSaveStatus} from './save-status.mjs?v=20261017profile1';

const sdkUrl='https://esm.sh/@supabase/supabase-js@2.118.0?bundle';

/** Restore once per account, only while the opening example remains untouched. */
export function createAccountPictureLoader({getPicture,fetchPicture,applyPicture,onAvailable,onError}) {
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
      else onAvailable(saved);
    }).catch(e=>{
      if(requestGeneration!==generation)return;
      pending=null;onError(e);
    });
    return pending;
  }};
}

/** Signed-in cloud storage for one validated household picture per account. */
export function mountAccountStorage({button,getPicture,restorePicture,editPeople}) {
  let clientPromise=null,client=null,user=null,cloudEnabled=false,cloudUpdatedAt='',lastSaved='',timer=null,saving=Promise.resolve(),errorMessage='';
  const dialog=document.createElement('dialog');dialog.id='account-dialog';dialog.className='form-dialog storage-dialog account-dialog';dialog.setAttribute('aria-labelledby','account-title');
  dialog.innerHTML=`<div class="dialog-heading"><h2 id="account-title">Your Steadybee account</h2><button id="account-close" class="icon-button" type="button" aria-label="Close account options">×</button></div>
    <p class="account-intro">Sign in with your email. We’ll send a one-time link so you don’t need another password.</p>
    <p id="account-error" class="form-error" role="alert" hidden></p><p id="account-message" role="status" aria-live="polite"></p>
    <form id="account-email-form"><label for="account-email">Email address</label><input id="account-email" type="email" autocomplete="email" required maxlength="254" /><button class="button button-primary" type="submit">Email me a sign-in link</button></form>
    <section id="account-session" hidden><p id="account-email-label" class="account-email-label"></p>
      <div id="account-cloud-summary" class="account-cloud-summary"></div>
      <div class="account-actions"><button id="account-open-picture" class="button button-primary" type="button" hidden>Open saved picture</button><button id="account-save-picture" class="button button-secondary" type="button">Save this picture to my account</button></div>
      <div id="account-restore-confirm" class="account-restore-confirm" hidden><p id="account-restore-copy">This will replace the picture open in this tab.</p><button id="account-confirm-open" class="button button-primary" type="button">Open saved picture</button><button id="account-cancel-open" class="button button-secondary" type="button">Keep this tab</button></div>
      <button id="account-delete-picture" class="text-button text-button-danger" type="button" hidden>Delete saved cloud picture</button>
      <button id="account-sign-out" class="text-button" type="button">Sign out</button>
    </section>
    <p class="account-privacy">Your account picture is stored in Supabase cloud storage. App access rules restrict it to your signed-in account, but this is not end-to-end encryption: project administrators can access the record. For a passphrase-encrypted copy, use <strong>Save picture</strong> and download a device backup.</p>`;
  document.body.append(dialog);const $=id=>dialog.querySelector(`#${id}`);
  const status=document.getElementById('picture-save-status');
  function message(text){$('account-message').textContent=text;}
  function error(text){errorMessage=text;$('account-error').textContent=text;$('account-error').hidden=!text;}
  function setStatus(text){updateSaveStatus(status,'account',user?text:null);}
  const peopleButton=document.createElement('button');peopleButton.type='button';peopleButton.className='button button-secondary';peopleButton.textContent='Manage people';peopleButton.addEventListener('click',()=>{dialog.close();editPeople?.();});$('account-session').prepend(peopleButton);
  function renderCloudSummary(data){
    if(!cloudEnabled)cloudUpdatedAt=data?.updated_at||'';
    $('account-open-picture').hidden=!data;$('account-delete-picture').hidden=!data;
    $('account-cloud-summary').textContent=data?`Saved picture · ${new Date(data.updated_at).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'})}`:'No picture saved to this account yet.';
    $('account-save-picture').textContent=data&&!cloudEnabled?'Replace saved picture with this tab':'Save this picture to my account';
  }
  const pictureLoader=createAccountPictureLoader({
    getPicture,
    fetchPicture:async userId=>{
      const {data,error:dbError}=await client.from('user_pictures').select('picture,updated_at').eq('user_id',userId).maybeSingle();
      if(dbError)throw dbError;
      if(user?.id!==userId)return null;
      renderCloudSummary(data);
      return data?{picture:validatePicture(data.picture),updatedAt:data.updated_at}:null;
    },
    applyPicture:saved=>{
      clearTimeout(timer);cloudEnabled=false;
      restorePicture(saved.picture);
      cloudUpdatedAt=saved.updatedAt;lastSaved=JSON.stringify(validatePicture(getPicture()));cloudEnabled=true;
      setStatus('Saved to your account');message('Your saved picture is open. Changes save automatically.');
      if(dialog.open)dialog.close();
    },
    onAvailable:saved=>{
      if(!cloudEnabled)setStatus(saved?'Saved picture available · open Account':'Signed in · no saved picture');
    },
    onError:e=>{error(`Could not open your saved picture. ${e.message}`);setStatus('Saved picture could not load · open Account');},
  });
  function setUser(nextUser){
    const changed=user?.id!==nextUser?.id;
    if(changed){clearTimeout(timer);cloudEnabled=false;cloudUpdatedAt='';lastSaved='';}
    user=nextUser;renderSession();
    if(!user){pictureLoader.setUser(null);setStatus(`${getPicture().example?'Example · not saved':'Not saved · this tab only'}`);return;}
    if(changed)setStatus('Opening your saved picture…');
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
    $('account-email-form').hidden=Boolean(user);$('account-session').hidden=!user;
    $('account-email-label').textContent=user?.email||'';
    button.textContent=user?'Account':'Sign in';button.title=user?'Signed in. Open account options and cloud save.':'Sign in to save a picture to your account.';
    if(!user){$('account-open-picture').hidden=true;$('account-delete-picture').hidden=true;$('account-cloud-summary').textContent='';}
  }
  async function refreshPicture(){
    if(!client||!user)return;
    const userId=user.id;
    try{
      const {data,error:dbError}=await client.from('user_pictures').select('updated_at').eq('user_id',userId).maybeSingle();
      if(dbError)throw dbError;
      if(user?.id!==userId)return;
      renderCloudSummary(data);
    }catch(e){error(`Could not check your saved picture. ${e.message}`);}
  }
  async function openAccount(){
    error('');message('');$('account-restore-confirm').hidden=true;
    try{await getClient();const {data}=await client.auth.getSession();user=data.session?.user||null;renderSession();if(user)await refreshPicture();}
    catch(e){error(`Account sign-in is unavailable. ${e.message}`);}
    dialog.showModal();
  }
  button.addEventListener('click',openAccount);
  $('account-close').addEventListener('click',()=>dialog.close());
  $('account-email-form').addEventListener('submit',async event=>{
    event.preventDefault();error('');message('Sending sign-in link…');
    try{
      await getClient();
      const email=$('account-email').value.trim();
      const emailRedirectTo=new URL('app.html',location.href).toString();
      const {error:authError}=await client.auth.signInWithOtp({email,options:{emailRedirectTo,shouldCreateUser:true}});
      if(authError)throw authError;
      message('Check your email for a one-time sign-in link. Return to this tab after opening it.');
    }catch(e){error(`Could not send a sign-in link. ${e.message}`);message('');}
  });
  $('account-save-picture').addEventListener('click',async()=>{
    error('');message('Saving your picture…');
    try{
      await getClient();const {data}=await client.auth.getSession();user=data.session?.user;
      if(!user)throw new Error('Sign in before saving.');
      if(cloudUpdatedAt && !window.confirm('Replace the picture already saved to this account with the picture in this tab?')){message('Saved account picture was left unchanged.');return;}
      const picture={...validatePicture(getPicture()),example:false},now=new Date().toISOString();
      const {error:dbError}=await client.from('user_pictures').upsert({user_id:user.id,picture,updated_at:now},{onConflict:'user_id'});
      if(dbError)throw dbError;
      cloudEnabled=false;restorePicture(picture);cloudEnabled=true;cloudUpdatedAt=now;lastSaved=JSON.stringify(getPicture());message('Saved to your account. Changes in this tab will now save automatically.');
      $('account-cloud-summary').textContent=`Saved just now · ${new Date(now).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'})}`;
      $('account-open-picture').hidden=false;$('account-delete-picture').hidden=false;$('account-save-picture').textContent='Save this picture again';
      setStatus('Saved to your account');
    }catch(e){error(`Your cloud picture was not saved. ${e.message}`);message('');}
  });
  $('account-open-picture').addEventListener('click',async()=>{
    error('');message('Loading saved picture…');
    try{
      await getClient();const {data:session}=await client.auth.getSession();user=session.session?.user;
      if(!user)throw new Error('Sign in before opening the saved picture.');
      const {data,error:dbError}=await client.from('user_pictures').select('picture,updated_at').eq('user_id',user.id).single();
      if(dbError)throw dbError;
      const picture=validatePicture(data.picture);
      $('account-restore-copy').textContent=`Saved ${new Date(data.updated_at).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'})}. Opening it replaces the picture in this tab.`;
      $('account-restore-confirm').hidden=false;$('account-confirm-open').focus();dialog.dataset.cloudPicture=JSON.stringify(picture);dialog.dataset.cloudUpdatedAt=data.updated_at;message('Review before opening.');
    }catch(e){error(`Could not open your saved picture. ${e.message}`);message('');}
  });
  $('account-confirm-open').addEventListener('click',()=>{
    let picture;try{picture=validatePicture(JSON.parse(dialog.dataset.cloudPicture||'null'));}catch(e){error(`Saved picture could not be opened. ${e.message}`);return;}
    cloudEnabled=false;restorePicture(picture);cloudUpdatedAt=dialog.dataset.cloudUpdatedAt||'';lastSaved=JSON.stringify(getPicture());cloudEnabled=true;setStatus('Saved to your account');dialog.close();
  });
  $('account-cancel-open').addEventListener('click',()=>{$('account-restore-confirm').hidden=true;});
  $('account-delete-picture').addEventListener('click',async()=>{
    if(!window.confirm('Delete the saved picture from your account? This cannot be undone.'))return;
    error('');
    try{await getClient();const {data}=await client.auth.getSession();const activeUser=data.session?.user;if(!activeUser)throw new Error('Sign in before deleting.');const {error:dbError}=await client.from('user_pictures').delete().eq('user_id',activeUser.id);if(dbError)throw dbError;cloudEnabled=false;cloudUpdatedAt='';lastSaved='';message('Saved cloud picture deleted. Your account remains active.');await refreshPicture();setStatus('Cloud picture deleted');}
    catch(e){error(`Could not delete the cloud picture. ${e.message}`);}
  });
  $('account-sign-out').addEventListener('click',async()=>{
    try{await getClient();const {error:authError}=await client.auth.signOut();if(authError)throw authError;user=null;cloudEnabled=false;renderSession();message('Signed out. The open tab remains here.');setStatus('Signed out');}
    catch(e){error(`Could not sign out. ${e.message}`);}
  });
  function scheduleCloudSave(){
    if(!cloudEnabled||!user)return;
    if(JSON.stringify(getPicture())===lastSaved){setStatus('Saved to your account');return;}
    setStatus('Saving to your account…');clearTimeout(timer);timer=setTimeout(()=>{const task=saving.then(autoSave);saving=task.catch(()=>{});},650);
  }
  async function autoSave(){
    if(!cloudEnabled||!user)return;
    try{
      const picture=validatePicture(getPicture()),serial=JSON.stringify(picture);if(serial===lastSaved)return;
      const timestamp=new Date().toISOString();
      let request;
      if(cloudUpdatedAt)request=client.from('user_pictures').update({picture,updated_at:timestamp}).eq('user_id',user.id).eq('updated_at',cloudUpdatedAt).select('updated_at').maybeSingle();
      else request=client.from('user_pictures').insert({user_id:user.id,picture,updated_at:timestamp}).select('updated_at').maybeSingle();
      const {data,error:dbError}=await request;
      if(dbError)throw dbError;
      if(!data){cloudEnabled=false;setStatus('Cloud copy changed elsewhere');if(dialog.open)error('Another tab updated this saved picture. Reopen it before continuing so you do not overwrite newer changes.');return;}
      cloudUpdatedAt=data.updated_at;lastSaved=serial;setStatus('Saved to your account');
      if(dialog.open)$('account-cloud-summary').textContent=`Saved just now · ${new Date(data.updated_at).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'})}`;
    }catch(e){cloudEnabled=false;setStatus('Cloud save needs attention');if(dialog.open)error(`Latest changes were not saved to your account. ${e.message}`);}
  }
  document.addEventListener('picture-updated',scheduleCloudSave);
  getClient().then(async()=>{const {data}=await client.auth.getSession();setUser(data.session?.user||null);}).catch(()=>{});
  renderSession();
  return {open:openAccount};
}
