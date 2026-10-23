import test from 'node:test';
import assert from 'node:assert/strict';
import {createEmailLinkRequest} from '../prototype/email-link-request.mjs';

test('an existing session never sends another sign-in email',async()=>{
  let sends=0;const user={id:'test'};
  const request=createEmailLinkRequest({getUser:async()=>user,sendLink:async()=>{sends++;}});
  assert.deepEqual(await request.send('test@example.invalid','http://test/app'),{kind:'signed-in',user});assert.equal(sends,0);
});

test('double submits and resends during cooldown make only one email request',async()=>{
  let done,sends=0,time=0;const response=new Promise(resolve=>{done=resolve;});
  const request=createEmailLinkRequest({getUser:async()=>null,sendLink:async()=>{sends++;return response;},now:()=>time});
  const first=request.send('test@example.invalid','http://test/app');
  assert.equal((await request.send('test@example.invalid','http://test/app')).kind,'busy');
  done({error:null});assert.equal((await first).kind,'sent');
  assert.equal((await request.send('test@example.invalid','http://test/app')).kind,'cooldown');assert.equal(sends,1);
  time=60_001;assert.equal(request.secondsRemaining(),0);
});

test('provider limits create a shared backoff without retrying automatically',async()=>{
  const data=new Map(),storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};let sends=0;
  const options={storage,now:()=>1000,getUser:async()=>null,sendLink:async()=>{sends++;return {error:{status:429,code:'over_email_send_rate_limit'}};}};
  const request=createEmailLinkRequest(options);
  assert.equal((await request.send('test@example.invalid','http://test/app')).kind,'rate-limited');
  assert.equal(request.secondsRemaining(),300);
  const anotherTab=createEmailLinkRequest(options);
  assert.equal((await anotherTab.send('test@example.invalid','http://test/app')).kind,'cooldown');assert.equal(sends,1);
});
