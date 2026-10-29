import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
let child,base;
const secret=randomBytes(32).toString('hex');
before(async()=>{
 child=spawn(process.execPath,['server.mjs'],{cwd:new URL('.',import.meta.url),env:{...process.env,PORT:'0',HOST:'127.0.0.1',ZK_PROVER_SHARED_SECRET:secret,ZK_ARTIFACT_DIR:'/tmp/zexvro-audit/no-artifacts',RELAYER_SECRET:'',TREASURY_SECRET:''},stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(Error('Prover startup timed out')),15000);child.once('exit',code=>{clearTimeout(timer);reject(Error('Prover exited '+code))});child.stdout.on('data',chunk=>{output=(output+chunk).slice(-4096);const m=output.match(/listening on :(\d+)/);if(m){base='http://127.0.0.1:'+m[1];clearTimeout(timer);resolve()}})});
});
after(async()=>{if(child){child.kill('SIGTERM');await new Promise(r=>child.once('exit',r))}});
const call=async(path,body,authorized=true)=>{const r=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(authorized?{'X-Zexvro-Prover-Secret':secret}:{})},body:body===undefined?undefined:typeof body==='string'?body:JSON.stringify(body)});return {status:r.status,body:await r.json()}};
test('prover health reports unavailable artifacts without fabricating readiness',async()=>{const r=await call('/health');assert.equal(r.status,200);assert.equal(r.body.artifacts.wasm,false);assert.equal(r.body.relayer,false)});
test('prove and jobs require the configured secret',async()=>{assert.equal((await call('/prove',{input:{}},false)).status,401);assert.equal((await call('/jobs/unknown',undefined,false)).status,401)});
test('malformed, missing and oversized proof input is bounded',async()=>{assert.equal((await call('/prove','{')).status,400);assert.equal((await call('/prove',{})).status,400);assert.equal((await call('/prove',{input:[]})).status,400);assert.equal((await call('/prove',{input:{data:'x'.repeat(66000)}})).status,413)});
test('missing proving artifacts return unavailable and release the concurrency slot',async()=>{assert.equal((await call('/prove',{input:{}})).status,503);assert.equal((await call('/health')).body.proving,0)});
test('legacy pool settlement fails closed and does not enqueue money movement',async()=>{const r=await call('/settle',{to:'fixture'});assert.equal(r.status,503);assert.equal(r.body.error,'pool_safety_upgrade_required');assert.equal((await call('/health')).body.jobs,0)});
test('unknown jobs and routes are explicit errors',async()=>{assert.equal((await call('/jobs/missing')).status,404);assert.equal((await call('/missing')).status,404)});
