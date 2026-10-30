import {test} from 'node:test';
import assert from 'node:assert/strict';
import {onRequest} from '../../functions/api/[[path]].ts';
import {signSession} from './session.ts';
const env={LABS_STATE_BACKEND:'memory',APP_URL:'https://api-fixture.test',LABS_SESSION_SECRET:'test-only-session-secret-at-least-32-chars',LABS_ADMIN_GITHUB_LOGINS:'trusted'};
async function call(path:string,role?:'student'|'admin',body?:unknown,method=body?'POST':'GET'){
 const token=role?signSession({githubId:role,login:role,name:role,email:'',avatarUrl:'',role,iss:'zexvro-labs'},env.LABS_SESSION_SECRET):'';
 const request=new Request(env.APP_URL+'/api'+path,{method,headers:{cookie:token?'zexvro_labs_session='+token:'','content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 return onRequest({request,env,params:{path:path.slice(1).split('/')}} as any);
}
test('Pages API requires authentication and admin authority for privileged operations',async()=>{
 assert.equal((await call('/admin/users')).status,401);
 assert.equal((await call('/admin/users','student')).status,403);
 assert.equal((await call('/admin/users','admin')).status,200);
 assert.equal((await call('/badges','student',{name:'forged'})).status,403);
});
test('student submissions cannot forge reviewer status or another identity',async()=>{
 const res=await call('/submissions','student',{labId:'fixture',userId:'victim',status:'approved',userName:'Admin'});
 assert.equal(res.status,201);const {submission}=await res.json() as any;
 assert.equal(submission.userId,'student');assert.equal(submission.status,'pending');assert.equal(submission.userName,'student');
});
test('student-created labs stay unpublished until admin approval; CRUD is durable within the test store',async()=>{
 const res=await call('/labs','student',{title:'Fixture',tasks:[],pages:[],status:'published',isPublished:true});
 assert.equal(res.status,201);const {lab}=await res.json() as any;
 assert.equal(lab.status,'draft');assert.equal(lab.isPublished,false);
 assert.equal((await call('/labs/'+lab.id)).status,404);
 assert.equal((await call('/labs/'+lab.id,'student',{},'DELETE')).status,403);
 assert.equal((await call('/labs/'+lab.id,'admin',{status:'published',isPublished:true},'PUT')).status,200);
 assert.equal((await call('/labs/'+lab.id)).status,200);
 assert.equal((await call('/labs/'+lab.id,'admin',undefined,'DELETE')).status,200);
 assert.equal((await call('/labs/'+lab.id)).status,404);
});
