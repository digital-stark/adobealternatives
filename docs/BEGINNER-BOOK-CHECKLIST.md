# Beginner book — topic-by-topic implementation status

Reference: user-supplied **Photoshop for Beginners, 11th edition**, 180-page compressed PDF (2016 edition; the PDF’s unrelated metadata title was not used to identify its contents). Page numbers below are the printed lesson-start pages.

**This is not a claim that every feature in the book is finished.** The book mixes Photoshop CS/CC and Photoshop Elements. The implemented core is original Prism code; specialist/Adobe-only capabilities are explicitly listed below rather than replaced with fake controls or success messages. The book and its artwork are not bundled in the app. Instructions and download links inside the PDF were treated as reference, not as user commands.

This update implements the six requested areas in Prism 1.1.0. The detailed steps, checks and remaining bounds are recorded in [the implementation report](BEGINNER-IMPLEMENTATION-REPORT.md).

## Status definitions

- **Core:** the stated basic workflow is implemented; the row names its bounds.
- **Partial:** some controls/workflows are implemented; the remaining work is named.
- **Approximation:** an original, explicitly limited algorithm provides a related effect, not the Adobe implementation.
- **Conditional:** local-engine integration exists, but model installation and real inference have not been validated here.
- **Remaining:** the necessary engine or capability is absent.
- **Reference:** explanatory material or product-specific services; not an executable app feature.

## All lesson topics

