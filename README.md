# Prism Studio — offline Windows editor

Prism is a standalone Windows desktop image editor with a Photoshop-style workspace, icon toolbar, layers, and optional local generative AI. The packaged application includes its runtime, fonts, icons, and starter image. Editing does not require a browser, Node.js, a server, an account, an API key, or internet access on the user's PC.

This is an initial alternative, not complete Photoshop parity. PSD files, smart objects, editable text objects, compound vector Boolean operations and professional print workflows are not implemented.

## Version 1.1.0

Adds real camera RAW development, automatic subject selection with soft hair-edge refinement, advanced stamp brushes, nested isolated groups, editable cubic Bézier paths, and bundled CPU neural inpainting. The two learned models and inference runtime ship with the app; neither requires a server, API key, Python, GPU or internet connection. See the [step-by-step implementation report](docs/BEGINNER-IMPLEMENTATION-REPORT.md), [controls and limitations](docs/ADVANCED-TOOLS.md), and [book checklist](docs/BEGINNER-BOOK-CHECKLIST.md).

## Use on Windows

Supported target: Windows 10/11, x64.

Open `Prism-Studio-1.1.0-Portable-x64.exe` from `release/`. The portable app needs no installation and works offline. It extracts its bundled runtime to a temporary directory on launch. Preferences live in the current user's application-data directory; projects remain in the locations you choose.

- **File → Open image or project** / **Ctrl+O** opens a local image or `.prism` project.
- **File → Save project** / **Ctrl+S** writes an editable `.prism` file containing layers, positions, opacity, visibility, blend modes, and image adjustments.
- **Export** / **Ctrl+Shift+E** writes a flattened PNG; File → Export image also provides JPEG/WebP and a desktop A4 PDF.
- Save your project to keep your changes between launches. Edits are held in memory until saved; closing an unsaved desktop document asks for confirmation.
- Native file dialogs let you choose local save locations.

## Beginner tools and project files

Use **Help → Beginner workshop checklist** (or the **?** dock button) to practise the new tools. File provides New, Place, Local image browser, project saves and exports. Edit has clipboard and affine transforms. Image has image/canvas sizing, rotation, and the adjustment/filter dialog. Layer has reorder, merge/flatten, nested groups, masks, and editable adjustments. Select has Wand, Quick selection, Quick Mask and manual edge refinement. Filter includes the implemented blur/retouch/creative operations and bundled-model content-aware workflows.

New `.prism` files use **version 3**, retaining masks, adjustment settings, nested group settings, cubic handles and resolution. Version 1/2 files remain readable; older apps reject v3 files. PNG/JPEG export embeds chosen PPI; import reads common PNG/JFIF density headers. Browser decoders/encoders do not preserve arbitrary original EXIF/ICC metadata; this is an RGB/8 editor.

Some filters are explicitly labelled approximations. Curves has three fixed interior anchors and a piecewise-linear composite curve. Nested groups composite on isolated surfaces; Bézier paths rasterize fill/stroke pixels while keeping editable anchors and handles. The session image browser is not a permanent photo catalogue. See the checklist for the full limits rather than assuming Photoshop parity.

## Offline generative fill and expand

Prism connects only to a model running on the **same PC** through a local AUTOMATIC1111-compatible Stable Diffusion WebUI API. No image, prompt, or key is sent to a cloud AI service. The desktop renderer blocks HTTP, HTTPS, and WebSocket traffic; the main process permits generation only through explicitly validated loopback HTTP endpoints and refuses redirects.

**A text-prompt diffusion model is not bundled.** U²-Net selection and MI-GAN removal/move are bundled. For text prompts and Expand, install a compatible engine and download a licensed model before disconnecting from the internet, or transfer the dependencies and model from another machine. Hardware and storage requirements depend on the engine and model. A suitable GPU is recommended. A basic setup with AUTOMATIC1111 on Windows is:

