# Prism Studio — offline Windows editor

Prism is a standalone Windows desktop image editor with a Photoshop-style workspace, icon toolbar, layers, and optional local generative AI. The packaged application includes its runtime, fonts, icons, and starter image. Editing does not require a browser, Node.js, a server, an account, an API key, or internet access on the user's PC.

This is an initial alternative, not complete Photoshop parity. PSD files, smart objects, full Bezier vector paths, editable text objects, nested layer groups, and professional print workflows are not implemented.

## Beginner-workshop changes (not released)

This source includes the interface rework and beginner-book features; they are not yet part of a published Windows release. See the [topic-by-topic beginner checklist](docs/BEGINNER-BOOK-CHECKLIST.md) for completed core workflows, approximations and remaining work, and the earlier [interface change log](docs/INTERFACE-REWORK.md). The current local preview is `release/Prism-Studio-Beginner-Preview-x64.exe`; it is not a hosted download. The existing GitHub release is unchanged. This is a staged implementation, not a claim that every lesson feature is finished.

## Use on Windows

Supported target: Windows 10/11, x64.

Open `Prism-Studio-1.0.0-Portable-x64.exe` from `release/`. The portable app needs no installation and works offline. It extracts its bundled runtime to a temporary directory on launch. Preferences live in the current user's application-data directory; projects remain in the locations you choose.

- **File → Open image or project** / **Ctrl+O** opens a local image or `.prism` project.
- **File → Save project** / **Ctrl+S** writes an editable `.prism` file containing layers, positions, opacity, visibility, blend modes, and image adjustments.
- **Export** / **Ctrl+Shift+E** writes a flattened PNG; File → Export image also provides JPEG/WebP and a desktop A4 PDF.
- Save your project to keep your changes between launches. Edits are held in memory until saved; closing an unsaved desktop document asks for confirmation.
- Native file dialogs let you choose local save locations.

## Beginner tools and project files

Use **Help → Beginner workshop checklist** (or the **?** dock button) to practise the new tools. File provides New, Place, Local image browser, project saves and exports. Edit has clipboard and affine transforms. Image has image/canvas sizing, rotation, and the adjustment/filter dialog. Layer has reorder, merge/flatten, flat groups, masks, and editable adjustments. Select has Wand, Quick selection, Quick Mask and manual edge refinement. Filter includes the implemented blur/retouch/creative operations and conditional local-AI content-aware workflows.

New `.prism` files use **version 2**, retaining masks, adjustment settings, group labels, polygon path points and resolution. Version 1 files remain readable. The original published app cannot read v2 files. PNG/JPEG export embeds chosen PPI; import reads common PNG/JFIF density headers. Browser decoders/encoders do not preserve arbitrary original EXIF/ICC metadata; this is an RGB/8 editor.

Some filters are explicitly labelled approximations. Curves has three fixed interior anchors and a piecewise-linear composite curve. Groups are flat; polygon paths rasterize their gradient fill and keep editable anchor metadata. The session image browser is not a permanent photo catalogue. See the checklist for the full limits rather than assuming Photoshop parity.

## Offline generative fill and expand

Prism connects only to a model running on the **same PC** through a local AUTOMATIC1111-compatible Stable Diffusion WebUI API. No image, prompt, or key is sent to a cloud AI service. The desktop renderer blocks HTTP, HTTPS, and WebSocket traffic; the main process permits generation only through explicitly validated loopback HTTP endpoints and refuses redirects.

**A model is not bundled.** Install a compatible engine and download a licensed model before disconnecting from the internet, or transfer the dependencies and model from another machine. Hardware and storage requirements depend on the engine and model. A suitable GPU is recommended. A basic setup with AUTOMATIC1111 on Windows is:

