import {expect,test} from '@playwright/test';
import {installConsoleMock,assertConsoleClean} from './fixtures/console';
const workspace='/dashboard/w/ws-test',project=workspace+'/p/project-test';
const routes=[
 ...['overview','projects','team','credits','audit','settings','security','analytics','services'].map(p=>workspace+'/'+p),
 ...['overview','services','members','audit','settings','security','analytics','nft','nft/collections/new','agent-auth','depin'].map(p=>project+'/'+p),
 ...['','people','treasury','pay','history','payroll','proofs','data-preview','stealth','settings'].map(p=>project+'/zer0'+(p?'/'+p:'')),
 '/dashboard/platform','/docs',
];
for(const path of routes)test(`non-Morph route renders ${path}`,async({page})=>{
 const state=await installConsoleMock(page,{admin:true});await page.goto(path,{waitUntil:'domcontentloaded'});
 await expect(page.locator('main').first()).toBeVisible();
 await expect(page.getByRole('heading').first()).toBeVisible();
 await expect(page.locator('body')).not.toContainText('Something went wrong');
 await expect(page.locator('body')).not.toContainText('Failed to fetch');
 await assertConsoleClean(state);
});
test('workspace name changes are persisted by the UI and visible after reload',async({page})=>{
 const state=await installConsoleMock(page);await page.goto(workspace+'/settings',{waitUntil:'domcontentloaded'});
 await expect(page.getByRole('heading').first()).toBeVisible();
 const input=page.locator('input').filter({visible:true}).first();await expect(input).toHaveValue('QA Workspace');await input.fill('Renamed QA');
 await page.getByRole('button',{name:/save/i}).first().click();
 await expect.poll(()=>state.workspaces[0].name).toBe('Renamed QA');await page.reload();await expect(page.locator('input').filter({visible:true}).first()).toHaveValue('Renamed QA');await assertConsoleClean(state);
});
test('non-admin platform access is denied without loading privileged datasets',async({page})=>{
 const state=await installConsoleMock(page);await page.goto('/dashboard/platform',{waitUntil:'domcontentloaded'});await expect(page.getByText(/administrator access|admin access|restricted|not authorized/i).first()).toBeVisible();
 expect(state.requests.filter(r=>r.path.startsWith('/api/platform/')&&r.path!=='/api/platform/me')).toEqual([]);await assertConsoleClean(state);
});
test('credit promo validation and redemption update the visible balance',async({page})=>{
 const state=await installConsoleMock(page);await page.goto(workspace+'/credits',{waitUntil:'domcontentloaded'});await expect(page.getByRole('heading').first()).toBeVisible();
 await page.getByPlaceholder('ZXR-…').fill('QA-PROMO');await page.getByRole('button',{name:/check|validate|apply/i}).first().click();
 await expect.poll(()=>state.requests.some(r=>r.path.endsWith('/validate-promo'))).toBe(true);
 await page.getByRole('button',{name:/redeem/i}).first().click();await expect.poll(()=>state.balance).toBe(125);await assertConsoleClean(state);
});
