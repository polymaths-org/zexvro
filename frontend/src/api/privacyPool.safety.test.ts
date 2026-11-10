import {beforeEach,describe,it,expect,vi} from 'vitest';
const notes=vi.hoisted(()=>({list:vi.fn(),save:vi.fn().mockResolvedValue({})}));
vi.mock('./api',()=>({zkNotesApi:notes,zkWorkerApi:{}}));
vi.mock('./stellarWalletsKit',()=>({getStellarWalletsKit:vi.fn(),connectWithWalletsKit:vi.fn()}));
import {planShieldPay,estimateFreighterPromptsForAmount,getNotes,saveNote,syncNotesFromAws,fundPool,deposit,shieldPayAmount,getPreferRemoteProver} from './privacyPool';
import {PRIVATE_POOL_SAFETY_MESSAGE,PRIVATE_POOL_DEMO_UNLOCK_KEY,isPrivatePoolFundingPaused,assertPrivatePoolFundingAllowed} from '../lib/poolSafety';
const login=(username:string)=>localStorage.setItem('zexvro_user_session',JSON.stringify({username,token:'zx_fixture'}));
beforeEach(()=>{localStorage.clear();vi.clearAllMocks();login('alice')});
describe('Zer0 accounting and funding safety',()=>{
 it.each([0,-1,NaN,Infinity])('does not construct notes for invalid amount %s',amount=>{expect(planShieldPay(amount).totalNotes).toBe(0)});
 it('uses bounded denominations and explicitly reports rounding',()=>{const p=planShieldPay(1111);expect(p.totalNotes).toBe(4);expect(p.settledXlm).toBe(1111);expect(planShieldPay(1.5).settledXlm).toBe(2);expect(estimateFreighterPromptsForAmount(1111)).toBeGreaterThanOrEqual(4)});
 it('defaults to local proving after the AWS reset',()=>expect(getPreferRemoteProver()).toBe(false));
 it('isolates note storage between accounts',()=>{saveNote({commitment:'test-c',secret:'test-s',nullifier:'test-n',nullifierHash:'test-h',index:0,timestamp:1} as any);expect(getNotes()).toHaveLength(1);login('bob');expect(getNotes()).toEqual([]);login('alice');expect(getNotes()).toHaveLength(1)});
 it('discards delayed note sync after an account switch',async()=>{let resolve!:Function;notes.list.mockReturnValueOnce(new Promise(r=>resolve=r));const pending=syncNotesFromAws();login('bob');resolve({notes:[{commitment:'alice-private'}]});await pending;expect(getNotes()).toEqual([])});
 it('rejects new funding before wallet/RPC activity, including skipFund deposits',async()=>{const fetchSpy=vi.spyOn(globalThis,'fetch');await expect(fundPool('fixture',10n)).rejects.toThrow(PRIVATE_POOL_SAFETY_MESSAGE);await expect(deposit('fixture',10n,{skipFund:true})).rejects.toThrow(PRIVATE_POOL_SAFETY_MESSAGE);await expect(shieldPayAmount({fromAddress:'fixture',toAddress:'fixture',amountXlm:1})).rejects.toThrow(PRIVATE_POOL_SAFETY_MESSAGE);expect(fetchSpy).not.toHaveBeenCalled();fetchSpy.mockRestore()});
 it('unlocks funding only with the explicit demo key',()=>{expect(isPrivatePoolFundingPaused()).toBe(true);expect(()=>assertPrivatePoolFundingAllowed()).toThrow(PRIVATE_POOL_SAFETY_MESSAGE);localStorage.setItem(PRIVATE_POOL_DEMO_UNLOCK_KEY,'true');expect(isPrivatePoolFundingPaused()).toBe(false);expect(()=>assertPrivatePoolFundingAllowed()).not.toThrow()});
});
