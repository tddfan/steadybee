import test from 'node:test';
import assert from 'node:assert/strict';
import {createAccountPictureLoader,queryWithSessionRefresh} from '../prototype/account-storage.mjs';

function fixture(fetchPicture,example=true,restoreOnLogin=()=>true){
  let picture={example,holdings:{name:'Demo',assets:[]},planning:{}};
  const restored=[],available=[],errors=[],requests=[],empties=[];
  const loader=createAccountPictureLoader({
    getPicture:()=>structuredClone(picture),restoreOnLogin,
    fetchPicture:async userId=>{requests.push(userId);return fetchPicture(userId);},
    applyPicture:saved=>{restored.push(saved);picture=structuredClone(saved.picture);},
    onAvailable:saved=>available.push(saved),onEmpty:()=>{empties.push(true);picture={...picture,example:false};},onError:error=>errors.push(error),
  });
  return {loader,restored,available,errors,requests,empties,getPicture:()=>structuredClone(picture),edit:()=>{picture.holdings.assets.push({value:123});}};
}
const saved=id=>({picture:{example:false,holdings:{name:`Account ${id}`,assets:[]},planning:{}},updatedAt:'2026-01-01T00:00:00Z'});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};

test('returning account restores its picture once despite duplicate auth events',async()=>{
  const response=deferred(),f=fixture(()=>response.promise);
  const first=f.loader.setUser('one'),duplicate=f.loader.setUser('one');
  response.resolve(saved('one'));await Promise.all([first,duplicate]);
  await f.loader.setUser('one');
  assert.deepEqual(f.requests,['one']);assert.deepEqual(f.restored,[saved('one')]);
  assert.deepEqual(f.errors,[]);
});

test('the default household takes precedence over local edits on a normal sign-in',async()=>{
  for(const editBefore of [true,false]){
    const response=deferred(),f=fixture(()=>response.promise);
    if(editBefore)f.edit();
    const loading=f.loader.setUser('one');
    if(!editBefore)f.edit();
    response.resolve(saved('one'));await loading;
    assert.deepEqual(f.restored,[saved('one')]);assert.deepEqual(f.available,[]);
  }
});

test('a response for a signed-out or different account cannot restore its private picture',async()=>{
  const oldResponse=deferred(),newResponse=deferred();
  const f=fixture(id=>id==='one'?oldResponse.promise:newResponse.promise);
  const oldRequest=f.loader.setUser('one');
  await f.loader.setUser(null);
  const newRequest=f.loader.setUser('two');
  oldResponse.resolve(saved('one'));await oldRequest;
  assert.deepEqual(f.restored,[]);
  newResponse.resolve(saved('two'));await newRequest;
  assert.deepEqual(f.restored,[saved('two')]);
});

test('missing cloud picture clears an untouched demo and performs no restore',async()=>{
  const f=fixture(()=>null);await f.loader.setUser('one');
  assert.deepEqual(f.restored,[]);assert.deepEqual(f.available,[null]);assert.deepEqual(f.empties,[true]);assert.deepEqual(f.errors,[]);
});

test('missing cloud picture does not clear a demo that the user has edited',async()=>{
  const f=fixture(()=>null);f.edit();await f.loader.setUser('one');
  assert.deepEqual(f.restored,[]);assert.deepEqual(f.available,[null]);assert.deepEqual(f.empties,[true]);assert.equal(f.getPicture().holdings.assets.length,1);assert.deepEqual(f.errors,[]);
});

test('returning users load their saved default instead of a local household',async()=>{
  const f=fixture(()=>saved('one'),false);await f.loader.setUser('one');
  assert.deepEqual(f.restored,[saved('one')]);assert.deepEqual(f.available,[]);
});

test('a failed account read can retry without replacing the tab with fallback data',async()=>{
  let attempts=0;const f=fixture(()=>{if(!attempts++)throw Error('Unavailable');return saved('one');});
  await f.loader.setUser('one');assert.equal(f.errors.length,1);assert.deepEqual(f.restored,[]);
  await f.loader.setUser('one');assert.deepEqual(f.restored,[saved('one')]);
});

test('explicit sample and setup routes keep their household instead of loading the account default',async()=>{
  for(const example of [true,false]){
    const f=fixture(()=>saved('one'),example,()=>false);await f.loader.setUser('one');
    assert.deepEqual(f.restored,[]);assert.deepEqual(f.available,[saved('one')]);assert.equal(f.getPicture().holdings.name,'Demo');
  }
});


test('an expired JWT refreshes once before retrying the account query',async()=>{
  let attempts=0,refreshes=0;
  const result=await queryWithSessionRefresh(async()=>++attempts===1?{error:{message:'JWT expired'}}:{data:{id:'saved'}},async()=>{refreshes++;return {data:{session:{user:{id:'one'}}}};});
  assert.equal(attempts,2);assert.equal(refreshes,1);assert.equal(result.data.id,'saved');
});
test('invalid refresh tokens produce a sign-in action instead of an endless retry',async()=>{
  let attempts=0;
  const result=await queryWithSessionRefresh(async()=>{attempts++;return {error:{message:'JWT expired'}};},async()=>({error:Error('Refresh token invalid')}));
  assert.equal(attempts,1);assert.equal(result.error.code,'STEADYBEE_REAUTH_REQUIRED');assert.match(result.error.message,/Continue with Google/);
});

test('temporary refresh network failures keep the session available for retry',async()=>{
  const result=await queryWithSessionRefresh(async()=>({error:{message:'JWT expired'}}),async()=>({error:{name:'AuthRetryableFetchError'}}));
  assert.equal(result.error.code,undefined);assert.match(result.error.message,/connection/);
});
