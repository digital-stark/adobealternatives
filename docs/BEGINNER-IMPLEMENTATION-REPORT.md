# Beginner implementation — completed local stages

The compressed 180-page PDF was readable. Its 57 lesson topics are mapped in [the full checklist](BEGINNER-BOOK-CHECKLIST.md). This pass implemented core editing workflows across the chapters; it did not complete every Photoshop/Elements feature or reproduce the supplied artwork.

1. **Reference audit:** identified the actual 2016 eleventh-edition content, separated explanatory/exercise instructions from the user's request, and recorded all lesson starts. Did not act on publisher/watermark links, Adobe registration or asset-download directions.
2. **Documents and delivery:** added New document, resolution/print-size controls, aspect-linked resampling, canvas anchors, placement, affine transforms, rotation/flips, internal/native clipboard, session image browsing and JPEG/WebP/A4 PDF export. PNG/JPEG density metadata is preserved as a chosen PPI; arbitrary original EXIF/ICC is not preserved.
3. **Layer model:** added real masks and grayscale mask painting, reorder/merge/flatten, flat group labels/visibility, more blend modes and editable adjustment layers. Project v2 persists masks, numeric effect settings, groups, polygon anchors and resolution; v1 project reading remains supported.
4. **Corrections:** added Levels/histogram, interactive fixed-anchor Curves, exposure/offset/gamma/contrast, whole-image and tonal-range Colour Balance, all nine RGB Channel Mixer coefficients, Black & White, master Hue/Saturation, Vibrance, Auto Levels and Shadows/Highlights. The three-anchor curve is piecewise linear; it is not full per-channel Photoshop Curves.
5. **Selections and retouching:** added tolerance/contiguous Wand, additive/subtractive Quick selection, Quick Mask overlay, inverse/feather/manual grow-contract-contrast refinement, brush flow/hardness, mask painting, Dodge/Burn/Sponge, Blur/Sharpen, simple Repair and captured-source History brush. Source History defaults are limited to the current document. Advanced hair matting and semantic subject selection are absent.
6. **Filters and creativity:** bundled an offline processing worker and preview UI. Added Gaussian-style/motion/spin/tilt-style blur, unsharp mask, median denoising, radial lighting, cutout/painterly approximations, panosphere and kaleidoscope remaps, original repeat craft patterns and editable polygon-gradient anchor workflows. Some effects are explicitly approximate, and raster filter settings are not smart filters.
7. **Local AI workflows:** retained loopback-only generation and added a content-aware move controller that preserves original layers and sends the correct mask. Fixture tests verify transport/mask/layer handling only. No actual inpainting or segmentation model is bundled or was run.
8. **Teaching and review:** added Help → Beginner workshop checklist and a ? dock button with practice actions and explicit availability states. Saved native desktop screenshots: [Curves](screenshots/beginner-curves.png), [workshop](screenshots/beginner-workshop.png).
9. **Validation:** final production build passed; **17 unit tests and 15 browser tests passed**. Native Electron smoke passed both from the checkout and from the packaged Windows application's platform-independent `app.asar`, using Linux Electron and a virtual display. It exercised offline worker filters, project save/open, text, PNG/JPEG/WebP/PDF files, native clipboard and local-only AI configuration.
10. **Local package:** built `release/Prism-Studio-Beginner-Preview-x64.exe` (about 153 MB) and `release/Beginner-Preview-SHA256SUMS.txt`. It is a Windows portable build, not a hosted download, and was not executed on a real Windows PC. At review, no GitHub push, tag, commit or release had been made. The user subsequently approved a source push; no new binary release is part of that push.

## Material limits and next stages

The topic checklist marks 30 topics with core coverage, 17 partial, 4 approximate, 2 conditional on a model, 2 remaining engine/capability gaps, and 2 reference-only entries. A core label is scoped by the row; it does not mean every subcontrol or recipe detail in Photoshop has been cloned.

Remaining work includes a RAW/ICC/high-bit-depth pipeline, content-aware seam carving/recompose, real local-model installation/quality tests, automatic subject/hair selection, nested groups, smart objects, full Bezier and shape/layer-style editing, targeted colour ranges and Colorize/preset workflows, Photo Filter/High Pass, advanced brush imports/dynamics, and full Blur Gallery/Art History behaviour. These are deliberately not marked complete.

The latest hardware reply was “Not sure,” so GPU acceleration is not assumed. The added core image operations run on the CPU. Choosing and validating external model/decoder engines on the user's Windows machine is a separate prerequisite for the remaining engine-dependent paths.

## Reproduce locally

```sh
npm run test:unit
npm test
npm run test:desktop
npm run build
npx electron-builder --win portable --x64 --config.portable.artifactName=Prism-Studio-Beginner-Preview-x64.exe
```

On headless Linux, the desktop smoke test needs a virtual X display. `PRISM_TEST_APP=/absolute/path/to/release/win-unpacked/resources/app.asar` can select the bundled app for the same smoke script. These commands do not publish anything.
