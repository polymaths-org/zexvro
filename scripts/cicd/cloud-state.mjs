import {ACCOUNT} from './policy.mjs';import {smoke} from './smoke.mjs';
const migrationFiles=files=>Object.fromEntries(Object.entries(files||{}).filter(([p])=>p.startsWith('migrations/')));
export function cloudState(api,env){
 const prefix='/accounts/'+ACCOUNT;
 async function snapshot(){
  const d=await api(`${prefix}/workers/scripts/${env.worker}/deployments`,{allow404:true}),versions=d?.deployments?.[0]?.versions;
  if(versions&&!(versions.length===1&&versions[0].percentage===100))throw Error('Cannot replace a split Worker deployment');
  const pages={};for(const name of [env.pages,env.landingPages])pages[name]=(await api(`${prefix}/pages/projects/${name}`)).canonical_deployment?.id||null;
  return {worker:versions?.[0]?.version_id||null,pages};
 }
 async function restore(previous,oldSha){
  if(!previous?.worker||Object.values(previous.pages||{}).length!==2||Object.values(previous.pages).some(id=>!id))throw Error('Rollback baseline missing; operator recovery required');
  await api(`${prefix}/workers/scripts/${env.worker}/deployments`,{method:'POST',body:{strategy:'percentage',versions:[{version_id:previous.worker,percentage:100}]}});
  for(const [name,id] of Object.entries(previous.pages)){
   if(![env.pages,env.landingPages].includes(name))throw Error('Unknown rollback target');
   const current=await api(`${prefix}/pages/projects/${name}`);if(current.canonical_deployment?.id!==id)await api(`${prefix}/pages/projects/${name}/deployments/${id}/rollback`,{method:'POST'});
  }
  await smoke(env,oldSha);
 }
 async function reconcile(state){
  const query=async sql=>{const rows=await api(`${prefix}/d1/database/${env.databaseId}/query`,{method:'POST',body:{sql}});if(rows?.[0]?.success===false||!Array.isArray(rows?.[0]?.results))throw Error('Cannot reconcile applied migrations');return rows[0].results};
  const exists=await query("SELECT name FROM sqlite_master WHERE type='table' AND name='d1_migrations'");
  const names=exists.length?(await query('SELECT name FROM d1_migrations ORDER BY id')).map(r=>'migrations/'+r.name):[];
  const known={...migrationFiles(state.files),...(state.migrations||{}),...(state.attemptedMigrations||{})},migrations={...(state.migrations||migrationFiles(state.files))};
  for(const path of names){if(!known[path])throw Error('Unrecorded applied migration: '+path);migrations[path]=known[path]}
  for(const path of Object.keys(migrations))if(!names.includes(path))throw Error('Applied migration history was removed: '+path);
  return {...state,migrations,attemptedMigrations:undefined,migrationRecoveryRequired:false};
 }
 return {snapshot,restore,reconcile};
}
export {migrationFiles};
