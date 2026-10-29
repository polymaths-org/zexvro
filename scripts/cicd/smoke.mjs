import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
const pause=ms=>new Promise(r=>setTimeout(r,ms)),hash=value=>createHash('sha256').update(value).digest('hex');
export async function smoke(env,sha,root,target,{attempts=5,delayMs=3000,fetchImpl=fetch}={}){
 const read=async url=>{const r=await fetchImpl(url,{signal:AbortSignal.timeout(20000),headers:{'Cache-Control':'no-cache'}});assert.equal(r.status,200,url);return r};
 let last;
 for(let attempt=0;attempt<attempts;attempt++)try{
  const health=await (await read(env.api+'/api/health')).json();assert.equal(health.status,'ok');assert.equal(health.auth,'d1-accounts');if(sha)assert.equal(health.release,sha);
  for(const [base,dir] of [[env.console,'console'],[env.landing,'landing']]){
   if(sha){const marker=await (await read(base+'/release.json?sha='+sha)).json();assert.equal(marker.sha,sha);assert.equal(marker.api,env.api)}
   const html=await (await read(base+'/')).text();assert.match(html,/<html/);assert.match(html,/\/assets\/[^"']+\.js/);
   if(root){
    assert.equal(hash(html),hash(await readFile(root+'/'+dir+'/index.html')),'Published HTML differs');
    const runtime=await read(base+'/runtime-config.js?sha='+sha);assert.match(runtime.headers.get('content-type')||'',/javascript/);
    assert.equal(hash(Buffer.from(await runtime.arrayBuffer())),hash(await readFile(root+'/config/'+target+'/runtime-config.js')),'Published runtime configuration differs');
    const assets=[...html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+\.(?:js|css))["']/g)].map(m=>m[1]);
    assert.ok(assets.length>0&&assets.length<50,'Unexpected asset inventory');
    for(const asset of new Set(assets)){
     assert.ok(!asset.includes('..'),'Unsafe asset path');
     const response=await read(base+asset),bytes=Buffer.from(await response.arrayBuffer());
     assert.equal(hash(bytes),hash(await readFile(root+'/'+dir+asset)),'Published entry asset differs: '+asset);
    }
   }
  }
  for(const path of ['/nft/health','/gate/health']){const body=await (await read(env.api+path)).json();assert.equal(body.status,'ok')}
  for(const origin of (env.origins||[env.console])){
   const cors=await fetchImpl(env.api+'/gate/v1/admin/sites',{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'GET','Access-Control-Request-Headers':'authorization'},signal:AbortSignal.timeout(20000)});assert.ok([200,204].includes(cors.status));assert.equal(cors.headers.get('access-control-allow-origin'),origin);
  }
  console.log('Release identity, HTML, runtime/entry assets, service health and CORS passed:',sha||'previous release');return;
 }catch(error){last=error;if(attempt<attempts-1)await pause(delayMs)}
 throw last;
}
