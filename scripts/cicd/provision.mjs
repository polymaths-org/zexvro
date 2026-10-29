// Explicit, idempotent staging provisioning. Never resets or migrates production.
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {ACCOUNT} from './policy.mjs';
import {authenticate,client,cf} from './cloudflare.mjs';
import {journal} from './journal.mjs';
const file='scripts/cicd/environments.json',config=JSON.parse(await readFile(file)),api=client(await authenticate()),prefix='/accounts/'+ACCOUNT;
const databases=await api(prefix+'/d1/database?per_page=100');let db=databases.find(d=>d.name===config.dev.database);
if(!db)db=await api(prefix+'/d1/database',{method:'POST',body:{name:config.dev.database}});
if(db.uuid===config.production.databaseId)throw Error('Staging must not reference production D1');config.dev.databaseId=db.uuid;
let newJournal=false;
for(const name of [config.dev.bucket,config.journalBucket]){const bucket=await api(prefix+'/r2/buckets/'+name,{allow404:true});if(!bucket){await api(prefix+'/r2/buckets',{method:'POST',body:{name}});if(name===config.journalBucket)newJournal=true}}
for(const name of [config.dev.pages,config.dev.landingPages]){const project=await api(prefix+'/pages/projects/'+name,{allow404:true});if(!project)await api(prefix+'/pages/projects',{method:'POST',body:{name,production_branch:'main'}})}
await writeFile(file,JSON.stringify(config,null,2)+'\n');
// Initialize empty state once. An authentication or service failure must not overwrite existing state.
for(const target of ['dev','production']){
 if(newJournal)await journal(config.journalBucket,target,{phase:'complete',sha:null,files:{},quarantined:[]});
 else await journal(config.journalBucket,target);
}
console.log('Staging resources provisioned; database ID written. Existing production and Labs data unchanged.');
