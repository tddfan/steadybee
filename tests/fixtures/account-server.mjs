// Isolated browser-test backend: all sessions and households are synthetic.
// Run with `node tests/fixtures/account-server.mjs`, then use localhost:8767.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const root=resolve('prototype'),rows=new Map(),port=Number(process.env.STEADYBEE_TEST_PORT||8767);
const sdk=`
export function createClient(){
 const user=new URLSearchParams(location.search).has('fixture_guest')?null:{id:new URLSearchParams(location.search).get('fixture_user')||'fixture-user',email:'journey@example.invalid'};
 let current=user;
 const session=()=>current?{user:current}:null;
 return {auth:{
  onAuthStateChange(fn){let active=true;queueMicrotask(()=>{if(active)fn('INITIAL_SESSION',session());});return {data:{subscription:{unsubscribe(){active=false;}}}};},
  async getSession(){return {data:{session:session()}};},
  async signOut(){current=null;return {error:null};}
 },from(){
  const query={op:'select',filters:[],orders:[]};
  const builder={
   select(){return builder;},eq(key,value){query.filters.push([key,value]);return builder;},
   order(key,options){query.orders.push([key,options]);return builder;},
   insert(value){query.op='insert';query.value=value;return builder;},
   update(value){query.op='update';query.value=value;return builder;},
   delete(){query.op='delete';return builder;},
   single(){query.one=true;return builder;},maybeSingle(){query.one=true;return builder;},
   then(resolve,reject){return fetch('/__fixture__/pictures',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(query)}).then(r=>r.json()).then(resolve,reject);}
  };return builder;
 }};
}`;
const server=createServer(async(req,res)=>{
 try{
  const path=new URL(req.url,'http://fixture').pathname;
  if(path==='/__fixture__/sdk.mjs'){res.setHeader('Content-Type','text/javascript');res.end(sdk);return;}
  if(path==='/auth/v1/settings'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({external:{google:true}}));return;}
  if(path==='/__fixture__/pictures'){
   let body='';for await(const chunk of req)body+=chunk;
   const q=JSON.parse(body),matches=[...rows.values()].filter(row=>q.filters.every(([key,value])=>row[key]===value));
   let result=matches;
   if(q.op==='insert'){rows.set(q.value.id,structuredClone(q.value));result=[q.value];}
   if(q.op==='update'){for(const row of matches){Object.assign(row,q.value);}result=matches;}
   if(q.op==='delete'){for(const row of matches)rows.delete(row.id);result=[];}
   for(const [key,options] of [...q.orders].reverse())result.sort((a,b)=>String(a[key]).localeCompare(String(b[key]))*(options?.ascending===false?-1:1));
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:q.one?(result[0]||null):result,error:null}));return;
  }
  const file=resolve(root,'.'+(path==='/'?'/index.html':path));if(!file.startsWith(root+'/'))throw Error('Invalid path');
  let data=await readFile(file);
  if(path==='/cloud-config.mjs')data=Buffer.from(`export const SUPABASE_URL='http://127.0.0.1:${port}';export const SUPABASE_PUBLISHABLE_KEY='synthetic-test-key';`);
  if(path==='/account-storage.mjs')data=Buffer.from(data.toString().replace('https://esm.sh/@supabase/supabase-js@2.118.0?bundle','/__fixture__/sdk.mjs'));
  const types={'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.png':'image/png'};
  res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(data);
 }catch(error){res.statusCode=404;res.end('Not found');}
});
server.listen(port,'127.0.0.1',()=>process.stdout.write(`Synthetic journey fixture: http://127.0.0.1:${port}\n`));
