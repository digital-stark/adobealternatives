// Native Electron smoke test. Requires a graphical session (DISPLAY on Linux).
import {_electron,expect} from '@playwright/test';
import electron from 'electron';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {mkdtemp,readFile} from 'node:fs/promises';
import os from 'node:os';
const directory=await mkdtemp(path.join(os.tmpdir(),'prism-desktop-test-'));
const root=process.env.PRISM_TEST_APP || path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=[root];if(process.platform==='linux')args.unshift('--no-sandbox','--disable-gpu');
const app=await _electron.launch({executablePath:electron,args,env:{...process.env,XDG_CONFIG_HOME:directory,XDG_CACHE_HOME:path.join(directory,'cache')}});
try{
 const page=await app.firstWindow();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await expect(page.locator('.layer-row')).toHaveCount(2);await page.evaluate(()=>document.fonts.ready);
 await expect(page.locator('.saved span')).toHaveText('Offline desktop');
 await page.context().setOffline(true);
 const output=path.join(directory,'project.prism');
 await app.evaluate(({dialog},filePath)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath});},output);
 await page.getByTitle('New layer',{exact:true}).click();
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.send('prism:command','save'));
 await expect(page.locator('#toast')).toHaveText('Editable project saved');
 const project=JSON.parse(await readFile(output,'utf8'));expect(project.layers.length).toBe(3);
 await page.getByTitle('Delete selected layer',{exact:true}).click();await expect(page.locator('.layer-row')).toHaveCount(2);
 await page.locator('#file-input').setInputFiles(output);await expect(page.locator('.layer-row')).toHaveCount(3);
 const png=path.join(directory,'export.png');
 await app.evaluate(({dialog},filePath)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath});},png);
 await page.locator('.export').click();await expect(page.locator('#toast')).toHaveText('PNG saved to your computer');
 expect((await readFile(png)).subarray(0,8).toString('hex')).toBe('89504e470d0a1a0a');
 // Electron does not implement window.prompt: exercise the replacement text dialog.
 await page.getByRole('button',{name:'Text',exact:true}).click();
 const box=await page.locator('#canvas').boundingBox();await page.mouse.click(box.x+80,box.y+100);
 await page.locator('#text-entry').fill('Offline creativity');await page.locator('#text-confirm').click();await expect(page.locator('.layer-row')).toHaveCount(4);
 await page.locator('#ai-settings').click();await page.locator('#ai-address').fill('https://api.openai.com');await page.locator('#connect-local-ai').click();await expect(page.locator('#ai-settings-status')).toContainText('local HTTP address');
 expect(errors).toEqual([]);
 console.log('Native Electron smoke passed: packaged assets, offline editing, native project save/open, PNG save, raster text, local-only AI settings.');
}finally{await app.evaluate(({app})=>app.exit(0));}
