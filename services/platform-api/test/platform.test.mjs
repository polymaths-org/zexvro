import {after,before,test} from 'node:test';
import assert from 'node:assert/strict';
import {getPlatformProxy} from 'wrangler';
import {createSession} from '../src/auth.ts';
import worker from '../src/index.ts';
import {Store} from '../src/store.ts';
let proxy,env,owner,outsider;
const prefix=crypto.randomUUID();
const limiter={limit:async()=>({success:true})};
before(async()=>{
  proxy=await getPlatformProxy();
  env={...proxy.env,API_RATE_LIMITER:limiter,WRITE_RATE_LIMITER:limiter,AUTH_RATE_LIMITER:limiter,DEVICE_RATE_LIMITER:limiter};
  const fixture=async name=>{
    const id=`${name}-${prefix}`;
    await env.DB.prepare('INSERT INTO accounts(id,username,email,password_hash,recovery_hash,created_at) VALUES(?,?,?,?,?,?)').bind(id,id,`${id}@example.test`,'fixture','fixture',Date.now()).run();
    return (await createSession(env,{id,username:id,email:`${id}@example.test`,version:1})).token;
  };
  owner=await fixture('owner');outsider=await fixture('outsider');
});
after(async()=>{
  await proxy?.env.DB.prepare('DELETE FROM workspaces WHERE owner_id=?').bind(`owner-${prefix}`).run();
  await proxy?.env.DB.prepare('DELETE FROM personal_records WHERE username=?').bind(`owner-${prefix}`).run();
  await proxy?.env.DB.prepare('DELETE FROM user_memory WHERE username=?').bind(`owner-${prefix}`).run();
  await proxy?.env.DB.prepare('DELETE FROM accounts WHERE id IN (?,?) OR username=?').bind(`owner-${prefix}`,`outsider-${prefix}`,`auth_${prefix.slice(0,12)}`).run();
  await proxy?.dispose();
});
async function call(path,method='GET',body,token=owner,overrides={}){
  const response=await worker.fetch(new Request(`https://api.example${path}`,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...overrides},...(body===undefined?{}:{body:JSON.stringify(body)})}),env);
  return {status:response.status,body:await response.json()};
}
test('reject forged tokens and disallowed origins before database access',async()=>{
 assert.equal((await call('/api/workspaces','GET',undefined,'fake')).status,401);
 assert.equal((await call('/api/workspaces','GET',undefined,owner,{Origin:'https://evil.example'})).status,403);
});
test('workspace lifecycle, isolation, bounded pagination, no-op writes and deletion cascade',async()=>{
 const created=await call('/api/workspaces','POST',{name:`Test ${prefix}`,members:[{id:`outsider-${prefix}`,role:'Owner',status:'active'}]});
 assert.equal(created.status,200);const ws=created.body.workspace,id=ws.id;
 assert.equal((await call(`/api/workspaces/${id}`,'GET',undefined,outsider)).status,403);
 assert.equal((await call('/api/workspaces','POST',{name:`Test ${prefix}`})).body.workspace.id,id);
 const balance=await call(`/api/workspaces/${id}/credits`);assert.equal(balance.body.credits.balance,100);
 const project=await call('/api/projects','POST',{workspaceId:id,name:'A'});assert.equal(project.status,200);
 const pid=project.body.project.id;
 assert.equal((await call(`/api/projects?workspaceId=${id}`,'GET',undefined,outsider)).status,403);
 assert.equal((await call(`/api/projects/${pid}`,'PUT',{workspaceId:'wrong',name:'changed'})).body.project.workspaceId,id);
 assert.equal((await call(`/api/projects?workspaceId=${id}&limit=-1`)).status,400);
 for(let i=0;i<3;i++)assert.equal((await call('/api/projects','POST',{workspaceId:id,name:`P${i}`})).status,200);
 const first=await call(`/api/projects?workspaceId=${id}&limit=2`);assert.equal(first.body.projects.length,2);assert.ok(first.body.nextCursor);
 const next=await call(`/api/projects?workspaceId=${id}&limit=2&cursor=${encodeURIComponent(first.body.nextCursor)}`);assert.equal(next.body.projects.length,2);assert.equal(next.body.nextCursor,null);
 assert.equal(new Set([...first.body.projects,...next.body.projects].map(p=>p.id)).size,4);
 const row=await env.DB.prepare('SELECT data FROM records WHERE kind=? AND id=?').bind('project',pid).first();
 const before=(await env.DB.prepare('SELECT count(*) AS n FROM audit_events WHERE workspace_id=?').bind(id).first()).n;
 const doc=JSON.parse(row.data);await new Store(env.DB).saveRecord('project',doc,ws.ownerId,doc);
 assert.equal((await env.DB.prepare('SELECT count(*) AS n FROM audit_events WHERE workspace_id=?').bind(id).first()).n,before);
 assert.equal((await call(`/api/workspaces/${id}`,'DELETE')).status,200);
 assert.equal((await env.DB.prepare('SELECT count(*) AS n FROM records WHERE workspace_id=?').bind(id).first()).n,0);
 assert.equal((await env.DB.prepare('SELECT count(*) AS n FROM credit_balances WHERE workspace_id=?').bind(id).first()).n,0);
});
test('memory updates merge without overwriting unrelated concurrent fields and null deletes',async()=>{
 await Promise.all([call('/api/memory','POST',{memory:{a:1}}),call('/api/memory','POST',{memory:{b:2}})]);
 assert.deepEqual((await call('/api/memory')).body.memory,{a:1,b:2});
 await call('/api/memory','POST',{memory:{a:null}});
 assert.deepEqual((await call('/api/memory')).body.memory,{b:2});
});
test('SQL membership triggers track roster atomically and indexes cover tenant queries',async()=>{
 const created=await call('/api/workspaces','POST',{name:`Index ${prefix}`}),ws=created.body.workspace;
 const updated={...ws,members:[...ws.members,{id:`outsider-${prefix}`,role:'Viewer',status:'active'}]};
 await new Store(env.DB).updateWorkspace(ws,updated,ws.ownerId);
 assert.equal((await call(`/api/workspaces/${ws.id}`,'GET',undefined,outsider)).status,200);
 assert.equal((await call('/api/projects','POST',{workspaceId:ws.id,name:'forbidden'},outsider)).status,403);
 const plans=await env.DB.prepare('EXPLAIN QUERY PLAN SELECT id,data FROM records INDEXED BY records_workspace WHERE kind=? AND workspace_id=? AND id>? ORDER BY id LIMIT ?').bind('project',ws.id,'',51).all();
 assert.ok(plans.results.some(r=>String(r.detail).includes('records_workspace')));
 const memberPlans=await env.DB.prepare('EXPLAIN QUERY PLAN SELECT role FROM memberships WHERE identity=? AND workspace_id=?').bind('x',ws.id).all();
 assert.ok(memberPlans.results.every(r=>!String(r.detail).includes('SCAN')));
});
test('write and request limits reject without D1 work; oversized bodies rejected',async()=>{
 const limited={...env,WRITE_RATE_LIMITER:{limit:async()=>({success:false})}};
 const response=await worker.fetch(new Request('https://api.example/api/workspaces',{method:'POST',headers:{Authorization:`Bearer ${owner}`},body:'{}'}),limited);
 assert.equal(response.status,429);assert.equal(response.headers.get('Retry-After'),'60');
 assert.equal((await call('/api/memory','POST',{memory:{blob:'x'.repeat(66000)}})).status,413);
});
test('personal records are isolated, notes deduplicate, proofs filter by project',async()=>{
 const a=await call('/api/zk-notes','POST',{commitment:prefix});
 const b=await call('/api/zk-notes','POST',{commitment:prefix});
 assert.equal(a.body.note.id,b.body.note.id);
 assert.equal((await call('/api/zk-notes','GET',undefined,outsider)).body.notes.length,0);
 await call('/api/proofs','POST',{projectId:'one',paymentId:'p'});
 await call('/api/proofs','POST',{projectId:'two',paymentId:'p'});
 const one=await call('/api/proofs?projectId=one');assert.equal(one.body.proofs.length,1);assert.equal(one.body.proofs[0].projectId,'one');
 await env.DB.prepare('DELETE FROM personal_records WHERE username=?').bind(`owner-${prefix}`).run();
});
test('small patches cannot grow memory beyond its storage cap',async()=>{
 assert.equal((await call('/api/memory','POST',{memory:{largeA:'a'.repeat(40000)}})).status,200);
 assert.equal((await call('/api/memory','POST',{memory:{largeB:'b'.repeat(40000)}})).status,413);
 assert.equal((await call('/api/memory','POST',{memory:{largeA:null}})).status,200);
});
test('fresh accounts: signup, email login, refresh rotation, recovery replay denial and logout',async()=>{
 const username=`auth_${prefix.slice(0,12)}`,password='A sufficiently long password 9',email=`${username}@example.test`;
 const signup=await call('/auth/signup','POST',{username,email,password});assert.equal(signup.status,200);assert.ok(signup.body.recoveryKey);
 assert.equal((await call('/auth/signup','POST',{username,email,password})).status,409);
 assert.equal((await call('/auth/signin','POST',{username,password:'wrong password'})).status,401);
 const login=await call('/auth/signin','POST',{username:email,password});assert.equal(login.status,200);
 const session=login.body;
 assert.equal((await call('/api/workspaces','GET',undefined,session.token)).status,200);
 const refresh=await call('/auth/refresh','POST',{refreshToken:session.refreshToken});assert.equal(refresh.status,200);
 assert.equal((await call('/api/workspaces','GET',undefined,session.token)).status,401);
 assert.equal((await call('/auth/refresh','POST',{refreshToken:session.refreshToken})).status,401);
 assert.equal((await call('/auth/reset-password','POST',{username,recoveryKey:'wrong',password})).status,400);
 const reset=await call('/auth/reset-password','POST',{username,recoveryKey:signup.body.recoveryKey,password:'New secure password 12345'});assert.equal(reset.status,200);
 assert.notEqual(reset.body.recoveryKey,signup.body.recoveryKey);
 assert.equal((await call('/api/workspaces','GET',undefined,refresh.body.token)).status,401);
 assert.equal((await call('/auth/reset-password','POST',{username,recoveryKey:signup.body.recoveryKey,password})).status,400);
 assert.equal((await call('/auth/signin','POST',{username,password})).status,401);
 const fresh=await call('/auth/signin','POST',{username,password:'New secure password 12345'});assert.equal(fresh.status,200);
 assert.equal((await call('/auth/signout','POST',{},fresh.body.token)).status,200);
 assert.equal((await call('/api/workspaces','GET',undefined,fresh.body.token)).status,401);
 const stored=await env.DB.prepare('SELECT password_hash,recovery_hash FROM accounts WHERE username=?').bind(username).first();
 assert.ok(stored.password_hash.startsWith('scrypt$'));assert.notEqual(stored.recovery_hash,reset.body.recoveryKey);
});

