import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {capture,run} from './process.mjs';
import {ACCOUNT} from './policy.mjs';
export const ROOT=resolve(import.meta.dirname,'../..');
export const CLI=resolve(ROOT,'services/platform-api/node_modules/wrangler/bin/wrangler.js');
export const cfEnv={...process.env,XDG_CONFIG_HOME:'/home/wraient',CLOUDFLARE_ACCOUNT_ID:ACCOUNT};
// Never silently substitute an environment credential for the required profile.
export async function authenticate(){
 if(cfEnv.CLOUDFLARE_API_TOKEN||cfEnv.CLOUDFLARE_API_KEY)throw Error('Named zexvro profile required; environment auth override rejected');
 if(process.env.GITHUB_ACTIONS==='true'){
  const secret=process.env.WRANGLER_ZEXVRO_PROFILE_TOML;if(!secret)throw Error('Missing protected CI zexvro profile secret');
  await mkdir('/home/wraient/.wrangler/config',{recursive:true,mode:0o700});
  await writeFile('/home/wraient/.wrangler/config/zexvro.toml',secret,{mode:0o600});
 }
 cf(['auth','activate','zexvro',ROOT]);
 const identity=capture('node',[CLI,'whoami'],{cwd:ROOT,env:cfEnv});
 if(!identity.includes('email zexvro@gmail.com.')||!identity.includes(ACCOUNT))throw Error('Wrong Cloudflare identity; expected zexvro@gmail.com / ZEXVRO account');
 const profile=await readFile('/home/wraient/.wrangler/config/zexvro.toml','utf8');
 const match=profile.match(/^oauth_token\s*=\s*(".*")\s*$/m);if(!match)throw Error('Expected verified zexvro OAuth profile');
 return JSON.parse(match[1]);
}
export function cf(args,options={}){return run('node',[CLI,...args],{cwd:ROOT,env:cfEnv,...options})}
export function cfCapture(args){return capture('node',[CLI,...args],{cwd:ROOT,env:cfEnv})}
export function client(token){return async(path,{method='GET',body,allow404=false}={})=>{
 const response=await fetch('https://api.cloudflare.com/client/v4'+path,{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(60000)});
 if(allow404&&response.status===404)return null;
 const data=await response.json();if(!response.ok||!data.success)throw Error(`Cloudflare ${method} ${path}: HTTP ${response.status}, codes ${(data.errors||[]).map(e=>e.code).join(',')}`);
 return data.result;
}}
