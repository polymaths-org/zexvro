import {test} from 'node:test';
import assert from 'node:assert/strict';
import {signSession,verifySession} from './session.ts';
import {isAdmin,validOAuthState,verifyFirebaseToken} from '../../functions/_shared.ts';
import {isTrustedGateway} from '../../spacetimedb/src/authorization.ts';
const secret='test-only-session-key-with-at-least-32-bytes';
const user={githubId:'fixture',login:'student',name:'Fixture',email:'',avatarUrl:'',iss:'zexvro-labs'};
test('sessions reject tampering, weak keys, extra segments and expired cookies',()=>{
 const token=signSession(user,secret);assert.ok(verifySession(token,secret));
 assert.equal(verifySession(token+'x',secret),null);assert.equal(verifySession(token+'.extra',secret),null);
 assert.equal(verifySession(token,'dev-only-change-me'),null);
 const now=Date.now;Date.now=()=>now()+8*86400000;try{assert.equal(verifySession(token,secret),null)}finally{Date.now=now}
});
test('admin allowlists require verified GitHub identity, not email prefixes',()=>{
 const env={LABS_ADMIN_GITHUB_LOGINS:'zexvro'} as any;
 assert.equal(isAdmin({role:'student',username:'zexvro',email:'zexvro@example.test'} as any,env),false);
 assert.equal(isAdmin({role:'student',verifiedGithubLogin:'zexvro'} as any,env),true);
 assert.equal(isAdmin({role:'student',verifiedGithubLogin:'zexvro'} as any,{LABS_ADMIN_GITHUB_LOGINS:'other'} as any),false);
});
test('OAuth state must match the browser cookie',()=>{
 const state='00000000-0000-4000-8000-000000000001';
 assert.equal(validOAuthState(new Request(`https://labs.test/auth/callback?state=${state}`)),false);
 assert.equal(validOAuthState(new Request(`https://labs.test/auth/callback?state=${state}`,{headers:{cookie:`zexvro_labs_oauth_state=${state}`}})),true);
});
test('module writes allow only the dedicated gateway or database owner',()=>{
 assert.equal(isTrustedGateway({toHexString:()=> 'random'} as any),false);
 assert.equal(isTrustedGateway({toHexString:()=> 'c20034125f35d02691bc817065a26ba7f4923a9012da8f490835d06e4de4dfd4'} as any),true);
});