test('device authorization requires signed-in approval and consumes the code once',async()=>{
 const device=await call('/auth/device-code','POST',{});assert.equal(device.status,200);
 assert.equal((await call('/auth/token','POST',{device_code:device.body.device_code})).body.error,'authorization_pending');
 assert.equal((await call('/auth/activate','POST',{user_code:device.body.user_code,action:'approve'},'fake')).status,401);
 assert.equal((await call('/auth/activate','POST',{user_code:device.body.user_code,action:'approve'})).status,200);
 const session=await call('/auth/token','POST',{device_code:device.body.device_code});assert.equal(session.status,200);assert.ok(session.body.access_token.startsWith('zx_'));
 assert.equal((await call('/auth/token','POST',{device_code:device.body.device_code})).body.error,'expired_token');
 assert.equal((await call('/api/workspaces','GET',undefined,session.body.access_token)).status,200);
});

test('optimistic console IDs remain stable; supplied IDs cannot overwrite another workspace',async()=>{
 const id=`ws_client_${prefix}`,projectId=`proj_client_${prefix}`;
 const ws=await call('/api/workspaces','POST',{id,name:`Client ${prefix}`});assert.equal(ws.status,200);assert.equal(ws.body.workspace.id,id);
 assert.equal((await call(`/api/workspaces/${id}/members`)).status,200);
 const project=await call('/api/projects','POST',{workspaceId:id,id:projectId,name:'Client project'});assert.equal(project.body.project.id,projectId);
 assert.equal((await call(`/api/projects/${projectId}`)).status,200);
 const attack=await call('/api/workspaces','POST',{id,name:'stolen'},outsider);assert.equal(attack.status,409);
 assert.equal((await call(`/api/workspaces/${id}`,'GET',undefined,outsider)).status,403);
});
test('NFT D1: concurrent token allocation, imported counters, one-time checkout claims and idempotency',async()=>{
 const {D1NftRepository}=await import('../../nft-service/api/src/d1Repository.ts');const repo=new D1NftRepository(env.DB);
 const id=`nft_${prefix}`;const collection={id,workspaceId:`team_${prefix}`,name:'Test collection',status:'live',createdAt:new Date().toISOString()};
 await repo.saveCollection(collection);
 try {
  const allocated=await Promise.all(Array.from({length:25},()=>repo.allocateNextTokenId(id)));assert.equal(new Set(allocated).size,25);assert.equal(await repo.getTokenCounter(id),25);
  await repo.saveMintedItem({collectionId:id,tokenId:100,id:'token100',ownerAddress:'owner',mintedAt:new Date().toISOString()});assert.equal(await repo.allocateNextTokenId(id),101);
  const checkout={id:`co_${prefix}`,collectionId:id,idempotencyKey:`idem_${prefix}`,status:'pending_signature',expiresAt:new Date(Date.now()+60000).toISOString()};
  await repo.saveCheckoutIntent(checkout);assert.equal((await repo.findCheckoutIntentByIdempotencyKey(checkout.idempotencyKey)).id,checkout.id);
  const claims=await Promise.all(Array.from({length:20},()=>repo.claimCheckoutIntent(checkout.id,new Date())));assert.equal(claims.filter(Boolean).length,1);
  assert.equal((await repo.getCheckoutIntent(checkout.id)).status,'submitting');
  await assert.rejects(repo.saveCheckoutIntent({...checkout,id:`other_${prefix}`}));
  const plan=await env.DB.prepare('EXPLAIN QUERY PLAN SELECT data FROM nft_collections INDEXED BY nft_workspace WHERE workspace_scope=? ORDER BY id LIMIT 100').bind(collection.workspaceId).all();assert.ok(plan.results.every(row=>!String(row.detail).includes('SCAN')));
 }finally{await repo.deleteCollection(id)}
 assert.equal(await repo.getCheckoutIntent(`co_${prefix}`),undefined);
});
test('Gate D1: tenant isolation, hashed site keys, atomic challenge/replay protection and counters',async()=>{
 const {D1GateRepository}=await import('../../agent-auth/src/repository.d1.ts');
 const repo=new D1GateRepository(env.DB,()=>`owner-${prefix}`),other=new D1GateRepository(env.DB,()=>`outsider-${prefix}`);
 const site={siteId:`site_${prefix}`,siteKey:`public_${prefix}`,secretHash:'',projectId:'project',allowedOrigins:['https://embed.example'],name:'Test',createdAt:new Date().toISOString()};const secret=`private_${prefix}`;
 await repo.createSite(site,secret);
 try {
  assert.equal(await other.getSiteById(site.siteId),undefined);assert.equal(await other.getSiteByKey(site.siteKey),undefined);assert.equal((await other.listSites()).length,0);
  assert.equal((await repo.findSiteBySecret(secret)).siteId,site.siteId);assert.equal(await repo.getSiteSecret(site.siteId),undefined);assert.ok(await repo.isOriginAllowed('https://embed.example'));assert.equal(await repo.isOriginAllowed('https://evil.example'),false);
  const challenge={id:`ch_${prefix}`,siteId:site.siteId,status:'pending',expiresAt:Date.now()+60000};await repo.putChallenge(challenge);
  const completed=await Promise.all(Array.from({length:20},()=>repo.completeChallengeIfPending(challenge.id)));assert.equal(completed.filter(Boolean).length,1);
  await repo.saveChallenge(challenge);assert.equal((await repo.getChallenge(challenge.id)).status,'completed');
  const jti=`jti_${prefix}`;await repo.registerJti(jti,Date.now()+60000,3);const used=await Promise.all(Array.from({length:20},()=>repo.consumeJti(jti)));assert.equal(used.filter(Boolean).length,3);assert.equal((await repo.getJti(jti)).remaining,0);await env.DB.prepare('DELETE FROM gate_jti WHERE jti=?').bind(jti).run();
  const credential={siteId:site.siteId,credentialId:'cred',userId:'user',publicKey:'key',counter:2,createdAt:new Date().toISOString()};await repo.putWebAuthnCredential(credential);await repo.updateWebAuthnCounter(site.siteId,'cred',3);await assert.rejects(repo.updateWebAuthnCounter(site.siteId,'cred',2));
  const stored=await env.DB.prepare('SELECT data,secret_hash FROM gate_sites WHERE id=?').bind(site.siteId).first();assert.ok(!stored.data.includes(secret));assert.notEqual(stored.secret_hash,secret);
 }finally{await env.DB.prepare('DELETE FROM gate_sites WHERE id=?').bind(site.siteId).run()}
});
test('R2 assets are content-addressed and round-trip without putting image bytes into D1',async()=>{
 const {R2AssetPinningService}=await import('../../nft-service/api/src/r2Pinning.ts');const assets=new R2AssetPinningService(proxy.env.NFT_MEDIA,'https://api.example/nft');
 const input={bytes:new TextEncoder().encode(`image-${prefix}`),filename:'test.png',mimeType:'image/png'};
 const first=await assets.pinFile(input),second=await assets.pinFile(input);assert.equal(first.cid,second.cid);assert.ok(first.uri.includes('/nft/v1/assets/'));
 const restored=await assets.readAsset(first.cid);assert.equal(new TextDecoder().decode(restored.bytes),`image-${prefix}`);assert.equal(restored.mimeType,'image/png');await proxy.env.NFT_MEDIA.delete(first.cid);
});
test('credit ledger: idempotent grants and concurrent spending cannot overdraw or apply twice',async()=>{
 const {applyCredit,creditBalance}=await import('../src/credits.ts');
 const ws=(await call('/api/workspaces','POST',{name:`Credit ${prefix}`})).body.workspace;
 assert.equal((await creditBalance(env.DB,ws.id)).balance,100);
 const grants=await Promise.all(Array.from({length:15},()=>applyCredit(env.DB,ws.id,50,'grant-once',{type:'grant'})));
 assert.equal((await creditBalance(env.DB,ws.id)).balance,150);assert.equal(grants.filter(g=>!g.idempotent).length,1);
 const attempts=await Promise.allSettled(Array.from({length:20},(_,i)=>applyCredit(env.DB,ws.id,-20,`spend-${i}`,{type:'consume',service:'zer0',action:'prove'})));
 assert.equal(attempts.filter(a=>a.status==='fulfilled').length,7);assert.equal((await creditBalance(env.DB,ws.id)).balance,10);
 const duplicate=await applyCredit(env.DB,ws.id,-20,'spend-0',{type:'consume',service:'zer0',action:'prove'});assert.ok(duplicate.idempotent);
 await assert.rejects(applyCredit(env.DB,ws.id,60,'grant-once',{type:'grant'}));assert.equal((await creditBalance(env.DB,ws.id)).balance,10);
 assert.equal((await call('/api/platform/credits/grant','POST',{workspaceId:ws.id,amount:1000},outsider)).status,403);
});
test('promos: concurrent redemptions respect the global cap and per-workspace uniqueness',async()=>{
 const {redeem,creditBalance}=await import('../src/credits.ts');const code=`PROMO_${prefix}`.toUpperCase();
 const a=(await call('/api/workspaces','POST',{name:`Promo A ${prefix}`})).body.workspace,b=(await call('/api/workspaces','POST',{name:`Promo B ${prefix}`})).body.workspace;
 await env.DB.prepare('INSERT INTO promo_codes(code,amount,remaining,data) VALUES(?,?,?,?)').bind(code,25,1,JSON.stringify({code})).run();
 try {
  const result=await Promise.allSettled(Array.from({length:20},(_,i)=>redeem(env.DB,i%2?a.id:b.id,code)));assert.equal(result.filter(r=>r.status==='fulfilled').length,1);
  assert.equal((await creditBalance(env.DB,a.id)).balance+(await creditBalance(env.DB,b.id)).balance,225);
  assert.equal((await env.DB.prepare('SELECT remaining FROM promo_codes WHERE code=?').bind(code).first()).remaining,0);
 }finally{await env.DB.prepare('DELETE FROM promo_redemptions WHERE code=?').bind(code).run();await env.DB.prepare('DELETE FROM promo_codes WHERE code=?').bind(code).run()}
});
test('invites: owner-only creation, hashed links, recipient binding, revocation, acceptance and replay',async()=>{
 const ws=(await call('/api/workspaces','POST',{name:`Invite ${prefix}`})).body.workspace;
 const token='invite_'+prefix.replaceAll('-',''),email=`outsider-${prefix}@example.test`;
 const body={workspaceId:ws.id,inviteId:'inv_test',email,role:'Viewer',token};
 assert.equal((await call('/api/invite/send','POST',body,outsider)).status,403);
 assert.equal((await call('/api/invite/send','POST',{...body,role:'Owner'})).status,400);
 assert.equal((await call('/api/invite/send','POST',body)).status,200);
 const preview=await call(`/api/invite/${token}`,'GET',undefined,'fake');assert.equal(preview.status,200);assert.equal(preview.body.invite.status,'pending');
 const stored=await env.DB.prepare('SELECT token,data FROM invites WHERE workspace_id=?').bind(ws.id).first();assert.notEqual(stored.token,token);assert.ok(!stored.data.includes(token));
 assert.equal((await call('/api/invite/accept','POST',{token})).status,403);
 assert.equal((await call('/api/invite/revoke','POST',{workspaceId:ws.id,inviteId:'inv_test'})).status,200);
 assert.equal((await call('/api/invite/accept','POST',{token},outsider)).status,410);
 const newToken=token+'_new';assert.equal((await call('/api/invite/send','POST',{...body,token:newToken})).status,200);
 assert.equal((await call(`/api/invite/${token}`)).status,404);
 const accepted=await call('/api/invite/accept','POST',{token:newToken,principalId:'forged-admin'},outsider);assert.equal(accepted.status,200);assert.equal(accepted.body.role,'Viewer');
 assert.equal((await call(`/api/workspaces/${ws.id}`,'GET',undefined,outsider)).status,200);
 assert.equal((await call('/api/projects','POST',{workspaceId:ws.id,name:'deny'},outsider)).status,403);
 assert.equal((await call('/api/invite/accept','POST',{token:newToken},outsider)).body.alreadyAccepted,true);
});
test('NFT inventory pages, maintained counts and read paths do not reconcile or call the chain',async()=>{
 const {D1NftRepository}=await import('../../nft-service/api/src/d1Repository.ts'),{NftService}=await import('../../nft-service/api/src/service.ts');
 const repo=new D1NftRepository(env.DB),id=`nft_page_${prefix}`;
 await repo.saveCollection({id,workspaceId:'test',name:'Paged inventory',symbol:'PAGE',description:'Test',coverImageUri:'https://example.test/image',status:'live',contractId:'on-chain-id',createdAt:new Date().toISOString()});
 try {
  await Promise.all(Array.from({length:105},(_,i)=>repo.saveMintedItem({id:`item${i}`,collectionId:id,tokenId:i,ownerAddress:'owner',mintedAt:new Date().toISOString()})));
  assert.equal(await repo.countMintedItems(id),105);const first=await repo.listMintedItems(id,{limit:101});assert.equal(first.length,101);
  const last=await repo.listMintedItems(id,{limit:101,cursor:99});assert.deepEqual(last.map(i=>i.tokenId),[100,101,102,103,104]);
  let rpcCalls=0;const service=new NftService(repo,{}, {getTokenOwner:async()=>{rpcCalls++;throw Error('GET must not reconcile')}},300);
  assert.equal(await service.suggestNextTokenId(id),105);
  const meta=await service.getPublicTokenMetadata(id,999);assert.equal(meta.availability,'unknown');assert.equal(rpcCalls,0);assert.equal(await repo.countMintedItems(id),105);
  const measured=await env.DB.prepare('SELECT data FROM nft_minted WHERE collection_id=? AND token_id>? ORDER BY token_id LIMIT ?').bind(id,99,101).all();assert.ok(measured.meta.rows_read<=6);
 }finally{await repo.deleteCollection(id)}
});
test('bulk import is bounded and atomic; waitlist inserts are idempotent',async()=>{
 const ws=(await call('/api/workspaces','POST',{name:`Bulk ${prefix}`})).body.workspace;
 const result=await call('/api/employees/bulk','POST',{workspaceId:ws.id,csv:'name,salary\n"Last, First",12.5\nSecond,20'});assert.equal(result.status,200);assert.equal(result.body.employees.length,2);assert.equal(result.body.employees[0].name,'Last, First');
 assert.equal((await call('/api/employees/bulk','POST',{workspaceId:ws.id,employees:Array.from({length:26},()=>({name:'reject'}))})).status,400);
 assert.equal((await call('/api/employees/bulk','POST',{workspaceId:ws.id,employees:[{name:'deny'}]},outsider)).status,403);
 const email=`wait_${prefix}@example.test`;assert.equal((await call('/api/waitlist','POST',{email},'fake')).status,201);assert.equal((await call('/api/waitlist','POST',{email},'fake')).status,201);
 assert.equal((await env.DB.prepare('SELECT count(*) AS n FROM waitlist WHERE email=?').bind(email).first()).n,1);await env.DB.prepare('DELETE FROM waitlist WHERE email=?').bind(email).run();
});
test('workspace member role updates persist and cannot transfer ownership; member can leave',async()=>{
 const ws=(await call('/api/workspaces','POST',{name:`Roles ${prefix}`})).body.workspace,store=new Store(env.DB);
 await store.updateWorkspace(ws,{...ws,members:[...ws.members,{id:`outsider-${prefix}`,role:'Developer',status:'active'}]},ws.ownerId);
 assert.equal((await call(`/api/workspaces/${ws.id}/members/${encodeURIComponent(ws.ownerId)}/role`,'POST',{role:'Viewer'})).status,403);
 assert.equal((await call(`/api/workspaces/${ws.id}/members/${encodeURIComponent(`outsider-${prefix}`)}/role`,'POST',{role:'Viewer'})).status,200);
 assert.equal((await call('/api/projects','POST',{workspaceId:ws.id,name:'denied'},outsider)).status,403);
 assert.equal((await call(`/api/workspaces/${ws.id}/leave`,'POST',{},outsider)).status,200);
 assert.equal((await call(`/api/workspaces/${ws.id}`,'GET',undefined,outsider)).status,403);
});
test('platform administration requires an explicit account binding and persists grants/promos',async()=>{
 const accountId=`owner-${prefix}`,code=`ADMIN_${prefix}`.toUpperCase();
 assert.equal((await call('/api/platform/me')).body.platformAdmin,false);
 await env.DB.prepare('INSERT INTO platform_admins(account_id) VALUES(?)').bind(accountId).run();
 try {
  assert.equal((await call('/api/platform/me')).body.platformAdmin,true);
  const ws=(await call('/api/workspaces','POST',{name:`Admin ${prefix}`})).body.workspace;
  const grant=await call('/api/platform/credits/grant','POST',{workspaceId:ws.id,amount:15,ref:'admin-once'});assert.equal(grant.status,200);assert.equal(grant.body.balance.balance,115);
  assert.equal((await call('/api/platform/credits/grant','POST',{workspaceId:ws.id,amount:15,ref:'admin-once'})).body.balance.balance,115);
  assert.equal((await call('/api/platform/promo-codes','POST',{code,creditAmount:25,maxRedemptions:2})).status,200);
  assert.ok((await call('/api/platform/promo-codes')).body.promos.some(p=>p.code===code));
  assert.equal((await call('/api/platform/promo-codes/'+code+'/disable','POST',{})).status,200);
  const workspaces=await call('/api/platform/workspaces');assert.equal(workspaces.status,200);assert.ok(workspaces.body.workspaces.every(w=>Array.isArray(w.roles.finance)));
  const analytics=await call('/api/platform/analytics');assert.equal(analytics.status,200);assert.ok(analytics.body.workspaceCount>0);assert.ok(Number.isFinite(analytics.body.totalZcrInCirculation));
 }finally{await env.DB.prepare('DELETE FROM platform_admins WHERE account_id=?').bind(accountId).run();await env.DB.prepare('DELETE FROM promo_codes WHERE code=?').bind(code).run()}
});

