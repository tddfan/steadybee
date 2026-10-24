/** Open OAuth separately so sign-in never discards unsaved household inputs. */
export async function startGoogleSignIn({client,redirectTo,openWindow}){
  const popup=openWindow();
  if(!popup)throw new Error('Allow a sign-in window for Steadybee, then try again.');
  try{
    const requestedRedirect=new URL(redirectTo);
    if(!['http:','https:'].includes(requestedRedirect.protocol))throw new Error('The sign-in return address is invalid.');
    const {data:session,error:sessionError}=await client.auth.getSession();
    if(sessionError)throw sessionError;
    if(session.session?.user){popup.close();return {user:session.session.user};}
    const {data,error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo,skipBrowserRedirect:true,queryParams:{prompt:'select_account'}}});
    if(error)throw error;
    if(!data?.url || new URL(data.url).protocol!=='https:')throw new Error('Google sign-in could not be opened.');
    const actualRedirect=new URL(data.url).searchParams.get('redirect_to');
    if(actualRedirect && actualRedirect!==requestedRedirect.href)throw new Error('Supabase returned a different sign-in address. Check the allowed return URLs in Supabase Auth settings.');
    popup.location.replace(data.url);
    return {popup};
  }catch(error){popup.close();throw error;}
}

/** Complete OAuth in a named popup and return the user to the still-open app. */
export function isGoogleOAuthPopup(windowRef=window){
  // window.name may be cleared by modern browsers on cross-site OAuth hops;
  // the OAuth response fragment plus the still-open opener identifies this flow.
  return Boolean(windowRef.opener)&&(/access_token=/.test(windowRef.location.hash)||new URLSearchParams(windowRef.location.search).has('code'));
}

export function completeGoogleOAuthPopup({client,windowRef=window,onComplete=()=>{}}){
  if(!isGoogleOAuthPopup(windowRef))return false;
  let subscription;
  const finish=(session)=>{
    if(!session?.user)return;
    try{windowRef.opener.postMessage({type:'steadybee-google-sign-in-complete'},windowRef.location.origin);}catch{}
    subscription?.unsubscribe();
    onComplete(session.user);
    windowRef.close();
  };
  const result=client.auth.onAuthStateChange((_event,session)=>finish(session));
  subscription=result?.data?.subscription;
  return true;
}

export async function googleProviderEnabled({url,key,fetcher=fetch}){
  const response=await fetcher(`${url}/auth/v1/settings`,{headers:{apikey:key},signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw new Error('Sign-in options could not be checked.');
  return (await response.json()).external?.google===true;
}

/** Complete new sign-ins in the current tab, including installed/PWA browsers. */
export async function startGoogleRedirectSignIn({client,redirectTo,beforeNavigate=()=>{},navigate}){
  const target=new URL(redirectTo);
  if(!['http:','https:'].includes(target.protocol))throw new Error('The sign-in return address is invalid.');
  const {data:session,error:sessionError}=await client.auth.getSession();
  if(sessionError)throw sessionError;
  if(session.session?.user)return {user:session.session.user};
  const {data,error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo,skipBrowserRedirect:true,queryParams:{prompt:'select_account'}}});
  if(error)throw error;
  if(!data?.url || new URL(data.url).protocol!=='https:')throw new Error('Google sign-in could not be opened.');
  const actualRedirect=new URL(data.url).searchParams.get('redirect_to');
  if(actualRedirect && actualRedirect!==target.href)throw new Error('The sign-in return address does not match this app. Check Supabase’s allowed return URLs.');
  await beforeNavigate();
  navigate(data.url);
  return {redirecting:true};
}
