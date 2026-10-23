const key='steadybee.auth.link-retry-at';

/** One request at a time, with a resend delay shared by tabs on this origin. */
export function createEmailLinkRequest({getUser,sendLink,storage=null,now=Date.now}){
  let sending=false,retryAt=0;
  const read=()=>{try{return Math.max(retryAt,Number(storage?.getItem(key))||0);}catch{return retryAt;}};
  const pause=duration=>{retryAt=now()+duration;try{storage?.setItem(key,String(retryAt));}catch{}};
  const secondsRemaining=()=>Math.max(0,Math.ceil((read()-now())/1000));
  return {secondsRemaining,isSending:()=>sending,async send(email,emailRedirectTo){
    if(sending)return {kind:'busy'};
    sending=true;
    try{
      const user=await getUser();
      if(user)return {kind:'signed-in',user};
      if(secondsRemaining())return {kind:'cooldown'};
      const {error}=await sendLink({email,options:{emailRedirectTo,shouldCreateUser:true}});
      if(error){
        const limited=error.status===429||error.code==='over_email_send_rate_limit'||/rate limit/i.test(error.message||'');
        pause(limited?300_000:60_000);
        if(limited)return {kind:'rate-limited'};
        throw error;
      }
      pause(60_000);return {kind:'sent'};
    }finally{sending=false;}
  }};
}
