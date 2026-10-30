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
