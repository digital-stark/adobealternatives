import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
const executablePath=process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined);
export default defineConfig({testDir:'./tests',testMatch:'**/*.spec.js',use:{baseURL:'http://127.0.0.1:3010',viewport:{width:1440,height:1000},launchOptions:{executablePath,args:['--no-sandbox']}},webServer:{command:'npm run build && npm start',url:'http://127.0.0.1:3010',env:{PORT:'3010',PRISM_TEST:'1'},reuseExistingServer:!process.env.CI},reporter:'list'});
