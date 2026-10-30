import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const moduleUrl=pathToFileURL(resolve('scripts/cicd/cloudflare.mjs')).href;
// Each probe runs in a child process with credentials scrubbed, so no test can reach a real Cloudflare account.
function probe(env,script){
 const base={...process.env};
 for(const key of ['GITHUB_ACTIONS','CLOUDFLARE_API_TOKEN','CLOUDFLARE_API_KEY','ZEXVRO_CI_CLOUDFLARE_API_TOKEN'])delete base[key];
 const result=spawnSync(process.execPath,['--input-type=module','-e',`const m=await import(${JSON.stringify(moduleUrl)});${script}`],{env:{...base,...env},encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
 return JSON.parse(result.stdout.trim().split('\n').pop());
}
const attempt='try{await m.authenticate();console.log(JSON.stringify({result:"ok"}))}catch(e){console.log(JSON.stringify({error:e.message}))}';

test('laptop runs keep the zexvro profile and reject environment credentials',()=>{
 assert.deepEqual(probe({},'console.log(JSON.stringify({ciTokenMode:m.ciTokenMode,profile:m.profileArgs()}))'),{ciTokenMode:false,profile:['--profile','zexvro']});
 assert.match(probe({CLOUDFLARE_API_TOKEN:'fixture-not-used'},attempt).error,/environment auth override rejected/);
});

test('GitHub Actions without the scoped token fails closed instead of using a profile',()=>{
 assert.match(probe({GITHUB_ACTIONS:'true'},attempt).error,/Missing CI Cloudflare token secret/);
});

test('GitHub Actions with the scoped token passes it to Wrangler and never a profile flag',()=>{
 assert.deepEqual(
  probe({GITHUB_ACTIONS:'true',ZEXVRO_CI_CLOUDFLARE_API_TOKEN:'fixture-token'},'console.log(JSON.stringify({ciTokenMode:m.ciTokenMode,profile:m.profileArgs(),wranglerToken:m.cfEnv.CLOUDFLARE_API_TOKEN,secretNameExposed:"ZEXVRO_CI_CLOUDFLARE_API_TOKEN" in m.cfEnv}))'),
  {ciTokenMode:true,profile:[],wranglerToken:'fixture-token',secretNameExposed:false},
 );
});

test('release workflows pass only the scoped CI token and never the retired profile secret',async()=>{
 for(const file of ['.github/workflows/dev-release.yml','.github/workflows/production-release.yml']){
  const text=await readFile(file,'utf8');
  assert.match(text,/ZEXVRO_CI_CLOUDFLARE_API_TOKEN: \$\{\{ secrets\.ZEXVRO_CI_CLOUDFLARE_API_TOKEN \}\}/,file);
  assert.doesNotMatch(text,/WRANGLER_ZEXVRO_PROFILE_TOML/,file);
 }
});

test('every CI Wrangler call takes its profile flag from the single helper',async()=>{
 for(const file of ['build.mjs','deploy.mjs','dev-secret.mjs','journal.mjs']){
  const text=await readFile(resolve('scripts/cicd',file),'utf8');
  assert.doesNotMatch(text,/'--profile','zexvro'/,file);
  assert.match(text,/\.\.\.profileArgs\(\)/,file);
  assert.match(text,/import \{[^}]*profileArgs[^}]*\} from '\.\/cloudflare\.mjs'/,file);
 }
});
test('smoke cleanup hands the scoped CI token to Wrangler inside Actions',async()=>{
 const text=await readFile('services/platform-api/scripts/smoke-services.mjs','utf8');
 assert.match(text,/process\.env\.ZEXVRO_CI_CLOUDFLARE_API_TOKEN/);
 assert.match(text,/\.\.\.\(ciToken\?\{CLOUDFLARE_API_TOKEN:ciToken\}:\{\}\)/);
});
