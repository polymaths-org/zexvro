import {expect,type Page} from '@playwright/test';
export const owner='qa-owner';
export const wallet='GCD4SBBOLPUM7UYWLPRKOP6IYKOZ6FX5YQOJHVVE7RKC2QGZYNUHKRCZ';
export const apiBase=process.env.E2E_API_BASE||'https://zexvro-platform-api.zexvro.workers.dev';
export async function installConsoleMock(page:Page,options:{role?:string;admin?:boolean}={}) {
 const now=Date.now(),role=options.role||'Owner';
 const workspace:any={id:'ws-test',workspaceId:'ws-test',name:'QA Workspace',slug:'qa',plan:'Team workspace',ownerId:role==='Owner'?owner:'another-owner',createdAt:now,environment:'testnet',settings:{environment:'testnet'},members:[{id:owner,principalId:owner,name:'QA Owner',email:'qa@example.test',role,status:'active',joinedAt:now}],invitations:[]};
 const project:any={id:'project-test',projectId:'project-test',workspaceId:'ws-test',name:'QA Project',slug:'qa-project',description:'Migration verification',purpose:'Test platform',owner,createdAt:now,updatedAt:now,lifecycle:'active',health:'healthy',network:'testnet',enabledServices:['zer0','nft','depin','agent-auth'],environments:[],serviceInstances:[]};
 const state={workspaces:[workspace],projects:[project],employees:[] as any[],runs:[] as any[],items:[] as any[],proofs:[] as any[],notes:[] as any[],promos:[] as any[],collections:[] as any[],sites:[] as any[],events:[] as any[],balance:100,requests:[] as {path:string,method:string,body:any}[],unknown:[] as string[],pageErrors:[] as string[]};
 page.on('pageerror',error=>state.pageErrors.push(error.message));
 await page.addInitScript(({now,owner})=>{
  localStorage.setItem('zexvro_user_session',JSON.stringify({username:owner,email:'qa@example.test',token:'zx_'+ 'a'.repeat(43),refreshToken:'zr_'+'b'.repeat(43),expiresAt:now+3600000}));
  localStorage.setItem('zexvro.platform.bootup.seen','1');
  sessionStorage.setItem('zexvro_boot_seen','1');
 },{now,owner});
 const json=(data:unknown)=>({status:200,contentType:'application/json',body:JSON.stringify(data)});
 await page.route(`${apiBase}/**`,async route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname,method=req.method();let body:any={};
  try{body=req.postDataJSON()||{}}catch{}
  state.requests.push({path,method,body});
  const ok=(value:unknown)=>route.fulfill(json(value));
  if(method==='OPTIONS')return route.fulfill({status:204});
  if(path==='/api/memory')return ok({username:owner,memory:{cli_connected:false}});
  if(path==='/auth/signout')return ok({status:'success'});
  if(path==='/api/zk-worker/status')return ok({configured:false,online:false,provider:'browser',state:'unconfigured',message:'Proofs run locally in your browser.'});
  if(path.startsWith('/api/zk-worker/'))return ok({mode:'browser_fallback',reason:'worker_unconfigured'});
  if(path==='/api/platform/me')return ok({username:owner,email:'qa@example.test',platformAdmin:options.admin??false});
  if(path==='/api/platform/analytics')return ok({workspaceCount:state.workspaces.length,ownerCount:1,totalZcrInCirculation:state.balance,environmentCounts:{testnet:1,mainnet:0},creditAccountCount:1,promoCount:state.promos.length,activePromoCount:state.promos.length});
  if(path==='/api/platform/workspaces')return ok({workspaces:state.workspaces.map(w=>({...w,workspaceId:w.id,roles:{owners:w.members,admins:[],developers:[],finance:[],viewers:[],agents:[]},members:w.members,memberCount:1,projectCount:1,services:project.enabledServices,zcrBalance:state.balance})),nextCursor:null});
  if(path==='/api/platform/promo-codes') {if(method==='POST'){const code=body.code||'QA-PROMO';state.promos.push({...body,code,status:'active'});return ok({promo:state.promos.at(-1),code})}return ok({promos:state.promos,nextCursor:null})}
  if(path.startsWith('/api/platform/promo-codes/')){state.promos.forEach(p=>p.status='disabled');return ok({status:'success'})}
  if(path==='/api/platform/credits/grant'){state.balance+=Number(body.amount);return ok({status:'success',balance:{balance:state.balance}})}
  if(path==='/api/platform/waitlist')return ok({entries:[],nextCursor:null});
  if(path==='/api/credits/packs')return ok({packs:[],purchaseMode:'unconfigured',currency:'ZCR',paymentAsset:'XLM',custom:{enabled:false,min:1,max:1000000,unitPriceUsdc:.01}});
  if(path.endsWith('/credits/validate-promo'))return ok({valid:true,status:'active',message:'Ready to redeem',promo:{code:body.code,creditAmount:25}});
  if(path.endsWith('/credits/redeem')){state.balance+=25;state.events.push({id:'promo-grant',type:'promo',delta:25,amount:25,balanceAfter:state.balance,createdAt:now});return ok({status:'success',balance:{balance:state.balance},tx:state.events.at(-1)})}
  if(path.endsWith('/credits/consume'))return ok({status:'success',charged:false,cost:0,balance:{balance:state.balance}});
  if(path.endsWith('/credits/ledger'))return ok({events:state.events,nextCursor:null});
  if(path.endsWith('/credits'))return ok({credits:{workspaceId:'ws-test',balance:state.balance,currency:'ZCR'},environment:workspace.environment,burnsOnUse:workspace.environment==='mainnet',recent:state.events});
  if(path.endsWith('/audit'))return ok({events:state.events,nextCursor:null,workspaceId:'ws-test'});
  if(path==='/api/invite/send'){const invite={...body,id:body.inviteId,status:'pending',provider:'link',acceptUrl:'https://console.zexvro.in/invite/accept?token='+body.token};workspace.invitations.push(invite);return ok(invite)}
  if(path==='/api/invite/revoke'){workspace.invitations=[];return ok({status:'success'})}
  if(path.endsWith('/members'))return ok({members:workspace.members});
  if(path==='/api/me/workspaces'||path==='/api/workspaces/shared')return ok({workspaces:state.workspaces});
  if(path.endsWith('/environment')){workspace.environment=body.environment;workspace.settings.environment=body.environment;return ok({workspace,environment:body.environment,status:'success'})}
  for(const [base,rows,key,singular] of [['/api/workspaces',state.workspaces,'workspaces','workspace'],['/api/projects',state.projects,'projects','project'],['/api/employees',state.employees,'employees','employee'],['/api/payroll/runs',state.runs,'runs','run'],['/api/payroll/taxonomy',state.items,'items','item'],['/api/proofs',state.proofs,'proofs','proof'],['/api/zk-notes',state.notes,'notes','note']] as const){
   if(path!==base&&!path.startsWith(base+'/'))continue;
   const id=path.slice(base.length+1);
   if(id==='bulk'){for(const item of body.employees||[])rows.push({...item,id:'employee-'+rows.length});return ok({employees:rows,count:rows.length})}
   if(method==='GET'){if(id)return ok({[singular]:rows.find(r=>r.id===id)});return ok({[key]:rows,nextCursor:null,roles:[],departments:[]})}
   if(role==='Viewer')return route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({error:'Workspace access denied'})});
   if(method==='DELETE'){const idx=rows.findIndex(r=>r.id===id);if(idx>=0)rows.splice(idx,1);return ok({status:'success'})}
   if(id){const row=rows.find(r=>r.id===id);Object.assign(row||{},body);return ok({[singular]:row,status:'success'})}
   const row={...body,id:body.id||body.projectId||body.employeeId||'row-'+rows.length,workspaceId:body.workspaceId||'ws-test'};rows.push(row);return ok({[singular]:row,status:'success'});
  }
  if(path==='/nft/health')return ok({status:'ok',service:'nft-service',capabilities:{network:'stellar:testnet',networkPassphrase:'Test SDF Network ; September 2015',pinningConfigured:true,stellarConfigured:true,storageMode:'r2'}});
  if(path==='/nft/v1/collections')return ok({collections:state.collections,nextCursor:null});
  if(path.endsWith('/sale-config/intent'))return ok({intent:{serializedTransaction:'prepared-sale',requiredSigners:[wallet]}});
  if(path.endsWith('/items'))return ok({items:[],mintedCount:0,nextCursor:null});
  if(path.startsWith('/nft/v1/collections/'))return ok({collection:state.collections.find(c=>c.id===path.split('/')[4])});
  if(path==='/gate/health')return ok({status:'ok',service:'agent-auth'});
  if(path==='/gate/status')return ok({status:'ok',service:'agent-auth',product:'zexvro-gate',issuer:apiBase+'/gate',header:'X-Zexvro-Capability',stateBackend:'d1',capabilities:{channels:['human','agent'],policyModes:['human_only','agent_only','either','dual_path'],proofTypes:['captcha_pass','nonce_sign'],stellar:{},depinBindingClaims:[]},securityProfile:{isProd:true,allowDevHuman:false,allowDevHmac:false,popEnforcedOnVerify:true}});
  if(path==='/gate/v1/admin/sites')return ok({sites:state.sites,nextCursor:null});
  if(path==='/depin/health')return ok({status:'ok',service:'depin'});
  if(path==='/depin/status')return ok({status:'ok',service:'depin',stateBackend:'d1',multiInstanceSafe:true,capabilities:{scheme:'exact',network:'stellar:testnet',facilitatorUrl:'https://x402.org/facilitator',settlement:'after_upstream_success',fees:'sponsored',replayTtlMs:600000,unpaidRateLimit:{maxRequests:30,windowMs:60000}},providers:[{route:'/v1/nft-health',method:'GET',description:'NFT health',price:'$0.001',recipient:wallet,network:'stellar:testnet',timeoutMs:5000,upstreamOrigin:apiBase,upstreamSecretRequired:false}]});
  if(path==='/depin/v1/nft-health')return route.fulfill({status:402,contentType:'application/json',headers:{'Access-Control-Expose-Headers':'PAYMENT-REQUIRED,PAYMENT-RESPONSE','PAYMENT-REQUIRED':Buffer.from(JSON.stringify({x402Version:2,accepts:[{scheme:'exact',network:'stellar:testnet',amount:'10000',payTo:wallet}]})).toString('base64')},body:'{}'});
  state.unknown.push(method+' '+path);return route.fulfill({status:501,contentType:'application/json',body:JSON.stringify({error:'Unmocked endpoint '+path})});
 });
 return state;
}
export async function assertConsoleClean(state:Awaited<ReturnType<typeof installConsoleMock>>){expect(state.pageErrors).toEqual([]);expect(state.unknown).toEqual([])}
