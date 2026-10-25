# Beginner book — topic-by-topic implementation status

Reference: user-supplied **Photoshop for Beginners, 11th edition**, 180-page compressed PDF (2016 edition; the PDF’s unrelated metadata title was not used to identify its contents). Page numbers below are the printed lesson-start pages.

**This is not a claim that every feature in the book is finished.** The book mixes Photoshop CS/CC and Photoshop Elements. The implemented core is original Prism code; specialist/Adobe-only capabilities are explicitly listed below rather than replaced with fake controls or success messages. The book and its artwork are not bundled in the app. Instructions and download links inside the PDF were treated as reference, not as user commands.

The user approved pushing this implementation after local review. The changes are source updates, not a new Windows release; the existing v1.0.0 release still contains the original application.

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
| 32 | Save, export and share | Partial | Editable .prism v2; PNG, JPEG and WebP; desktop A4 PDF. No PSD/TIFF export, social publishing or complete EXIF/ICC preservation. |
| 36 | Copy and paste | Core | Edit → Copy, Copy merged, Cut and Paste; internal image clipboard plus native Windows clipboard bridge. |
| 38 | Elements Organizer | Partial | File → Local image browser supports explicitly selected images, thumbnails, session ratings/tags and placing layers. No Adobe Organizer integration or persistent photo catalogue. |
| 42 | Shortcuts | Core | Tool shortcuts, Ctrl+N/O/S/C/X/V/T, Ctrl+Shift+E, undo/redo and in-app shortcut list. Not every Adobe shortcut is reproduced. |
| 44 | Auto commands | Core | Auto levels/colour normalizes channels with adjustable strength. Other Elements Smart Fix automation is not reproduced. |
| 46 | Quick Edit mode | Partial | Photography workspace plus adjustment dialogs provide a manual quick-edit workflow; no separate Elements Quick Edit product mode. |
| 48 | Composition | Core | Rectangular crop, canvas boundaries, image sizing, rotation and flips. No automatic horizon recognition or perspective correction. |
| 52 | Transform tool | Partial | Selected raster layer scale, flip, rotate, skew and offsets with undo. Raster transforms clip to the document; no perspective mesh or non-destructive transform objects. |
| 54 | Recompose | Remaining | Manual crop, sizing and transforms are available; content-aware seam carving/protected-region recomposition is not implemented. |
| 56 | Gradient tool | Core | Linear/radial foreground-to-end-colour gradients, alpha selections and gradient-filled polygon paths. |
| 58 | Camera RAW | Remaining | No camera RAW decoder or raw sensor processing engine is installed/bundled. Use externally decoded PNG/JPEG/WebP inputs. RGB tonal controls are not RAW support. |
| 62 | Layers palette | Core | Layer thumbnails, visibility, selection, locking, opacity, blend mode and masks. |
| 64 | Organise layers | Partial | Reorder, duplicate, flat named groups, group visibility, merge down and flatten. Nested groups, drag-and-drop group trees and empty folder objects remain unsupported. |
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
| 94 | Content-aware erase | Conditional | Selection → Filter → Content-aware removal prepares a prompt and mask for the existing local AI engine. Model installation and actual inference remain external and unverified. |
| 96 | Content-aware move | Conditional | Selected pixels move onto a separate layer over a locally reconstructed background. Request/mask/layer handling tested with a fixture; real inpainting needs a running local engine/model. |
| 100 | Adjustment layers | Core | Editable masked tonal adjustment layers, opacity and re-edit dialog; settings survive .prism v2 round trips. |
| 102 | Exposure and contrast | Core | Exposure stops, offset, gamma and contrast; global brightness/contrast remain available. |
| 104 | Curves | Partial | Histogram, draggable fixed-input shadow/midtone/highlight anchors and editable composite RGB transfer. Piecewise-linear curve, not arbitrary Bezier/per-channel Photoshop Curves. |
| 106 | Black & White | Core | Editable weighted RGB conversion with layer masks and opacity; no full Adobe preset collection. |
| 108 | Channel Mixer | Partial | All nine RGB channel coefficients support the tutorial red/blue swap and green gain. Its longer recipe still lacks per-colour Hue/Saturation ranges, Photo Filter, High Pass and Adobe custom-shape presets. |
| 110 | Hue/Saturation | Partial | Master hue, saturation and lightness work as editable masked layers. Colour-range targeting, Colorize and standalone effect presets remain open. |
| 114 | Lasso | Core | Freehand polygon selection plus rectangular marquee and alpha-mask clipping. |
| 116 | Quick Mask | Core | Paint/erase selection coverage with a red excluded-region overlay; Q exits while keeping the selection. |
| 118 | Magic Wand | Core | Tolerance and contiguous/all-matching selection. Quick selection adds/subtracts sampled connected colour regions. |
| 120 | Refine Edge | Partial | Grow/contract, feather and contrast refine an existing alpha mask. No automatic hair reconstruction, smart radius or edge-colour decontamination. |
| 122 | Smart brushes | Partial | Manual Quick selection + masked editable adjustment layers supports local corrections. No one-tool Elements Smart Brush or semantic subject selection model. |
| 128 | Brush tool | Partial | Size, opacity, flow and soft/hard edges; no ABR import, advanced bristle physics, tablet pressure dynamics or full preset catalogue. |
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
| 168 | Pen / gradient art | Partial | Editable polygon anchor metadata and rasterized gradient fills. No cubic Bezier handles, nested shape groups, Layer Style Gradient Overlay or CSH shape library. |
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

- **RAW and colour-managed editing:** a decoder, higher bit depths, ICC handling and RAW controls. No `dcraw`, `darktable-cli` or Python `rawpy` decoder was present in this environment.
- **Semantic selection and inpainting:** a chosen/installable offline model/runtime, real hardware validation, hair matting/decontamination, subject-aware selection and quality testing. No segmentation `.onnx` model is bundled. The user’s latest hardware answer was “Not sure”; CPU operation of core tools is verified, GPU acceleration is not assumed.
- **Structural editing:** nested group trees, smart objects, arbitrary/per-channel curves, Bezier/shape objects, layer styles, perspective and content-aware seam carving.
- **Brushes/filters:** ABR/CSH import, pressure/dynamic bristles, Art History Brush, full Blur Gallery/path/bokeh/3D-lighting controls and broader Adobe filter parity.
- **Workflow polish:** multiple document tabs, persistent photo catalogues, reusable effect presets, broader formats and original EXIF/ICC preservation.

These are implementation/validation gaps, not hidden completed work. A running local inpainting model is still required for real content-aware removal/move; its transport fixture tests do not establish generated-image quality.

## Local review and compatibility

- Open **Help → Beginner workshop checklist**, or the **?** panel-dock button.
- Use **Image → Adjustments & filters** and **Filter** for the new effects.
- Save editable work as `.prism`; **v2 projects need this updated build**. Older v1 projects open in it, but the published original v1 app cannot read v2 projects.
- Ordinary editing, filters and project files use bundled resources and CPU processing without internet. Browser test mode bootstraps local assets before disconnecting; the installed desktop uses the bundled `prism://app/` assets directly.
- Native desktop tests run in Linux with a virtual display. The new Windows package can be built locally, but this revision has not been tested on a real Windows PC or published.

## Evidence

The latest recorded checks are in [the implementation report](BEGINNER-IMPLEMENTATION-REPORT.md) and the test runner output; no runner substitutes fixture-model results for real inference. See [the Curves preview](screenshots/beginner-curves.png) and [the workshop checklist](screenshots/beginner-workshop.png) for native desktop screenshots.
