import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {cf} from './cloudflare.mjs';
import {assertJournal} from './policy.mjs';
export async function journal(bucket,target,value){
 if(!['dev','production'].includes(target))throw Error('Unknown journal target');
 const dir=await mkdtemp(join(tmpdir(),'zexvro-release-')),file=join(dir,'journal.json');
 try{
  if(value!==undefined){assertJournal(value);await writeFile(file,JSON.stringify(value),{mode:0o600});cf(['r2','object','put',`${bucket}/${target}.json`,'--file',file,'--remote','--profile','zexvro']);return value}
  // Provisioning creates both records. A missing/unreadable journal is a hard failure.
  cf(['r2','object','get',`${bucket}/${target}.json`,'--file',file,'--remote','--profile','zexvro']);
  return assertJournal(JSON.parse(await readFile(file,'utf8')));
 }finally{await rm(dir,{recursive:true,force:true})}
}
