import {
  app,
  BrowserWindow,
  Menu,
  protocol,
  net,
  session,
  ipcMain,
  dialog,
  clipboard,
  nativeImage,
  ClipboardItem,
} from "electron";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { writeFile } from "node:fs/promises";
import { generateLocally, localAIStatus } from "./local-ai.mjs";
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../dist");
let window;
let dirty = false;
protocol.registerSchemesAsPrivileged([
  {
    scheme: "prism",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
]);
const trusted = (event) => {
  if (
    !window ||
    event.sender !== window.webContents ||
    event.senderFrame !== window.webContents.mainFrame ||
    !event.senderFrame.url.startsWith("prism://app/")
  )
    throw new Error("Untrusted desktop request.");
};
ipcMain.on("prism:dirty", (event, value) => {
  trusted(event);
  dirty = value === true;
});
ipcMain.handle("prism:ai-status", (event, endpoint) => {
  trusted(event);
  return localAIStatus(endpoint);
});
ipcMain.handle("prism:generate", async (event, payload) => {
  trusted(event);
  try {
    return await generateLocally(payload);
  } catch (error) {
    return { error: error.message };
  }
});
function send(command) {
  window?.webContents.send("prism:command", command);
}
async function nativeEdit(command) {
  const editing = await window.webContents.executeJavaScript(
    "['INPUT','TEXTAREA'].includes(document.activeElement.tagName)",
  );
  if (editing) window.webContents[command]();
  else send(command);
}
ipcMain.handle("prism:clipboard-copy", async (event, data) => {
  trusted(event);
  if (
    typeof data !== "string" ||
    data.length > 40_000_000 ||
    !/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(data)
  )
    throw new Error("Invalid clipboard image");
  const image = nativeImage.createFromDataURL(data);
  if (image.isEmpty()) throw new Error("Cannot decode clipboard image");
  await clipboard.write([
    new ClipboardItem({
      "image/png": new Blob([image.toPNG()], { type: "image/png" }),
    }),
  ]);
  return true;
});
ipcMain.handle("prism:clipboard-paste", async (event) => {
  trusted(event);
  const items = await clipboard.read(),
    item = items.find((item) => item.types.includes("image/png"));
  if (!item) return null;
  const blob = await item.getType("image/png");
  if (blob.size > 40_000_000) throw new Error("Clipboard image is too large");
  const image = nativeImage.createFromBuffer(
      Buffer.from(await blob.arrayBuffer()),
    ),
    size = image.getSize();
  if (image.isEmpty()) return null;
  if (size.width > 8000 || size.height > 8000)
    throw new Error("Clipboard image is too large");
  return image.toDataURL();
});
ipcMain.handle("prism:export-pdf", async (event, { image, name }) => {
  trusted(event);
  if (
    typeof image !== "string" ||
    image.length > 100_000_000 ||
    !/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(image)
  )
    throw new Error("Invalid PDF image");
  const { canceled, filePath } = await dialog.showSaveDialog(window, {
    defaultPath: path.basename(String(name)),
    filters: [{ name: "PDF image document", extensions: ["pdf"] }],
  });
  if (canceled || !filePath) return false;
  const printWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  try {
    await printWindow.loadURL(
      "data:text/html;charset=utf-8," +
        encodeURIComponent(
          `<html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><style>@page{size:A4;margin:10mm}body{margin:0}img{width:100%;height:auto;max-height:270mm;object-fit:contain}</style></head><body><img src="${image}"></body></html>`,
        ),
    );
    await printWindow.webContents.executeJavaScript(
      "Promise.all(Array.from(document.images).map(image=>image.decode()))",
    );
    const data = await printWindow.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
    });
    await writeFile(filePath, data);
    return true;
  } finally {
    printWindow.destroy();
  }
});

