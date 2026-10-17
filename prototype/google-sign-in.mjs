/** Open OAuth separately so sign-in never discards unsaved household inputs. */
export async function startGoogleSignIn({client,redirectTo,openWindow}){
  const popup=openWindow();
  if(!popup)throw new Error('Allow a sign-in window for Steadybee, then try again.');
  popup.opener=null;
  try{
    const {data:session,error:sessionError}=await client.auth.getSession();
    if(sessionError)throw sessionError;
    if(session.session?.user){popup.close();return {user:session.session.user};}
    const {data,error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo,skipBrowserRedirect:true,queryParams:{prompt:'select_account'}}});
    if(error)throw error;
    if(!data?.url || new URL(data.url).protocol!=='https:')throw new Error('Google sign-in could not be opened.');
    popup.location.replace(data.url);
    return {popup};
  }catch(error){popup.close();throw error;}
}

export async function googleProviderEnabled({url,key,fetcher=fetch}){
  const response=await fetcher(`${url}/auth/v1/settings`,{headers:{apikey:key},signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw new Error('Sign-in options could not be checked.');
  return (await response.json()).external?.google===true;
}
