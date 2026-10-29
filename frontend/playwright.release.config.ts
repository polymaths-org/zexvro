import {defineConfig} from '@playwright/test';
// Never rebuild or attach to an unrelated existing server during artifact validation.
const external=process.env.PLAYWRIGHT_BASE_URL;
export default defineConfig({testDir:process.env.RELEASE_SURFACE==='landing'?'./surface-e2e':'./e2e',outputDir:'test-results/release',workers:1,retries:0,reporter:'list',use:{baseURL:external||'http://127.0.0.1:4173',channel:'chrome',trace:'retain-on-failure',launchOptions:{args:['--no-sandbox']}},webServer:external?undefined:{command:'node ../scripts/cicd/serve.mjs',url:'http://127.0.0.1:4173',reuseExistingServer:false,timeout:30000}});
