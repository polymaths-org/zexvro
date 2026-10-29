import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import {createServer as createViteServer} from 'vite';
import {onRequest} from './functions/api/[[path]].js';
import {onRequestGet} from './functions/auth/callback.js';
import type {Env} from './functions/_shared.js';

// Local and production Node hosting use the same authorization/routes as Pages.
const app=express();
app.use(['/api','/auth/callback'],express.raw({type:()=>true,limit:'64kb'}));
app.use(async(req,res,next)=>{
 if(!req.path.startsWith('/api/') && req.path!=='/auth/callback')return next();
 try {
  const origin=process.env.APP_URL || 'http://localhost:3000';
  const headers=new Headers();
  for(const [key,value] of Object.entries(req.headers))if(value)headers.set(key,Array.isArray(value)?value.join(','):value);
  const request=new Request(new URL(req.originalUrl,origin),{method:req.method,headers,...(['GET','HEAD'].includes(req.method)?{}:{body:req.body?.length?req.body:undefined})});
  const ctx={request,env:{...process.env,APP_URL:origin} as unknown as Env,params:{path:req.path.replace(/^\/api\//,'').split('/')}};
  const response=await (req.path==='/auth/callback'?onRequestGet(ctx as any):onRequest(ctx as any));
  res.status(response.status);
  response.headers.forEach((value,key)=>{if(key!=='set-cookie')res.setHeader(key,value)});
  const cookies=response.headers.getSetCookie();if(cookies.length)res.setHeader('Set-Cookie',cookies);
  res.send(Buffer.from(await response.arrayBuffer()));
 }catch {res.status(500).json({error:'Labs request failed'});}
});
if(process.env.NODE_ENV!=='production'){
 const vite=await createViteServer({server:{middlewareMode:true},appType:'spa'});app.use(vite.middlewares);
}else{
 const dist=path.resolve('dist');app.use(express.static(dist));app.get('*',(_req,res)=>res.sendFile(path.join(dist,'index.html')));
}
const port=Number(process.env.PORT||3000);
app.listen(port,process.env.HOST||'127.0.0.1',()=>console.log(`Labs listening on port ${port}`));
