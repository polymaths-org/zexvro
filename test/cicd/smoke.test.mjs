import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {smoke} from '../../scripts/cicd/smoke.mjs';
const sha='a'.repeat(40),env={api:'https://api.test',console:'https://console.test',landing:'https://landing.test',origins:['https://console.test','https://www.test']};
async function fixture(change){
 const root=await mkdtemp(join(tmpdir(),'release-smoke-')),html='<html><script src="/runtime-config.js"></script><script src="/assets/main.js"></script></html>',runtime='globalThis.__ZEXVRO_CONFIG__={};';
 for(const dir of ['console/assets','landing/assets','config/production'])await mkdir(join(root,dir),{recursive:true});
 for(const dir of ['console','landing']){await writeFile(join(root,dir,'index.html'),html);await writeFile(join(root,dir,'assets/main.js'),'main();')}
 await writeFile(join(root,'config/production/runtime-config.js'),runtime);
 const fetchImpl=async(url,options={})=>{
  const u=new URL(url);if(options.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':options.headers.Origin}});
  if(u.pathname==='/api/health')return Response.json({status:'ok',auth:'d1-accounts',release:sha});
  if(u.pathname.endsWith('/health'))return Response.json({status:'ok'});
  if(u.pathname==='/release.json')return Response.json({sha,api:env.api});
  if(u.pathname==='/runtime-config.js')return new Response(change==='overlay'?'wrong':runtime,{headers:{'Content-Type':'application/javascript'}});
  if(u.pathname==='/assets/main.js')return change==='missing-asset'?new Response('missing',{status:404}):new Response('main();');
  return new Response(html);
 };
 return {root,options:{attempts:1,delayMs:0,fetchImpl}};
}
test('live acceptance verifies published configuration and entry asset bytes',async()=>{
 const f=await fixture();try{await smoke(env,sha,f.root,'production',f.options)}finally{await rm(f.root,{recursive:true,force:true})}
});
for(const change of ['overlay','missing-asset'])test('a '+change+' regression fails deployment acceptance',async()=>{
 const f=await fixture(change);try{await assert.rejects(()=>smoke(env,sha,f.root,'production',f.options))}finally{await rm(f.root,{recursive:true,force:true})}
});
