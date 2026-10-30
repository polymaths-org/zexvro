import {describe,it,expect,vi,beforeEach} from 'vitest';
import {accountStorage,accountStorageKey,withoutAccountStorageWrites} from './accountStorage';
import {persistSession,clearStoredSession} from '../auth/cognito';
import {Buffer as NodeBuffer} from 'node:buffer';
import {Keypair} from '@stellar/stellar-sdk';
import {writeUserTreasury,readUserTreasury} from './userTreasury';
const login=(username:string)=>persistSession({username,email:username+'@example.test',token:'zx_'+username,expiresAt:Date.now()+3600000});
beforeEach(()=>localStorage.clear());
describe('private browser storage',()=>{
 it('isolates accounts and preserves their own state across switching',()=>{login('alice');accountStorage.setItem('notes','private-a');login('bob');expect(accountStorage.getItem('notes')).toBeNull();accountStorage.setItem('notes','private-b');login('alice');expect(accountStorage.getItem('notes')).toBe('private-a');clearStoredSession();expect(accountStorage.getItem('notes')).toBeNull()});
 it('preserves legacy unscoped state without attaching it to another user',()=>{localStorage.setItem('notes','legacy-private');login('bob');expect(accountStorage.getItem('notes')).toBeNull();expect(localStorage.getItem('notes')).toBe('legacy-private')});
 it('does not overwrite saved account data while resetting live stores',()=>{login('alice');accountStorage.setItem('settings','saved');withoutAccountStorageWrites(()=>accountStorage.setItem('settings','default'));expect(accountStorage.getItem('settings')).toBe('saved')});
 it('notifies only when the account changes, not when refreshing tokens',()=>{const callback=vi.fn();window.addEventListener('zexvro:account-changed',callback);try{login('alice');login('alice');login('bob');clearStoredSession();expect(callback).toHaveBeenCalledTimes(3)}finally{window.removeEventListener('zexvro:account-changed',callback)}});
 it('keeps local treasury keys isolated and validates keypair consistency',()=>{login('alice');
  // SDK Buffer values originate in Node's realm; align jsdom's instanceof check.
  const original=globalThis.Uint8Array;globalThis.Uint8Array=Object.getPrototypeOf(NodeBuffer.prototype).constructor;
  const kp=Keypair.random();writeUserTreasury({publicKey:kp.publicKey(),secret:kp.secret(),createdAt:1});expect(readUserTreasury()?.publicKey).toBe(kp.publicKey());login('bob');expect(readUserTreasury()).toBeNull();login('alice');expect(readUserTreasury()?.publicKey).toBe(kp.publicKey());expect(localStorage.getItem(accountStorageKey('zexvro_user_treasury_v1'))).toBeTruthy();globalThis.Uint8Array=original});
});
