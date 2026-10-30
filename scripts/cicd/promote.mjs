import {readFile,writeFile,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {eligible,assertSha,verify,WORKFLOW} from './policy.mjs';
import {run,capture} from './process.mjs';
import {authenticate,client} from './cloudflare.mjs';
import {cloudState} from './cloud-state.mjs';
import {recover} from './transaction.mjs';
import {journal} from './journal.mjs';
const repository=process.env.GITHUB_REPOSITORY;
if(repository!=='polymaths-org/zexvro'||process.env.GITHUB_REF!=='refs/heads/main')throw Error('Production promotion requires the trusted repository main workflow');
const manual=process.env.GITHUB_EVENT_NAME==='workflow_dispatch',requested=process.env.REQUESTED_SHA||'';
if(requested)assertSha(requested);
const config=JSON.parse(await readFile('scripts/cicd/environments.json'));
const token=await authenticate();
const previous=await journal(config.journalBucket,'production');
// Recover using the persisted deployment IDs before considering artifacts or candidate availability.
const state=await recover(previous,{...cloudState(client(token),config.production),save:value=>journal(config.journalBucket,'production',value)});
if(state.migrationRecoveryRequired||state.attemptedMigrations)throw Error('Migration reconciliation is unresolved; release mutations are blocked');
if(state.phase==='rollback_failed')throw Error('Production recovery must complete before promotion');
const api=async(path)=>{const r=await fetch('https://api.github.com/repos/'+repository+path,{headers:{Authorization:'Bearer '+process.env.GH_TOKEN,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('GitHub API failed: '+r.status);return r.json()};
const ancestor=(a,b)=>{try{capture('git',['merge-base','--is-ancestor',a,b]);return true}catch{return false}};
const main=capture('git',['rev-parse','origin/main']);let selected;
for(let page=1;page<=10;page++){
 const {workflow_runs:runs}=await api(`/actions/workflows/${WORKFLOW}/runs?branch=main&status=success&per_page=100&page=${page}`);
 for(const r of runs){
  if(!eligible(r,{repository,manual,sha:requested})||r.path!=='.github/workflows/'+WORKFLOW||!ancestor(r.head_sha,main)||state.quarantined?.includes(r.head_sha)||r.head_sha===state.sha||state.sha&&!ancestor(state.sha,r.head_sha))continue;
  const {artifacts}=await api(`/actions/runs/${r.id}/artifacts?per_page=100`),name=`candidate-${r.head_sha}-${r.id}-${r.run_attempt}`;
  const artifact=artifacts.find(a=>a.name===name&&!a.expired);
  if(artifact&&(!selected||ancestor(selected.run.head_sha,r.head_sha)))selected={run:r,artifact};
 }
 if(runs.length<100)break;
}
if(!selected){if(manual)throw Error('No eligible newer release. Commit must first pass the Dev release workflow; no checks can be bypassed.');console.log('No new eligible release; production unchanged');process.exit(0)}
await rm('release',{recursive:true,force:true});
run('gh',['run','download',String(selected.run.id),'--repo',repository,'--name',selected.artifact.name,'--dir','release']);
const m=await verify(resolve('release'),{sha:selected.run.head_sha,repository,workflow:WORKFLOW,runId:String(selected.run.id),attempt:String(selected.run.run_attempt)});
if(m.sourceDirty!==false)throw Error('Only clean CI source artifacts can reach production');
const staged=JSON.parse(await readFile('release/staging.json'));
if(staged.sha!==m.sha||staged.verifiedAt!==m.readyAt||!Number.isFinite(Date.parse(m.readyAt))||Date.parse(m.readyAt)>Date.now()||!manual&&Date.now()-Date.parse(m.readyAt)<1800000)throw Error('Staging evidence missing or observation period incomplete');
if(!staged.deployments?.worker||Object.values(staged.deployments.pages||{}).length!==2)throw Error('Missing staging deployment identities');
run('node',['scripts/cicd/deploy.mjs','production','release'],{env:{...process.env,CANDIDATE_SHA:m.sha,CANDIDATE_RUN_ID:String(selected.run.id)}});
if(process.env.GITHUB_STEP_SUMMARY)await writeFile(process.env.GITHUB_STEP_SUMMARY,`Production release: **${m.sha}**\n\nCandidate: ${selected.artifact.name}\n\nManual: ${manual}. All verification gates retained.\n`,{flag:'a'});
