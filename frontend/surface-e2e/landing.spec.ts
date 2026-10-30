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
// The preloader holds the page while its intro plays, so these allow for that before measuring.
const waitlistTop=(page:import('@playwright/test').Page)=>page.locator('#waitlist').boundingBox().then(box=>Math.round(box?.y??9999));
test('a direct /#waitlist link lands on the waitlist form',async({page})=>{
 test.setTimeout(120000);
 await page.goto('/#waitlist',{waitUntil:'domcontentloaded'});
 await expect.poll(()=>waitlistTop(page),{timeout:90000}).toBeLessThan(120);
 await expect(page.locator('#waitlist input[type="email"]')).toBeVisible();
});
test('the navbar Join waitlist link scrolls to the waitlist form',async({page})=>{
 test.setTimeout(120000);
 await page.goto('/',{waitUntil:'domcontentloaded'});
 // The preloader covers the page first, and the navbar CTA only mounts once the page is scrolled past the hero.
 await expect(page.locator('[class*="z-[10000]"]')).toHaveCount(0,{timeout:90000});
 await page.mouse.wheel(0,1500);
 await page.getByRole('link',{name:'Join waitlist'}).filter({visible:true}).first().click({timeout:30000});
 await expect.poll(()=>waitlistTop(page),{timeout:15000}).toBeLessThan(120);
 await expect(page.locator('#waitlist input[type="email"]')).toBeVisible();
});
test('zexvro.in/waitlist centres the email form and confirms a new join',async({page})=>{
 await page.route('**/api/waitlist',route=>route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({status:'joined'})}));
 await page.goto('/waitlist',{waitUntil:'domcontentloaded'});
 const input=page.locator('input[type="email"]');
 await expect(input).toBeVisible();
 const box=await input.boundingBox();const view=page.viewportSize()!;
 expect(Math.abs(box!.y+box!.height/2-view.height/2)).toBeLessThan(view.height*0.2);
 await input.fill('builder@example.test');
 await page.getByRole('button',{name:'Join waitlist'}).click();
 await expect(page.getByRole('button',{name:"You're on the list"})).toBeVisible();
});
test('the waitlist page says so when an email is already on the list',async({page})=>{
 await page.route('**/api/waitlist',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({status:'already_joined'})}));
 await page.goto('/waitlist',{waitUntil:'domcontentloaded'});
 await page.locator('input[type="email"]').fill('builder@example.test');
 await page.getByRole('button',{name:'Join waitlist'}).click();
 await expect(page.getByText('This email is already on the waitlist.')).toBeVisible();
});
