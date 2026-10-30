import {test} from 'node:test';import assert from 'node:assert/strict';
import {transact,recover} from '../../scripts/cicd/transaction.mjs';
const old={phase:'complete',sha:'a'.repeat(40),files:{old:'hash'},baselineVerified:true,quarantined:[]},next={sha:'b'.repeat(40),files:{next:'hash'},runId:'123'};
function fixture(fail){
 const events=[],states=[];let failed=false;
 const step=name=>async()=>{events.push(name);if(name===fail&&!failed){failed=true;throw Error('injected '+name)}};
 const io={reconcile:async s=>({...s,migrations:{'migrations/0001.sql':'stable'},attemptedMigrations:undefined,migrationRecoveryRequired:false}),snapshot:async()=>({worker:'previous',pages:{console:'previous'}}),save:async s=>{events.push('save:'+s.phase);if(fail==='save:'+s.phase&&!failed){failed=true;throw Error('injected journal failure')}states.push(structuredClone(s))},migrate:step('migrate'),checkPrevious:step('old-check'),publish:step('publish'),verify:step('verify-and-cleanup'),evidence:step('evidence'),restore:async(p,sha)=>{events.push('rollback:'+sha);if(fail==='rollback')throw Error('cannot rollback')},now:()=> '2026-10-29T00:00:00Z'};
 return {events,states,io};
}
test('eligibility is written only after migration, old-code check, publication and full cleanup',async()=>{
 const f=fixture();const result=await transact(old,next,f.io);assert.equal(result.sha,next.sha);assert.equal(result.baselineVerified,true);
 assert.deepEqual(f.events,['save:deploying','migrate','save:deploying','old-check','publish','verify-and-cleanup','save:complete','evidence']);assert.equal(old.sha,'a'.repeat(40));
});
for(const fail of ['migrate','old-check','publish','verify-and-cleanup','save:complete','evidence'])test('failure during '+fail+' restores and verifies immutable previous state',async()=>{
 const f=fixture(fail);await assert.rejects(()=>transact(old,next,f.io));assert.ok(f.events.includes('rollback:'+old.sha));assert.equal(f.states.at(-1).sha,old.sha);assert.equal(f.states.at(-1).phase,'failed');assert.ok(f.states.at(-1).quarantined.includes(next.sha));
});
test('initial journal failure causes no schema or application mutation',async()=>{
 const f=fixture('save:deploying');await assert.rejects(()=>transact(old,next,f.io));assert.deepEqual(f.events,['save:deploying']);
});
test('interrupted release recovers before accepting new work',async()=>{
 const f=fixture(),pending={...old,phase:'deploying',attemptedSha:next.sha,previous:{worker:'prior',pages:{}}};const result=await recover(pending,f.io);assert.equal(result.phase,'failed');assert.equal(result.sha,old.sha);assert.ok(result.quarantined.includes(next.sha));
});
test('unsuccessful rollback blocks later promotions',async()=>{
 const f=fixture('rollback');await assert.rejects(()=>recover({...old,phase:'deploying',attemptedSha:next.sha,previous:{}},f.io));assert.equal(f.states.at(-1).phase,'rollback_failed');await assert.rejects(()=>recover(f.states.at(-1),f.io),/Operator recovery/);
});
test('interrupted first-time dev bootstrap can retry without a fictitious rollback baseline',async()=>{
 const f=fixture();const result=await recover({phase:'deploying',sha:null,bootstrap:true,previous:{worker:null,pages:{}}},{...f.io,allowBootstrap:true});assert.equal(result.phase,'failed');assert.ok(!f.events.some(e=>e.startsWith('rollback:')));
});
test('applied migration provenance survives failed publication and rejects a changed retry',async()=>{
 const f=fixture('publish'),files={'migrations/0001.sql':'stable','migrations/0002.sql':'applied'};
 f.io.reconcile=async s=>({...s,migrations:files,attemptedMigrations:undefined,migrationRecoveryRequired:false});
 await assert.rejects(()=>transact({...old,migrations:{'migrations/0001.sql':'stable'}},{...next,files},f.io));
 const failed=f.states.at(-1);assert.equal(failed.sha,old.sha);assert.equal(failed.migrations['migrations/0002.sql'],'applied');
 const {migrationsCompatible}=await import('../../scripts/cicd/policy.mjs');assert.throws(()=>migrationsCompatible(failed.migrations,{...files,'migrations/0002.sql':'changed'}));
});
test('failed migration reconciliation retains attempted hashes until positive database reconciliation',async()=>{
 const f=fixture('publish');f.io.reconcile=async()=>{throw Error('database offline')};
 await assert.rejects(()=>transact(old,{...next,files:{'migrations/0002.sql':'attempted'}},f.io));
 const failed=f.states.at(-1);assert.equal(failed.migrationRecoveryRequired,true);assert.equal(failed.attemptedMigrations['migrations/0002.sql'],'attempted');
});
test('interrupted recovery with an unavailable database cannot overwrite attempted migration provenance',async()=>{
 const f=fixture();f.io.reconcile=async()=>{throw Error('database offline')};
 const interrupted={...old,phase:'deploying',attemptedSha:next.sha,previous:{worker:'previous',pages:{}},attemptedMigrations:{'migrations/x.sql':'original'},migrationRecoveryRequired:true};
 const recovered=await recover(interrupted,f.io);assert.equal(recovered.migrationRecoveryRequired,true);const before=f.events.length;
 await assert.rejects(()=>transact(recovered,{...next,files:{'migrations/x.sql':'replacement'}},f.io),/reconciliation required/);
 assert.equal(f.events.length,before);assert.equal(recovered.attemptedMigrations['migrations/x.sql'],'original');
});
