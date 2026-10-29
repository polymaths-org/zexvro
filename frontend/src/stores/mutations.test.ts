import {beforeEach,describe,it,expect,vi} from 'vitest';
const api=vi.hoisted(()=>({workspaceApi:{update:vi.fn(),delete:vi.fn(),create:vi.fn(),removeMember:vi.fn(),setMemberRole:vi.fn(),leave:vi.fn()},projectApi:{delete:vi.fn()},inviteApi:{}}));
vi.mock('../api/api',()=>api);
import {useWorkspaceStore} from './workspace';import {useProjectStore} from './project';
const fixture=()=>({id:'ws',name:'Original',ownerId:'owner',slug:'original',plan:'Team',createdAt:1,members:[{id:'member',principalId:'member',name:'Member',email:'m@example.test',role:'Viewer',status:'active',joinedAt:1}],invitations:[]});
beforeEach(()=>{vi.resetAllMocks();useWorkspaceStore.setState({workspaces:[fixture() as any],currentWorkspaceId:'ws',lastError:null});useProjectStore.setState({projects:[{id:'project',workspaceId:'ws',name:'Original'}] as any,currentProjectId:'project',environments:[],serviceInstances:[],deployments:[],lastError:null})});
describe('confirmed mutations',()=>{
 it('does not show workspace settings as saved after a rejected write',async()=>{api.workspaceApi.update.mockRejectedValue(Error('Permission denied'));expect(await useWorkspaceStore.getState().updateWorkspace('ws',{name:'Unsaved'})).toBe(false);expect(useWorkspaceStore.getState().workspaces[0].name).toBe('Original');expect(useWorkspaceStore.getState().lastError).toBe('Permission denied')});
 it('uses canonical returned workspace settings on success',async()=>{api.workspaceApi.update.mockResolvedValue({workspace:{...fixture(),name:'Saved'}});expect(await useWorkspaceStore.getState().updateWorkspace('ws',{name:'Saved'})).toBe(true);expect(useWorkspaceStore.getState().workspaces[0].name).toBe('Saved')});
 it('preserves workspace/member/role when the server rejects those changes',async()=>{
  api.workspaceApi.delete.mockRejectedValue(Error('Denied'));api.workspaceApi.removeMember.mockRejectedValue(Error('Denied'));api.workspaceApi.setMemberRole.mockRejectedValue(Error('Denied'));
  const store=useWorkspaceStore.getState();store.removeMember('ws','member');store.updateMemberRole('ws','member','Admin');store.deleteWorkspace('ws');await vi.waitFor(()=>expect(useWorkspaceStore.getState().lastError).toBe('Denied'));
  const ws=useWorkspaceStore.getState().workspaces[0];expect(ws.members[0].role).toBe('Viewer');expect(ws.members).toHaveLength(1);
 });
 it('does not remove a shared workspace after a failed leave',async()=>{api.workspaceApi.leave.mockRejectedValue(Error('Offline'));await expect(useWorkspaceStore.getState().leaveWorkspace('ws',{username:'member',email:'m@example.test'})).rejects.toThrow('Offline');expect(useWorkspaceStore.getState().workspaces).toHaveLength(1)});
 it('does not delete project state when deletion is denied',async()=>{api.projectApi.delete.mockRejectedValue(Error('Owner required'));useProjectStore.getState().deleteProject('project');await vi.waitFor(()=>expect(useProjectStore.getState().lastError).toBe('Owner required'));expect(useProjectStore.getState().projects).toHaveLength(1)});
 it('removes an optimistic workspace if creation fails',async()=>{api.workspaceApi.create.mockRejectedValue(Error('Offline'));const ws=useWorkspaceStore.getState().createWorkspace('New','owner');await vi.waitFor(()=>expect(useWorkspaceStore.getState().lastError).toBe('Offline'));expect(useWorkspaceStore.getState().workspaces.some(w=>w.id===ws.id)).toBe(false)});
});