// A browser does not send its bearer token on CORS preflight.
test('console service preflights succeed without authentication or D1 access',async()=>{
 for(const path of ['/gate/v1/admin/sites','/nft/v1/collections','/depin/v1/paid']){
  const response=await worker.fetch(new Request('https://api.test'+path,{method:'OPTIONS',headers:{Origin:'https://console.zexvro.in','Access-Control-Request-Method':'GET','Access-Control-Request-Headers':'authorization'}}),{...env,DB:{prepare(){throw new Error('preflight must not query D1')}}});
  assert.equal(response.status,204);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'),'https://console.zexvro.in');
  assert.match(response.headers.get('Access-Control-Allow-Headers'),/Authorization/i);
  assert.match(response.headers.get('Access-Control-Allow-Headers'),/PAYMENT-SIGNATURE/i);
  assert.match(response.headers.get('Access-Control-Allow-Methods'),/HEAD/);
 }
 const denied=await worker.fetch(new Request('https://api.test/api/workspaces',{method:'OPTIONS',headers:{Origin:'https://untrusted.example'}}),env);
 assert.equal(denied.status,403);
});

test('Zer0 has an authenticated browser-proof fallback without AWS controls or fabricated jobs', async()=>{
 assert.equal((await call('/api/zk-worker/status','GET',undefined,'invalid')).status,401);
 const status=await call('/api/zk-worker/status');assert.equal(status.body.configured,false);assert.equal(status.body.online,false);
 for(const action of ['prove','merkle','settle']){
  const result=await call('/api/zk-worker/'+action,'POST',{input:{secret:'fixture-do-not-return'}});
  assert.equal(result.status,200);assert.equal(result.body.mode,'browser_fallback');assert.ok(!JSON.stringify(result.body).includes('fixture-do-not-return'));
 }
 assert.equal((await call('/api/zk-worker/start','POST',{})).status,503);
 assert.equal((await call('/api/zk-worker/stop','POST',{})).status,503);
 assert.equal((await call('/api/zk-worker/jobs/missing')).status,404);
});
test('DEDSEC D1 replay claims are shared, atomic, indexed and expire without duplicate writes',async()=>{
 const {D1ReplayStore}=await import('../../depin/src/stores.d1.ts');let now=1000;
 const one=new D1ReplayStore(env.DB,()=>now),two=new D1ReplayStore(env.DB,()=>now),key='payment-'+prefix;
 const claims=await Promise.all(Array.from({length:20},(_,i)=>(i%2?one:two).claim(key,60000)));
 assert.equal(claims.filter(Boolean).length,1);now=61001;assert.equal(await two.claim(key,60000),true);assert.equal(await one.claim(key,60000),false);
 const plan=await env.DB.prepare('EXPLAIN QUERY PLAN SELECT key FROM depin_replays WHERE key=?').bind(key).all();assert.match(JSON.stringify(plan.results),/PRIMARY KEY/);
});

