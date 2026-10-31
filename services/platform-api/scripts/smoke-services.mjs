import assert from 'node:assert/strict'
import {randomBytes,createHash} from 'node:crypto'
import {mkdtempSync,writeFileSync,rmSync,readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {spawnSync} from 'node:child_process'
import {canonicalChallengeMessage,canonicalPopMessage,generateEd25519KeyPair,signEd25519} from '../../agent-auth/src/crypto.ts'

const environments=JSON.parse(readFileSync(new URL('../../../scripts/cicd/environments.json',import.meta.url),'utf8'));
const target=process.env.SMOKE_TARGET||'production';
if(!['dev','production'].includes(target))throw Error('Explicit known smoke target required');
const deployment=environments[target];
const base=process.env.SMOKE_API_URL||deployment.api;
const remote=base===deployment.api;
if(!remote&&!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base))throw Error('Smoke URL must match its declared isolated environment');
const database=deployment.database,bucket=deployment.bucket;
const nonce=randomBytes(6).toString('hex'),createdUsers=[],owners=[],siteIds=[],jtiIds=[],assets=[]
const q=value=>`'${String(value).replaceAll("'","''")}'`
const wrangler=fileURLToPath(new URL('../node_modules/.bin/wrangler',import.meta.url))
const config=target==='dev'?fileURLToPath(new URL('../../../release/config/dev/wrangler.json',import.meta.url)):fileURLToPath(new URL('../wrangler.jsonc',import.meta.url))
const cwd=fileURLToPath(new URL('..',import.meta.url))
// Inside Actions, cleanup runs on the scoped CI token; locally it uses the zexvro profile.
function cli(args){const ciToken=process.env.ZEXVRO_CI_CLOUDFLARE_API_TOKEN;const r=spawnSync(wrangler,args,{cwd,env:{...process.env,XDG_CONFIG_HOME:'/home/wraient',...(ciToken?{CLOUDFLARE_API_TOKEN:ciToken}:{})},stdio:'inherit'});if(r.status!==0)throw Error('Cleanup CLI failed')}
async function call(path,{body,token,method=body?'POST':'GET',expected=200}={}){
 const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})})
 const label=path.split('?')[0].replace(/(\/api\/invite\/)[A-Za-z0-9_-]{32,128}/,'$1[redacted]');
 const text=await r.text();let result;
 try{result=JSON.parse(text)}catch{
  // Name the response so a Cloudflare error page (for example a Worker exception) is visible in the CI log.
  const title=text.match(/<title>([^<]{0,200})<\/title>/i)?.[1]??text.replace(/\s+/g,' ').slice(0,160);
  throw Error(`${method} ${label}: HTTP ${r.status} ${r.headers.get('content-type')??'no content-type'} cf-ray=${r.headers.get('cf-ray')??'none'} is not JSON: ${title}`)
 }
 assert.equal(r.status,expected,`${label} HTTP status`);console.log(`${method} ${label}: ${r.status}`);return result
}
async function account(name){
 const username=`smoke_${name}_${nonce}`,email=`${username}@example.test`,password=randomBytes(24).toString('base64url')
 createdUsers.push(username) // Track uncertain request outcomes before mutation, too.
 await call('/auth/signup',{body:{username,email,password}})
 return {...await call('/auth/signin',{body:{username,password}}),email}
}
try{
 console.log(`Testing ${base}; credentials and private site keys stay in memory`)
 const owner=await account('owner'),guest=await account('guest')
 const ws=(await call('/api/workspaces',{body:{name:`Service smoke ${nonce}`},token:owner.token})).workspace;owners.push(ws.ownerId)
 const project=(await call('/api/projects',{body:{workspaceId:ws.id,name:'Service smoke project'},token:owner.token})).project
 const scope=`${ws.id}:${project.id}`
 const depin=await call('/depin/status',{token:owner.token});assert.equal(depin.stateBackend,'d1');assert.equal(depin.multiInstanceSafe,true)
 const prover=await call('/api/zk-worker/status',{token:owner.token});assert.equal(prover.provider,'browser');assert.equal(prover.configured,false)
 assert.equal((await call('/nft/v1/collections?workspaceId='+encodeURIComponent(scope),{token:owner.token})).collections.length,0)
 await call('/nft/v1/collections?workspaceId='+encodeURIComponent(scope),{token:guest.token,expected:403})
 const form=new FormData(),svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><title>${nonce}</title><rect width="1" height="1" fill="black"/></svg>`
 assets.push(createHash('sha256').update(svg).digest('hex'))
 form.append('file',new Blob([svg],{type:'image/svg+xml'}),'migration-smoke.svg')
 const upload=await fetch(base+'/nft/v1/media',{method:'POST',headers:{Authorization:`Bearer ${owner.token}`},body:form});assert.equal(upload.status,201)
 const asset=(await upload.json()).asset;assets.push(asset.cid)
 const image=await fetch(base+new URL(asset.uri).pathname);assert.equal(image.status,200);assert.equal(await image.text(),svg);assert.ok(image.headers.get('content-security-policy')?.includes('sandbox'))
 const cached=await fetch(base+new URL(asset.uri).pathname,{headers:{'If-None-Match':image.headers.get('etag')}});assert.equal(cached.status,304);console.log('R2 upload, streamed asset and conditional GET: passed')
 const site=await call('/gate/v1/admin/sites',{body:{name:`Smoke ${nonce}`,allowedOrigins:['https://smoke.example'],projectId:project.id},token:owner.token,expected:201});siteIds.push(site.siteId)
 assert.ok((await call('/gate/v1/admin/sites',{token:owner.token})).sites.some(s=>s.siteId===site.siteId))
 assert.equal((await call('/gate/v1/admin/sites',{token:guest.token})).sites.length,0)
 await call('/gate/v1/admin/sites/'+site.siteId,{token:guest.token,expected:404})
 const kp=generateEd25519KeyPair()
 await call('/gate/v1/admin/agents',{body:{siteKey:site.siteKey,publicKey:kp.publicKey,name:'Smoke agent'},token:owner.token,expected:201})
 const action='search.query'
 const challenge=await call('/gate/v1/challenges',{body:{siteKey:site.siteKey,action,channel:'agent',clientPublicKey:kp.publicKey,agentPublicKey:kp.publicKey},expected:201})
 const proof=signEd25519({privateKey:kp.privateKey,message:canonicalChallengeMessage({issuer:base+'/gate',audience:site.siteId,nonce:challenge.nonce,exp:challenge.exp,projectId:project.id,action,channel:'agent',clientPublicKey:kp.publicKey})})
 const completeBody={siteKey:site.siteKey,proofType:'nonce_sign',proof}
 const issued=await call(`/gate/v1/challenges/${challenge.id}/complete`,{body:completeBody})
 await call(`/gate/v1/challenges/${challenge.id}/complete`,{body:completeBody,expected:409})
 const claims=JSON.parse(Buffer.from(issued.capability.split('.')[1],'base64url').toString());jtiIds.push(claims.jti)
 const iat=Math.floor(Date.now()/1000),htu='https://smoke.example/search',htm='POST',bodyHash='-'
 const signature=signEd25519({privateKey:kp.privateKey,message:canonicalPopMessage({jti:claims.jti,htm,htu,iat,bodyHash})})
 await call('/gate/v1/verify',{body:{siteSecret:site.secretKey,capability:issued.capability,action,minClass:'agent',pop:{signature,htm,htu,iat,bodyHash}}})
 const token=randomBytes(24).toString('hex')
 const invite=await call('/api/invite/send',{body:{workspaceId:ws.id,email:guest.email,role:'Viewer',token},token:owner.token});assert.equal(invite.provider,'link')
 await call('/api/invite/'+token)
 await call('/api/invite/accept',{body:{token},token:guest.token})
 await call('/api/projects',{body:{workspaceId:ws.id,name:'deny viewer write'},token:guest.token,expected:403})
 const credits=await call(`/api/workspaces/${ws.id}/credits`,{token:owner.token});assert.equal(credits.credits.balance,100)
 await call('/auth/signout',{body:{},token:owner.token});await call('/auth/signout',{body:{},token:guest.token})
 console.log('Live tenant isolation, Gate Ed25519/PoP/replay, invitation permissions and credit reads: passed')
}finally{
 const dir=mkdtempSync(join(tmpdir(),'zexvro-service-smoke-')),file=join(dir,'cleanup.sql')
 const statements=[...jtiIds.map(id=>`DELETE FROM gate_jti WHERE jti=${q(id)};`),...siteIds.map(id=>`DELETE FROM gate_sites WHERE id=${q(id)} AND owner_id IN (${owners.map(q).join(',')||"''"});`),...[...new Set([...owners,...createdUsers])].flatMap(id=>[`DELETE FROM gate_sites WHERE owner_id=${q(id)};`,`DELETE FROM workspaces WHERE owner_id=${q(id)};`]),...createdUsers.map(name=>`DELETE FROM accounts WHERE username=${q(name)};`)]
 try{
  if(statements.length){writeFileSync(file,statements.join('\n'),{mode:0o600});cli(['d1','execute',database,'--config',config,remote?'--remote':'--local','--file',file,'--profile','zexvro'])}
  for(const key of new Set(assets))if(/^[a-f0-9]{64}$/.test(key))cli(['r2','object','delete',`${bucket}/${key}`,remote?'--remote':'--local','--profile','zexvro'])
 }catch(error){console.error('Cleanup file retained for retry:',file);throw error}
 rmSync(dir,{recursive:true,force:true})
}
