const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld(
  "prismDesktop",
  Object.freeze({
    offline: true,
    copyImage: (data) => ipcRenderer.invoke("prism:clipboard-copy", data),
    pasteImage: () => ipcRenderer.invoke("prism:clipboard-paste"),
    exportPdf: (payload) => ipcRenderer.invoke("prism:export-pdf", payload),
    setDirty: (value) => ipcRenderer.send("prism:dirty", value === true),
    saveFile: (payload) => ipcRenderer.invoke("prism:save-file", payload),
    aiStatus: (endpoint) => ipcRenderer.invoke("prism:ai-status", endpoint),
    generate: (payload) => ipcRenderer.invoke("prism:generate", payload),
    onCommand: (callback) => {
      const listener = (_, command) => callback(command);
      ipcRenderer.on("prism:command", listener);
      return () => ipcRenderer.removeListener("prism:command", listener);
    },
  }),
);
