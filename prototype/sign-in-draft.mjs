import {validatePicture} from './picture-storage.mjs?v=20261024persona1';
const key='steadybee-sign-in-draft-v1',lifetime=30*60*1000;
/** One short-lived, tab-scoped checkpoint; never store auth tokens with the draft. */
export function saveSignInDraft(storage,picture,returnUrl,now=Date.now()){
  const url=new URL(returnUrl);
  const safe=new URL('app.html',url);for(const name of ['example','start'])if(url.searchParams.has(name))safe.searchParams.set(name,url.searchParams.get(name));
  const section=url.hash.slice(1);safe.hash=['assets','flow','planning','inheritance','insights'].includes(section)?section:'assets';
  storage.setItem(key,JSON.stringify({version:1,created:now,returnUrl:safe.href,picture:validatePicture(picture)}));
}
export function takeSignInDraft(storage,currentUrl,now=Date.now()){
  try{
    const raw=storage.getItem(key);if(!raw)return null;storage.removeItem(key);
    const value=JSON.parse(raw),current=new URL(currentUrl),target=new URL(value.returnUrl);
    if(value.version!==1 || !Number.isFinite(value.created) || value.created>now || now-value.created>lifetime || target.origin!==current.origin || target.pathname!==new URL('app.html',current).pathname)return null;
    if([...target.searchParams.keys()].some(name=>!['example','start'].includes(name)) || !['assets','flow','planning','inheritance','insights'].includes(target.hash.slice(1)))return null;
    return {...value,picture:validatePicture(value.picture)};
  }catch{return null;}
}
