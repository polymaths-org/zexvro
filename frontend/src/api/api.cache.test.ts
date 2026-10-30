import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {api} from './api';
function session(token:string){localStorage.setItem('zexvro_user_session',JSON.stringify({username:token,email:'test@example.test',token:`zx_${token}`,expiresAt:Date.now()+3600000}));}
beforeEach(()=>{localStorage.clear();session('cache-test');});
afterEach(()=>{vi.unstubAllGlobals();localStorage.clear();});
describe('platform request usage controls',()=>{
 it('coalesces concurrent reads and returns independent response objects',async()=>{
  const fetch=vi.fn().mockImplementation(async()=>Response.json({items:[{name:'original'}]}));vi.stubGlobal('fetch',fetch);
  const [first,second]=await Promise.all([api.get<{items:{name:string}[]}>('/coalesce'),api.get<{items:{name:string}[]}>('/coalesce')]);
  expect(fetch).toHaveBeenCalledTimes(1);first.items[0].name='changed';expect(second.items[0].name).toBe('original');
 });
 it('invalidates after mutations and isolates cached responses by session',async()=>{
  const fetch=vi.fn().mockImplementation(async()=>Response.json({ok:true}));vi.stubGlobal('fetch',fetch);
  await api.get('/invalidate');await api.put('/change',{});await api.get('/invalidate');expect(fetch).toHaveBeenCalledTimes(3);
  session('another-user');await api.get('/invalidate');expect(fetch).toHaveBeenCalledTimes(4);
 });
 it('does not cache failures',async()=>{
  const fetch=vi.fn().mockImplementation(async()=>Response.json({error:'temporary'},{status:503}));vi.stubGlobal('fetch',fetch);
  await expect(api.get('/retry-failed-read')).rejects.toThrow('temporary');await expect(api.get('/retry-failed-read')).rejects.toThrow('temporary');expect(fetch).toHaveBeenCalledTimes(2);
 });
 it('rejects delayed responses after the account changes',async()=>{
  let resolve!:Function;vi.stubGlobal('fetch',vi.fn().mockImplementation(()=>new Promise(r=>resolve=r)));
  const pending=api.get('/account-switch');await vi.waitFor(()=>expect(resolve).toBeTypeOf('function'));session('other-account');resolve(Response.json({private:'previous-user'}));await expect(pending).rejects.toThrow('Account changed');
 });
 it('keeps explicit limit/cursor calls paginated for audit and ledger screens',async()=>{
  const fetch=vi.fn().mockResolvedValue(Response.json({events:[{id:'one'}],nextCursor:'two'}));vi.stubGlobal('fetch',fetch);
  const data=await api.get<any>('/api/audit?limit=20');expect(fetch).toHaveBeenCalledTimes(1);expect(data.nextCursor).toBe('two');
 });
 it('consumes all bounded pages for legacy list callers without changing identity',async()=>{
  const fetch=vi.fn().mockResolvedValueOnce(Response.json({items:[1],nextCursor:'two'})).mockResolvedValueOnce(Response.json({items:[2],nextCursor:null}));vi.stubGlobal('fetch',fetch);
  const data=await api.get<any>('/page-list');expect(data.items).toEqual([1,2]);expect(fetch).toHaveBeenCalledTimes(2);expect(fetch.mock.calls[0][1].headers.Authorization).toBe(fetch.mock.calls[1][1].headers.Authorization);
 });
 it('rejects repeated cursors instead of reading an entire loop',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockImplementation(()=>Promise.resolve(Response.json({items:[1],nextCursor:'same'}))));await expect(api.get('/page-loop')).rejects.toThrow('Invalid pagination');
 });

});
