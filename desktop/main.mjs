import {app,BrowserWindow,Menu,protocol,net,session,ipcMain,dialog} from 'electron';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {writeFile} from 'node:fs/promises';
import {generateLocally,localAIStatus} from './local-ai.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../dist');
let window;
let dirty=false;
protocol.registerSchemesAsPrivileged([{scheme:'prism',privileges:{standard:true,secure:true,supportFetchAPI:true,stream:true}}]);
const trusted = event => {
  if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || !event.senderFrame.url.startsWith('prism://app/')) throw new Error('Untrusted desktop request.');
};
ipcMain.on('prism:dirty',(event,value)=>{trusted(event);dirty=value===true;});
ipcMain.handle('prism:ai-status',(event,endpoint)=>{trusted(event);return localAIStatus(endpoint);});
ipcMain.handle('prism:generate',async(event,payload)=>{trusted(event);try{return await generateLocally(payload);}catch(error){return {error:error.message};}});
function send(command){window?.webContents.send('prism:command',command);}
app.whenReady().then(async()=>{
// No remote resources, telemetry, cloud generation, or automatic update connections.
session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(_,callback)=>callback({cancel:true}));
session.defaultSession.setPermissionRequestHandler((_,__,callback)=>callback(false));
session.defaultSession.setPermissionCheckHandler(()=>false);
protocol.handle('prism',async request=>{
  try {
    const url=new URL(request.url);
    if(url.hostname!=='app'||!['GET','HEAD'].includes(request.method))return new Response('Not found',{status:404});
    const target=path.resolve(root,'.'+decodeURIComponent(url.pathname));
    if(!target.startsWith(root+path.sep))return new Response('Not found',{status:404});
    const response=await net.fetch(pathToFileURL(target).href);
    const headers=new Headers(response.headers);
    headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-src 'none'");
    return new Response(response.body,{status:response.status,headers});
  } catch {return new Response('Not found',{status:404});}
});
session.defaultSession.on('will-download',(event)=>event.preventDefault());
ipcMain.handle('prism:save-file',async(event,{name,data,type})=>{
  trusted(event);
  if(!['png','prism'].includes(type)||typeof data!=='string'||data.length>200_000_000)throw new Error('Invalid document.');
  const {canceled,filePath}=await dialog.showSaveDialog(window,{defaultPath:path.basename(String(name)),filters:[{name:type==='png'?'PNG image':'Prism project',extensions:[type]}]});
  if(canceled||!filePath)return false;
  if(type==='png'){
    if(!/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(data))throw new Error('Invalid PNG.');
    await writeFile(filePath,Buffer.from(data.split(',')[1],'base64'));
  }else await writeFile(filePath,data,'utf8');
  return true;
});
window=new BrowserWindow({width:1480,height:960,minWidth:850,minHeight:640,backgroundColor:'#1b1b1e',title:'Prism Studio',show:false,autoHideMenuBar:false,webPreferences:{preload:path.join(here,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}});
window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
window.webContents.on('will-navigate',event=>event.preventDefault());
Menu.setApplicationMenu(Menu.buildFromTemplate([
 {label:'File',submenu:[{label:'Open image or project…',accelerator:'CmdOrCtrl+O',click:()=>send('open')},{label:'Save project…',accelerator:'CmdOrCtrl+S',click:()=>send('save')},{label:'Export PNG…',accelerator:'CmdOrCtrl+Shift+E',click:()=>send('export')},{type:'separator'},{role:'quit'}]},
 {label:'Edit',submenu:[{label:'Undo',accelerator:'CmdOrCtrl+Z',click:()=>send('undo')},{label:'Redo',accelerator:'CmdOrCtrl+Shift+Z',click:()=>send('redo')},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]},
 {label:'View',submenu:[{label:'Fit canvas',accelerator:'CmdOrCtrl+0',click:()=>send('fit')},{role:'togglefullscreen'}]},
 {label:'Help',submenu:[{label:'Offline AI setup',click:()=>send('ai-settings')},{label:'Keyboard shortcuts',click:()=>send('shortcuts')},{label:'About Prism',click:()=>send('about')}]}
]));
window.once('ready-to-show',()=>window.show());
window.on('close',event=>{if(!dirty)return;event.preventDefault();const answer=dialog.showMessageBoxSync(window,{type:'question',buttons:['Keep editing','Discard changes'],defaultId:0,cancelId:0,title:'Unsaved project',message:'Save your project before closing?',detail:'Use File → Save project to keep editable layers.'});if(answer===1){dirty=false;window.close();}});
await window.loadURL('prism://app/index.html');
}).catch(error=>{console.error(error);app.exit(1);});
app.on('window-all-closed',()=>app.quit());
