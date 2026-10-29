import {readFile,writeFile,cp,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {ACCOUNT,verify,advance,migrationsCompatible,assertTarget} from './policy.mjs';
import {capture,run} from './process.mjs';
import {recover,transact} from './transaction.mjs';
import {cloudState} from './cloud-state.mjs';
import {authenticate,client,cf} from './cloudflare.mjs';
import {journal} from './journal.mjs';
import {smoke} from './smoke.mjs';
const target=process.argv[2],root=resolve(process.argv[3]||'release');
if(!['dev','production'].includes(target))throw Error('Explicit dev or production target required');
if(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REF!=='refs/heads/main')throw Error('Only main can mutate deployment environments');
const config=JSON.parse(await readFile('scripts/cicd/environments.json')),env=config[target];
if(config.account!==ACCOUNT||env.databaseId==='UNPROVISIONED'||config.dev.databaseId===config.production.databaseId||config.dev.bucket===config.production.bucket)throw Error('Isolated staging resources must be provisioned first');
const sha=process.env.CANDIDATE_SHA||process.env.GITHUB_SHA||capture('git',['rev-parse','HEAD']);
const m=await verify(root,{sha,repository:process.env.GITHUB_REPOSITORY||'polymaths-org/zexvro',...(process.env.CANDIDATE_RUN_ID?{runId:process.env.CANDIDATE_RUN_ID}:{})});
assertTarget(JSON.parse(await readFile(resolve(root,'config',target,'wrangler.json'))),env,sha);
const api=client(await authenticate()),prefix='/accounts/'+ACCOUNT;
let state=await journal(config.journalBucket,target);
const ancestor=(a,b)=>{try{capture('git',['merge-base','--is-ancestor',a,b]);return true}catch{return false}};
const {snapshot,restore,reconcile}=cloudState(api,env);
state=await recover(state,{restore,reconcile,allowBootstrap:target==='dev',save:value=>journal(config.journalBucket,target,value)});
if(state.migrationRecoveryRequired||state.attemptedMigrations)throw Error('Migration reconciliation is unresolved; release mutations are blocked');
if(target==='production'&&!state.baselineVerified)throw Error('Verified production migration baseline required');
if(state.quarantined?.includes(sha))throw Error('This release is quarantined after an unsuccessful deployment');
if(!advance(state.sha,sha,ancestor)){
 if(JSON.stringify(state.files)!==JSON.stringify(m.files))throw Error('Same SHA has different payload bytes; staging evidence cannot be reused');
 if(target==='dev')await writeFile(resolve(root,'staging.json'),JSON.stringify({sha,verifiedAt:state.verifiedAt,deployments:state.deployments}));
 console.log('Release already deployed');process.exit(0)
}
migrationsCompatible(state.migrations,m.files);
const temp=await mkdtemp(join(tmpdir(),'zexvro-publish-'));
try{
 await transact(state,{sha,files:m.files,runId:process.env.GITHUB_RUN_ID||'local',bootstrap:target==='dev'}, {
 snapshot,restore,reconcile,save:value=>journal(config.journalBucket,target,value),now:()=>new Date().toISOString(),
 migrate:async()=>{
 const workerConfig=resolve(root,'config',target,'wrangler.json');
 cf(['d1','migrations','apply',env.database,'--remote','--config',workerConfig,'--profile','zexvro']);
 },
 checkPrevious:oldSha=>smoke(env,oldSha),
 publish:async()=>{
 const workerConfig=resolve(root,'config',target,'wrangler.json');
 cf(['deploy','--config',workerConfig,'--profile','zexvro']);
 for(const [site,name] of [['console',env.pages],['landing',env.landingPages]]){
  const dir=join(temp,site);await cp(join(root,site),dir,{recursive:true});
  await cp(join(root,'config',target,'runtime-config.js'),join(dir,'runtime-config.js'));await cp(join(root,'config',target,'release.json'),join(dir,'release.json'));
  // Pages reads the config in cwd. Use a sterile directory, never the repo's unrelated Pages config.
  cf(['pages','deploy',dir,'--project-name',name,'--branch','main','--commit-dirty=true','--profile','zexvro'],{cwd:temp});
 }
 },
 verify:async()=>{
  await smoke(env,sha,root,target);
  if(target==='dev'){
   run('npx',['playwright','test'],{cwd:resolve('frontend'),env:{...process.env,PLAYWRIGHT_BASE_URL:env.console,E2E_API_BASE:env.api}});
   run('npx',['playwright','test','--config','playwright.release.config.ts'],{cwd:resolve('frontend'),env:{...process.env,PLAYWRIGHT_BASE_URL:env.landing,RELEASE_SURFACE:'landing',E2E_API_BASE:env.api}});
   run('node',['--import',resolve('services/platform-api/node_modules/tsx/dist/loader.mjs'),'services/platform-api/scripts/smoke-services.mjs'],{env:{...process.env,SMOKE_TARGET:'dev'}});
  }
 },
 evidence:async completed=>{if(target==='dev')await writeFile(resolve(root,'staging.json'),JSON.stringify({sha,verifiedAt:completed.verifiedAt,deployments:completed.deployments}))}
 });
}finally{await rm(temp,{recursive:true,force:true})}