app
  .whenReady()
  .then(async () => {
    // No remote resources, telemetry, cloud generation, or automatic update connections.
    session.defaultSession.webRequest.onBeforeRequest(
      { urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"] },
      (_, callback) => callback({ cancel: true }),
    );
    session.defaultSession.setPermissionRequestHandler((_, __, callback) =>
      callback(false),
    );
    session.defaultSession.setPermissionCheckHandler(() => false);
    protocol.handle("prism", async (request) => {
      try {
        const url = new URL(request.url);
        if (url.hostname !== "app" || !["GET", "HEAD"].includes(request.method))
          return new Response("Not found", { status: 404 });
        const target = path.resolve(
          root,
          "." + decodeURIComponent(url.pathname),
        );
        if (!target.startsWith(root + path.sep))
          return new Response("Not found", { status: 404 });
        const response = await net.fetch(pathToFileURL(target).href);
        const headers = new Headers(response.headers);
        headers.set(
          "Content-Security-Policy",
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-src 'none'",
        );
        return new Response(response.body, {
          status: response.status,
          headers,
        });
      } catch {
        return new Response("Not found", { status: 404 });
      }
    });
    session.defaultSession.on("will-download", (event) =>
      event.preventDefault(),
    );
    ipcMain.handle("prism:save-file", async (event, { name, data, type }) => {
      trusted(event);
      if (
        !["png", "jpeg", "webp", "prism"].includes(type) ||
        typeof data !== "string" ||
        data.length > 200_000_000
      )
        throw new Error("Invalid document.");
      const { canceled, filePath } = await dialog.showSaveDialog(window, {
        defaultPath: path.basename(String(name)),
        filters: [
          {
            name:
              type === "prism"
                ? "Prism project"
                : type.toUpperCase() + " image",
            extensions: [type === "jpeg" ? "jpg" : type],
          },
        ],
      });
      if (canceled || !filePath) return false;
      if (type !== "prism") {
        if (
          !new RegExp("^data:image/" + type + ";base64,[A-Za-z0-9+/]+=*$").test(
            data,
          )
        )
          throw new Error("Invalid image data.");
        await writeFile(filePath, Buffer.from(data.split(",")[1], "base64"));
      } else await writeFile(filePath, data, "utf8");
      return true;
    });
    window = new BrowserWindow({
      width: 1480,
      height: 960,
      minWidth: 850,
      minHeight: 640,
      backgroundColor: "#1b1b1e",
      title: "Prism Studio",
      show: false,
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(here, "preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
      },
    });
    window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    window.webContents.on("will-navigate", (event) => event.preventDefault());
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        {
          label: "File",
          submenu: [
            {
              label: "New document…",
              accelerator: "CmdOrCtrl+N",
              click: () => send("new"),
            },
            {
              label: "Open image or project…",
              accelerator: "CmdOrCtrl+O",
              click: () => send("open"),
            },
            {
              label: "Save project…",
              accelerator: "CmdOrCtrl+S",
              click: () => send("save"),
            },
            {
              label: "Export PNG…",
              accelerator: "CmdOrCtrl+Shift+E",
              click: () => send("export"),
            },
            { type: "separator" },
            { role: "quit" },
          ],
        },
        {
          label: "Edit",
          submenu: [
            {
              label: "Undo",
              accelerator: "CmdOrCtrl+Z",
              click: () => send("undo"),
            },
            {
              label: "Redo",
              accelerator: "CmdOrCtrl+Shift+Z",
              click: () => send("redo"),
            },
            { type: "separator" },
            {
              label: "Cut",
              accelerator: "CmdOrCtrl+X",
              click: () => nativeEdit("cut"),
            },
            {
              label: "Copy",
              accelerator: "CmdOrCtrl+C",
              click: () => nativeEdit("copy"),
            },
            {
              label: "Paste",
              accelerator: "CmdOrCtrl+V",
              click: () => nativeEdit("paste"),
            },
            { role: "selectAll" },
          ],
        },
        {
          label: "View",
          submenu: [
            {
              label: "Fit canvas",
              accelerator: "CmdOrCtrl+0",
              click: () => send("fit"),
            },
            { role: "togglefullscreen" },
          ],
        },
        {
          label: "Help",
          submenu: [
            { label: "Beginner workshop", click: () => send("workshop") },
            { label: "Offline AI setup", click: () => send("ai-settings") },
            { label: "Keyboard shortcuts", click: () => send("shortcuts") },
            { label: "About Prism", click: () => send("about") },
          ],
        },
      ]),
    );
    window.once("ready-to-show", () => window.show());
    window.on("close", (event) => {
      if (!dirty) return;
      event.preventDefault();
      const answer = dialog.showMessageBoxSync(window, {
        type: "question",
        buttons: ["Keep editing", "Discard changes"],
        defaultId: 0,
        cancelId: 0,
        title: "Unsaved project",
        message: "Save your project before closing?",
        detail: "Use File → Save project to keep editable layers.",
      });
      if (answer === 1) {
        dirty = false;
        window.close();
      }
    });
    await window.loadURL("prism://app/index.html");
  })
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });
app.on("window-all-closed", () => app.quit());
