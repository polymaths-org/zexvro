import {readdir,lstat,unlink} from 'node:fs/promises';import {join} from 'node:path';
const root='frontend/test-results',files=[];
async function walk(dir){let names;try{names=await readdir(dir)}catch{return}for(const name of names){const path=join(dir,name),s=await lstat(path);if(s.isDirectory())await walk(path);else if(s.isFile())files.push({path,size:s.size,time:s.mtimeMs})}}
await walk(root);let used=0,removed=0;
for(const f of files.sort((a,b)=>b.time-a.time)){if(used+f.size<=25*1024*1024)used+=f.size;else{await unlink(f.path);removed++}}
console.log(`Failure evidence retained: ${used} bytes; ${removed} older/oversized files omitted to enforce 25 MiB budget`);
