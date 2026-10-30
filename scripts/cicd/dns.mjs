import {readFile} from 'node:fs/promises';
import {authenticate,client} from './cloudflare.mjs';import {ACCOUNT} from './policy.mjs';
const c=JSON.parse(await readFile('scripts/cicd/environments.json')),api=client(await authenticate());
const zones=await api('/zones?name=zexvro.in');const zone=zones.find(z=>z.name==='zexvro.in'&&z.account?.id===ACCOUNT);if(!zone)throw Error('Verified ZEXVRO zone unavailable');
for(const [name,url] of [[c.dev.pages,c.dev.console],[c.dev.landingPages,c.dev.landing]]){
 const domain=new URL(url).hostname,project=await api(`/accounts/${ACCOUNT}/pages/projects/${name}`);
 const records=await api(`/zones/${zone.id}/dns_records?name=${encodeURIComponent(domain)}`);
 if(records.length){if(!records.some(r=>r.type==='CNAME'&&r.content===project.subdomain))throw Error('Conflicting DNS record; refusing to overwrite');}
 else await api(`/zones/${zone.id}/dns_records`,{method:'POST',body:{type:'CNAME',name:domain,content:project.subdomain,proxied:true,ttl:1}});
 console.log(domain+' → '+project.subdomain);
}
