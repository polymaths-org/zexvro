import {test} from 'node:test';import assert from 'node:assert/strict';
import {createNftCheckoutClient,openCheckout} from '../src/index.js';
const client=createNftCheckoutClient({apiBase:'https://api.example/nft/'});
test('headless checkout uses public routes, preserves idempotency and submits only the signature',async t=>{
 const calls=[];t.mock.method(globalThis,'fetch',async(url,init)=>{calls.push({url,init});return Response.json({intent:{id:'checkout',status:'pending_signature'}})});
 await client.getCollection('a/b');assert.equal(calls[0].url,'https://api.example/nft/v1/public/collections/a%2Fb');
 const intent=await client.createCheckoutIntent({collectionId:'a',buyerAddress:'public-buyer',idempotencyKey:'same-purchase'});assert.equal(intent.id,'checkout');assert.equal(calls[1].init.headers['Idempotency-Key'],'same-purchase');assert.equal(calls[1].init.headers.Authorization,undefined);
 assert.deepEqual(JSON.parse(calls[1].init.body),{collectionId:'a',buyerAddress:'public-buyer'});
 await client.submitCheckoutIntent({intentId:'checkout',signedTransaction:'signed-fixture'});assert.deepEqual(JSON.parse(calls[2].init.body),{signedTransaction:'signed-fixture'});
});
test('headless clients reject SPA HTML and propagate structured API errors',async t=>{
 const fetch=t.mock.method(globalThis,'fetch',async()=>new Response('<html>SPA</html>',{headers:{'content-type':'text/html'}}));await assert.rejects(()=>client.getCollection('id'),/invalid JSON/);
 fetch.mock.mockImplementation(async()=>Response.json({error:{code:'sale_unavailable',message:'Sale is not active'}},{status:409}));await assert.rejects(()=>client.createCheckoutIntent({collectionId:'id',buyerAddress:'buyer'}),e=>e.code==='sale_unavailable'&&e.status===409);
});
test('popup callbacks require both the expected origin and the exact opened window',()=>{
 const previous=globalThis.window;let listener,success=0,closed=0;const popup={closed:false,close(){closed++}};
 globalThis.window={location:{origin:'https://game.example'},screenX:0,screenY:0,outerWidth:1280,outerHeight:900,open:()=>popup,addEventListener:(_,cb)=>listener=cb,removeEventListener(){},setInterval:()=>1,clearInterval(){}};
 try{const handle=openCheckout({collectionId:'c',checkoutOrigin:'https://console.example/',onSuccess:()=>success++});const data={source:'zexvro-nft-checkout',type:'success',payload:{tokenId:1,transactionHash:'fixture'}};
 listener({origin:'https://attacker.example',source:popup,data});listener({origin:'https://console.example',source:{},data});assert.equal(success,0);listener({origin:'https://console.example',source:popup,data});assert.equal(success,1);assert.equal(closed,1);handle.close();
 }finally{globalThis.window=previous}
});
