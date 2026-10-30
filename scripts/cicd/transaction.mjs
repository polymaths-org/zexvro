// Database migration history is monotonic; application code can be rolled back.
import {migrationFiles} from './cloud-state.mjs';
export async function recover(prior,io){
 if(prior.phase==='rollback_failed')throw Error('Operator recovery required: rollback failed');
 let durable=prior;
 try{durable=await io.reconcile(prior)}catch(error){if(prior.phase!=='deploying')throw error;durable={...prior,migrationRecoveryRequired:true}}
 if(prior.phase!=='deploying'){if(prior.migrationRecoveryRequired||!prior.migrations)await io.save(durable);return durable}
 if(io.allowBootstrap&&prior.bootstrap&&!prior.sha){const retry={...durable,phase:'failed'};await io.save(retry);return retry}
 try{
  await io.restore(prior.previous,prior.sha||null);
  const result={...durable,phase:'failed',quarantined:[...new Set([...(prior.quarantined||[]),prior.attemptedSha])]};await io.save(result);return result;
 }catch(error){await io.save({...durable,phase:'rollback_failed'});throw error}
}
export async function transact(prior,release,io){
 if(prior.migrationRecoveryRequired||prior.attemptedMigrations)throw Error('Migration reconciliation required before any new transaction');
 const previous=await io.snapshot();
 const pending={...prior,phase:'deploying',attemptedSha:release.sha,attemptedMigrations:migrationFiles(release.files),migrationRecoveryRequired:true,previous,runId:release.runId,bootstrap:!!release.bootstrap&&!prior.sha};
 await io.save(pending);
 let durable=pending;
 try{
  await io.migrate();durable=await io.reconcile(pending);await io.save(durable);
  if(prior.sha)await io.checkPrevious(prior.sha);
  await io.publish();await io.verify();
  const complete={...durable,phase:'complete',sha:release.sha,files:release.files,verifiedAt:io.now(),deployments:await io.snapshot(),runId:release.runId};
  await io.save(complete);await io.evidence(complete);return complete;
 }catch(error){
  try{durable=await io.reconcile(durable)}catch{durable={...durable,migrationRecoveryRequired:true}}
  if(release.bootstrap&&!prior.sha){await io.save({...durable,phase:'failed',bootstrap:true});throw error}
  try{
   await io.restore(previous,prior.sha||null);
   await io.save({...prior,migrations:durable.migrations,attemptedMigrations:durable.attemptedMigrations,migrationRecoveryRequired:durable.migrationRecoveryRequired,phase:'failed',attemptedSha:release.sha,quarantined:[...new Set([...(prior.quarantined||[]),release.sha])]});
  }catch(rollbackError){await io.save({...durable,phase:'rollback_failed'});throw new AggregateError([error,rollbackError],'Deployment failed and recovery requires attention')}
  throw error;
 }
}
