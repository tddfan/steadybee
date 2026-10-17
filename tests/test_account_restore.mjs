import test from 'node:test';
import assert from 'node:assert/strict';
import {createAccountPictureLoader} from '../prototype/account-storage.mjs';

function fixture(fetchPicture,example=true){
  let picture={example,holdings:{name:'Demo',assets:[]},planning:{}};
  const restored=[],available=[],errors=[],requests=[];
  const loader=createAccountPictureLoader({
    getPicture:()=>structuredClone(picture),
    fetchPicture:async userId=>{requests.push(userId);return fetchPicture(userId);},
    applyPicture:saved=>{restored.push(saved);picture=structuredClone(saved.picture);},
    onAvailable:saved=>available.push(saved),onError:error=>errors.push(error),
  });
  return {loader,restored,available,errors,requests,edit:()=>{picture.holdings.assets.push({value:123});}};
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

test('edits made before sign-in or while loading are kept instead of silently replaced',async()=>{
  for(const editBefore of [true,false]){
    const response=deferred(),f=fixture(()=>response.promise);
    if(editBefore)f.edit();
    const loading=f.loader.setUser('one');
    if(!editBefore)f.edit();
    response.resolve(saved('one'));await loading;
    assert.deepEqual(f.restored,[]);assert.deepEqual(f.available,[saved('one')]);
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

test('missing cloud picture leaves the demo available and performs no restore',async()=>{
  const f=fixture(()=>null);await f.loader.setUser('one');
  assert.deepEqual(f.restored,[]);assert.deepEqual(f.available,[null]);assert.deepEqual(f.errors,[]);
});

test('an existing personal picture always requires an explicit choice to replace',async()=>{
  const f=fixture(()=>saved('one'),false);await f.loader.setUser('one');
  assert.deepEqual(f.restored,[]);assert.deepEqual(f.available,[saved('one')]);
});

test('a failed account read can retry without replacing the tab with fallback data',async()=>{
  let attempts=0;const f=fixture(()=>{if(!attempts++)throw Error('Unavailable');return saved('one');});
  await f.loader.setUser('one');assert.equal(f.errors.length,1);assert.deepEqual(f.restored,[]);
  await f.loader.setUser('one');assert.deepEqual(f.restored,[saved('one')]);
});
