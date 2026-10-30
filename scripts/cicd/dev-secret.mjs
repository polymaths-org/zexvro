import {readFile} from 'node:fs/promises';import {randomBytes} from 'node:crypto';
import {authenticate,client,cf,profileArgs} from './cloudflare.mjs';import {ACCOUNT} from './policy.mjs';
const c=JSON.parse(await readFile('scripts/cicd/environments.json')),api=client(await authenticate());
const secrets=await api(`/accounts/${ACCOUNT}/workers/scripts/${c.dev.worker}/secrets`,{allow404:true});
if(!secrets?.some(s=>s.name==='GATE_SIGNING_SECRET')){
 // Fresh staging-only signing material. No wallet, user credential or production secret is copied.
 cf(['secret','put','GATE_SIGNING_SECRET','--name',c.dev.worker,'--config','services/platform-api/wrangler.jsonc',...profileArgs()],{input:randomBytes(48).toString('base64url')+'\n',stdio:['pipe','inherit','inherit']});
}
console.log('Staging Gate signing secret present; production secrets unchanged');
