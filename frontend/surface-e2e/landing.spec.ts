import {test,expect} from '@playwright/test';
test('landing page renders without an application crash',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 const api=process.env.E2E_API_BASE||'https://zexvro-platform-api.zexvro.workers.dev';
 await page.route(api+'/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({status:'success'})}));
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#root')).not.toBeEmpty();
 await expect(page.getByRole('heading').first()).toBeVisible();
 await expect(page.locator('body')).not.toContainText('Something went wrong');
 await page.waitForTimeout(500);expect(errors).toEqual([]);
});