1. Follow the engine's official Windows installation instructions: <https://github.com/AUTOMATIC1111/stable-diffusion-webui#installation-and-running>.
2. Install a compatible Stable Diffusion inpainting checkpoint (follow the engine/model publisher's documentation) and start WebUI with its `--api` option. For an existing WebUI installation, add `--api` to its `COMMANDLINE_ARGS` in `webui-user.bat`, then launch that file. Keep it bound to the default loopback address; `--listen` is not needed.
3. Load the model and finish any first-run dependency/model downloads. Verify WebUI itself works offline.
4. In Prism, choose **Local AI settings**, enter `http://127.0.0.1:7860` (or your local port), and choose **Save & check connection**.
5. Select a region and describe an edit, or use Expand to add a 25% border. Generated results appear on a new layer; the original stays underneath.

Prism sends an opaque black/white inpainting mask (white = regenerate, black = preserve). Local inference is sized to at most 1024 pixels on the longest side, then mapped onto the document. The engine/model controls result quality and masked-region fidelity. With no local model running, ordinary editing still works; generation displays a setup message. Actual model inference has not been validated in this cloud machine, which has no model installed. Transport and mask handling are covered by fixture-based tests.

## Download delivery

Workspace file links are not hosted release downloads. The Windows executable in this cloud workspace is about 153 MB; a link to its local path does not establish that the chat can transfer it.

The prepared `.github/workflows/windows-release.yml` workflow builds and tests on a Windows runner, uploads a downloadable Actions artifact, and can publish the portable executable and SHA-256 checksum as GitHub Release assets. It does not run until the source is pushed to GitHub. A `v1.0.0` tag push publishes a release; a manual run uploads an artifact by default and publishes only when its Publish option is selected. Publication needs repository approval and working GitHub Actions. Public-repository releases are public downloads; private-repository releases require repository access.

## Build from source

Build-time dependency downloads need internet access; the resulting desktop application does not. Install Node.js **22.12+** and run from PowerShell in this repository:

```powershell
npm ci
npm run desktop
```

To make the portable Windows executable:

```powershell
npm run dist:win
```

To build a Windows installer on a Windows build machine:

```powershell
npm run dist:installer
```

Outputs are written under `release/`. Packages are unsigned. The portable Windows artifact was built in Linux; it still needs acceptance testing on a real Windows PC. The native Electron runtime, offline editing, and file operations were tested in Linux.

The optional browser development workflow remains available through `npm run dev`, serving the editor on `http://127.0.0.1:3000`. It uses the same local-only AI adapter. The installed desktop application neither starts nor needs this server.

## Checks

```powershell
npm run test:unit
npx playwright install chromium
npm test
npm run test:desktop
```

The tests cover loopback-only AI endpoints, local engine transport with a fixture, mask requests, project schema validation, painting, layers, history, selections, adjustments, offline project round trips, native Electron saves/opens, raster text dialogs, and PNG export. Tests do not run a real diffusion model. Native tests need a graphical session; Linux cloud runs use a virtual X display. Chromium defaults to Playwright's browser on Windows, or `/usr/bin/chromium` when present on Linux; `CHROMIUM_PATH` can override it.

## Editing notes

Paint, erase, sample colors, add rasterized text/rectangles, draw gradients, move layers, select regions, and crop to a selection. Double-click layers to rename them. Layers can be hidden, locked, duplicated, and deleted. Brightness, contrast, and saturation apply to the composited image. Undo/redo retains up to 20 edits. Pen is a fine raster brush; Alt-click sets the clone source. Advanced controls explain unavailable functionality. Projects support up to 100 layers within a 100-million-pixel combined layer limit; files larger than 150 MB are rejected.

## Assets

Fonts are bundled from Fontsource (DM Sans and Manrope, SIL Open Font License); icons are Lucide (ISC). Font license files are included in the Windows app's `resources/licenses/` directory. The bundled coastal sample is from [dharmx/walls](https://github.com/dharmx/walls/blob/main/nature/a_beach_with_waves_and_cliffs.jpg); replace it with your own licensed image before public distribution. No assets are downloaded at application startup.
