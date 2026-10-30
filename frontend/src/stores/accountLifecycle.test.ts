import {describe,it,expect,vi} from 'vitest';
vi.mock('../api/privacyPool',()=>({configurePrivacyPoolNetwork:vi.fn(),setForceFreighterSigning:vi.fn(),getNotes:()=>[],shieldPayAmount:vi.fn(),planShieldPay:vi.fn()}));
import {resetAccountStores} from './accountLifecycle';import {useZer0Store} from './zer0';import {useStealthClaimsStore} from './stealthClaims';import {useWorkspaceStore} from './workspace';import {persistSession,clearStoredSession} from '../auth/cognito';
const login=(username:string)=>persistSession({username,email:username+'@example.test',token:'zx_fixture',expiresAt:Date.now()+3600000});
describe('account lifecycle',()=>{
 it('clears live private state on account change, restores the correct scoped state on return, and preserves legacy data',async()=>{
  localStorage.clear();localStorage.setItem('zexvro_zk_notes','legacy-fixture');login('alice');resetAccountStores();useZer0Store.setState({employees:[{id:'alice-private'}] as any});useStealthClaimsStore.setState({issued:[{id:'alice-claim'}] as any});
  login('bob');resetAccountStores();expect(useZer0Store.getState().employees).toEqual([]);expect(useStealthClaimsStore.getState().issued).toEqual([]);expect(useWorkspaceStore.getState().workspaces).toEqual([]);
  useZer0Store.setState({employees:[{id:'bob-private'}] as any});login('alice');resetAccountStores();expect(useZer0Store.getState().employees.map(e=>e.id)).toEqual(['alice-private']);expect(useStealthClaimsStore.getState().issued.map(c=>c.id)).toEqual(['alice-claim']);expect(localStorage.getItem('zexvro_zk_notes')).toBe('legacy-fixture');
  clearStoredSession();resetAccountStores();expect(useZer0Store.getState().employees).toEqual([]);
 });
});
