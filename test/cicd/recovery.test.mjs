import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {cloudState} from '../../scripts/cicd/cloud-state.mjs';
const env={databaseId:'database',worker:'worker',pages:'console',landingPages:'landing'};
test('migration reconciliation records applied attempts and releases positively un-applied reservations',async()=>{
 const api=async(_path,{body})=>[{success:true,results:body.sql.includes('sqlite_master')?[{name:'d1_migrations'}]:[{name:'one.sql'},{name:'two.sql'}]}];
 const {reconcile}=cloudState(api,env),result=await reconcile({migrations:{'migrations/one.sql':'one'},attemptedMigrations:{'migrations/two.sql':'two','migrations/unapplied.sql':'unapplied'},migrationRecoveryRequired:true});
 assert.deepEqual(result.migrations,{'migrations/one.sql':'one','migrations/two.sql':'two'});assert.equal(result.attemptedMigrations,undefined);assert.equal(result.migrationRecoveryRequired,false);
});
test('unknown applied migrations and missing recorded migrations block reconciliation',async()=>{
 const api=async(_path,{body})=>[{success:true,results:body.sql.includes('sqlite_master')?[{name:'d1_migrations'}]:[{name:'unknown.sql'}]}];
 await assert.rejects(()=>cloudState(api,env).reconcile({migrations:{'migrations/one.sql':'one'}}),/Unrecorded/);
});
test('production recovery is invoked before candidate discovery and empty-candidate success',async()=>{
 const source=await readFile('scripts/cicd/promote.mjs','utf8');assert.ok(source.indexOf('await recover(')<source.indexOf('for(let page=1;'));assert.ok(source.indexOf('await recover(')<source.indexOf('if(!selected)'));
});
