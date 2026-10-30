import {readFile,writeFile,cp,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {run} from './process.mjs';
const root=resolve('release'),original=await readFile(resolve(root,'console/runtime-config.js'));
try{
 for(const target of ['dev','production']){
  // Test exactly the packaged JS/CSS with each packaged public configuration.
  await cp(resolve(root,'config',target,'runtime-config.js'),resolve(root,'console/runtime-config.js'));
  const config=JSON.parse(await readFile('scripts/cicd/environments.json'))[target];
  run('npx',['playwright','test','--config','playwright.release.config.ts'],{cwd:resolve('frontend'),env:{...process.env,PLAYWRIGHT_BASE_URL:'',RELEASE_SURFACE:'console',RELEASE_SITE:resolve(root,'console'),E2E_API_BASE:config.api}});
 }
}finally{await writeFile(resolve(root,'console/runtime-config.js'),original)}

const landingOriginal=await readFile(resolve(root,'landing/runtime-config.js'));
try{
 for(const target of ['dev','production']){
  await cp(resolve(root,'config',target,'runtime-config.js'),resolve(root,'landing/runtime-config.js'));
  const config=JSON.parse(await readFile('scripts/cicd/environments.json'))[target];
  run('npx',['playwright','test','--config','playwright.release.config.ts'],{cwd:resolve('frontend'),env:{...process.env,PLAYWRIGHT_BASE_URL:'',RELEASE_SITE:resolve(root,'landing'),RELEASE_SURFACE:'landing',E2E_API_BASE:config.api}});
 }
}finally{await writeFile(resolve(root,'landing/runtime-config.js'),landingOriginal)}