test('server enforces Finance, Developer, Admin, Viewer and Agent permissions even with direct requests',async()=>{
 const ws=(await call('/api/workspaces','POST',{name:'RBAC '+prefix})).body.workspace;
 const project=(await call('/api/projects','POST',{workspaceId:ws.id,name:'Permission test'})).body.project;
 const id=`outsider-${prefix}`;
 for(const role of ['Finance','Developer','Admin','Viewer','Agent']){
  await env.DB.prepare('INSERT INTO memberships(identity,workspace_id,role) VALUES(?,?,?) ON CONFLICT(identity,workspace_id) DO UPDATE SET role=excluded.role').bind(id,ws.id,role).run();
  const projectWrite=await call('/api/projects','POST',{workspaceId:ws.id,name:role+' project'},outsider);
  assert.equal(projectWrite.status,['Developer','Admin'].includes(role)?200:403,role+' project.create');
  const employees=await call('/api/employees?workspaceId='+ws.id,'GET',undefined,outsider);
  assert.equal(employees.status,['Finance','Admin','Viewer'].includes(role)?200:403,role+' finance.view');
  const employee=await call('/api/employees','POST',{workspaceId:ws.id,name:'Employee',salary:10},outsider);
  assert.equal(employee.status,['Finance','Admin'].includes(role)?200:403,role+' finance.manage');
  const run=await call('/api/payroll/runs','POST',{workspaceId:ws.id,totalAmount:10},outsider);
  assert.equal(run.status,['Finance','Admin'].includes(role)?200:403,role+' finance.pay');
  assert.equal((await call('/api/projects/'+project.id,'DELETE',undefined,outsider)).status,403,role+' cannot delete the owner project');
 }
});
