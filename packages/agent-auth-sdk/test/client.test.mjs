import {test,before,after} from 'node:test';import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {Gate,GateAgent,generateAgentKeyPair,verifyCapabilityRemote} from '../src/index.js';
import {createGateApp} from '../../../services/agent-auth/src/app.ts';
import {MemoryRepository} from '../../../services/agent-auth/src/repository.ts';
import {loadConfig} from '../../../services/agent-auth/src/config.ts';
let server,base,site,agent;
before(async()=>{
 const config=loadConfig({NODE_ENV:'test',AGENT_AUTH_ISSUER:'http://localhost',AGENT_AUTH_SIGNING_SECRET:'sdk-test-only-signing-fixture',GATE_ALLOW_DEV_HUMAN:'false',GATE_ALLOW_DEV_HMAC:'false',GATE_REQUIRE_POP:'true',GATE_ADMIN_REQUIRE_AUTH:'false'});
 const repo=new MemoryRepository();server=createServer(createGateApp(config,repo));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;config.issuer=base;
 const post=async(path,body)=>{const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});assert.ok(r.ok,'setup '+path+' '+r.status);return r.json()};
 site=await post('/v1/admin/sites',{name:'SDK integration',allowedOrigins:['https://sdk.example'],projectId:'sdk-project'});const keys=await generateAgentKeyPair();await post('/v1/admin/agents',{siteKey:site.siteKey,publicKey:keys.publicKey,name:'SDK agent'});agent=new GateAgent({apiBase:base,siteKey:site.siteKey,siteId:site.siteId,projectId:'sdk-project',...keys});
});
after(async()=>{if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}});
test('SDK completes a real Ed25519 challenge and verifies its request-bound proof of possession',async()=>{
 const {capability}=await agent.obtainCapability({action:'search.query'});assert.equal(typeof capability,'string');
 const pop=await agent.createPop({capability,htm:'POST',htu:'https://sdk.example/search'});
 const result=await verifyCapabilityRemote({apiBase:base,siteSecret:site.secretKey,capability,action:'search.query',minClass:'agent',pop,expectedHtm:'POST',expectedHtu:'https://sdk.example/search'});assert.equal(result.ok,true);assert.equal(result.class,'agent');
});
test('production SDK refuses the development human bypass',async()=>{await assert.rejects(()=>new Gate({apiBase:base,siteKey:site.siteKey}).protect({action:'search.query'}),/insecure|BrowserGate/)});
test('a successful HTTP status cannot authorize malformed, negative or mismatched verification responses',async t=>{
 const mocked=t.mock.method(globalThis,'fetch',async()=>Response.json({}));
 for(const body of [{},{ok:false},{ok:true,class:'unknown',action:'search.query'},{ok:true,class:'human',action:'different'},{ok:true,class:'human',action:'search.query'}]){
  mocked.mock.mockImplementation(async()=>Response.json(body));const result=await verifyCapabilityRemote({apiBase:base,siteSecret:'fixture',action:'search.query',minClass:'agent'});assert.equal(result.ok,false);assert.equal(result.status,502);
 }
 mocked.mock.mockImplementation(async()=>new Response('<html>SPA</html>'));assert.equal((await verifyCapabilityRemote({apiBase:base,action:'search.query'})).ok,false);
});
