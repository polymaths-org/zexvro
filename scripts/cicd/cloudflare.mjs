import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {capture,run} from './process.mjs';
import {ACCOUNT} from './policy.mjs';
export const ROOT=resolve(import.meta.dirname,'../..');
export const CLI=resolve(ROOT,'services/platform-api/node_modules/wrangler/bin/wrangler.js');
// GitHub Actions deploys use one account-scoped token from the environment secret ZEXVRO_CI_CLOUDFLARE_API_TOKEN.
// Laptops and verify runs keep the named zexvro profile. The token is passed to Wrangler only inside Actions.
const {ZEXVRO_CI_CLOUDFLARE_API_TOKEN:ciSecret,...inheritedEnv}=process.env;
const ciToken=process.env.GITHUB_ACTIONS==='true'?ciSecret:undefined;
export const ciTokenMode=Boolean(ciToken);
export const cfEnv={...inheritedEnv,XDG_CONFIG_HOME:'/home/wraient',CLOUDFLARE_ACCOUNT_ID:ACCOUNT,...(ciToken?{CLOUDFLARE_API_TOKEN:ciToken}:{})};
export const profileArgs=()=>ciTokenMode?[]:['--profile','zexvro'];
// Never silently substitute an environment credential for the required profile.
export async function authenticate(){
 if(ciTokenMode)return verifyCiToken(ciToken);
 if(process.env.GITHUB_ACTIONS==='true')throw Error('Missing CI Cloudflare token secret; Actions never falls back to the profile');
 if(cfEnv.CLOUDFLARE_API_TOKEN||cfEnv.CLOUDFLARE_API_KEY)throw Error('Named zexvro profile required; environment auth override rejected');
 cf(['auth','activate','zexvro',ROOT]);
 const identity=capture('node',[CLI,'whoami'],{cwd:ROOT,env:cfEnv});
 if(!identity.includes('email zexvro@gmail.com.')||!identity.includes(ACCOUNT))throw Error('Wrong Cloudflare identity; expected zexvro@gmail.com / ZEXVRO account');
 const profile=await readFile('/home/wraient/.wrangler/config/zexvro.toml','utf8');
 const match=profile.match(/^oauth_token\s*=\s*(".*")\s*$/m);if(!match)throw Error('Expected verified zexvro OAuth profile');
 return JSON.parse(match[1]);
}
// The CI token must be active and belong to the ZEXVRO account before any mutation runs.
async function verifyCiToken(token){
 const get=async path=>{
  const response=await fetch('https://api.cloudflare.com/client/v4'+path,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(60000)});
  const data=await response.json();if(!response.ok||!data.success)throw Error(`CI Cloudflare token check ${path}: HTTP ${response.status}`);
  return data.result;
 };
 if((await get(`/accounts/${ACCOUNT}/tokens/verify`)).status!=='active')throw Error('CI Cloudflare token is not active');
 if((await get(`/accounts/${ACCOUNT}`)).id!==ACCOUNT)throw Error('CI Cloudflare token is not scoped to the ZEXVRO account');
 return token;
}
export function cf(args,options={}){return run('node',[CLI,...args],{cwd:ROOT,env:cfEnv,...options})}
export function cfCapture(args){return capture('node',[CLI,...args],{cwd:ROOT,env:cfEnv})}
export function client(token){return async(path,{method='GET',body,allow404=false}={})=>{
 const response=await fetch('https://api.cloudflare.com/client/v4'+path,{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(60000)});
 if(allow404&&response.status===404)return null;
 const data=await response.json();if(!response.ok||!data.success)throw Error(`Cloudflare ${method} ${path}: HTTP ${response.status}, codes ${(data.errors||[]).map(e=>e.code).join(',')}`);
 return data.result;
}}
