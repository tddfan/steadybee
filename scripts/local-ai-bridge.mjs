/**
 * Local-only adapter for the AI endpoint when the app is served by a static
 * development server. It holds no API key: reviews go to the authenticated,
 * allowlisted Steadybee Netlify preview, then Groq from the Netlify function.
 */
import {createServer} from 'node:http';

const upstream='https://deploy-preview-8--steadybee.netlify.app/.netlify/functions/planning-analysis';
const endpoint=new URL(upstream);
const port=Number(process.env.LOCAL_AI_PORT || 8888);
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('LOCAL_AI_PORT must be a valid port.');
const allowedOrigins=new Set(['http://127.0.0.1:8766','http://localhost:8766']);
const path='/.netlify/functions/planning-analysis';

const server=createServer(async(request,response)=>{
  const origin=request.headers.origin;
  if(origin&&!allowedOrigins.has(origin)){
    response.writeHead(403,{'Cache-Control':'no-store'});response.end();return;
  }
  const cors=origin?{'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Max-Age':'600'}:{};
  if(request.method==='OPTIONS'){
    response.writeHead(204,{...cors,'Cache-Control':'no-store'});response.end();return;
  }
  if(request.url!==path || !['GET','POST'].includes(request.method)){
    response.writeHead(404,{...cors,'Content-Type':'application/json','Cache-Control':'no-store'});response.end(JSON.stringify({error:'Local AI bridge route not found.'}));return;
  }
  try{
    const headers={};
    if(request.headers.authorization)headers.Authorization=request.headers.authorization;
    if(request.method==='POST')headers['Content-Type']=request.headers['content-type'] || 'application/json';
    let body;
    if(request.method==='POST'){
      const chunks=[];let size=0;
      for await(const chunk of request){size+=chunk.length;if(size>24000){response.writeHead(413,{...cors,'Content-Type':'application/json','Cache-Control':'no-store'});response.end(JSON.stringify({error:'Summary is too large.'}));return;}chunks.push(chunk);}
      body=Buffer.concat(chunks);
    }
    const result=await fetch(upstream,{method:request.method,headers,body,signal:AbortSignal.timeout(35000),cache:'no-store'});
    const payload=Buffer.from(await result.arrayBuffer());
    response.writeHead(result.status,{...cors,'Content-Type':result.headers.get('content-type') || 'application/json','Cache-Control':'no-store'});
    response.end(payload);
  }catch{
    response.writeHead(502,{...cors,'Content-Type':'application/json','Cache-Control':'no-store'});
    response.end(JSON.stringify({error:'The configured Steadybee AI preview is unreachable. Try again later.'}));
  }
});
server.listen(port,'127.0.0.1',()=>console.log(`Local AI bridge listening on http://127.0.0.1:${port}; upstream is ${endpoint.host}.`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
