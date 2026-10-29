// Reproducible acceptance entry point. Uses disposable local DBs/mocked chains.
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const cwd=fileURLToPath(new URL('..',import.meta.url));
const commands=[
 ['npm',['--prefix','frontend','test']],
 ['npm',['--prefix','frontend','run','test:crypto']],
 ['npm',['--prefix','services/platform-api','test']],
 ['npm',['--prefix','services/nft-service/api','test']],
 ['npm',['--prefix','services/agent-auth','test']],
 ['npm',['--prefix','services/depin','test']],
 ['npm',['--prefix','labs','test']],
 ['node',['--test','services/zk-prover/server.test.mjs']],
 ['node',['--import','./services/agent-auth/node_modules/tsx/dist/loader.mjs','--test','packages/agent-auth-sdk/test/client.test.mjs','packages/nft-checkout-sdk/test/client.test.mjs']],
];
for(const [cmd,args] of commands){
 const result=spawnSync(cmd,args,{cwd,stdio:'inherit',env:process.env});
 if(result.error)throw result.error;if(result.status!==0)process.exit(result.status||1);
}
if(process.argv.includes('--browser')){
 const result=spawnSync('npm',['run','test:e2e'],{cwd:cwd+'/frontend',stdio:'inherit'});if(result.error)throw result.error;process.exit(result.status===0?0:1);
}
