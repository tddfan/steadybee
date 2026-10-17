import test from 'node:test';
import assert from 'node:assert/strict';
import {startGoogleSignIn,googleProviderEnabled} from '../prototype/google-sign-in.mjs';

function popup(){return {opener:{},closed:false,url:null,close(){this.closed=true;},location:{replace(url){this.url=url;}}};}

test('Google OAuth uses a separate window and only requests the configured provider',async()=>{
  const window=popup();let request;
  const client={auth:{getSession:async()=>({data:{session:null}}),signInWithOAuth:async options=>{request=options;return {data:{url:'https://project.supabase.co/auth/v1/authorize?provider=google'}};}}};
  const result=await startGoogleSignIn({client,redirectTo:'https://steadybee.netlify.app/app.html',openWindow:()=>window});
  assert.equal(result.popup,window);assert.equal(window.opener,null);assert.equal(window.closed,false);
  assert.deepEqual(request,{provider:'google',options:{redirectTo:'https://steadybee.netlify.app/app.html',skipBrowserRedirect:true,queryParams:{prompt:'select_account'}}});
  assert.match(window.location.url,/provider=google/);
});

test('existing sessions do not start OAuth or replace the open picture',async()=>{
  const window=popup(),user={id:'test'};
  const client={auth:{getSession:async()=>({data:{session:{user}}}),signInWithOAuth:()=>{throw Error('Must not start another login');}}};
  const result=await startGoogleSignIn({client,redirectTo:'https://example.invalid/app',openWindow:()=>window});
  assert.equal(result.user,user);assert.equal(window.closed,true);
});

test('blocked sign-in windows and provider errors are handled without navigating the app',async()=>{
  await assert.rejects(()=>startGoogleSignIn({openWindow:()=>null}),/Allow a sign-in window/);
  const window=popup(),client={auth:{getSession:async()=>({data:{session:null}}),signInWithOAuth:async()=>({error:Error('Provider unavailable')})}};
  await assert.rejects(()=>startGoogleSignIn({client,openWindow:()=>window}),/Provider unavailable/);assert.equal(window.closed,true);
});

test('Google is offered only when Supabase explicitly enables it',async()=>{
  for(const enabled of [false,true,'true',undefined]){
    const result=await googleProviderEnabled({url:'https://project.supabase.co',key:'public-test-key',fetcher:async()=>({ok:true,json:async()=>({external:{google:enabled}})})});
    assert.equal(result,enabled===true);
  }
});
