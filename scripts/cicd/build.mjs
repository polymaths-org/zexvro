import {mkdir,cp,readFile,writeFile,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {stat} from 'node:fs/promises';
import {run,capture} from './process.mjs';
import {inventory,assertSha,ACCOUNT} from './policy.mjs';
import {profileArgs} from './cloudflare.mjs';
const root=process.cwd(),out=resolve('release'),sha=assertSha(process.env.GITHUB_SHA||capture('git',['rev-parse','HEAD']));
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
const sourceDirty=!!capture('git',['status','--porcelain','--untracked-files=normal']);
if(process.env.GITHUB_ACTIONS==='true'&&sourceDirty)throw Error('CI release source checkout is dirty');
const config=JSON.parse(await readFile('scripts/cicd/environments.json'));
if(config.account!==ACCOUNT)throw Error('Unexpected release account');
// One code bundle for both environments; API URLs are public runtime overlays.
for(const key of Object.keys(process.env))if(key.startsWith('VITE_'))delete process.env[key];
for(const [pkg,target] of [['frontend','console'],['landing/zexvro','landing']]){
 run('npm',['--prefix',pkg,'run','build']);await cp(resolve(pkg,'dist'),resolve(out,target),{recursive:true});
}
run('node',['services/platform-api/node_modules/wrangler/bin/wrangler.js','deploy','--dry-run','--outdir',resolve(out,'worker'),'--config','services/platform-api/wrangler.jsonc',...profileArgs()],{env:{...process.env,XDG_CONFIG_HOME:'/home/wraient'}});
await cp('services/platform-api/migrations',resolve(out,'migrations'),{recursive:true});
const base=JSON.parse(await readFile('services/platform-api/wrangler.jsonc'));
for(const target of ['dev','production']){
 const env=config[target],dir=resolve(out,'config',target);await mkdir(dir,{recursive:true});
 const runtime={VITE_API_URL:env.api,VITE_NFT_API_URL:env.api+'/nft',VITE_AGENT_AUTH_API_URL:env.api+'/gate',VITE_DEPIN_API_URL:env.api+'/depin',VITE_APP_URL:env.console};
 await writeFile(resolve(dir,'runtime-config.js'),'globalThis.__ZEXVRO_CONFIG__='+JSON.stringify(runtime)+';\n');
 const worker={...base,name:env.worker,main:'../../worker/index.js',no_bundle:true,minify:false,build:undefined,upload_source_maps:false,
  rules:[{type:'Text',globs:['**/*-captcha.js'],fallthrough:true}],
  vars:{...base.vars,PUBLIC_API_URL:env.api,RELEASE_SHA:sha,SIGNUPS_OPEN:target==='dev'?'true':base.vars.SIGNUPS_OPEN,ALLOWED_ORIGINS:target==='production'?base.vars.ALLOWED_ORIGINS:[env.console,env.landing,'http://127.0.0.1:4173'].join(',')},
  d1_databases:[{binding:'DB',database_name:env.database,database_id:env.databaseId,migrations_dir:'../../migrations'}],
  r2_buckets:[{binding:'NFT_MEDIA',bucket_name:env.bucket}],
  ratelimits:base.ratelimits.map(r=>({...r,namespace_id:target==='dev'?String(Number(r.namespace_id)+100):r.namespace_id}))};
 if(target==='dev')worker.triggers={crons:[]};
 await writeFile(resolve(dir,'wrangler.json'),JSON.stringify(worker,null,2));
 await writeFile(resolve(dir,'release.json'),JSON.stringify({sha,target,api:env.api,targets:config.targets,sourceDirty}));
}
const manifest={schema:1,sourceDirty,repository:process.env.GITHUB_REPOSITORY||'polymaths-org/zexvro',sha,workflow:'dev-release.yml',runId:process.env.GITHUB_RUN_ID||'local',attempt:process.env.GITHUB_RUN_ATTEMPT||'1',files:await inventory(out)};
let size=0;for(const path of Object.keys(manifest.files))size+=(await stat(resolve(out,path))).size;
if(size>100*1024*1024)throw Error('Release exceeds the 100 MiB artifact budget; move large static media to shared hosting');
await writeFile(resolve(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
