import {beforeEach,describe,expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({workspaceApi:{list:vi.fn(),get:vi.fn()},projectApi:{list:vi.fn()},employeeApi:{list:vi.fn()},payrollApi:{listRuns:vi.fn()},proofApi:{list:vi.fn()}}));
const zero=vi.hoisted(()=>({state:{employees:[],payments:[],proofs:[],settings:{}},setState:vi.fn()}));
vi.mock('../api/api',()=>api);
vi.mock('./zer0',()=>({useZer0Store:{getState:()=>zero.state,setState:zero.setState}}));
import {useWorkspaceStore} from './workspace';
import {useProjectStore} from './project';
import {loadWorkspaceDetail,loadProjectsForWorkspace,pullFromAWS} from './awsSync';
const session=(username='alice')=>localStorage.setItem('zexvro_user_session',JSON.stringify({username,token:'zx_fixture'}));
const ws=(id:string,name='Team')=>({id,name,ownerId:'alice',members:[{id:'alice',name:'Alice',email:'alice@example.test',role:'Owner' as const,status:'active' as const,joinedAt:1}],invitations:[],createdAt:1,slug:'team',plan:'Team'});
beforeEach(()=>{vi.clearAllMocks();session();useWorkspaceStore.setState({workspaces:[],currentWorkspaceId:null,isHydrated:false});useProjectStore.setState({projects:[],environments:[],serviceInstances:[],deployments:[],currentProjectId:null});api.projectApi.list.mockResolvedValue({projects:[]});api.employeeApi.list.mockResolvedValue({employees:[]});api.payrollApi.listRuns.mockResolvedValue({runs:[]});api.proofApi.list.mockResolvedValue({proofs:[]});api.workspaceApi.get.mockResolvedValue({workspace:ws('one')});});
describe('authoritative Cloudflare refresh',()=>{
 it('removes stale members and revoked invites instead of unioning browser state',async()=>{
  useWorkspaceStore.setState({workspaces:[{...ws('one'),members:[{id:'removed',email:'r@example.test',role:'Admin',status:'active'}],invitations:[{id:'revoked',status:'pending'}]} as any]});
  api.workspaceApi.get.mockResolvedValueOnce({workspace:{...ws('one'),members:[]}});
  await loadWorkspaceDetail('one');expect(useWorkspaceStore.getState().workspaces[0].members).toEqual([]);expect(useWorkspaceStore.getState().workspaces[0].invitations).toEqual([]);
 });
 it('retains distinct same-name workspaces, drops revoked access and clears deleted employees',async()=>{
  useWorkspaceStore.setState({workspaces:[ws('revoked')]});zero.state.employees=[{id:'stale'}] as any;
  api.workspaceApi.list.mockResolvedValue({workspaces:[ws('one'),ws('two')]});
  await pullFromAWS();expect(useWorkspaceStore.getState().workspaces.map(w=>w.id)).toEqual(['one','two']);expect(zero.setState).toHaveBeenCalledWith(expect.objectContaining({employees:[]}));
 });
 it('honors an empty successful workspace list instead of preserving removed access',async()=>{
  useWorkspaceStore.setState({workspaces:[ws('revoked')]});api.workspaceApi.list.mockResolvedValue({workspaces:[]});await pullFromAWS();expect(useWorkspaceStore.getState().workspaces).toEqual([]);expect(useWorkspaceStore.getState().isHydrated).toBe(true);
 });
 it('discards a roster response after switching accounts',async()=>{
  let resolve!:Function;api.workspaceApi.get.mockImplementation(()=>new Promise(r=>resolve=r));useWorkspaceStore.setState({workspaces:[ws('one')]});const pending=loadWorkspaceDetail('one');session('bob');resolve({workspace:{...ws('one'),name:'Private Alice data'}});await pending;expect(useWorkspaceStore.getState().workspaces[0].name).toBe('Team');
 });
 it('discards a project response after switching accounts',async()=>{
  let resolve!:Function;api.projectApi.list.mockImplementationOnce(()=>new Promise(r=>resolve=r));const pending=loadProjectsForWorkspace('one');session('bob');resolve({projects:[{id:'private',workspaceId:'one'}]});await pending;expect(useProjectStore.getState().projects).toEqual([]);
 });
});
