import {createHash} from 'node:crypto';
import {readdir,readFile,lstat} from 'node:fs/promises';
import {join,relative} from 'node:path';
export const ACCOUNT='ac51c31a2a40b154a68a40bd5283fae2';
export const SHA=/^[a-f0-9]{40}$/;
export const WORKFLOW='dev-release.yml';
export function assertSha(value){if(!SHA.test(value||''))throw Error('A full 40-character commit SHA is required');return value}
export function eligible(run,{repository,now=Date.now(),manual=false,sha}={}){
 return run.conclusion==='success' && run.status==='completed' && run.event==='push' && run.head_branch==='main' && run.repository?.full_name===repository && SHA.test(run.head_sha||'') && (!sha||run.head_sha===sha) && (manual||now-Date.parse(run.updated_at)>=30*60*1000);
}
export function advance(current,next,isAncestor){assertSha(next);if(current){assertSha(current);if(current===next)return false;if(!isAncestor(current,next))throw Error('Production downgrade/divergent history rejected')}return true}
export async function inventory(root){
 const result={};
 async function walk(dir){for(const name of (await readdir(dir)).sort()){
  const path=join(dir,name),stat=await lstat(path),key=relative(root,path).replaceAll('\\','/');
  if(stat.isSymbolicLink())throw Error('Release symlinks are forbidden');
  if(stat.isDirectory())await walk(path);else if(stat.isFile()&&key!=='manifest.json')result[key]=createHash('sha256').update(await readFile(path)).digest('hex');else if(!stat.isFile())throw Error('Unexpected release file');
 }}await walk(root);return result;
}
export async function verify(root,expected){
 const m=JSON.parse(await readFile(join(root,'manifest.json'),'utf8'));assertSha(m.sha);
 for(const [key,value] of Object.entries(expected))if(m[key]!==value)throw Error('Release provenance mismatch: '+key);
 const actual=await inventory(root);
 if(JSON.stringify(actual)!==JSON.stringify(m.files))throw Error('Release files missing, altered or unexpected');
 if(!actual['worker/index.js']||!actual['console/index.html']||!actual['migrations/0001_platform.sql'])throw Error('Required release targets missing');
 return m;
}
export function migrationsCompatible(previous,next){
 for(const [path,hash] of Object.entries(previous||{}))if(path.startsWith('migrations/')&&next[path]!==hash)throw Error('Published migration modified or removed: '+path);
}
export function assertTarget(config,environment,sha){
 if(config.account_id!==ACCOUNT||config.name!==environment.worker||config.no_bundle!==true||config.main!=='../../worker/index.js'||config.build||config.env||config.routes||config.assets||config.unsafe)throw Error('Unsafe artifact Worker configuration');
 if(config.vars?.PUBLIC_API_URL!==environment.api||config.vars?.RELEASE_SHA!==sha)throw Error('Worker release identity/configuration mismatch');
 if(config.d1_databases?.length!==1||config.d1_databases[0].database_id!==environment.databaseId||config.d1_databases[0].database_name!==environment.database||config.d1_databases[0].migrations_dir!=='../../migrations')throw Error('Unexpected D1 binding');
 if(config.r2_buckets?.length!==1||config.r2_buckets[0].bucket_name!==environment.bucket)throw Error('Unexpected R2 binding');
}
export function assertJournal(state){
 if(!state||!['complete','deploying','failed','rollback_failed'].includes(state.phase)||state.sha!==null&&!SHA.test(state.sha||''))throw Error('Invalid release journal; operator reconciliation required');
 for(const field of ['files','migrations','attemptedMigrations'])if(state[field]!==undefined){
  if(!state[field]||Array.isArray(state[field])||typeof state[field]!=='object')throw Error('Invalid release ledger');
  for(const [path,hash] of Object.entries(state[field]))if(!path||path.includes('..')||!/^[a-f0-9]{64}$/.test(hash))throw Error('Invalid release ledger entry');
 }
 return state;
}
