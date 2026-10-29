import {test} from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,writeFile,mkdir,rm,symlink} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {eligible,advance,inventory,verify,migrationsCompatible} from '../../scripts/cicd/policy.mjs';
import {run} from '../../scripts/cicd/process.mjs';
const a='a'.repeat(40),b='b'.repeat(40),now=Date.now();
const good={status:'completed',conclusion:'success',event:'push',head_branch:'main',head_sha:a,repository:{full_name:'polymaths-org/zexvro'},updated_at:new Date(now-3600000).toISOString()};
test('scheduled eligibility fails closed on provenance, failed checks and insufficient observation',()=>{
 const opts={repository:'polymaths-org/zexvro',now};assert.equal(eligible(good,opts),true);
 for(const patch of [{conclusion:'failure'},{event:'pull_request'},{head_branch:'other'},{repository:{full_name:'attacker/fork'}},{head_sha:'main'},{updated_at:'invalid'},{updated_at:new Date(now).toISOString()}])assert.equal(eligible({...good,...patch},opts),false);
});
test('manual mode only relaxes observation; it cannot bypass a failed or mismatched commit',()=>{
 const opts={repository:'polymaths-org/zexvro',now,manual:true,sha:a};assert.equal(eligible({...good,updated_at:new Date(now).toISOString()},opts),true);
 assert.equal(eligible({...good,conclusion:'failure'},opts),false);assert.equal(eligible({...good,head_sha:b},opts),false);
});
test('release ordering rejects downgrade, divergence and same-commit redeploys',()=>{
 assert.equal(advance(a,a,()=>true),false);assert.equal(advance(a,b,()=>true),true);assert.throws(()=>advance(a,b,()=>false),/downgrade/);assert.throws(()=>advance(a,'main',()=>true));
});
test('edited or removed published migrations are rejected',()=>{
 const old={'migrations/1.sql':'abc'};migrationsCompatible(old,{...old,'migrations/2.sql':'new'});assert.throws(()=>migrationsCompatible(old,{'migrations/1.sql':'changed'}));assert.throws(()=>migrationsCompatible(old,{}));
});
test('artifact validation rejects tampering, unexpected files, missing targets and wrong run identity',async()=>{
 const root=await mkdtemp(join(tmpdir(),'release-policy-'));
 try{
  for(const p of ['worker','console','migrations'])await mkdir(join(root,p));
  for(const p of ['worker/index.js','console/index.html','migrations/0001_platform.sql'])await writeFile(join(root,p),'fixture');
  const manifest={sha:a,repository:'polymaths-org/zexvro',runId:'123',files:await inventory(root)};
  await writeFile(join(root,'manifest.json'),JSON.stringify(manifest));await verify(root,{sha:a,runId:'123'});
  await assert.rejects(()=>verify(root,{runId:'other'}),/provenance/);
  await writeFile(join(root,'console/index.html'),'changed');await assert.rejects(()=>verify(root,{sha:a}),/altered/);
  await writeFile(join(root,'console/index.html'),'fixture');await writeFile(join(root,'extra'),'untrusted');await assert.rejects(()=>verify(root,{sha:a}),/unexpected/);
  await rm(join(root,'extra'));await symlink('/etc/passwd',join(root,'link'));await assert.rejects(()=>inventory(root),/symlink/);
 }finally{await rm(root,{recursive:true,force:true})}
});
test('a terminated or missing subprocess cannot be reported as a passing check',()=>{
 assert.throws(()=>run(process.execPath,['-e','process.kill(process.pid,"SIGTERM")'],{stdio:'ignore'}));assert.throws(()=>run('zexvro-command-that-does-not-exist',[],{stdio:'ignore'}));
});