1. Follow the engine's official Windows installation instructions: <https://github.com/AUTOMATIC1111/stable-diffusion-webui#installation-and-running>.
2. Install a compatible Stable Diffusion inpainting checkpoint (follow the engine/model publisher's documentation) and start WebUI with its `--api` option. For an existing WebUI installation, add `--api` to its `COMMANDLINE_ARGS` in `webui-user.bat`, then launch that file. Keep it bound to the default loopback address; `--listen` is not needed.
3. Load the model and finish any first-run dependency/model downloads. Verify WebUI itself works offline.
4. In Prism, choose **Local AI settings**, enter `http://127.0.0.1:7860` (or your local port), and choose **Save & check connection**.
5. Select a region and describe an edit, or use Expand to add a 25% border. Generated results appear on a new layer; the original stays underneath.

Prism sends an opaque black/white inpainting mask (white = regenerate, black = preserve). Local inference is sized to at most 1024 pixels on the longest side, then mapped onto the document. The engine/model controls result quality and masked-region fidelity. With no local model running, ordinary editing still works; generation displays a setup message. This optional text-prompt diffusion path remains transport-tested. Bundled U²-Net subject selection and MI-GAN removal/move run real inference and are tested separately in Chromium and native Electron with networking disabled.

## Download delivery

Workspace file links are not hosted release downloads. The Windows executable in this cloud workspace is about 188 MB; a link to its local path does not establish that the chat can transfer it.

The prepared `.github/workflows/windows-release.yml` workflow builds and tests on a Windows runner, uploads a downloadable Actions artifact, and can publish the portable executable and SHA-256 checksum as GitHub Release assets. A main-branch push runs Windows tests and uploads a build artifact. A release tag starts a published release build. A version tag push publishes a release; a manual run uploads an artifact by default and publishes only when its Publish option is selected. Publication requires working GitHub Actions. Public-repository releases are public downloads; private-repository releases require repository access.

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

Outputs are written under `release/`. Packages are unsigned. The portable Windows artifact was built in Linux and on a Windows GitHub Actions runner. Native offline editing, RAW decoding, both learned models, clipboard and file operations passed on Windows CI and Linux. The user’s own PC and physical tablet still need acceptance testing.

The optional browser development workflow remains available through `npm run dev`, serving the editor on `http://127.0.0.1:3000`. It uses the same local-only AI adapter. The installed desktop application neither starts nor needs this server.

## Checks

```powershell
npm run test:unit
npx playwright install chromium
npm test
npm run test:desktop
```

The tests cover loopback-only AI endpoints, local engine transport with a fixture, mask requests, project schema validation, painting, layers, history, selections, adjustments, offline project round trips, native Electron saves/opens, raster text dialogs, and PNG export. Tests run real bundled subject-selection and inpainting networks; they do not run a Stable Diffusion checkpoint. Native tests need a graphical session; Linux cloud runs use a virtual X display. Chromium defaults to Playwright's browser on Windows, or `/usr/bin/chromium` when present on Linux; `CHROMIUM_PATH` can override it.

## Editing notes

Paint, erase, sample colors, add rasterized text/rectangles, draw gradients, move layers, select regions, and crop to a selection. Double-click layers to rename them. Layers can be hidden, locked, duplicated, and deleted. Brightness, contrast, and saturation apply to the composited image. Undo/redo retains up to 20 edits. Pen is a fine raster brush; Alt-click sets the clone source. Brush settings expose dynamics and PNG tips. Pen path exposes cubic handles and path actions. Group selected layer accepts paths such as Portrait/Hair. Projects support up to 100 layers within a 100-million-pixel combined layer limit; files larger than 150 MB are rejected.

## Assets

Fonts are bundled from Fontsource (DM Sans and Manrope, SIL Open Font License); icons are Lucide (ISC). Font license files are included in the Windows app's `resources/licenses/` directory. The bundled coastal sample is from [dharmx/walls](https://github.com/dharmx/walls/blob/main/nature/a_beach_with_waves_and_cliffs.jpg); replace it with your own licensed image before public distribution. No assets are downloaded at application startup.

Bundled inference uses ONNX Runtime Web (MIT), U²-Net (Apache-2.0) and MI-GAN (MIT). RAW development uses LibRaw-Wasm (ISC), LibRaw (CDDL option), Little CMS (MIT) and IJG JPEG. Sources, conversion instructions and checksums are in [model documentation](docs/ADVANCED-TOOLS.md) and `public/models/manifest.json`; third-party notices ship in `resources/licenses/`. Decoder source is available at the upstream links in `licenses/LIBRAW-WASM-NOTICE.txt`.

Validated Windows 1.1.0 build: [Actions run and downloadable artifact](https://github.com/digital-stark/adobealternatives/actions/runs/40219311425). This main-branch build is an Actions artifact; the older published GitHub Release is unchanged.
