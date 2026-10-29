import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
test('scheduled and manual production share the verified promoter and deployment lock',async()=>{
 const prod=await readFile('.github/workflows/production-release.yml','utf8'),dev=await readFile('.github/workflows/dev-release.yml','utf8');
 assert.match(prod,/17 \*\/3 \* \* \*/);assert.match(prod,/workflow_dispatch:/);assert.match(prod,/REQUESTED_SHA: \$\{\{ inputs.commit_sha \}\}/);assert.match(prod,/node scripts\/cicd\/promote.mjs/);
 for(const text of [prod,dev]){assert.match(text,/group: zexvro-deployment-lane/);assert.match(text,/cancel-in-progress: false/);assert.match(text,/queue: max/);assert.doesNotMatch(text,/skip.checks|force.deploy|continue-on-error:\s*true/i)}
 assert.match(dev,/needs: verify/);assert.match(dev,/github.event_name == 'push'/);assert.match(dev,/scripts\/cicd\/finalize.mjs/);
});
test('legacy manual script dispatches the verified workflow and contains no direct mutation path',async()=>{
 const script=await readFile('scripts/deploy-production.sh','utf8');assert.match(script,/workflow run production-release.yml/);assert.doesNotMatch(script,/wrangler|migrations apply|npm .*build/);
 const old=await readFile('.github/workflows/e2e-testnet.yml','utf8');assert.doesNotMatch(old,/COGNITO|BUYER_SECRET|SPONSOR_SECRET|chain_smoke|paid_depin/);
});
test('legacy Worker deployment alias cannot bypass production gates',async()=>{
 const script=await readFile('services/platform-api/scripts/deploy.mjs','utf8');assert.match(script,/scripts\/deploy-production.sh/);assert.doesNotMatch(script,/wrangler|d1.*migrations|npm.*build/);
});
