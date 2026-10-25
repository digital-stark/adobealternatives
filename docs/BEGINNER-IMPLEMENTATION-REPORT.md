# Completed modifications — Prism 1.1.0

This revision addresses the six requested areas. It does not claim every Photoshop control or every recipe in the book is finished. The book remains reference material; neither the book nor its artwork is distributed.

1. **Real RAW development.** Added bundled LibRaw/WASM decoding, an exposure/white-balance/highlight development dialog, half-size decoding, source/output limits and useful decode failures. Verified an actual 32 MB Sony ARW (3120×2084 half-size output) and an original Bayer DNG fixture. The editor develops to RGB/8; high-bit-depth/ICC-preserving RAW editing remains outside this revision.
2. **Automatic subject and hair-edge estimation.** Bundled checksum-verified U²-Net weights and ONNX Runtime. Added Select-menu commands and a person icon in the AI sidebar. Added edge-aware soft matte refinement, manual correction controls, and protection against applying inference to a changed document. Tested real network execution and soft-mask pixel variation, including a public-domain NASA portrait. This is saliency plus edge refinement, not a dedicated high-resolution hair-matting network or guaranteed hair reconstruction.
3. **Advanced brushes.** Added Round, Charcoal, Foliage and Calligraphy presets, PNG stamp tips, continuous spacing across pointer events, scatter, size/angle jitter, roundness, pressure/tilt and locally saved settings. Selection/mask painting still uses actual alpha coverage. ABR parsing, physical bristle simulation and physical-tablet acceptance remain open.
4. **Nested groups.** Added group paths up to 12 levels, isolated recursive compositing, parent opacity/blend/visibility, collapse controls, immutable undo metadata and saved project structure. Pixel tests verify two nested 50% groups produce 25% composite alpha rather than applying opacity separately to member layers. Empty folders and drag/drop tree moves are not implemented.
5. **Cubic Bézier tools.** Added editable smooth/corner anchors, mirrored or independent handles, anchor movement/deletion, exact de Casteljau subdivision, open/closed paths, gradient fills, strokes and selection conversion. Handles follow document/affine transforms and survive save/open. Rendered pixels are raster; compound Boolean paths, CSH libraries and vector-only shape layers remain open.
6. **Real learned inpainting.** Converted the checksum-pinned MIT MI-GAN checkpoint to bundled ONNX; added offline content-aware removal and default built-in content-aware move. CPU inference needs no Python, server, GPU, key or network. Tests exercise real model output and exact preservation of unselected pixels. The original stays below the output layer. The 512px network can produce artifacts on large holes; inspect results. Optional text-prompt Stable Diffusion still requires an external local engine and weights and remains transport-tested here.
7. **Compatibility and packaging.** Added project v3, with v1/v2 import, source/model notices, checksum verification before builds, reproducible MI-GAN conversion instructions, CPU-first documentation, updated workshop guidance and Windows 1.1.0 release configuration. RAW-worker Emscripten binding generation has its own narrowly scoped CSP exception; the document still disallows JavaScript eval and renderer network access.

## Validation

**20 unit tests and 20 production browser tests passed.** The native Electron smoke test also passed with real RAW/selection/inpainting execution while network access was disabled. Checks include pure geometry/group/spacing tests, production browser tests, real DNG decoding, real portrait selection and inpainting, nested group pixel compositing, cubic/project round trips, and native Electron offline model execution. The Windows x64 portable executable was cross-built locally (about 188 MB). Its packaged `app.asar` passed the full native offline smoke test with Linux Electron, including both real models and RAW decoding. One packaged-run Playwright debugger handshake timed out before the test started; a fresh run completed all assertions. The same 20 unit tests, 20 browser tests, native desktop smoke test, Windows portable build and checksum/artifact upload also passed on a Windows GitHub Actions runner: [Windows validation and download](https://github.com/digital-stark/adobealternatives/actions/runs/40219311425). This verifies native Windows execution, while acceptance on the user's own PC and physical tablet remains outstanding.

Commands:

```sh
npm run test:unit
npm test
DISPLAY=:99 npm run test:desktop  # Linux virtual-display runner
npm run dist:win
```

See [advanced controls and limits](ADVANCED-TOOLS.md) and the [updated book checklist](BEGINNER-BOOK-CHECKLIST.md) for the remaining scope. This report replaces the earlier source-only beginner-preview report; it does not relabel outstanding Photoshop capabilities as complete.

Windows CI initially caught CRLF conversion of a vendored runtime file. `.gitattributes` now preserves all checksum-verified runtime/decoder bytes; a local `core.autocrlf=true` checkout and the Windows rerun both passed.
