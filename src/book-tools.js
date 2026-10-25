import { inpaint } from "./inpaint-model.js";
import {
  brushDefaults,
  brushPresets,
  stampPositions,
  drawBrushStamp,
} from "./brush-engine.js";
import {
  clonePath,
  pathCommands,
  tracePath,
  moveAnchor,
  splitSegment,
  transformPath,
} from "./bezier.js";
import { setGroupPath, groupPath } from "./layer-groups.js";
import { decodeRaw, isRaw } from "./raw-decoder.js";
import { selectSubject } from "./subject-model.js";
import { imageDensityDataURL } from "./export-metadata.js";
import {
  EFFECTS,
  defaults,
  validateEffect,
  processPixels,
  wandMask,
  featherMask,
  creativeRemap,
} from "./imaging.js";
import {
  createCanvas,
  cloneCanvas,
  selectionMask,
  alphaMask,
  getMaskAlpha,
  maskBounds,
  renderLayer,
  compositeLayers,
  applyMask,
  drawSelected,
} from "./canvas-helpers.js";
const tonal = new Set([
  "levels",
  "curves",
  "exposure",
  "balance",
  "hue",
  "bw",
  "mixer",
  "shadows",
  "vibrance",
  "auto",
  "invert",
]);
export function initBookTools(api) {
  const $ = (s) => document.querySelector(s),
    state = api.getState;
  let clipboard = null,
    editingMask = null,
    historySource = null,
    retouching = null,
    quickMask = false;
  const s = () => state(),
    refresh = () => {
      api.render();
      api.renderLayers();
    };
  const commit = (fn) => {
    api.save();
    fn();
    refresh();
  };
  const selectedMask = () =>
    selectionMask(s().selection, s().canvas.width, s().canvas.height);
  const newLayer = (name) => api.createLayer(name);
  const assertEditable = () => {
    const l = s().active;
    if (!l || l.locked) throw new Error("Select an unlocked layer first.");
    return l;
  };
  function report(fn) {
    try {
      return fn();
    } catch (error) {
      api.toast(error.message);
    }
  }
  function values(form) {
    return Object.fromEntries(
      [...form.querySelectorAll("input,select")]
        .filter((e) => e.name)
        .map((e) => [
          e.name,
          e.type === "checkbox"
            ? e.checked
            : e.type === "number" || e.type === "range"
              ? Number(e.value)
              : e.value,
        ]),
    );
  }
  function dialog(title, html, apply) {
    api.modal(
      title,
      `<form id="book-form">${html}<div class="book-error" id="book-error" role="alert"></div><button class="primary full book-apply" type="submit">Apply</button></form>`,
    );
    $("#book-form").onsubmit = async (e) => {
      e.preventDefault();
      const button = $("#book-form button[type=submit]");
      button.disabled = true;
      try {
        await apply(values(e.target));
        $("#modal").close();
      } catch (error) {
        $("#book-error").textContent = error.message;
      } finally {
        button.disabled = false;
      }
    };
  }
  const number = (name, label, value, min, max, step = 1) =>
    `<label class="book-field"><span>${label}</span><input name="${name}" type="number" value="${value}" min="${min}" max="${max}" step="${step}" required></label>`;
  const check = (name, label, checked = true) =>
    `<label class="book-check"><input name="${name}" type="checkbox" ${checked ? "checked" : ""}>${label}</label>`;
  function dimensions(width, height) {
    if (
      ![width, height].every(
        (n) => Number.isInteger(n) && n > 0 && n <= 8000,
      ) ||
      width * height * Math.max(1, s().layers.length) > 100_000_000
    )
      throw new Error(
        "Use whole dimensions from 1–8000 px within the 100-million layer-pixel limit.",
      );
  }
  function newDocument() {
    dialog(
      "New document",
      `<label class="book-field"><span>Name</span><input name="name" value="Untitled" maxlength="150" required></label>${number("width", "Width", 1200, 1, 8000)}${number("height", "Height", 800, 1, 8000)}${number("ppi", "Resolution (pixels/inch)", 72, 1, 2400)}<label class="book-field"><span>Background</span><select name="background"><option value="white">White</option><option value="transparent">Transparent</option><option value="foreground">Foreground colour</option></select></label><p>Use Save project to keep the current document first. You can also undo creating this document.</p>`,
      (v) => {
        if (
          ![v.width, v.height].every(
            (n) => Number.isInteger(n) && n > 0 && n <= 8000,
          )
        )
          throw new Error("Use whole pixel dimensions from 1–8000.");
        api.save();
        api.replaceState({
          width: v.width,
          height: v.height,
          layers: [],
          selection: null,
          ppi: v.ppi,
          name: v.name,
          adjustments: { brightness: 100, contrast: 100, saturation: 100 },
        });
        const l = newLayer("Background");
        if (v.background !== "transparent") {
          const c = l.canvas.getContext("2d");
          c.fillStyle =
            v.background === "white" ? "#ffffff" : $("#color").value;
          c.fillRect(0, 0, v.width, v.height);
        }
        api.replaceState({ layers: [l], activeId: l.id });
        api.fit();
        refresh();
      },
    );
  }
  function imageSize() {
    const { canvas, ppi } = s(),
      ratio = canvas.height / canvas.width;
    dialog(
      "Image size",
      `${number("width", "Width (px)", canvas.width, 1, 8000)}${number("height", "Height (px)", canvas.height, 1, 8000)}${number("ppi", "Resolution (ppi)", ppi, 1, 2400)}${check("ratio", "Keep aspect ratio")}${check("resample", "Resample image pixels")}<p id="print-size"></p>`,
      (v) => {
        dimensions(v.width, v.height);
        api.save();
        if (v.resample) {
          for (const l of s().layers) {
            const c = createCanvas(v.width, v.height);
            const resizedContext = c.getContext("2d");
            resizedContext.scale(
              v.width / canvas.width,
              v.height / canvas.height,
            );
            resizedContext.drawImage(l.canvas, l.x, l.y);
            if (l.path)
              l.path = transformPath(l.path, (p) => ({
                x: ((p.x + l.x) * v.width) / canvas.width,
                y: ((p.y + l.y) * v.height) / canvas.height,
              }));
            if (l.mask) {
              const oldMask = createCanvas(canvas.width, canvas.height);
              oldMask.getContext("2d").drawImage(l.mask, l.x, l.y);
              const m = createCanvas(v.width, v.height);
              m.getContext("2d").drawImage(oldMask, 0, 0, v.width, v.height);
              l.mask = m;
            }
            l.canvas = c;
            l.x = 0;
            l.y = 0;
          }
          api.replaceState({
            width: v.width,
            height: v.height,
            selection: null,
          });
        }
        api.replaceState({ ppi: v.ppi });
        api.fit();
        refresh();
      },
    );
    const form = $("#book-form");
    const update = () => {
      const v = values(form);
      $("#print-size").textContent =
        `Print size: ${(v.width / v.ppi).toFixed(2)} × ${(v.height / v.ppi).toFixed(2)} inches`;
    };
    form.elements.width.oninput = () => {
      if (form.elements.ratio.checked)
        form.elements.height.value = Math.round(
          Number(form.elements.width.value) * ratio,
        );
      update();
    };
    form.elements.height.oninput = () => {
      if (form.elements.ratio.checked)
        form.elements.width.value = Math.round(
          Number(form.elements.height.value) / ratio,
        );
      update();
    };
    form.elements.resample.onchange = () => {
      const enabled = form.elements.resample.checked;
      form.elements.width.disabled = form.elements.height.disabled = !enabled;
      if (!enabled) {
        form.elements.width.value = canvas.width;
        form.elements.height.value = canvas.height;
      }
      update();
    };
    form.elements.ppi.oninput = update;
    update();
  }
  function canvasSize() {
    const { canvas } = s();
    dialog(
      "Canvas size",
      `${number("width", "Width (px)", canvas.width, 1, 8000)}${number("height", "Height (px)", canvas.height, 1, 8000)}<label class="book-field"><span>Anchor</span><select name="anchor"><option value="center">Centre</option><option value="top-left">Top left</option></select></label><p>Changes the canvas boundary without stretching the image. Pixels outside a smaller boundary are discarded.</p>`,
      (v) => {
        dimensions(v.width, v.height);
        api.save();
        const dx = v.anchor === "center" ? (v.width - canvas.width) / 2 : 0,
          dy = v.anchor === "center" ? (v.height - canvas.height) / 2 : 0;
        for (const l of s().layers) {
          for (const key of ["canvas", "mask"])
            if (l[key]) {
              const c = createCanvas(v.width, v.height);
              c.getContext("2d").drawImage(l[key], l.x + dx, l.y + dy);
              l[key] = c;
            }
          if (l.path)
            l.path = transformPath(l.path, (p) => ({
              x: p.x + l.x + dx,
              y: p.y + l.y + dy,
            }));
          l.x = l.y = 0;
        }
        api.replaceState({ width: v.width, height: v.height, selection: null });
        api.fit();
        refresh();
      },
    );
  }
  function transform() {
    const l = report(assertEditable);
    if (!l) return;
    dialog(
      "Transform selected layer",
      `${number("scaleX", "Width (%)", 100, -400, 400)}${number("scaleY", "Height (%)", 100, -400, 400)}${number("angle", "Rotation (degrees)", 0, -360, 360)}${number("skew", "Horizontal skew (degrees)", 0, -70, 70)}${number("x", "X offset (px)", l.x, -8000, 8000)}${number("y", "Y offset (px)", l.y, -8000, 8000)}<p>Transform applies to this raster layer and its mask. Content is clipped at the document boundary; Undo restores the original.</p>`,
      (v) => {
        if (!v.scaleX || !v.scaleY) throw new Error("Scale must not be zero");
        commit(() => {
          const w = l.canvas.width,
            h = l.canvas.height;
          for (const key of ["canvas", "mask"])
            if (l[key]) {
              const c = createCanvas(w, h),
                ctx = c.getContext("2d");
              ctx.translate(w / 2, h / 2);
              ctx.rotate((v.angle * Math.PI) / 180);
              ctx.transform(
                v.scaleX / 100,
                0,
                Math.tan((v.skew * Math.PI) / 180),
                v.scaleY / 100,
                0,
                0,
              );
              ctx.translate(-w / 2, -h / 2);
              ctx.drawImage(l[key], 0, 0);
              l[key] = c;
            }
          if (l.path) {
            const matrix = new DOMMatrix()
              .translate(w / 2, h / 2)
              .rotate(v.angle)
              .multiply(
                new DOMMatrix([
                  v.scaleX / 100,
                  0,
                  Math.tan((v.skew * Math.PI) / 180),
                  v.scaleY / 100,
                  0,
                  0,
                ]),
              )
              .translate(-w / 2, -h / 2);
            l.path = transformPath(l.path, (p) => {
              const t = matrix.transformPoint(p);
              return { x: t.x, y: t.y };
            });
          }
          l.x = v.x;
          l.y = v.y;
        });
      },
    );
  }
  function rotateDocument(turns = 1, flip = null) {
    commit(() => {
      const { canvas } = s(),
        w = canvas.width,
        h = canvas.height,
        newW = turns % 2 ? h : w,
        newH = turns % 2 ? w : h;
      for (const l of s().layers) {
        for (const key of ["canvas", "mask"])
          if (l[key]) {
            const c = createCanvas(newW, newH),
              ctx = c.getContext("2d");
            ctx.translate(newW / 2, newH / 2);
            if (flip)
              ctx.scale(
                flip === "horizontal" ? -1 : 1,
                flip === "vertical" ? -1 : 1,
              );
            else ctx.rotate((turns * Math.PI) / 2);
            ctx.translate(-w / 2, -h / 2);
            ctx.drawImage(l[key], l.x, l.y);
            l[key] = c;
          }
        if (l.path) {
          let matrix = new DOMMatrix().translate(newW / 2, newH / 2);
          matrix = flip
            ? matrix.scale(
                flip === "horizontal" ? -1 : 1,
                flip === "vertical" ? -1 : 1,
              )
            : matrix.rotate(turns * 90);
          matrix = matrix.translate(-w / 2, -h / 2);
          l.path = transformPath(l.path, (p) => {
            const t = matrix.transformPoint({ x: p.x + l.x, y: p.y + l.y });
            return { x: t.x, y: t.y };
          });
        }
        l.x = l.y = 0;
      }
      api.replaceState({ width: newW, height: newH, selection: null });
      api.fit();
    });
  }
  async function placeImage(file) {
    const image = await loadFile(file);
    dimensions(s().canvas.width, s().canvas.height);
    commit(() => {
      const l = newLayer(file.name.slice(0, 180)),
        scale = Math.min(
          1,
          s().canvas.width / image.width,
          s().canvas.height / image.height,
        ),
        w = image.width * scale,
        h = image.height * scale;
      l.canvas
        .getContext("2d")
        .drawImage(
          image,
          (s().canvas.width - w) / 2,
          (s().canvas.height - h) / 2,
          w,
          h,
        );
      s().layers.unshift(l);
      api.replaceState({ activeId: l.id });
    });
  }
  function openRaw(file) {
    dialog(
      "Develop camera RAW",
      `${number("exposure", "Exposure (stops)", 0, -4, 4, 0.1)}<label>White balance <select name="wb"><option value="camera">Camera</option><option value="auto">Automatic</option><option value="daylight">Daylight</option></select></label><label><input type="checkbox" name="half"> Half-size decode</label><p>LibRaw demosaicing, sRGB conversion and highlight recovery run locally. The developed document uses RGB/8; the original RAW file stays unchanged.</p>`,
      async (v) => {
        api.toast("Decoding camera RAW…");
        const decoded = await decodeRaw(file, {
          expCorrec: true,
          expShift: 2 ** Number(v.exposure),
          expPreser: 0.8,
          highlight: 2,
          useCameraWb: v.wb === "camera",
          useAutoWb: v.wb === "auto",
          halfSize: !!v.half,
        });
        commit(() => {
          const l = newLayer(file.name.slice(0, 180));
          l.canvas = decoded.canvas;
          api.replaceState({
            width: l.canvas.width,
            height: l.canvas.height,
            layers: [l],
            activeId: l.id,
            selection: null,
            ppi: 72,
            name: file.name,
            adjustments: { brightness: 100, contrast: 100, saturation: 100 },
          });
        });
        api.toast("RAW developed locally");
      },
    );
  }
  async function automaticSubject(hair = false) {
    if (inferenceBusy) return api.toast("A local inference is already running");
    inferenceBusy = true;
    const source = cloneCanvas(s().canvas);
    api.toast("Running bundled U²-Net model on CPU…");
    try {
      const result = await selectSubject(source, hair);
      if (s().canvas.toDataURL() !== source.toDataURL())
        throw new Error(
          "The document changed during inference. Retry on the current image.",
        );
      setSelection(result);
      api.toast(
        hair
          ? "Subject selected with edge-aware soft hair matte; inspect and refine the edges."
          : "Subject selected by the local model",
      );
    } catch (e) {
      api.toast("Subject selection failed: " + e.message);
    } finally {
      inferenceBusy = false;
    }
  }
  async function loadFile(file) {
    if (isRaw(file)) return (await decodeRaw(file)).canvas;
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file),
        img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(
          new Error(
            "This image format could not be decoded. Try PNG, JPEG, WebP or a supported camera RAW format.",
          ),
        );
      };
      img.src = url;
    });
  }
  function choosePlace() {
    let input = $("#place-file");
    if (!input) {
      input = document.createElement("input");
      input.id = "place-file";
      input.type = "file";
      input.accept = "image/*";
      input.hidden = true;
      document.body.append(input);
      input.onchange = async () => {
        const f = input.files[0];
        input.value = "";
        if (f)
          try {
            await placeImage(f);
          } catch (error) {
            api.toast(error.message);
          }
      };
    }
    input.click();
  }
  function copy(cut = false, merged = false) {
    const l = s().active;
    if (!l) throw new Error("Select a layer first");
    if (cut) assertEditable();
    clipboard = merged
      ? cloneCanvas(s().canvas)
      : renderLayer(l, s().canvas.width, s().canvas.height);
    const mask = selectedMask();
    const c = clipboard.getContext("2d");
    c.globalCompositeOperation = "destination-in";
    c.drawImage(mask, 0, 0);
    c.globalCompositeOperation = "source-over";
    if (cut) {
      if (l.kind === "adjustment")
        throw new Error("Adjustment layers contain settings, not pixels.");
      commit(() => {
        const ctx = l.canvas.getContext("2d");
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        ctx.drawImage(mask, -l.x, -l.y);
        ctx.restore();
      });
    }
    api.toast(
      cut ? "Selection cut to the internal clipboard" : "Selection copied",
    );
    if (api.desktop?.copyImage)
      api.desktop.copyImage(clipboard.toDataURL("image/png")).catch(() => {});
  }
  async function paste() {
    if (!clipboard && api.desktop?.pasteImage) {
      const data = await api.desktop.pasteImage();
      if (data) {
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = data;
        });
        clipboard = createCanvas(img.width, img.height);
        clipboard.getContext("2d").drawImage(img, 0, 0);
      }
    }
    if (!clipboard)
      return api.toast("Copy an image selection or place an image first");
    commit(() => {
      const l = newLayer("Pasted layer");
      l.canvas.getContext("2d").drawImage(clipboard, 0, 0);
      s().layers.unshift(l);
      api.replaceState({ activeId: l.id });
    });
  }
  async function exportFormat(type = "jpeg", quality = 0.92) {
    const { canvas } = s(),
      flattened = createCanvas(canvas.width, canvas.height),
      ctx = flattened.getContext("2d");
    if (type === "jpeg") {
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(canvas, 0, 0);
    const data = imageDensityDataURL(
        flattened.toDataURL("image/" + type, quality),
        type,
        s().ppi,
      ),
      name =
        $("#document-name").textContent.replace(/\.[^.]+$/, "") +
        "." +
        (type === "jpeg" ? "jpg" : type);
    if (api.desktop) {
      if (await api.desktop.saveFile({ name, data, type }))
        api.toast("Image exported");
    } else {
      const a = document.createElement("a");
      a.download = name;
      a.href = data;
      a.click();
    }
  }
  function exportOptions() {
    dialog(
      "Export image",
      `<label class="book-field"><span>Format</span><select name="format"><option value="png">PNG · transparency, lossless</option><option value="jpeg">JPEG · white background</option><option value="webp">WebP · transparency, compressed</option>${api.desktop?.exportPdf ? '<option value="pdf">PDF · A4 image document</option>' : ""}</select></label>${number("quality", "Quality (%)", 92, 1, 100)}<p>PNG is lossless; quality applies to JPEG and WebP. Editable layers are kept by Save project, not by image export.</p>`,
      async (v) => {
        if (v.format === "png") await api.exportPng();
        else if (v.format === "pdf")
          await api.desktop.exportPdf({
            image: s().canvas.toDataURL("image/png"),
            name:
              $("#document-name").textContent.replace(/\.[^.]+$/, "") + ".pdf",
          });
        else await exportFormat(v.format, v.quality / 100);
      },
    );
  }
  function reorder(direction) {
    const l = assertEditable(),
      index = s().layers.indexOf(l),
      next = Math.max(0, Math.min(s().layers.length - 1, index + direction));
    if (index === next) return;
    commit(() => {
      s().layers.splice(index, 1);
      s().layers.splice(next, 0, l);
    });
  }
  function mergeDown() {
    const index = s().layers.indexOf(assertEditable());
    if (index === s().layers.length - 1)
      return api.toast("No layer below the selected layer");
    const members = [s().layers[index], s().layers[index + 1]],
      path = groupPath(members[0]);
    if (
      path.map((g) => g.id).join("/") !==
      groupPath(members[1])
        .map((g) => g.id)
        .join("/")
    )
      return api.toast("Move both layers into the same group before merging.");
    commit(() => {
      const l = newLayer(s().layers[index].name + " merged");
      l.groups = path.map((g) => ({ ...g }));
      l.canvas = compositeLayers(
        members.map((m) => ({ ...m, groups: [], group: undefined })),
        s().canvas.width,
        s().canvas.height,
      );
      s().layers.splice(index, 2, l);
      api.replaceState({ activeId: l.id });
    });
  }
  function flatten() {
    commit(() => {
      const l = newLayer("Flattened image");
      l.canvas = compositeLayers(
        s().layers,
        s().canvas.width,
        s().canvas.height,
      );
      api.replaceState({ layers: [l], activeId: l.id });
    });
  }
  async function group() {
    const l = assertEditable(),
      name = await api.askText(
        "Group path (use / for nested groups)",
        groupPath(l)
          .map((g) => g.name)
          .join("/") || "Group 1",
      );
    if (name?.trim())
      commit(() => {
        setGroupPath(s().layers, l, name);
      });
  }
  function setMask() {
    const l = assertEditable();
    commit(() => {
      l.mask = selectedMask();
      editingMask = l.id;
    });
    api.setForeground("#ffffff");
    api.chooseTool("Brush");
    api.toast("Painting the mask: white reveals, black conceals");
  }
  function selectMask(id) {
    editingMask = editingMask === id ? null : id;
    if (editingMask) {
      api.setForeground("#ffffff");
      api.chooseTool("Brush");
    }
    api.toast(
      editingMask
        ? "Mask editing: white reveals, black conceals"
        : "Pixel editing",
    );
    refresh();
  }
  function invertMask() {
    const l = assertEditable();
    if (!l.mask) return api.toast("Add a mask first");
    commit(() => {
      l.mask = alphaMask(
        getMaskAlpha(l.mask).map((v) => 255 - v),
        l.mask.width,
        l.mask.height,
      );
    });
  }
  function removeMask(apply = false) {
    const l = assertEditable();
    if (apply && l.kind === "adjustment")
      return api.toast(
        "Use Flatten to bake an adjustment and its mask together",
      );
    if (!l.mask) return;
    commit(() => {
      if (apply && l.kind !== "adjustment") applyMask(l);
      else l.mask = null;
      editingMask = null;
    });
  }
  function setSelection(mask) {
    api.replaceState({ selection: maskBounds(mask) });
    api.updateSelection();
  }
  function invertSelection() {
    const mask = selectedMask();
    setSelection(
      alphaMask(
        getMaskAlpha(mask).map((v) => 255 - v),
        mask.width,
        mask.height,
      ),
    );
  }
  function feather() {
    if (!s().selection) return api.toast("Make a selection first");
    dialog(
      "Feather selection",
      number("radius", "Radius (px)", 4, 1, 50),
      (v) => {
        const m = selectedMask();
        setSelection(
          alphaMask(
            featherMask(getMaskAlpha(m), m.width, m.height, v.radius),
            m.width,
            m.height,
          ),
        );
      },
    );
  }
  function quickMaskToggle() {
    quickMask = !quickMask;
    $("#canvas-wrap").classList.toggle("quick-mask-view", quickMask);
    api.toast(
      quickMask
        ? "Quick Mask: paint to add to the selection; Eraser removes. Q exits."
        : "Quick Mask off",
    );
    if (quickMask) api.chooseTool("Brush");
    sync();
  }
  function wandAt(point) {
    const { canvas } = s(),
      data = canvas
        .getContext("2d")
        .getImageData(0, 0, canvas.width, canvas.height);
    setSelection(
      alphaMask(
        wandMask(
          data.data,
          canvas.width,
          canvas.height,
          point.x,
          point.y,
          Number($("#wand-tolerance").value),
          $("#wand-contiguous").checked,
        ),
        canvas.width,
        canvas.height,
      ),
    );
  }
  const pending = new Map();
  let worker,
    workerFailure = null,
    workerJob = 0;
  try {
    worker = new Worker(new URL("./imaging-worker.js", import.meta.url), {
      type: "module",
    });
    worker.onmessage = ({ data }) => {
      if (data.ready) {
        document.body.dataset.processingReady = "true";
        return;
      }
      const job = pending.get(data.id);
      if (!job) return;
      pending.delete(data.id);
      data.error
        ? job.reject(new Error(data.error))
        : job.resolve(new Uint8ClampedArray(data.pixels));
    };
    worker.onerror = (event) => {
      event.preventDefault();
      workerFailure =
        event.message || "Image-processing worker could not start";
      for (const job of pending.values()) job.reject(new Error(workerFailure));
      pending.clear();
    };
  } catch (error) {
    workerFailure = error.message;
  }
  function runWorker(source, width, height, options) {
    return new Promise((resolve, reject) => {
      if (workerFailure || !worker)
        return reject(
          new Error(workerFailure || "Image-processing worker unavailable"),
        );
      const id = ++workerJob;
      pending.set(id, { resolve, reject });
      worker.postMessage(
        { id, pixels: source.buffer, width, height, ...options },
        [source.buffer],
      );
    });
  }

  function effectsDialog(initial = "levels") {
    const active = s().active,
      editing = active?.kind === "adjustment";
    let current = editing ? active.effect.type : initial;
    api.modal(
      editing ? "Edit adjustment layer" : "Adjustments & filters",
      `<label class="book-field"><span>Technique</span><select id="effect-choice">${Object.entries(
        EFFECTS,
      )
        .filter(([id]) => !editing || tonal.has(id))
        .map(([id, e]) => `<option value="${id}">${e.name}</option>`)
        .join(
          "",
        )}</select></label><canvas id="effect-preview" width="320" height="180"></canvas><canvas id="tone-graph" width="320" height="160" aria-label="Tone curve and luminance histogram" hidden></canvas><div id="effect-fields"></div><label class="book-check"><input id="effect-layer" type="checkbox" checked>Keep as an editable adjustment layer</label><p id="effect-note"></p><div id="effect-error" class="book-error" role="alert"></div><button id="effect-apply" class="primary full book-apply">Apply to a new layer</button>`,
    );
    const preview = $("#effect-preview"),
      raw = compositeLayers(s().layers, s().canvas.width, s().canvas.height),
      width = 320,
      height = Math.max(1, Math.round((raw.height / raw.width) * width));
    preview.height = height;
    const small = createCanvas(width, height);
    small.getContext("2d").drawImage(raw, 0, 0, width, height);
    const pixels = small
      .getContext("2d")
      .getImageData(0, 0, width, height).data;
    function settings() {
      return {
        type: current,
        ...Object.fromEntries(
          [...$("#effect-fields").querySelectorAll("input")].map((input) => [
            input.name,
            Number(input.value),
          ]),
        ),
      };
    }
    function drawToneGraph() {
      const graph = $("#tone-graph");
      graph.hidden = !["curves", "levels"].includes(current);
      if (graph.hidden) return;
      const c = graph.getContext("2d"),
        w = graph.width,
        h = graph.height,
        settingsNow = settings(),
        hist = new Uint32Array(256);
      for (let i = 0; i < pixels.length; i += 4)
        if (pixels[i + 3])
          hist[
            Math.round(
              0.2126 * pixels[i] +
                0.7152 * pixels[i + 1] +
                0.0722 * pixels[i + 2],
            )
          ]++;
      const max = Math.max(1, ...hist);
      c.fillStyle = "#222";
      c.fillRect(0, 0, w, h);
      c.fillStyle = "#565656";
      for (let n = 0; n < 256; n++)
        c.fillRect(
          (n * w) / 256,
          h - (hist[n] / max) * h,
          w / 256 + 1,
          (hist[n] / max) * h,
        );
      c.strokeStyle = "#777";
      c.lineWidth = 0.5;
      for (let i = 1; i < 4; i++) {
        c.beginPath();
        c.moveTo((i * w) / 4, 0);
        c.lineTo((i * w) / 4, h);
        c.stroke();
        c.beginPath();
        c.moveTo(0, (i * h) / 4);
        c.lineTo(w, (i * h) / 4);
        c.stroke();
      }
      c.strokeStyle = "#dceaff";
      c.lineWidth = 2;
      c.beginPath();
      for (let n = 0; n < 256; n++) {
        let value;
        if (current === "curves") {
          const outputs = [
              0,
              settingsNow.shadows,
              settingsNow.midtones,
              settingsNow.highlights,
              255,
            ],
            position = (n / 255) * 4,
            index = Math.min(3, Math.floor(position)),
            fraction = position - index;
          value =
            outputs[index] * (1 - fraction) + outputs[index + 1] * fraction;
        } else
          value =
            255 *
            Math.pow(
              Math.max(
                0,
                Math.min(
                  1,
                  (n - settingsNow.black) /
                    (settingsNow.white - settingsNow.black),
                ),
              ),
              1 / settingsNow.gamma,
            );
        const x = (n / 255) * w,
          y = h - (value / 255) * h;
        n ? c.lineTo(x, y) : c.moveTo(x, y);
      }
      c.stroke();
      if (current === "curves")
        for (const [n, key] of [
          [64, "shadows"],
          [128, "midtones"],
          [192, "highlights"],
        ]) {
          c.fillStyle = "white";
          c.strokeStyle = "#417bb0";
          c.beginPath();
          c.arc(
            (n / 255) * w,
            h - (settingsNow[key] / 255) * h,
            4,
            0,
            Math.PI * 2,
          );
          c.fill();
          c.stroke();
        }
    }
    let curveDrag = null;
    $("#tone-graph").onpointerdown = (event) => {
      if (current !== "curves") return;
      const r = event.currentTarget.getBoundingClientRect(),
        x = ((event.clientX - r.left) / r.width) * 255;
      curveDrag = x < 96 ? "shadows" : x < 160 ? "midtones" : "highlights";
      event.currentTarget.setPointerCapture(event.pointerId);
      changeCurve(event);
    };
    function changeCurve(event) {
      if (!curveDrag) return;
      const r = event.currentTarget.getBoundingClientRect(),
        input = $("#effect-fields input[name=" + curveDrag + "]");
      input.value = Math.max(
        0,
        Math.min(
          255,
          Math.round((1 - (event.clientY - r.top) / r.height) * 255),
        ),
      );
      input.previousElementSibling.value = input.value;
      paintPreview();
    }
    $("#tone-graph").onpointermove = (event) => {
      if (event.buttons) changeCurve(event);
    };
    $("#tone-graph").onpointerup = $("#tone-graph").onpointercancel = () => {
      curveDrag = null;
    };
    function paintPreview() {
      try {
        const settingsNow = validateEffect(settings()),
          output = preview.getContext("2d");
        output.clearRect(0, 0, width, height);
        const globals = s().adjustments;
        output.filter = `brightness(${globals.brightness}%) contrast(${globals.contrast}%) saturate(${globals.saturation}%)`;
        if (editing) {
          const projected = compositeLayers(
            s().layers.map((l) =>
              l.id === active.id ? { ...l, effect: settingsNow } : l,
            ),
            s().canvas.width,
            s().canvas.height,
          );
          output.drawImage(projected, 0, 0, width, height);
        } else {
          const image = processPixels(pixels, width, height, settingsNow),
            result = createCanvas(width, height);
          result
            .getContext("2d")
            .putImageData(new ImageData(image, width, height), 0, 0);
          output.drawImage(result, 0, 0);
        }
        output.filter = "none";
        $("#effect-error").textContent = "";
        drawToneGraph();
      } catch (error) {
        $("#effect-error").textContent = error.message;
      }
    }
    function fields() {
      current = $("#effect-choice").value;
      const saved =
        editing && active.effect.type === current
          ? active.effect
          : defaults(current);
      $("#effect-fields").innerHTML = EFFECTS[current].fields
        .map(
          ([id, label, value, min, max, step = 1]) =>
            `<label class="slider-label">${label}<output>${saved[id] ?? value}</output><input name="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${saved[id] ?? value}"></label>`,
        )
        .join("");
      $("#effect-layer").checked = tonal.has(current);
      $("#effect-layer").disabled = editing || !tonal.has(current);
      $("#effect-note").textContent = tonal.has(current)
        ? editing
          ? "Updates this adjustment layer with its existing mask and opacity."
          : "Editable adjustment layers affect the visible layers below. A selection becomes the layer mask."
        : "Filter results are new pixel layers. This is a scaled preview; filter radii may look different at full size. Effects named “style” are approximations.";
      for (const input of $("#effect-fields").querySelectorAll("input"))
        input.oninput = () => {
          input.previousElementSibling.value = input.value;
          paintPreview();
        };
      paintPreview();
    }
    $("#effect-choice").value = current;
    $("#effect-choice").onchange = fields;
    fields();
    $("#effect-apply").textContent = editing
      ? "Update adjustment"
      : "Apply to a new layer";
    $("#effect-apply").onclick = async () => {
      const button = $("#effect-apply");
      button.disabled = true;
      try {
        const effect = validateEffect(settings());
        if ($("#effect-layer").checked) {
          commit(() => {
            if (editing) active.effect = effect;
            else {
              const l = newLayer(EFFECTS[current].name);
              l.kind = "adjustment";
              l.effect = effect;
              if (s().selection) l.mask = selectedMask();
              s().layers.unshift(l);
              api.replaceState({ activeId: l.id });
            }
          });
        } else {
          const { canvas } = s(),
            source = compositeLayers(s().layers, canvas.width, canvas.height)
              .getContext("2d")
              .getImageData(0, 0, canvas.width, canvas.height),
            pixels = await runWorker(source.data, canvas.width, canvas.height, {
              effect,
            });
          commit(() => {
            const l = newLayer(EFFECTS[current].name);
            l.canvas
              .getContext("2d")
              .putImageData(
                new ImageData(pixels, canvas.width, canvas.height),
                0,
                0,
              );
            if (s().selection) l.mask = selectedMask();
            s().layers.unshift(l);
            api.replaceState({ activeId: l.id });
          });
        }
        $("#modal").close();
      } catch (error) {
        $("#effect-error").textContent = error.message;
      } finally {
        button.disabled = false;
      }
    };
  }
  function creative(type) {
    dialog(
      type === "panosphere" ? "Create a panosphere" : "Create a kaleidoscope",
      `${type === "kaleidoscope" ? number("segments", "Mirrored segments", 8, 2, 24) : "<p>Maps the visible image into polar coordinates. A wide panorama gives the most natural little-planet result.</p>"}<p>The result is a new pixel layer; originals stay underneath.</p>`,
      async (v) => {
        const { canvas } = s(),
          data = canvas
            .getContext("2d")
            .getImageData(0, 0, canvas.width, canvas.height),
          pixels = await runWorker(data.data, canvas.width, canvas.height, {
            creative: type,
            segments: v.segments || 8,
          });
        commit(() => {
          const l = newLayer(
            type === "panosphere" ? "Panosphere" : "Kaleidoscope",
          );
          l.canvas
            .getContext("2d")
            .putImageData(
              new ImageData(pixels, canvas.width, canvas.height),
              0,
              0,
            );
          s().layers.unshift(l);
          api.replaceState({ activeId: l.id });
        });
      },
    );
  }
  let brushSettings = { ...brushDefaults },
    brushCarry = 0,
    brushFresh = true,
    customBrushTip = null;
  const savedBrushes = (() => {
    try {
      return JSON.parse(localStorage.getItem("prism-brush-presets") || "{}");
    } catch {
      return {};
    }
  })();
  function brushDialog() {
    dialog(
      "Brush dynamics",
      `<label>Preset <select name="preset" id="advanced-preset"><option>Current</option>${Object.keys(
        { ...brushPresets, ...savedBrushes },
      )
        .map((_, i) => `<option value="${i}"></option>`)
        .join(
          "",
        )}</select></label>${number("spacing", "Spacing (% of diameter)", brushSettings.spacing * 100, 1, 300)}${number("scatter", "Scatter (% of diameter)", brushSettings.scatter * 100, 0, 400)}${number("sizeJitter", "Size jitter (%)", brushSettings.sizeJitter * 100, 0, 95)}${number("angle", "Angle", brushSettings.angle, -180, 180)}${number("angleJitter", "Angle jitter", brushSettings.angleJitter, 0, 180)}${number("roundness", "Roundness (%)", brushSettings.roundness * 100, 5, 100)}<label>Tip <select name="tip"><option value="round">Round</option><option value="grain">Charcoal grain</option><option value="leaf">Leaf</option><option value="custom">Imported PNG tip</option></select></label><label><input name="pressure" type="checkbox" ${brushSettings.pressure ? "checked" : ""}>Pen pressure controls size and flow</label><label><input name="tilt" type="checkbox" ${brushSettings.tilt ? "checked" : ""}>Pen tilt controls angle</label><label>Custom tip (PNG, black marks on white or transparency)<input id="brush-tip-file" type="file" accept="image/png"></label><label>Save preset name <input name="saveName" maxlength="60"></label><p>Built-in tips and saved settings work offline. Imported tip images are kept for this session.</p>`,
      async (v) => {
        let tip = customBrushTip;
        const file = $("#brush-tip-file").files[0];
        if (file) {
          if (file.size > 2_000_000)
            throw new Error("Use a PNG tip smaller than 2 MB.");
          const img = await loadFile(file);
          if (img.width > 1024 || img.height > 1024)
            throw new Error("Tip dimensions must be at most 1024 pixels.");
          tip = createCanvas(img.width, img.height);
          const c = tip.getContext("2d");
          c.drawImage(img, 0, 0);
          const pixels = c.getImageData(0, 0, tip.width, tip.height);
          for (let i = 0; i < pixels.data.length; i += 4) {
            pixels.data[i + 3] *=
              (255 -
                (pixels.data[i] + pixels.data[i + 1] + pixels.data[i + 2]) /
                  3) /
              255;
            pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = 255;
          }
          c.putImageData(pixels, 0, 0);
        }
        if (v.tip === "custom" && !tip)
          throw new Error("Import a PNG tip first.");
        customBrushTip = tip;
        brushSettings = {
          spacing: v.spacing / 100,
          scatter: v.scatter / 100,
          sizeJitter: v.sizeJitter / 100,
          angle: v.angle,
          angleJitter: v.angleJitter,
          roundness: v.roundness / 100,
          tip: v.tip,
          pressure: v.pressure,
          tilt: v.tilt,
        };
        if (v.saveName.trim()) {
          if (
            Object.keys(savedBrushes).length >= 30 &&
            !savedBrushes[v.saveName.trim()]
          )
            throw new Error("Up to 30 presets can be saved.");
          savedBrushes[v.saveName.trim()] = { ...brushSettings };
          localStorage.setItem(
            "prism-brush-presets",
            JSON.stringify(savedBrushes),
          );
        }
      },
    );
    const presets = Object.entries({ ...brushPresets, ...savedBrushes }),
      select = $("#advanced-preset");
    for (let i = 0; i < presets.length; i++)
      select.options[i + 1].textContent = presets[i][0];
    const form = $("#book-form");
    form.elements.tip.value = brushSettings.tip;
    select.onchange = () => {
      const preset = presets[Number(select.value)]?.[1];
      if (!preset) return;
      for (const k of ["spacing", "scatter", "sizeJitter", "roundness"])
        form.elements[k].value = preset[k] * 100;
      for (const k of ["angle", "angleJitter", "tip"])
        form.elements[k].value = preset[k];
      for (const k of ["pressure", "tilt"])
        form.elements[k].checked = preset[k];
    };
  }
  function paint(a, b) {
    const { active: l, canvas, selection, tool } = s();
    if (!l) return;
    if (l.kind === "adjustment" && editingMask !== l.id) {
      api.toast(
        "Edit the adjustment settings or its mask; it contains no raster pixels.",
      );
      return;
    }
    const radius = (Number($("#brush-size").value) || 30) / 2,
      opacity =
        (((Number($("#brush-opacity").value) || 100) / 100) *
          (Number($("#brush-flow").value) || 100)) /
        100,
      hardness = Math.max(
        0,
        Math.min(1, Number($("#brush-hardness").value ?? 100) / 100),
      );
    const maskEdit = editingMask === l.id && l.mask,
      target = maskEdit ? { ...l, canvas: l.mask } : l;
    const hex = $("#color").value,
      gray =
        (parseInt(hex.slice(1, 3), 16) +
          parseInt(hex.slice(3, 5), 16) +
          parseInt(hex.slice(5, 7), 16)) /
        3;
    const erase = tool === "Eraser" || (maskEdit && gray < 128);
    drawSelected(
      target,
      selection,
      canvas.width,
      canvas.height,
      (c) => {
        c.globalAlpha = opacity;
        c.strokeStyle = maskEdit ? "white" : hex;
        c.lineCap = "round";
        c.lineJoin = "round";
        c.lineWidth = radius * 2;
        if (hardness < 1) {
          c.filter = `blur(${Math.max(0.1, radius * (1 - hardness) * 0.45)}px)`;
          c.lineWidth = Math.max(1, radius * 2 * (0.6 + 0.4 * hardness));
        }
        if (tool === "Clone brush" && canvas.clonePoint) {
          const source = retouching?.clone || canvas,
            origin = retouching?.start || a;
          c.beginPath();
          c.arc(b.x, b.y, radius, 0, Math.PI * 2);
          c.clip();
          c.drawImage(
            source,
            b.x - (canvas.clonePoint.x + b.x - origin.x),
            b.y - (canvas.clonePoint.y + b.y - origin.y),
          );
        } else {
          c.filter = "none";
          const spaced = stampPositions(
            a,
            b,
            Math.max(0.5, radius * 2 * brushSettings.spacing),
            brushCarry,
          );
          brushCarry = spaced.carry;
          const points = brushFresh ? [a, ...spaced.points] : spaced.points;
          brushFresh = false;
          let tip = customBrushTip;
          if (tip && brushSettings.tip === "custom") {
            tip = cloneCanvas(tip);
            const tc = tip.getContext("2d");
            tc.globalCompositeOperation = "source-in";
            tc.fillStyle = maskEdit ? "white" : hex;
            tc.fillRect(0, 0, tip.width, tip.height);
          }
          for (const p of points)
            drawBrushStamp(
              c,
              p,
              radius * 2,
              maskEdit ? "#ffffff" : hex,
              opacity,
              hardness,
              brushSettings,
              tip,
            );
        }
      },
      erase ? "destination-out" : "source-over",
      maskEdit ? (tool === "Eraser" ? 0 : gray / 255) : undefined,
    );
    api.render();
  }
  function retouch(point) {
    const { active: l, canvas, tool } = s();
    if (!l || l.kind === "adjustment") return;
    const r = Math.round((Number($("#brush-size").value) || 30) / 2),
      x = Math.max(0, Math.floor(point.x - l.x - r)),
      y = Math.max(0, Math.floor(point.y - l.y - r)),
      w = Math.min(l.canvas.width - x, 2 * r + 1),
      h = Math.min(l.canvas.height - y, 2 * r + 1);
    if (w < 1 || h < 1) return;
    const ctx = l.canvas.getContext("2d"),
      image = ctx.getImageData(x, y, w, h),
      data = image.data,
      mask = retouching?.selectionAlpha || null,
      amount =
        ((Number($("#brush-opacity").value) || 100) / 100) *
        ((Number($("#brush-flow").value) || 100) / 100) *
        0.2,
      hardness = Math.max(
        0,
        Math.min(1, Number($("#brush-hardness").value) / 100),
      );
    const filtered =
      tool === "Blur brush"
        ? processPixels(data, w, h, { type: "blur", radius: 2 })
        : tool === "Sharpen brush"
          ? processPixels(data, w, h, {
              type: "sharpen",
              radius: 1,
              amount: 100,
              threshold: 1,
            })
          : null;
    const old = tool === "History brush" ? retouching?.historyPixels : null;
    const ring = [0, 0, 0];
    let samples = 0;
    if (tool === "Repair brush")
      for (let yy = 0; yy < h; yy++)
        for (let xx = 0; xx < w; xx++)
          if (Math.hypot(xx - w / 2, yy - h / 2) > r * 0.8) {
            const i = (yy * w + xx) * 4;
            for (let c = 0; c < 3; c++) ring[c] += data[i + c];
            samples++;
          }
    for (let yy = 0; yy < h; yy++)
      for (let xx = 0; xx < w; xx++) {
        const wx = xx + x + l.x,
          wy = yy + y + l.y,
          distance = Math.hypot(wx - point.x, wy - point.y) / Math.max(1, r);
        if (distance > 1) continue;
        const i = (yy * w + xx) * 4,
          global = (Math.floor(wy) * canvas.width + Math.floor(wx)) * 4,
          strength =
            (distance <= hardness
              ? 1
              : (1 - distance) / Math.max(0.001, 1 - hardness)) *
            amount *
            (mask
              ? (mask[Math.floor(wy) * canvas.width + Math.floor(wx)] || 0) /
                255
              : 1),
          gray = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        for (let c = 0; c < 3; c++) {
          const original = data[i + c];
          let edited = original;
          if (tool === "Dodge") edited = original + (255 - original) * 0.5;
          else if (tool === "Burn") edited = original * 0.5;
          else if (tool === "Sponge")
            edited =
              gray +
              (original - gray) *
                ($("#sponge-mode").value === "desaturate" ? 0.2 : 1.8);
          else if (filtered) edited = filtered[i + c];
          else if (tool === "History brush" && old) edited = old[global + c];
          else if (tool === "Repair brush")
            edited = ring[c] / Math.max(1, samples);
          data[i + c] = original * (1 - strength) + edited * strength;
        }
        if (tool === "History brush" && old)
          data[i + 3] =
            data[i + 3] * (1 - strength) + old[global + 3] * strength;
      }
    ctx.putImageData(image, x, y);
    api.render();
  }
  let pathPoints = [],
    pathLayer = null,
    pathDrag = -1,
    pathHandle = null,
    pathNew = false,
    pathClosed = true,
    stroke = null,
    quickOverlay = null,
    lastQuickSelection = null;
  const pixelTools = new Set([
    "Dodge",
    "Burn",
    "Sponge",
    "Blur brush",
    "Sharpen brush",
    "Repair brush",
    "History brush",
  ]);
  function world(e) {
    const r = s().canvas.getBoundingClientRect();
    return {
      x: Math.max(
        0,
        Math.min(s().canvas.width - 1, (e.clientX - r.left) / s().zoom),
      ),
      y: Math.max(
        0,
        Math.min(s().canvas.height - 1, (e.clientY - r.top) / s().zoom),
      ),
    };
  }
  function drawQuick(point, erase = false) {
    const { canvas } = s(),
      mask = selectedMask(),
      ctx = mask.getContext("2d");
    if (!s().selection) ctx.clearRect(0, 0, mask.width, mask.height);
    ctx.globalCompositeOperation = erase ? "destination-out" : "source-over";
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(
      point.x,
      point.y,
      (Number($("#brush-size").value) || 30) / 2,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    setSelection(mask);
  }
  s().canvas.addEventListener(
    "pointerdown",
    (e) => {
      brushCarry = 0;
      brushFresh = true;
      const { tool, active: l } = s(),
        p = world(e);
      if (tool === "Clone brush") {
        retouching = { start: p, clone: cloneCanvas(s().canvas) };
        return;
      }
      if (tool === "Quick selection") {
        e.stopImmediatePropagation();
        stroke = { start: p, last: p, tool };
        s().canvas.setPointerCapture(e.pointerId);
        quickSelect(p, e.altKey);
        return;
      }
      if (tool === "Magic Wand") {
        e.stopImmediatePropagation();
        wandAt(p);
        return;
      }
      if (tool === "Pen path") {
        e.stopImmediatePropagation();
        pathHandle = null;
        pathNew = false;
        for (let i = 0; i < pathPoints.length; i++)
          for (const key of ["in", "out"])
            if (
              pathPoints[i][key] &&
              Math.hypot(
                pathPoints[i][key].x - p.x,
                pathPoints[i][key].y - p.y,
              ) <
                9 / s().zoom
            ) {
              pathDrag = i;
              pathHandle = key;
            }
        if (!pathHandle) {
          pathDrag = pathPoints.findIndex(
            (a) => Math.hypot(a.x - p.x, a.y - p.y) < 9 / s().zoom,
          );
          if (pathDrag >= 0 && e.ctrlKey) {
            pathPoints.splice(pathDrag, 1);
            pathDrag = -1;
            sync();
            return;
          }
          if (pathDrag >= 0 && e.altKey) {
            delete pathPoints[pathDrag].in;
            delete pathPoints[pathDrag].out;
            sync();
            return;
          }
          if (pathDrag === 0 && pathPoints.length >= 3 && e.shiftKey) {
            pathClosed = true;
            sync();
            return;
          }
          if (pathDrag < 0) {
            pathPoints.push(p);
            pathDrag = pathPoints.length - 1;
            pathNew = true;
          }
        }
        s().canvas.setPointerCapture(e.pointerId);
        sync();
        return;
      }
      if (
        !pixelTools.has(tool) &&
        tool !== "Gradient" &&
        !(quickMask && ["Brush", "Eraser"].includes(tool))
      )
        return;
      e.stopImmediatePropagation();
      if (!quickMask && (!l || l.locked || l.kind === "adjustment"))
        return api.toast("Select an unlocked pixel layer");
      if (!quickMask) api.save();
      stroke = { start: p, last: p, tool };
      s().canvas.setPointerCapture(e.pointerId);
      retouching = {
        selectionAlpha: s().selection ? getMaskAlpha(selectedMask()) : null,
      };
      if (tool === "History brush") {
        const old = s().history.find(
            (entry) =>
              entry.width === s().canvas.width &&
              entry.height === s().canvas.height &&
              entry.name === $("#document-name").textContent,
          ),
          source =
            historySource ||
            (old
              ? compositeLayers(old.layers, old.width, old.height)
              : s().canvas);
        retouching.historyPixels = source
          .getContext("2d")
          .getImageData(0, 0, s().canvas.width, s().canvas.height).data;
      }
      if (quickMask) drawQuick(p, tool === "Eraser");
      else if (pixelTools.has(tool)) retouch(p);
    },
    true,
  );
  s().canvas.addEventListener(
    "pointermove",
    (e) => {
      if (s().tool === "Pen path" && pathDrag >= 0 && e.buttons) {
        e.stopImmediatePropagation();
        const p = world(e),
          a = pathPoints[pathDrag];
        if (pathHandle || pathNew) {
          const key = pathHandle || "out";
          a[key] = p;
          if (!e.altKey)
            a[key === "out" ? "in" : "out"] = {
              x: 2 * a.x - p.x,
              y: 2 * a.y - p.y,
            };
        } else moveAnchor(a, p.x, p.y);
        sync();
        return;
      }
      if (!stroke) return;
      e.stopImmediatePropagation();
      const p = world(e);
      if (stroke.tool === "Quick selection") {
        if (Math.hypot(p.x - stroke.last.x, p.y - stroke.last.y) > 8) {
          quickSelect(p, e.altKey);
          stroke.last = p;
        }
        return;
      }
      if (quickMask) drawQuick(p, stroke.tool === "Eraser");
      else if (pixelTools.has(stroke.tool)) {
        const distance = Math.hypot(p.x - stroke.last.x, p.y - stroke.last.y),
          count = Math.max(
            1,
            Math.ceil(
              distance / Math.max(1, Number($("#brush-size").value) / 4),
            ),
          );
        for (let i = 1; i <= count; i++)
          retouch({
            x: stroke.last.x + ((p.x - stroke.last.x) * i) / count,
            y: stroke.last.y + ((p.y - stroke.last.y) * i) / count,
          });
      }
      stroke.last = p;
    },
    true,
  );
  s().canvas.addEventListener(
    "pointerup",
    (e) => {
      if (s().tool === "Pen path" && pathDrag >= 0) {
        e.stopImmediatePropagation();
        pathDrag = -1;
        return;
      }
      if (!stroke) return;
      e.stopImmediatePropagation();
      if (stroke.tool === "Gradient") {
        const l = s().active,
          a = stroke.start,
          b = world(e);
        drawSelected(
          l,
          s().selection,
          s().canvas.width,
          s().canvas.height,
          (c) => {
            const g =
              $("#gradient-kind").value === "radial"
                ? c.createRadialGradient(
                    a.x,
                    a.y,
                    0,
                    a.x,
                    a.y,
                    Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
                  )
                : c.createLinearGradient(
                    a.x,
                    a.y,
                    b.x === a.x && b.y === a.y ? b.x + 1 : b.x,
                    b.y,
                  );
            g.addColorStop(0, $("#color").value);
            g.addColorStop(1, $("#gradient-end").value);
            c.fillStyle = g;
            c.fillRect(0, 0, s().canvas.width, s().canvas.height);
          },
        );
      }
      stroke = null;
      refresh();
    },
    true,
  );
  s().canvas.addEventListener(
    "pointercancel",
    () => {
      stroke = null;
      pathDrag = -1;
    },
    true,
  );
  function finishPath() {
    if (pathPoints.length < 3)
      return api.toast("Add at least three path points");
    commit(() => {
      const l = pathLayer || newLayer("Gradient path");
      if (!pathLayer) s().layers.unshift(l);
      else
        l.canvas
          .getContext("2d")
          .clearRect(0, 0, l.canvas.width, l.canvas.height);
      const c = l.canvas.getContext("2d"),
        xs = pathPoints.map((p) => p.x),
        ys = pathPoints.map((p) => p.y),
        g = c.createLinearGradient(
          Math.min(...xs),
          Math.min(...ys),
          Math.max(...xs) || 1,
          Math.max(...ys) || 1,
        );
      g.addColorStop(0, $("#color").value);
      g.addColorStop(1, $("#gradient-end").value);
      c.fillStyle = g;
      c.save();
      c.translate(-l.x, -l.y);
      c.beginPath();
      tracePath(c, pathPoints, pathClosed);
      c.fill();
      c.restore();
      l.path = transformPath(pathPoints, (p) => ({
        x: p.x - l.x,
        y: p.y - l.y,
      }));
      l.pathClosed = pathClosed;
      api.replaceState({ activeId: l.id });
      pathPoints = [];
      pathLayer = null;
    });
    sync();
  }
  function pattern() {
    dialog(
      "Craft pattern maker",
      `<label class="book-field"><span>Pattern</span><select name="pattern"><option value="dots">Polka dots</option><option value="stripes">Diagonal stripes</option><option value="checks">Checkerboard</option></select></label>${number("size", "Repeat size (px)", 40, 8, 300)}<p>Uses the foreground and gradient-end colours. Creates original repeat artwork on a new layer for printing or export.</p>`,
      (v) => {
        commit(() => {
          const tile = createCanvas(v.size, v.size),
            ctx = tile.getContext("2d");
          ctx.fillStyle = $("#gradient-end").value;
          ctx.fillRect(0, 0, v.size, v.size);
          ctx.fillStyle = $("#color").value;
          if (v.pattern === "dots") {
            ctx.beginPath();
            ctx.arc(v.size / 2, v.size / 2, v.size / 5, 0, Math.PI * 2);
            ctx.fill();
          } else if (v.pattern === "checks") {
            ctx.fillRect(0, 0, v.size / 2, v.size / 2);
            ctx.fillRect(v.size / 2, v.size / 2, v.size / 2, v.size / 2);
          } else {
            ctx.strokeStyle = $("#color").value;
            ctx.lineWidth = v.size / 3;
            for (const shift of [-v.size, 0, v.size]) {
              ctx.beginPath();
              ctx.moveTo(shift, 0);
              ctx.lineTo(shift + v.size, v.size);
              ctx.stroke();
            }
          }
          const l = newLayer("Craft pattern"),
            c = l.canvas.getContext("2d");
          c.fillStyle = c.createPattern(tile, "repeat");
          c.fillRect(0, 0, l.canvas.width, l.canvas.height);
          s().layers.unshift(l);
          api.replaceState({ activeId: l.id });
        });
      },
    );
  }
  function localRemoval(move = false) {
    if (!s().selection) return api.toast("Select the object or area first");
    api.chooseTool("Generative fill");
    $("#prompt").value = move
      ? "Reconstruct the selected background naturally, removing the selected object. Preserve all unselected details."
      : "Remove the object inside the selected region and fill it with a natural continuation of the surrounding background. Preserve everything outside the selection.";
    api.toast(
      "Ready for the local AI engine. Choose Generate; a separate model must be running.",
    );
  }
  let gallery = [];
  function imageBrowser() {
    api.modal(
      "Local image browser",
      '<p>Select your own images to browse, rate and tag during this session. No folder scan, cloud upload or permanent catalogue is created.</p><input id="gallery-files" type="file" accept="image/*" multiple><input id="gallery-search" class="ai-address" placeholder="Filter by file name or tag" aria-label="Search local images"><div id="gallery-items"></div><div id="gallery-error" class="book-error"></div>',
    );
    function draw() {
      const q = $("#gallery-search").value.toLowerCase();
      $("#gallery-items").replaceChildren();
      for (const item of gallery.filter((a) =>
        (a.file.name + " " + a.tag).toLowerCase().includes(q),
      )) {
        const card = document.createElement("article");
        card.className = "gallery-card";
        const image = document.createElement("img");
        image.src = item.thumbnail;
        image.alt = item.file.name;
        const name = document.createElement("strong");
        name.textContent = item.file.name;
        const tag = document.createElement("input");
        tag.placeholder = "Tag";
        tag.value = item.tag;
        tag.maxLength = 100;
        tag.onchange = () => {
          item.tag = tag.value;
        };
        const rate = document.createElement("button");
        rate.className = "outline";
        rate.textContent = "★".repeat(item.rating) || "Rate";
        rate.onclick = () => {
          item.rating = (item.rating + 1) % 6;
          draw();
        };
        const open = document.createElement("button");
        open.className = "outline";
        open.textContent = "Open";
        open.onclick = () => {
          $("#modal").close();
          const transfer = new DataTransfer();
          transfer.items.add(item.file);
          $("#file-input").files = transfer.files;
          $("#file-input").dispatchEvent(new Event("change"));
        };
        const place = document.createElement("button");
        place.className = "outline";
        place.textContent = "Place as layer";
        place.onclick = () => {
          $("#modal").close();
          placeImage(item.file).catch((error) => api.toast(error.message));
        };
        card.append(image, name, tag, rate, open, place);
        $("#gallery-items").append(card);
      }
    }
    $("#gallery-files").onchange = async (event) => {
      try {
        if (gallery.length + event.target.files.length > 50)
          throw new Error("Select up to 50 images per session");
        for (const file of event.target.files) {
          if (file.size > 50_000_000)
            throw new Error("Image browser files must be under 50 MB");
          const image = await loadFile(file),
            thumbnail = createCanvas(160, 100),
            ctx = thumbnail.getContext("2d"),
            ratio = Math.min(160 / image.width, 100 / image.height);
          ctx.drawImage(
            image,
            (160 - image.width * ratio) / 2,
            (100 - image.height * ratio) / 2,
            image.width * ratio,
            image.height * ratio,
          );
          gallery.push({
            file,
            thumbnail: thumbnail.toDataURL("image/png"),
            rating: 0,
            tag: "",
          });
        }
        draw();
      } catch (error) {
        $("#gallery-error").textContent = error.message;
      }
      event.target.value = "";
    };
    $("#gallery-search").oninput = draw;
    draw();
  }
  function quickSelect(point, subtract = false) {
    const { canvas } = s(),
      data = canvas
        .getContext("2d")
        .getImageData(0, 0, canvas.width, canvas.height),
      found = wandMask(
        data.data,
        canvas.width,
        canvas.height,
        point.x,
        point.y,
        Number($("#wand-tolerance").value),
        true,
      ),
      current = s().selection
        ? getMaskAlpha(selectedMask())
        : new Uint8ClampedArray(found.length);
    for (let i = 0; i < found.length; i++)
      current[i] = subtract
        ? Math.min(current[i], 255 - found[i])
        : Math.max(current[i], found[i]);
    setSelection(alphaMask(current, canvas.width, canvas.height));
  }
  function refineSelection() {
    if (!s().selection) return api.toast("Make a selection first");
    dialog(
      "Refine selection edges",
      `${number("radius", "Feather radius (px)", 0, 0, 30)}${number("contrast", "Edge contrast (%)", 0, 0, 100)}${number("shift", "Grow / contract (px)", 0, -30, 30)}<p>Refines your existing pixel mask. For automatic subject/hair estimation, use Select subject and refine hair in the Select menu. This dialog edits the current mask manually.</p>`,
      async (values) => {
        const mask = selectedMask(),
          alpha = await runWorker(getMaskAlpha(mask), mask.width, mask.height, {
            refine: values,
          });
        setSelection(alphaMask(alpha, mask.width, mask.height));
      },
    );
  }
  let inferenceBusy = false;
  async function removeWithModel() {
    if (!s().selection) return api.toast("Select the object to remove first");
    if (inferenceBusy) return api.toast("A local inference is already running");
    inferenceBusy = true;
    const before = s(),
      source = cloneCanvas(before.canvas),
      mask = selectedMask(),
      ids = before.layers.map((l) => l.id).join(",");
    api.toast("MI-GAN is reconstructing the selected area locally…");
    try {
      const output = await inpaint(source, mask);
      if (
        s().canvas.width !== source.width ||
        s().canvas.height !== source.height ||
        s()
          .layers.map((l) => l.id)
          .join(",") !== ids ||
        s().canvas.toDataURL() !== source.toDataURL()
      )
        throw new Error(
          "Document structure changed during inference. Retry on the current document.",
        );
      commit(() => {
        const l = newLayer("MI-GAN content-aware removal");
        l.canvas = output;
        s().layers.unshift(l);
        api.replaceState({ activeId: l.id, selection: null });
      });
      api.toast("Local neural inpainting complete");
    } catch (e) {
      api.toast("Inpainting failed: " + e.message);
    } finally {
      inferenceBusy = false;
    }
  }
  function contentAwareMove() {
    if (!s().selection) return api.toast("Select the object first");
    dialog(
      "Move selected object · local AI",
      `${number("x", "Horizontal offset (px)", 50, -8000, 8000)}${number("y", "Vertical offset (px)", 0, -8000, 8000)}<p>The local AI engine reconstructs the source region. The selected original pixels are placed above the reconstructed background at the chosen offset. The bundled MI-GAN model runs on CPU. Prompt-guided Stable Diffusion is also available through a separately installed local engine.</p><label>Engine <select name="engine"><option value="builtin">Bundled MI-GAN (offline)</option><option value="external">Local Stable Diffusion server</option></select></label>`,
      async (values) => {
        const { canvas } = s(),
          w = canvas.width,
          h = canvas.height,
          originalPreview = canvas.toDataURL(),
          raw = compositeLayers(s().layers, w, h),
          object = cloneCanvas(raw),
          selection = selectedMask(),
          ctx = object.getContext("2d");
        ctx.globalCompositeOperation = "destination-in";
        ctx.drawImage(selection, 0, 0);
        const alpha = getMaskAlpha(selection),
          mask = createCanvas(w, h),
          m = mask.getContext("2d"),
          image = m.createImageData(w, h);
        for (let i = 0; i < alpha.length; i++) {
          image.data[i * 4] =
            image.data[i * 4 + 1] =
            image.data[i * 4 + 2] =
              alpha[i];
          image.data[i * 4 + 3] = 255;
        }
        m.putImageData(image, 0, 0);
        const payload = {
          endpoint:
            localStorage.getItem("prism-local-ai-url") ||
            "http://127.0.0.1:7860",
          prompt:
            "Remove the selected object and reconstruct its original background naturally. Preserve all other unselected details.",
          image: raw.toDataURL("image/png"),
          mask: mask.toDataURL("image/png"),
          width: w,
          height: h,
        };
        let result;
        if (values.engine === "builtin") {
          api.toast("Running local MI-GAN inpainting…");
          result = {
            image: (await inpaint(raw, selection)).toDataURL("image/png"),
          };
        } else if (api.desktop) result = await api.desktop.generate(payload);
        else
          result = await (
            await fetch("/api/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
              signal: AbortSignal.timeout(600000),
            })
          ).json();
        if (result.error) throw new Error(result.error);
        const background = new Image();
        await new Promise((resolve, reject) => {
          background.onload = resolve;
          background.onerror = () =>
            reject(new Error("Cannot decode local AI result"));
          background.src = result.image;
        });
        if (
          canvas.width !== w ||
          canvas.height !== h ||
          canvas.toDataURL() !== originalPreview
        )
          throw new Error(
            "The document changed during generation; retry the move",
          );
        commit(() => {
          const bg = newLayer("Reconstructed background");
          bg.canvas.getContext("2d").drawImage(background, 0, 0, w, h);
          const moved = newLayer("Moved object");
          moved.canvas = object;
          moved.x = values.x;
          moved.y = values.y;
          s().layers.unshift(moved, bg);
          api.replaceState({ activeId: moved.id, selection: null });
        });
      },
    );
  }

  const lessons = [
    [
      "Getting started",
      "26–42",
      "Document creation, image/canvas sizing, place, clipboard, PNG/JPEG/WebP/PDF export, shortcuts.",
      "Implemented core workflow",
      newDocument,
    ],
    [
      "Basic corrections",
      "44–60",
      "Auto levels, crop, affine transform, gradients and bundled LibRaw Camera RAW development. Content-aware recompose/seam carving remains open.",
      "Partial",
      () => effectsDialog("auto"),
    ],
    [
      "Layers",
      "62–74",
      "Nested isolated groups, group visibility/opacity/blends, layer masks, merge/flatten and editable adjustment layers. Smart objects remain unsupported.",
      "Partial",
      () => api.chooseTool("Move"),
    ],
    [
      "Colour & tone",
      "76–84",
      "Colour balance, levels, sponge, saturation and masked colour isolation.",
      "Implemented core workflow",
      () => effectsDialog("levels"),
    ],
    [
      "Retouching",
      "86–98",
      "Clone, unsharp mask, dodge/burn, local repair and masked adjustments. Content-aware removal/move use bundled MI-GAN inference; prompt-guided generation can use local Stable Diffusion.",
      "Partial / local model for AI",
      () => effectsDialog("sharpen"),
    ],
    [
      "Adjustments",
      "100–112",
      "Editable masked levels, exposure, curves, black & white, channel mixer and hue/saturation layers.",
      "Implemented core workflow",
      () => effectsDialog("curves"),
    ],
    [
      "Selections",
      "114–126",
      "Lasso, wand, additive/subtractive Quick selection, Quick Mask, invert, feather and manual edge refinements. Bundled U²-Net subject selection and colour-guided soft hair-edge refinement are available; inspect difficult hair and backgrounds manually.",
      "Partial",
      () => api.chooseTool("Magic Wand"),
    ],
    [
      "Brushes",
      "128–140",
      "Size/opacity/flow/hardness, stamped presets, PNG tips, spacing, scatter, size/angle jitter, roundness, pen pressure/tilt and saved settings. Adobe ABR and simulated bristle physics remain unsupported.",
      "Partial",
      () => api.chooseTool("Brush"),
    ],
    [
      "Filters",
      "142–154",
      "Previewed blur, motion/spin/tilt-style blur, radial lighting, median noise reduction and cutout-style posterization. Adobe Blur Gallery/path blur algorithms are not reproduced.",
      "Partial",
      () => effectsDialog("blur"),
    ],
    [
      "Creative projects",
      "156–173",
      "Little-planet remap, photos + paths + blending, craft patterns, editable cubic Bézier gradient paths and mirrored kaleidoscope. These are reusable tools, not copies of the book artwork.",
      "Implemented building blocks",
      () => creative("kaleidoscope"),
    ],
    [
      "Glossary / Adobe services",
      "174–180",
      "Terminology reference. Elements Organizer and Adobe account/cloud services are not part of this offline editor.",
      "Reference / external services",
      () =>
        api.toast(
          "Use local files and Save project. No Adobe account is needed.",
        ),
    ],
  ];
  function learning() {
    api.modal(
      "Beginner workshop · implementation checklist",
      '<p>Choose a topic to practise with your own images. Statuses distinguish available basics from remaining specialist features. Topics follow Photoshop for Beginners, 11th edition.</p><div id="lesson-list"></div>',
    );
    for (const [title, pages, summary, status, run] of lessons) {
      const row = document.createElement("article");
      row.className = "lesson-row";
      const h = document.createElement("h3");
      h.textContent = title + " · pp. " + pages;
      const badge = document.createElement("strong");
      badge.textContent = status;
      const p = document.createElement("p");
      p.textContent = summary;
      const b = document.createElement("button");
      b.className = "outline";
      b.textContent = "Practise";
      b.onclick = () => {
        $("#modal").close();
        run();
      };
      row.append(h, badge, p, b);
      $("#lesson-list").append(row);
    }
  }
  function sync() {
    const st = s();
    for (const row of document.querySelectorAll(".layer-row"))
      row
        .querySelector(".mask-thumb")
        ?.classList.toggle(
          "active",
          Number(row.dataset.id) === editingMask &&
            st.active?.id === editingMask,
        );
    if (
      editingMask === st.active?.id &&
      st.active?.mask &&
      ["Brush", "Eraser", "Pen brush", "Clone brush"].includes(st.tool)
    )
      $("#paint-help").textContent =
        "Layer mask · white reveals, black conceals";
    if (quickMask) {
      if (!quickOverlay) {
        quickOverlay = createCanvas(st.canvas.width, st.canvas.height);
        quickOverlay.id = "quick-mask-overlay";
        Object.assign(quickOverlay.style, {
          position: "absolute",
          inset: "0",
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: "4",
        });
        $("#canvas-wrap").append(quickOverlay);
      }
      if (
        lastQuickSelection !== st.selection ||
        quickOverlay.width !== st.canvas.width ||
        quickOverlay.height !== st.canvas.height
      ) {
        quickOverlay.width = st.canvas.width;
        quickOverlay.height = st.canvas.height;
        const alpha = getMaskAlpha(selectedMask()),
          ctx = quickOverlay.getContext("2d"),
          image = ctx.createImageData(st.canvas.width, st.canvas.height);
        for (let i = 0; i < alpha.length; i++) {
          image.data[i * 4] = 255;
          image.data[i * 4 + 3] = (255 - alpha[i]) * 0.4;
        }
        ctx.putImageData(image, 0, 0);
        lastQuickSelection = st.selection;
      }
    } else if (quickOverlay) {
      quickOverlay.remove();
      quickOverlay = null;
      lastQuickSelection = null;
    }
    $("#wand-options").hidden = !["Magic Wand", "Quick selection"].includes(
      st.tool,
    );
    $("#retouch-options").hidden = st.tool !== "Sponge";
    $("#gradient-options").hidden = !["Gradient", "Pen path"].includes(st.tool);
    if (pixelTools.has(st.tool)) {
      $("#paint-options").hidden = false;
      $("#generic-options").hidden = true;
    }
    if (
      ["Magic Wand", "Quick selection", "Pen path", "Gradient"].includes(
        st.tool,
      )
    )
      $("#generic-options").hidden = true;
    $("#commit-path").hidden = st.tool !== "Pen path";
    if (pathPoints.length) {
      let overlay = $("#path-overlay");
      if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "path-overlay";
        $("#canvas-wrap").append(overlay);
      }
      overlay.innerHTML = `<svg viewBox="0 0 ${st.canvas.width} ${st.canvas.height}" width="100%" height="100%"><path d="${pathCommands(pathPoints, pathClosed)}" fill="none" stroke="#65b4ff" stroke-width="1.5" vector-effect="non-scaling-stroke"/>${pathPoints.map((p) => ["in", "out"].map((k) => (p[k] ? `<line x1="${p.x}" y1="${p.y}" x2="${p[k].x}" y2="${p[k].y}" stroke="#e6c178" stroke-width="${1 / st.zoom}"/><circle cx="${p[k].x}" cy="${p[k].y}" r="${3 / st.zoom}" fill="#e6c178"/>` : "")).join("") + `<rect x="${p.x - 4 / st.zoom}" y="${p.y - 4 / st.zoom}" width="${8 / st.zoom}" height="${8 / st.zoom}" fill="white" stroke="#2684d0" stroke-width="${1 / st.zoom}"/>`).join("")}</svg>`;
    } else $("#path-overlay")?.remove();
    const ppi = st.ppi || 72;
    $(".document-meta b").textContent = ppi + " pixels/inch";
    $(".color-profile").textContent = ppi + " ppi · RGB/8";
    const content = $("#paths-content");
    content.replaceChildren();
    const paths = st.layers.filter((l) => l.path?.length);
    if (!paths.length) {
      const p = document.createElement("p");
      p.textContent =
        "No saved paths. Use Pen path to add points; Enter fills with a gradient.";
      content.append(p);
    }
    for (const l of paths) {
      const b = document.createElement("button");
      b.className = "path-entry";
      b.textContent = l.name + " · " + l.path.length + " points";
      b.onclick = () => {
        pathPoints = transformPath(l.path, (p) => ({
          x: p.x + l.x,
          y: p.y + l.y,
        }));
        pathClosed = l.pathClosed !== false;
        pathLayer = l;
        api.chooseTool("Pen path");
        sync();
      };
      content.append(b);
    }
  }
  $(".generate-section").insertAdjacentHTML(
    "afterbegin",
    '<div class="bundled-ai"><span class="beta">BUILT-IN · OFFLINE CPU</span><button id="model-subject" class="outline full"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0116 0v3"/></svg> Select subject / hair</button><button id="model-remove" class="outline full"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 17L15 5l6 6L9 23H3zM11 9l6 6"/></svg> Remove selected object</button><p>Bundled U²-Net selection and MI-GAN reconstruction. Inspect fine edges and generated details.</p></div>',
  );
  $("#model-subject").onclick = () => automaticSubject(true);
  $("#model-remove").onclick = () => removeWithModel();
  api.menus.select.push(
    ["Select subject (local model)", () => automaticSubject(false)],
    ["Select subject and refine hair", () => automaticSubject(true)],
  );
  $("#file-input").accept +=
    ",.dng,.cr2,.cr3,.nef,.nrw,.arw,.raf,.rw2,.orf,.pef,.raw";
  const paintOptions = $("#paint-options");
  paintOptions.insertAdjacentHTML(
    "beforeend",
    `<button id="brush-dynamics" class="outline">Brush settings</button><label>Hardness <input id="brush-hardness" type="number" min="0" max="100" value="100"><span>%</span></label><label>Flow <input id="brush-flow" type="number" min="1" max="100" value="100"><span>%</span></label>`,
  );
  $(".current-tool").insertAdjacentHTML(
    "afterend",
    `<div class="tool-options" id="wand-options" hidden><label>Tolerance <input id="wand-tolerance" type="number" min="0" max="255" value="30"></label><label class="check"><input id="wand-contiguous" type="checkbox" checked>Contiguous</label></div><div class="tool-options" id="retouch-options" hidden><select id="sponge-mode" aria-label="Sponge mode"><option value="saturate">Saturate</option><option value="desaturate">Desaturate</option></select></div><div class="tool-options" id="gradient-options" hidden><select id="gradient-kind" aria-label="Gradient kind"><option value="linear">Linear</option><option value="radial">Radial</option></select><label>End <input id="gradient-end" type="color" value="#ffffff" aria-label="Gradient end colour"></label><button id="commit-path" class="outline" hidden>Fill path</button><button id="path-actions" class="outline">Path options</button></div>`,
  );
  $("#brush-dynamics").onclick = brushDialog;
  $("#commit-path").onclick = finishPath;
  $("#path-actions").onclick = () =>
    dialog(
      "Bézier path options",
      `<p>Click-drag to create smooth handles. Drag an anchor to move it; drag a handle to reshape. Alt-drag breaks handle symmetry. Alt-click removes handles, Ctrl-click deletes an anchor. Escape cancels the draft.</p><label><input name="closed" type="checkbox" ${pathClosed ? "checked" : ""}>Closed path</label>${number("segment", "Segment to split (1-based; 0 skips)", 0, 0, Math.max(0, pathPoints.length - (pathClosed ? 0 : 1)))}<label>Action <select name="action"><option value="draft">Keep editing</option><option value="stroke">Stroke with foreground</option><option value="selection">Make selection</option></select></label>`,
      (v) => {
        pathClosed = v.closed;
        if (v.segment > 0)
          pathPoints = splitSegment(pathPoints, Number(v.segment) - 1);
        if (v.action === "stroke" || v.action === "selection") {
          if (pathPoints.length < 2)
            throw new Error("Add at least two anchors.");
          if (v.action === "selection") {
            const mask = createCanvas(s().canvas.width, s().canvas.height),
              c = mask.getContext("2d");
            c.fillStyle = "white";
            c.beginPath();
            tracePath(c, pathPoints, true);
            c.fill();
            setSelection(mask);
          } else
            commit(() => {
              const l = pathLayer || newLayer("Bézier stroke");
              if (!pathLayer) s().layers.unshift(l);
              const c = l.canvas.getContext("2d");
              c.save();
              c.translate(-l.x, -l.y);
              c.strokeStyle = $("#color").value;
              c.lineWidth = Number($("#brush-size").value);
              c.lineCap = "round";
              c.beginPath();
              tracePath(c, pathPoints, pathClosed);
              c.stroke();
              c.restore();
              l.path = transformPath(pathPoints, (p) => ({
                x: p.x - l.x,
                y: p.y - l.y,
              }));
              l.pathClosed = pathClosed;
              api.replaceState({ activeId: l.id });
            });
        }
        sync();
      },
    );
  const blends = {
    darken: "Darken",
    lighten: "Lighten",
    "color-dodge": "Color Dodge",
    "color-burn": "Color Burn",
    "hard-light": "Hard Light",
    "soft-light": "Soft Light",
    difference: "Difference",
    exclusion: "Exclusion",
    hue: "Hue",
    saturation: "Saturation",
    color: "Color",
    luminosity: "Luminosity",
  };
  for (const [value, name] of Object.entries(blends)) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = name;
    $("#blend-mode").append(option);
  }
  $("#add-mask").onclick = () => report(setMask);
  $("#new-group").onclick = () =>
    group().catch((error) => api.toast(error.message));
  $("#layer-fx").onclick = () =>
    effectsDialog(s().active?.effect?.type || "levels");
  document.addEventListener(
    "keydown",
    (e) => {
      if (
        ["INPUT", "TEXTAREA", "SELECT"].includes(
          document.activeElement.tagName,
        ) ||
        $("#modal").open
      )
        return;
      const key = e.key.toLowerCase();
      if (e.ctrlKey || e.metaKey) {
        if (["c", "x", "v", "n", "t"].includes(key)) {
          e.preventDefault();
          e.stopImmediatePropagation();
          if (key === "c") report(() => copy(false, e.shiftKey));
          if (key === "x") report(() => copy(true));
          if (key === "v") paste().catch((error) => api.toast(error.message));
          if (key === "n") newDocument();
          if (key === "t") report(transform);
        }
      } else if (key === "q") {
        e.preventDefault();
        e.stopImmediatePropagation();
        quickMaskToggle();
      } else if (e.key === "Enter" && s().tool === "Pen path") {
        e.preventDefault();
        finishPath();
      } else if (e.key === "Escape") {
        pathPoints = [];
        pathLayer = null;
        sync();
      }
    },
    true,
  );
  const m = api.menus;
  m.file.unshift(["New document…", newDocument]);
  m.file.splice(2, 0, ["Place image as layer…", choosePlace]);
  m.file.push(
    ["Export image…", exportOptions],
    ["Local image browser…", imageBrowser],
  );
  m.edit.push(
    ["Copy", () => report(() => copy())],
    ["Copy merged", () => report(() => copy(false, true))],
    ["Cut", () => report(() => copy(true))],
    ["Paste", () => paste().catch((error) => api.toast(error.message))],
    ["Transform layer…", () => report(transform)],
    [
      "Set History brush source",
      () => {
        historySource = cloneCanvas(s().canvas);
        api.toast("History brush source captured");
      },
    ],
  );
  m.image.push(
    ["Image size…", imageSize],
    ["Canvas size…", canvasSize],
    ["Rotate 90° clockwise", () => rotateDocument(1)],
    ["Rotate 90° counterclockwise", () => rotateDocument(3)],
    ["Flip horizontal", () => rotateDocument(0, "horizontal")],
    ["Flip vertical", () => rotateDocument(0, "vertical")],
    ["Auto levels / colour…", () => effectsDialog("auto")],
    ["Adjustments & filters…", () => effectsDialog("levels")],
  );
  m.layer.push(
    ["Move layer up", () => report(() => reorder(-1))],
    ["Move layer down", () => report(() => reorder(1))],
    ["Merge down", () => report(mergeDown)],
    ["Flatten visible image", flatten],
    [
      "Group selected layer…",
      () => group().catch((error) => api.toast(error.message)),
    ],
    [
      "Ungroup selected layer",
      () =>
        report(() =>
          commit(() => {
            const l = assertEditable();
            delete l.group;
            delete l.groups;
          }),
        ),
    ],
    ["Add mask from selection", () => report(setMask)],
    ["Invert layer mask", () => report(invertMask)],
    ["Apply layer mask", () => report(() => removeMask(true))],
    ["Remove layer mask", () => report(() => removeMask(false))],
    [
      "Edit adjustment…",
      () => effectsDialog(s().active?.effect?.type || "levels"),
    ],
  );
  m.select.push(
    ["Magic Wand", () => api.chooseTool("Magic Wand")],
    ["Quick selection", () => api.chooseTool("Quick selection")],
    ["Refine selection edges…", refineSelection],
    ["Inverse selection", invertSelection],
    ["Feather selection…", feather],
    ["Quick Mask (Q)", quickMaskToggle],
  );
  m.filter.push(
    ...Object.entries(EFFECTS)
      .filter(([id]) => !tonal.has(id))
      .map(([id, e]) => [e.name + "…", () => effectsDialog(id)]),
    ["Content-aware removal (offline model)", () => removeWithModel()],
    ["Content-aware removal (local AI)", () => localRemoval()],
    ["Content-aware move (local AI)…", contentAwareMove],
    ["Panosphere…", () => creative("panosphere")],
    ["Kaleidoscope…", () => creative("kaleidoscope")],
    ["Craft pattern…", pattern],
  );
  m.help.unshift(["Beginner workshop checklist", learning]);
  const learnButton = document.createElement("button");
  learnButton.id = "beginner-workshop";
  learnButton.title = "Beginner workshop";
  learnButton.setAttribute("aria-label", "Beginner workshop");
  learnButton.textContent = "?";
  learnButton.onclick = learning;
  $("#toggle-panels").before(learnButton);
  return {
    openRaw,
    get editingMask() {
      return editingMask;
    },
    paint,
    selectMask,
    sync,
    effectsDialog,
    newDocument,
    imageSize,
    canvasSize,
    choosePlace,
    exportOptions,
    commands: {
      new: newDocument,
      copy: () => report(() => copy()),
      cut: () => report(() => copy(true)),
      paste: () => paste().catch((error) => api.toast(error.message)),
      transform: () => report(transform),
      "export-options": exportOptions,
      workshop: learning,
    },
    lessons,
  };
}
