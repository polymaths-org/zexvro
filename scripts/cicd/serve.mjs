import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=resolve(process.env.RELEASE_SITE||'../release/console');
const mime={'.js':'application/javascript','.html':'text/html','.json':'application/json','.css':'text/css','.wasm':'application/wasm','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
createServer(async(req,res)=>{try{
 const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!path.startsWith(root+sep)&&path!==root){res.writeHead(403).end();return}
 let file=path;try{if(!(await stat(file)).isFile())file=resolve(root,'index.html')}catch{file=resolve(root,'index.html')}
 res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.end(await readFile(file));
}catch{res.writeHead(500).end()}}).listen(4173,'127.0.0.1');
