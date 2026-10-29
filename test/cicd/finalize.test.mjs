import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,mkdir,writeFile,rm,readFile} from 'node:fs/promises';import {join,resolve} from 'node:path';import {tmpdir} from 'node:os';import {spawnSync} from 'node:child_process';import {inventory} from '../../scripts/cicd/policy.mjs';
test('finalization cannot bless payload changes made after tests',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'finalize-test-')),root=join(dir,'release');
 try{
  for(const p of ['worker','console','migrations'])await mkdir(join(root,p),{recursive:true});
  for(const p of ['worker/index.js','console/index.html','migrations/0001_platform.sql'])await writeFile(join(root,p),'original');
  await writeFile(join(root,'manifest.json'),JSON.stringify({sha:'a'.repeat(40),files:await inventory(root)}));await writeFile(join(root,'staging.json'),JSON.stringify({sha:'a'.repeat(40),verifiedAt:new Date().toISOString(),deployments:{worker:'id'}}));
  await writeFile(join(root,'worker/index.js'),'tampered');const r=spawnSync(process.execPath,[resolve('scripts/cicd/finalize.mjs')],{cwd:dir,encoding:'utf8'});assert.notEqual(r.status,0);assert.match(r.stderr,/Payload changed/);
 }finally{await rm(dir,{recursive:true,force:true})}
});
