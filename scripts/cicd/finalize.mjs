import {readFile,writeFile} from 'node:fs/promises';
import {inventory,verify} from './policy.mjs';
const root='release',m=JSON.parse(await readFile(root+'/manifest.json')),s=JSON.parse(await readFile(root+'/staging.json'));
if(m.sha!==s.sha||!s.deployments?.worker||!s.verifiedAt)throw Error('Incomplete staging evidence');
const actual=await inventory(root);delete actual['staging.json'];
if(JSON.stringify(actual)!==JSON.stringify(m.files))throw Error('Payload changed after verification');
m.readyAt=s.verifiedAt;m.files=await inventory(root);await writeFile(root+'/manifest.json',JSON.stringify(m,null,2)+'\n');
await verify(root,{sha:m.sha,repository:m.repository});