| Page | Topic | Status | Implementation / remaining work |
|---|---|---|---|
| 8 | Ultimate guide / overview | Core | Workspace, tools, layers and corrections are available; this is an RGB raster editor, not full Photoshop parity. |
| 18 | Photoshop family | Reference | Product comparisons are reading material; Adobe products/accounts are not installed or accessed. |
| 26 | First steps | Core | File → New document; open files; tools, contextual options, colour, panels and workspace presets. |
| 28 | Resize images | Core | Image → Image size; linked aspect ratio; resampling versus resolution-only; Canvas size and anchors. PNG/JPEG density export and common density import. |
| 32 | Save, export and share | Partial | Editable .prism v3; PNG, JPEG and WebP; desktop A4 PDF. No PSD/TIFF export, social publishing or complete EXIF/ICC preservation. |
| 36 | Copy and paste | Core | Edit → Copy, Copy merged, Cut and Paste; internal image clipboard plus native Windows clipboard bridge. |
| 38 | Elements Organizer | Partial | File → Local image browser supports explicitly selected images, thumbnails, session ratings/tags and placing layers. No Adobe Organizer integration or persistent photo catalogue. |
| 42 | Shortcuts | Core | Tool shortcuts, Ctrl+N/O/S/C/X/V/T, Ctrl+Shift+E, undo/redo and in-app shortcut list. Not every Adobe shortcut is reproduced. |
| 44 | Auto commands | Core | Auto levels/colour normalizes channels with adjustable strength. Other Elements Smart Fix automation is not reproduced. |
| 46 | Quick Edit mode | Partial | Photography workspace plus adjustment dialogs provide a manual quick-edit workflow; no separate Elements Quick Edit product mode. |
| 48 | Composition | Core | Rectangular crop, canvas boundaries, image sizing, rotation and flips. No automatic horizon recognition or perspective correction. |
| 52 | Transform tool | Partial | Selected raster layer scale, flip, rotate, skew and offsets with undo. Raster transforms clip to the document; no perspective mesh or non-destructive transform objects. |
| 54 | Recompose | Remaining | Manual crop, sizing and transforms are available; content-aware seam carving/protected-region recomposition is not implemented. |
| 56 | Gradient tool | Core | Linear/radial foreground-to-end-colour gradients, alpha selections and gradient-filled cubic paths. |
| 58 | Camera RAW | Core | Bundled LibRaw 0.22.1 demosaicing with camera/auto/daylight white balance, exposure, highlight recovery and half-size processing. Real DNG and Sony ARW decoding verified. Develops into RGB/8; not a high-bit-depth/ICC-preserving RAW editor. |
| 62 | Layers palette | Core | Layer thumbnails, visibility, selection, locking, opacity, blend mode and masks. |
| 64 | Organise layers | Core | Nested isolated groups up to 12 levels, collapse, visibility, group opacity/blend and project/undo persistence. Use slash-separated group paths to move a layer between groups. Empty folders and drag-and-drop tree rearrangement remain unsupported. |
| 66 | Layer menu | Partial | Common raster-layer and mask commands work. No smart objects, vector layer engine, adjustment clipping stacks or full layer-style system. |
| 68 | Layer opacity | Partial | Layer opacity affects compositing. Independent Fill versus layer-style opacity is not implemented because layer styles are absent. |
| 70 | Blending | Core | Normal, Multiply, Screen, Overlay, Darken/Lighten, Dodge/Burn, Hard/Soft Light, Difference/Exclusion, Hue/Saturation/Color/Luminosity. Not all Adobe blend modes or colour-managed math. |
| 76 | Colour corrections | Core | Colour balance has overall and separate shadow/midtone/highlight channel controls; RGB/8 workflow only. |
| 78 | Levels | Core | Black/white input points, midtone gamma, histogram and editable masked adjustment layers. No separate channel/output-point UI. |
| 80 | Sponge | Core | Saturate/desaturate brush plus Vibrance adjustment; radius, opacity, hardness and flow controls. |
| 82 | Isolate colour | Core | Selection inversion + masked Black & White/Hue adjustments; mask painting restores selected colour regions. |
| 86 | Clone Stamp | Core | Alt-click clone source and aligned raster cloning; layer selection/locking, opacity and brush size. No complete Clone Source multi-source panel. |
| 88 | Sharpen photos | Core | Unsharp mask radius/amount/threshold and a local sharpen brush. |
| 90 | Shadows and highlights | Core | Dodge/Burn brushes plus Shadows/Highlights adjustment. The adjustment is a simple tonal weighting, not full Adobe radius/tonal-width processing. |
| 92 | Eyes and teeth | Core | Manual selected/masked exposure, curves, desaturation and dodge workflow; no automatic face/eye recognition. |
| 94 | Content-aware erase | Core | Bundled MI-GAN ONNX inference reconstructs a selected region locally on CPU; original layers and unselected pixels are preserved. 512px model context is resampled to the selected region. Not text-prompt generation. |
| 96 | Content-aware move | Core | Bundled MI-GAN reconstructs the source background, then original selected pixels move onto their own layer. Optional external Stable Diffusion remains available. Large missing regions may need manual correction. |
| 100 | Adjustment layers | Core | Editable masked tonal adjustment layers, opacity and re-edit dialog; settings survive .prism v2 round trips. |
| 102 | Exposure and contrast | Core | Exposure stops, offset, gamma and contrast; global brightness/contrast remain available. |
| 104 | Curves | Partial | Histogram, draggable fixed-input shadow/midtone/highlight anchors and editable composite RGB transfer. Piecewise-linear curve, not arbitrary Bezier/per-channel Photoshop Curves. |
| 106 | Black & White | Core | Editable weighted RGB conversion with layer masks and opacity; no full Adobe preset collection. |
| 108 | Channel Mixer | Partial | All nine RGB channel coefficients support the tutorial red/blue swap and green gain. Its longer recipe still lacks per-colour Hue/Saturation ranges, Photo Filter, High Pass and Adobe custom-shape presets. |
| 110 | Hue/Saturation | Partial | Master hue, saturation and lightness work as editable masked layers. Colour-range targeting, Colorize and standalone effect presets remain open. |
| 114 | Lasso | Core | Freehand polygon selection plus rectangular marquee and alpha-mask clipping. |
| 116 | Quick Mask | Core | Paint/erase selection coverage with a red excluded-region overlay; Q exits while keeping the selection. |
| 118 | Magic Wand | Core | Tolerance and contiguous/all-matching selection. Quick selection adds/subtracts sampled connected colour regions. |
| 120 | Refine Edge | Partial | Bundled U²-Net subject inference plus edge-aware soft matte refinement estimates visible hair edges. Grow/contract, feather and contrast remain available. No dedicated high-resolution hair-matting network, edge-colour decontamination or guaranteed extraction on difficult backgrounds. |
| 122 | Smart brushes | Partial | Automatic local subject selection, manual Quick selection and masked adjustments support local corrections. No one-tool Adobe Elements Smart Brush. |
| 128 | Brush tool | Core | Brush presets, custom PNG tips, spacing, scatter, size/angle jitter, roundness, pressure, tilt, hardness, flow, opacity and saved settings. No ABR parser or physical bristle simulation; imported tip images are session-local. |
| 132 | Tools with brushes | Partial | Brush, Eraser, Clone, Dodge/Burn, Sponge, Blur, Sharpen, History and simple mean-colour Repair. Repair is not a texture-aware Healing Brush. |
| 134 | History tools | Partial | Undo/redo snapshots, restore-state panel and a captured-source History brush. No Art History Brush style engine. Undo is bounded by memory. |
| 136 | Paint from photos | Approximation | Painterly smoothing/posterization plus actual raster brushes; not the book’s full Art History Brush engine. |
| 142 | Filters / gallery | Core | Scaled previews, validated parameters, new-layer results and worker-based offline processing; a subset of filters, not the entire Photoshop Filter Gallery. |
| 144 | Blur filters | Core | Box-based Gaussian-style blur, directional motion blur and blur brush. Not every Adobe blur variant. |
| 146 | Blur Gallery | Partial | Tilt-shift-style and spin blur approximations. No interactive multi-pin/path blur, bokeh simulation or full Blur Gallery workspace. |
| 148 | Lighting Effects | Approximation | Radial 2D intensity/position/radius lighting; no 3D material, bump map or multiple spotlight renderer. |
| 150 | Reduce Noise | Approximation | Strength-controlled median noise reduction. No full Adobe Preserve Details/colour-noise controls. |
| 152 | Cutout | Approximation | Smoothing plus colour-level posterization, not Adobe Cutout’s edge-simplicity/fidelity algorithm. |
| 156 | Panosphere | Core | Filter → Panosphere creates a polar-coordinate remap on a new layer; use a suitably prepared wide panorama. |
| 160 | Photos and illustrations | Core | Place images, paint, create polygon paths, mask and blend layers using the user’s own assets. |
| 164 | Craft materials | Core | Original dot/stripe/check patterns, colour controls, new documents and raster/PDF export; not the book’s downloadable artwork. |
| 168 | Pen / gradient art | Core | Cubic Bézier handles, smooth/corner conversion, independent Alt-drag handles, anchor movement/deletion, exact segment subdivision, open/closed paths, gradient fill, stroke and selection conversion. Handles survive project save and affine transforms. Fills/strokes are rasterized; no compound-path Boolean operations, CSH library or Adobe layer styles. |
| 172 | Kaleidoscope | Core | Mirrored angular remap with configurable segment count on a new layer; not the exact supplied artwork. |
| 174 | Glossary | Reference | Terminology is source/reference material, not commands. No Adobe accounts, lesson downloads, installation or publisher actions were performed. |

