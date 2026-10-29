import {readFile} from 'node:fs/promises';
import {authenticate,client} from './cloudflare.mjs';
import {ACCOUNT} from './policy.mjs';
const config=JSON.parse(await readFile('scripts/cicd/environments.json')),api=client(await authenticate());
for(const [name,url] of [[config.dev.pages,config.dev.console],[config.dev.landingPages,config.dev.landing]]){
 const domain=new URL(url).hostname,path=`/accounts/${ACCOUNT}/pages/projects/${name}/domains`;
 const all=await api(path);let item=all.find(d=>d.name===domain);if(!item)item=await api(path,{method:'POST',body:{name:domain}});
 console.log(domain+': '+item.status);
}
