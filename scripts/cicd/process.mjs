import {spawnSync} from 'node:child_process';
export function run(cmd,args,options={}){
 const r=spawnSync(cmd,args,{stdio:'inherit',...options});
 if(r.error)throw r.error;if(r.status!==0)throw Error(cmd+' failed: '+(r.signal||r.status));return r;
}
export function capture(cmd,args,options={}){return run(cmd,args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],...options}).stdout.trim()}