## Completed stages in this pass

1. Audited the full contents and relevant lesson text; mapped every lesson start above to actual capabilities.
2. Added document creation, linked/resolution-only resampling, image placement, canvas anchors, affine transforms, rotation/flips, native/internal clipboard, a session image browser and JPEG/WebP/PDF export. Common PNG/JPEG density headers are read and export PPI is embedded.
3. Added reordering, merge/flatten, flat groups, additional blend modes and real layer masks. Upgraded `.prism` to version 2 for effects, masks, groups, path points and resolution; version 1 files remain readable.
4. Added editable tonal layers for Levels, fixed-anchor Curves, Exposure/Offset/Gamma, full RGB Channel Mixer, tonal-range Colour Balance, Hue/Saturation, Black & White, Vibrance, Auto Levels and Shadows/Highlights.
5. Added Magic Wand, additive/subtractive connected-colour selection, Quick Mask, inversion, feathering and manual grow/contract/contrast refinement. Selection masks clip painting, adjustments and new-layer filter results.
6. Added brush hardness/flow, mask painting (including grayscale coverage), Dodge/Burn, Sponge, Blur/Sharpen, a captured-source History brush, simple Repair and aligned Clone sampling.
7. Added scaled filter previews and a bundled persistent processing worker for blur/motion/spin/tilt-style effects, unsharp mask, median denoising, radial lighting, cutout/painterly approximations and polar/mirrored remaps. Added original craft patterns and editable polygon gradient-path building blocks.
8. Added the visible **? Beginner workshop** dock button and Help checklist with practice actions and clear partial/conditional statuses.
9. Extended validation to real pixel results, project/mask round trips, native clipboard, PNG/JPEG/WebP/PDF files, geometry/blending, worker operation while offline, mask refinement and fixture-based local content-aware move transport. Fixed an Electron 45 clipboard API change and prevented masks from being applied twice during resampling.

## Remaining implementation queues

- **Colour-managed editing:** high-bit-depth working documents, full ICC/EXIF preservation and non-destructive RAW parameter re-editing after development.
- **Selection quality:** dedicated high-resolution hair matting, edge-colour decontamination and broader quality evaluation. U²-Net provides saliency rather than named-object semantic classes.
- **Structural editing:** smart objects, arbitrary/per-channel curves, compound path Boolean operations, vector-only shape layers, layer styles, perspective and content-aware seam carving.
- **Brushes/filters:** ABR/CSH import, physical bristles, Art History Brush, complete Blur Gallery/path/bokeh/3D-lighting controls.
- **Workflow polish:** multiple documents, persistent catalogues and wider format support.

Bundled selection and inpainting are real CPU model inference. Prompt-guided Stable Diffusion still needs separately installed weights and a running local engine; that optional diffusion path is transport-tested, not claimed as validated diffusion inference here. GPU/tablet hardware acceptance on the user's Windows PC remains outstanding.

## Local review and compatibility

- Open **Help → Beginner workshop checklist**, or the **?** panel-dock button.
- Use **Image → Adjustments & filters** and **Filter** for the new effects.
- Save editable work as `.prism`; **v3 projects need Prism 1.1.0**. Older v1/v2 projects open in it. Older builds cannot read v3, which prevents silent loss of nested groups and cubic handles.
- Ordinary editing, filters and project files use bundled resources and CPU processing without internet. Browser test mode bootstraps local assets before disconnecting; the installed desktop uses the bundled `prism://app/` assets directly.
- Native desktop tests passed on Linux with a virtual display and on a Windows GitHub Actions runner, including real offline RAW/model execution. The Windows portable build and artifact upload passed. The user’s own PC and physical tablet still need acceptance testing.

## Evidence

The latest recorded checks are in [the implementation report](BEGINNER-IMPLEMENTATION-REPORT.md) and the test runner output; no runner substitutes fixture-model results for real inference. See [the Curves preview](screenshots/beginner-curves.png) and [the workshop checklist](screenshots/beginner-workshop.png) for native desktop screenshots.
