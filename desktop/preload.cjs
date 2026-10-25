const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('prismDesktop',Object.freeze({
  offline:true,
  setDirty:value=>ipcRenderer.send('prism:dirty',value===true),
  saveFile:payload=>ipcRenderer.invoke('prism:save-file',payload),
  aiStatus:endpoint=>ipcRenderer.invoke('prism:ai-status',endpoint),
  generate:payload=>ipcRenderer.invoke('prism:generate',payload),
  onCommand:callback=>{const listener=(_,command)=>callback(command);ipcRenderer.on('prism:command',listener);return ()=>ipcRenderer.removeListener('prism:command',listener);}
}));
