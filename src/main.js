import { transformPath } from "./bezier.js";
import { groupPath, updateGroup } from "./layer-groups.js";
import { isRaw } from "./raw-decoder.js";
import {
  createIcons,
  Aperture,
  ArrowLeftRight,
  ArrowUpRight,
  Blend,
  ChevronDown,
  Cloud,
  Copy,
  Crop,
  Ellipsis,
  Eraser,
  Eye,
  EyeOff,
  FolderPlus,
  Hand,
  History,
  Image as ImageIcon,
  Keyboard,
  Lasso,
  LoaderCircle,
  LockKeyhole,
  Maximize,
  Minus,
  MousePointer2,
  Paintbrush,
  PenTool,
  Pipette,
  Plus,
  RectangleEllipsis,
  Redo2,
  Scan,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Square,
  SquarePlus,
  Stamp,
  Sun,
  Trash2,
  Type,
  Undo2,
  Upload,
  ZoomIn,
  Search,
  Info,
  ChevronsRight,
  ChevronUp,
  Navigation,
  PanelRightClose,
  GripVertical,
  Layers,
  Contrast,
  Palette,
  Settings2,
  X,
} from "lucide";
const icons = {
  Aperture,
  ArrowLeftRight,
  ArrowUpRight,
  Blend,
  ChevronDown,
  Cloud,
  Copy,
  Crop,
  Ellipsis,
  Eraser,
  Eye,
  EyeOff,
  FolderPlus,
  Hand,
  History,
  Image: ImageIcon,
  Keyboard,
  Lasso,
  LoaderCircle,
  LockKeyhole,
  Maximize,
  Minus,
  MousePointer2,
  Paintbrush,
  PenTool,
  Pipette,
  Plus,
  RectangleEllipsis,
  Redo2,
  Scan,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Square,
  SquarePlus,
  Stamp,
  Sun,
  Trash2,
  Type,
  Undo2,
  Upload,
  ZoomIn,
  Search,
  Info,
  ChevronsRight,
  ChevronUp,
  Navigation,
  PanelRightClose,
  GripVertical,
  Layers,
  Contrast,
  Palette,
  Settings2,
  X,
};
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/manrope";
import "./style.css";
import { workspaceTemplate, initWorkspace } from "./workspace.js";
import { serializeProject, deserializeProject } from "./projects.js";
import { imageDensityDataURL, readDensity } from "./export-metadata.js";
import { initBookTools } from "./book-tools.js";
import {
  compositeLayers,
  snapshotLayers,
  cloneCanvas,
  selectionMask,
  drawSelected,
} from "./canvas-helpers.js";
const desktop = window.prismDesktop;
const localAIEndpoint = () =>
  localStorage.getItem("prism-local-ai-url") || "http://127.0.0.1:7860";
const icon = (name, cls = "") => `<i data-lucide="${name}" class="${cls}"></i>`;
const tools = [
  ["mouse-pointer-2", "Move", "V"],
  ["scan", "Marquee select", "M"],
  ["lasso", "Lasso select", "L"],
  ["sparkles", "Generative fill", "G"],
  ["crop", "Crop to selection", "C"],
  ["pipette", "Eyedropper", "I"],
  ["paintbrush", "Brush", "B"],
  ["eraser", "Eraser", "E"],
  ["stamp", "Clone brush", "S"],
  ["blend", "Gradient", "D"],
  ["type", "Text", "T"],
  ["pen-tool", "Pen brush", "P"],
  ["square", "Rectangle", "U"],
  ["hand", "Hand", "H"],
  ["zoom-in", "Zoom", "Z"],
];
tools.push(
  ["sparkles", "Magic Wand", "W"],
  ["scan", "Quick selection", "—"],
  ["sun", "Dodge", "O"],
  ["blend", "Burn", "K"],
  ["palette", "Sponge", "R"],
  ["blend", "Blur brush", "A"],
  ["paintbrush", "Sharpen brush", "—"],
  ["stamp", "Repair brush", "J"],
  ["history", "History brush", "Y"],
  ["pen-tool", "Pen path", "F"],
);
document.querySelector("#app").innerHTML = workspaceTemplate(tools, icon);
createIcons({ icons });
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
const canvas = $("#canvas"),
  ctx = canvas.getContext("2d");
let workspaceUI, bookTools;
let ppi = 72;
let layers = [],
  activeId = 1,
  nextId = 3,
  tool = "Move",
  zoom = 0.5,
  selection = null,
  dragging = null,
  history = [],
  future = [],
  adjustments = { brightness: 100, contrast: 100, saturation: 100 },
  genMode = "fill";
function layer(name, id) {
  const c = document.createElement("canvas");
  c.width = canvas.width;
  c.height = canvas.height;
  return {
    id,
    name,
    canvas: c,
    visible: true,
    opacity: 1,
    blend: "source-over",
    locked: false,
    x: 0,
    y: 0,
  };
}
const active = () => layers.find((l) => l.id === activeId);
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("#toast").classList.remove("visible"), 3500);
}
function render() {
  const composed = compositeLayers(layers, canvas.width, canvas.height);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.filter = `brightness(${adjustments.brightness}%) contrast(${adjustments.contrast}%) saturate(${adjustments.saturation}%)`;
  ctx.drawImage(composed, 0, 0);
  ctx.filter = "none";
  workspaceUI?.sync();
  bookTools?.sync();
}
function renderLayers() {
  $("#layer-list").setAttribute("role", "listbox");
  $("#layer-list").setAttribute("aria-label", "Document layers");
  $("#layer-list").innerHTML = layers
    .map(
      (l) =>
        `<div class="layer-row ${l.id === activeId ? "active" : ""}" data-id="${l.id}"><button class="visibility" aria-label="Toggle layer visibility">${icon(l.visible ? "eye" : "eye-off")}</button><div class="layer-thumb ${l.id === 1 ? "photo-thumb" : "transparent-thumb"}"></div><span class="layer-name"></span>${l.locked ? icon("lock-keyhole", "layer-lock") : ""}</div>`,
    )
    .join("");
  $$(".layer-row").forEach((row, i) => {
    row.querySelector(".layer-name").textContent = layers[i].name;
    row
      .querySelector(".visibility")
      .setAttribute(
        "aria-label",
        (layers[i].visible ? "Hide " : "Show ") + layers[i].name,
      );
    row.setAttribute("role", "option");
    row.setAttribute("aria-selected", String(layers[i].id === activeId));
    row.tabIndex = 0;
    row.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        activeId = layers[i].id;
        renderLayers();
      }
    };
    const thumb = document.createElement("canvas");
    thumb.width = 40;
    thumb.height = 30;
    thumb.getContext("2d").drawImage(layers[i].canvas, 0, 0, 40, 30);
    if (layers[i].kind === "adjustment") {
      const c = thumb.getContext("2d");
      c.fillStyle = "#999";
      c.fillRect(0, 0, 40, 30);
      c.fillStyle = "#fff";
      c.font = "24px sans-serif";
      c.fillText("◐", 9, 23);
    }
    row.querySelector(".layer-thumb").append(thumb);
    if (layers[i].mask) {
      const button = document.createElement("button");
      button.className = "mask-thumb";
      button.title = "Edit layer mask";
      button.setAttribute("aria-label", "Edit mask for " + layers[i].name);
      const image = document.createElement("canvas");
      image.width = 32;
      image.height = 24;
      const c = image.getContext("2d");
      c.fillStyle = "black";
      c.fillRect(0, 0, 32, 24);
      c.drawImage(layers[i].mask, 0, 0, 32, 24);
      button.append(image);
      button.onclick = (e) => {
        e.stopPropagation();
        activeId = layers[i].id;
        bookTools.selectMask(layers[i].id);
      };
      row.querySelector(".layer-thumb").after(button);
    }
    if (layers[i].kind === "adjustment")
      row.ondblclick = () => bookTools.effectsDialog(layers[i].effect.type);
    row.onclick = () => {
      activeId = Number(row.dataset.id);
      renderLayers();
    };
    row.querySelector(".visibility").onclick = (e) => {
      e.stopPropagation();
      save();
      layers[i].visible = !layers[i].visible;
      render();
      renderLayers();
    };
    row.ondblclick = async () => {
      if (layers[i].kind === "adjustment") {
        bookTools.effectsDialog(layers[i].effect.type);
        return;
      }
      const name = await askText("Layer name", layers[i].name);
      if (name?.trim()) {
        save();
        layers[i].name = name.trim();
        renderLayers();
      }
    };
  });
  const seenGroups = new Set();
  layers.forEach((l) => {
    const row = $("#layer-list").querySelector(`[data-id="${l.id}"]`),
      path = groupPath(l);
    row.style.paddingLeft = 8 + path.length * 14 + "px";
    row.dataset.groupCollapsed = String(path.some((g) => g.collapsed));
    row.hidden = row.dataset.groupCollapsed === "true";
    path.forEach((g, depth) => {
      if (seenGroups.has(g.id)) return;
      seenGroups.add(g.id);
      const header = document.createElement("div");
      header.className = "layer-group-header";
      header.style.paddingLeft = 8 + depth * 14 + "px";
      header.hidden = path.slice(0, depth).some((p) => p.collapsed);
      const name = document.createElement("button");
      name.textContent = (g.collapsed ? "▸ " : "▾ ") + g.name;
      name.title = "Collapse or expand group";
      name.onclick = () => {
        save();
        updateGroup(layers, g.id, { collapsed: !g.collapsed });
        renderLayers();
      };
      const eye = document.createElement("button");
      eye.textContent = g.visible ? "◉" : "○";
      eye.title = "Toggle group visibility";
      eye.onclick = () => {
        save();
        updateGroup(layers, g.id, { visible: !g.visible });
        render();
        renderLayers();
      };
      const options = document.createElement("button");
      options.textContent = Math.round(g.opacity * 100) + "%";
      options.title = "Group opacity and blend";
      options.onclick = async () => {
        const value = await askText(
          "Group opacity 0–100 and blend (e.g. 75 multiply)",
          Math.round(g.opacity * 100) + " " + g.blend,
        );
        if (!value) return;
        const [opacity, blend = "source-over"] = value.trim().split(/\s+/);
        if (
          !Number.isFinite(Number(opacity)) ||
          Number(opacity) < 0 ||
          Number(opacity) > 100 ||
          ![
            "source-over",
            "multiply",
            "screen",
            "overlay",
            "darken",
            "lighten",
            "difference",
            "exclusion",
          ].includes(blend)
        ) {
          toast("Enter opacity 0–100 and a supported blend mode");
          return;
        }
        save();
        updateGroup(layers, g.id, { opacity: Number(opacity) / 100, blend });
        render();
        renderLayers();
      };
      header.append(eye, name, options);
      row.before(header);
    });
  });
  $(".layers-count").textContent =
    `${layers.length} layer${layers.length === 1 ? "" : "s"}`;
  $(".layer-properties-title h3").textContent =
    active()?.name || "Selected layer";
  $("#opacity").value = Math.round((active()?.opacity ?? 1) * 100);
  $("#blend-mode").value = active()?.blend || "source-over";
  createIcons({ icons });
  workspaceUI?.sync();
  bookTools?.sync();
}
function save() {
  desktop?.setDirty?.(true);
  history.push({
    width: canvas.width,
    height: canvas.height,
    layers: snapshotLayers(layers),
    ppi,
    name: $("#document-name").textContent,
    activeId,
    adjustments: { ...adjustments },
  });
  const pixels = (entry) =>
    entry.width *
    entry.height *
    entry.layers.reduce((n, l) => n + 1 + (l.mask ? 1 : 0), 0);
  while (
    history.length > 1 &&
    (history.length > 20 ||
      history.reduce((n, entry) => n + pixels(entry), 0) > 64_000_000)
  )
    history.shift();
  future = [];
}
function copyCanvas(c) {
  const n = document.createElement("canvas");
  n.width = c.width;
  n.height = c.height;
  n.getContext("2d").drawImage(c, 0, 0);
  return n;
}
function restore(from, to) {
  if (from.length) desktop?.setDirty?.(true);
  if (!from.length) return toast("No more history");
  to.push({
    width: canvas.width,
    height: canvas.height,
    layers: snapshotLayers(layers),
    ppi,
    name: $("#document-name").textContent,
    activeId,
    adjustments: { ...adjustments },
  });
  const state = from.pop();
  canvas.width = state.width;
  canvas.height = state.height;
  layers = state.layers;
  activeId = state.activeId;
  adjustments = state.adjustments;
  ppi = state.ppi || 72;
  $("#document-name").textContent = state.name || "Untitled";
  selection = null;
  for (const id of Object.keys(adjustments)) {
    $("#" + id).value = adjustments[id];
    $("#" + id + "-value").value = adjustments[id] - 100;
  }
  syncSize();
  render();
  renderLayers();
}
function syncSize() {
  $("#canvas-wrap").style.width = `${canvas.width * zoom}px`;
  $("#canvas-wrap").style.height = `${canvas.height * zoom}px`;
  $("#dimensions").textContent = `${canvas.width} × ${canvas.height} px`;
  $("#doc-width").value = canvas.width;
  $("#doc-height").value = canvas.height;
  $$(".zoom-text").forEach((el) => (el.textContent = Math.round(zoom * 100)));
  updateSelection();
  workspaceUI?.sync();
  bookTools?.sync();
}
function fit() {
  zoom = Math.min(
    1,
    ($("#canvas-area").clientWidth - 110) / canvas.width,
    ($("#canvas-area").clientHeight - 160) / canvas.height,
  );
  syncSize();
}
function selectionPath(c, ox = 0, oy = 0) {
  if (selection.points?.length) {
    c.moveTo(selection.points[0].x - ox, selection.points[0].y - oy);
    for (const p of selection.points.slice(1)) c.lineTo(p.x - ox, p.y - oy);
    c.closePath();
  } else c.rect(selection.x - ox, selection.y - oy, selection.w, selection.h);
}
function updateSelection() {
  const el = $("#selection");
  el.style.display = selection ? "block" : "none";
  if (selection)
    Object.assign(el.style, {
      left: `${selection.x * zoom}px`,
      top: `${selection.y * zoom}px`,
      width: `${selection.w * zoom}px`,
      height: `${selection.h * zoom}px`,
    });
  el.innerHTML = "";
  el.style.borderStyle = selection?.points ? "none" : "dashed";
  el.style.outlineStyle = selection?.points ? "none" : "dashed";
  if (selection?.points && selection.w && selection.h) {
    const pts = selection.points
      .map((p) => `${p.x - selection.x},${p.y - selection.y}`)
      .join(" ");
    el.innerHTML = `<svg viewBox="0 0 ${selection.w} ${selection.h}" style="width:100%;height:100%;overflow:visible"><polygon points="${pts}" fill="#b4a0ee15" stroke="white" stroke-width="1.5" stroke-dasharray="5 4" vector-effect="non-scaling-stroke"/></svg>`;
  }
  if (selection?.mask) {
    const image = document.createElement("img");
    image.src = selection.mask.toDataURL("image/png");
    image.alt = "";
    Object.assign(image.style, {
      position: "absolute",
      width: canvas.width * zoom + "px",
      height: canvas.height * zoom + "px",
      left: -selection.x * zoom + "px",
      top: -selection.y * zoom + "px",
      opacity: ".22",
      pointerEvents: "none",
    });
    el.style.overflow = "hidden";
    el.append(image);
  } else el.style.overflow = "visible";
  $("#selection-label").textContent = selection ? "Deselect" : "Select an area";
  workspaceUI?.sync();
  bookTools?.sync();
}
function setTool(name) {
  tool = name;
  $$(".tool").forEach((b) =>
    b.classList.toggle("active", b.dataset.tool === name),
  );
  $("#tool-name").textContent = name === "Move" ? "Move tool" : name;
  $("#status-hint").textContent =
    {
      Move: "Drag to move the selected layer",
      Brush: "Drag to paint on the selected layer",
      Eraser: "Drag to erase from the selected layer",
      "Marquee select": "Drag to select an area",
      "Generative fill": "Select an area, then describe your idea",
      Text: "Click the canvas to add text",
      Hand: "Drag to pan the canvas",
    }[name] || `Click or drag to use ${name.toLowerCase()}`;
  canvas.style.cursor =
    name === "Move"
      ? "move"
      : name === "Hand"
        ? "grab"
        : name === "Text"
          ? "text"
          : "crosshair";
  workspaceUI?.sync();
  bookTools?.sync();
  if (name === "Generative fill") {
    workspaceUI?.openFlyout("generate");
    $("#prompt").focus();
  }
}
function cropSelection() {
  if (!selection) return toast("Select an area before cropping");
  save();
  const s = selection;
  for (const l of layers) {
    for (const key of ["canvas", "mask"])
      if (l[key]) {
        const c = document.createElement("canvas");
        c.width = Math.round(s.w);
        c.height = Math.round(s.h);
        c.getContext("2d").drawImage(l[key], l.x - s.x, l.y - s.y);
        l[key] = c;
      }
    if (l.path)
      l.path = transformPath(l.path, (p) => ({
        x: p.x + l.x - s.x,
        y: p.y + l.y - s.y,
      }));
    l.x = 0;
    l.y = 0;
  }
  canvas.width = Math.round(s.w);
  canvas.height = Math.round(s.h);
  selection = null;
  fit();
  render();
  renderLayers();
  toast("Cropped to selection");
}
$$(".tool").forEach((b) => (b.onclick = () => setTool(b.dataset.tool)));
function coords(e) {
  const r = canvas.getBoundingClientRect();
  return {
    pressure: e.pointerType === "pen" ? e.pressure : 1,
    tiltX: e.tiltX || 0,
    tiltY: e.tiltY || 0,
    x: Math.max(0, Math.min(canvas.width, (e.clientX - r.left) / zoom)),
    y: Math.max(0, Math.min(canvas.height, (e.clientY - r.top) / zoom)),
  };
}
canvas.onpointerdown = async (e) => {
  const p = coords(e);
  if (tool === "Move" && $("#auto-select").checked) {
    const hit = layers.find(
      (layer) =>
        layer.visible &&
        !layer.locked &&
        p.x - layer.x >= 0 &&
        p.y - layer.y >= 0 &&
        p.x - layer.x < layer.canvas.width &&
        p.y - layer.y < layer.canvas.height &&
        layer.canvas
          .getContext("2d")
          .getImageData(p.x - layer.x, p.y - layer.y, 1, 1).data[3] > 0,
    );
    if (hit) {
      activeId = hit.id;
      renderLayers();
    }
  }
  const l = active();
  if (tool === "Zoom") {
    zoom = Math.min(2, zoom + 0.1);
    syncSize();
    return;
  }
  if (tool === "Eyedropper") {
    const d = ctx.getImageData(p.x, p.y, 1, 1).data;
    $("#color").value =
      "#" +
      [...d]
        .slice(0, 3)
        .map((v) => v.toString(16).padStart(2, "0"))
        .join("");
    workspaceUI?.setForeground($("#color").value);
    toast("Foreground color sampled");
    return;
  }
  if (tool === "Text") {
    const text = await askText("Enter your text");
    if (!text) return;
    save();
    const t = layer(text, nextId++);
    t.canvas.getContext("2d").font =
      `600 ${Number($("#text-size").value) || 90}px "${$("#text-font").value}", sans-serif`;
    t.canvas.getContext("2d").fillStyle = $("#color").value;
    t.canvas.getContext("2d").fillText(text, p.x, p.y);
    layers.unshift(t);
    activeId = t.id;
    render();
    renderLayers();
    return;
  }
  if (!l || l.locked) return toast("Unlock the selected layer to edit it");
  if (tool === "Clone brush" && !e.altKey && !canvas.clonePoint)
    return toast("Alt-click to choose a clone source, then paint");
  if (tool === "Clone brush" && e.altKey) {
    canvas.clonePoint = p;
    return toast("Clone source set");
  }
  if (
    ![
      "Marquee select",
      "Lasso select",
      "Crop to selection",
      "Generative fill",
      "Hand",
    ].includes(tool)
  )
    save();
  canvas.setPointerCapture(e.pointerId);
  dragging = {
    start: p,
    last: p,
    x: l.x,
    y: l.y,
    scrollX: $("#stage").scrollLeft,
    scrollY: $("#stage").scrollTop,
    points: [p],
  };
  if (
    [
      "Marquee select",
      "Lasso select",
      "Generative fill",
      "Crop to selection",
    ].includes(tool)
  ) {
    selection = { x: p.x, y: p.y, w: 0, h: 0 };
    updateSelection();
  } else if (["Brush", "Eraser", "Pen brush", "Clone brush"].includes(tool))
    paint(p, p);
};
function paint(a, b) {
  if (bookTools) {
    bookTools.paint(a, b);
    return;
  }
  const l = active(),
    c = l.canvas.getContext("2d");
  c.save();
  if (selection) {
    c.beginPath();
    selectionPath(c, l.x, l.y);
    c.clip();
  }
  c.lineWidth = Number($("#brush-size").value) || 30;
  c.globalAlpha = (Number($("#brush-opacity").value) || 100) / 100;
  c.lineCap = "round";
  c.lineJoin = "round";
  c.strokeStyle = $("#color").value;
  c.globalCompositeOperation =
    tool === "Eraser" ? "destination-out" : "source-over";
  if (tool === "Clone brush") {
    const s = canvas.clonePoint;
    c.beginPath();
    c.arc(b.x - l.x, b.y - l.y, 30, 0, Math.PI * 2);
    c.clip();
    c.drawImage(canvas, b.x - s.x - l.x, b.y - s.y - l.y);
  } else {
    c.beginPath();
    c.moveTo(a.x - l.x, a.y - l.y);
    c.lineTo(b.x - l.x + 0.01, b.y - l.y + 0.01);
    c.stroke();
  }
  c.restore();
  render();
}
canvas.onpointermove = (e) => {
  if (!dragging) return;
  const p = coords(e),
    l = active();
  if (
    [
      "Marquee select",
      "Lasso select",
      "Generative fill",
      "Crop to selection",
    ].includes(tool)
  ) {
    if (tool === "Lasso select") {
      dragging.points.push(p);
      const xs = dragging.points.map((p) => p.x),
        ys = dragging.points.map((p) => p.y);
      selection = {
        x: Math.min(...xs),
        y: Math.min(...ys),
        w: Math.max(...xs) - Math.min(...xs),
        h: Math.max(...ys) - Math.min(...ys),
        points: dragging.points,
      };
    } else
      selection = {
        x: Math.min(p.x, dragging.start.x),
        y: Math.min(p.y, dragging.start.y),
        w: Math.abs(p.x - dragging.start.x),
        h: Math.abs(p.y - dragging.start.y),
      };
    updateSelection();
  } else if (["Brush", "Eraser", "Pen brush", "Clone brush"].includes(tool))
    paint(dragging.last, p);
  else if (tool === "Move") {
    l.x = dragging.x + p.x - dragging.start.x;
    l.y = dragging.y + p.y - dragging.start.y;
    render();
  } else if (tool === "Hand") {
    $("#stage").scrollLeft -= p.x - dragging.last.x;
    $("#stage").scrollTop -= p.y - dragging.last.y;
  }
  dragging.last = p;
};
canvas.onpointercancel = () => {
  dragging = null;
};
canvas.onpointerup = (e) => {
  if (!dragging) return;
  const p = coords(e),
    l = active(),
    c = l.canvas.getContext("2d"),
    a = dragging.start;
  if (tool === "Rectangle")
    drawSelected(l, selection, canvas.width, canvas.height, (c) => {
      c.fillStyle = $("#color").value;
      c.fillRect(
        Math.min(a.x, p.x),
        Math.min(a.y, p.y),
        Math.abs(a.x - p.x),
        Math.abs(a.y - p.y),
      );
    });
  if (tool === "Gradient") {
    const g = c.createLinearGradient(
      a.x - l.x,
      a.y - l.y,
      p.x - l.x || 1,
      p.y - l.y || 1,
    );
    g.addColorStop(0, $("#color").value);
    g.addColorStop(1, "transparent");
    c.fillStyle = g;
    const s = selection || { x: 0, y: 0, w: canvas.width, h: canvas.height };
    c.fillRect(s.x - l.x, s.y - l.y, s.w, s.h);
  }
  if (selection && (selection.w < 3 || selection.h < 3)) {
    selection = null;
    updateSelection();
  }
  dragging = null;
  render();
  renderLayers();
};
$("#undo").onclick = () => restore(history, future);
$("#redo").onclick = () => restore(future, history);
$("#new-layer").onclick = () => {
  save();
  const l = layer("Untitled layer", nextId++);
  l.groups = groupPath(active() || {}).map((g) => ({ ...g }));
  layers.unshift(l);
  activeId = l.id;
  renderLayers();
  toast("New layer created");
};
$("#delete-layer").onclick = () => {
  if (layers.length === 1)
    return toast("Keep at least one layer in the document");
  save();
  layers = layers.filter((l) => l.id !== activeId);
  activeId = layers[0].id;
  render();
  renderLayers();
};
$("#layer-link").onclick = () => {
  save();
  const l = {
    ...active(),
    id: nextId++,
    name: active().name + " copy",
    canvas: copyCanvas(active().canvas),
    mask: cloneCanvas(active().mask),
    effect: active().effect ? { ...active().effect } : undefined,
    path: active().path?.map((p) => ({ ...p })),
  };
  layers.unshift(l);
  activeId = l.id;
  render();
  renderLayers();
};
$("#lock-layer").onclick = () => {
  if (!active()) return;
  save();
  active().locked = !active().locked;
  renderLayers();
};
$("#opacity").onchange = (e) => {
  save();
  active().opacity = Math.max(0, Math.min(100, +e.target.value)) / 100;
  render();
  renderLayers();
};
$("#blend-mode").onchange = (e) => {
  save();
  active().blend = e.target.value;
  render();
};
$("#zoom-in").onclick = () => {
  zoom = Math.min(3, zoom + 0.1);
  syncSize();
};
$("#zoom-out").onclick = () => {
  zoom = Math.max(0.1, zoom - 0.1);
  syncSize();
};
$("#fit").onclick = fit;
$("#zoom-reset").onclick = () => {
  zoom = 1;
  syncSize();
};
$("#deselect").onclick = () => {
  if (selection) {
    selection = null;
    updateSelection();
  } else setTool("Marquee select");
};
$("#floating-generate").onclick = () => {
  workspaceUI?.openFlyout("generate");
  setTool("Generative fill");
  $("#prompt").focus();
};
$("#show-transform").onchange = (e) =>
  ($("#transform-box").hidden = !e.target.checked);
$("#resize").onclick = () => {
  const w = +$("#doc-width").value,
    h = +$("#doc-height").value;
  if (
    !Number.isInteger(w) ||
    !Number.isInteger(h) ||
    w < 1 ||
    h < 1 ||
    w > 8000 ||
    h > 8000
  )
    return toast("Enter dimensions between 1 and 8000 pixels");
  save();
  for (const l of layers) {
    for (const key of ["canvas", "mask"])
      if (l[key]) {
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        c.getContext("2d").drawImage(l[key], l.x, l.y);
        l[key] = c;
      }
    if (l.path)
      l.path = transformPath(l.path, (p) => ({ x: p.x + l.x, y: p.y + l.y }));
    l.x = 0;
    l.y = 0;
  }
  canvas.width = w;
  canvas.height = h;
  selection = null;
  fit();
  render();
  renderLayers();
  toast("Canvas resized");
};
async function exportImage() {
  try {
    const name =
      $("#document-name").textContent.replace(/\.[^.]+$/, "") + ".png";
    const data = imageDensityDataURL(canvas.toDataURL("image/png"), "png", ppi);
    if (desktop) {
      if (await desktop.saveFile({ name, data, type: "png" }))
        toast("PNG saved to your computer");
    } else {
      const a = document.createElement("a");
      a.download = name;
      a.href = data;
      a.click();
      toast("PNG exported");
    }
  } catch (error) {
    toast("Export failed: " + error.message);
  }
}
$(".export").onclick = exportImage;
$(".add-doc").onclick = () => $("#file-input").click();
$("#file-input").onchange = async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  if (file.name.toLowerCase().endsWith(".prism")) {
    openProject(file);
    return;
  }
  if (isRaw(file)) {
    bookTools.openRaw(file);
    return;
  }
  const importedPpi =
    readDensity(new Uint8Array(await file.slice(0, 131072).arrayBuffer())) ||
    72;
  const url = URL.createObjectURL(file),
    img = new Image();
  img.onload = () => {
    save();
    if (img.naturalWidth > 8000 || img.naturalHeight > 8000) {
      URL.revokeObjectURL(url);
      toast("Images must be at most 8000 × 8000 pixels");
      return;
    }
    ppi = importedPpi;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const l = layer(file.name.slice(0, 180), nextId++);
    l.canvas.getContext("2d").drawImage(img, 0, 0);
    layers = [l];
    activeId = l.id;
    $("#document-name").textContent = file.name;
    selection = null;
    adjustments = { brightness: 100, contrast: 100, saturation: 100 };
    fit();
    render();
    renderLayers();
    URL.revokeObjectURL(url);
    toast("Image opened");
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    toast("This image format could not be opened");
  };
  img.src = url;
};
$$("[data-panel]").forEach(
  (b) =>
    (b.onclick = () => {
      $$("[data-panel]").forEach((el) =>
        el.classList.toggle("selected", el === b),
      );
      $(".properties-section").hidden = b.dataset.panel !== "properties";
      $(".adjustments-section").hidden = b.dataset.panel !== "adjustments";
    }),
);
for (const id of Object.keys(adjustments)) {
  $("#" + id).onpointerdown = () => save();
  $("#" + id).oninput = (e) => {
    desktop?.setDirty?.(true);
    adjustments[id] = +e.target.value;
    $("#" + id + "-value").value = e.target.value - 100;
    render();
  };
}
$("#reset-adjustments").onclick = () => {
  save();
  for (const id of Object.keys(adjustments)) {
    adjustments[id] = 100;
    $("#" + id).value = 100;
    $("#" + id + "-value").value = 0;
  }
  render();
};
$("#layer-fx").onclick = () => workspaceUI.showProperties("adjustments");
$("#add-mask").onclick = () => setTool("Marquee select");
$("#swap-color").onclick = () => ($("#color").value = "#ffffff");
$$("[data-mode]").forEach(
  (b) =>
    (b.onclick = () => {
      genMode = b.dataset.mode;
      $$("[data-mode]").forEach((el) =>
        el.classList.toggle("active", el === b),
      );
      $("#prompt").placeholder =
        genMode === "expand"
          ? "Describe what should surround your image…"
          : "Describe what you’d like to create…";
    }),
);
$$("[data-prompt]").forEach(
  (b) =>
    (b.onclick = () => {
      $("#prompt").value = b.dataset.prompt;
      $("#prompt").focus();
    }),
);
$("#generate").onclick = async () => {
  const prompt = $("#prompt").value.trim();
  if (!prompt) {
    $("#prompt").focus();
    return toast("Describe what you would like to create");
  }
  const btn = $("#generate");
  btn.disabled = true;
  btn.innerHTML = icon("loader-circle", "spin") + " Creating your vision…";
  createIcons({ icons });
  $("#generation-message").textContent =
    "Generating on your PC. Your image stays on this machine.";
  try {
    let image = canvas.toDataURL("image/png"),
      mask;
    let gw = canvas.width,
      gh = canvas.height;
    const m = document.createElement("canvas");
    if (genMode === "expand") {
      const expanded = document.createElement("canvas");
      gw = Math.round(canvas.width * 1.25);
      gh = Math.round(canvas.height * 1.25);
      expanded.width = gw;
      expanded.height = gh;
      expanded
        .getContext("2d")
        .drawImage(canvas, (gw - canvas.width) / 2, (gh - canvas.height) / 2);
      image = expanded.toDataURL("image/png");
      m.width = gw;
      m.height = gh;
      m.getContext("2d").fillRect(
        (gw - canvas.width) / 2,
        (gh - canvas.height) / 2,
        canvas.width,
        canvas.height,
      );
      mask = m.toDataURL("image/png");
    } else if (selection) {
      m.width = gw;
      m.height = gh;
      const mc = m.getContext("2d");
      mc.fillRect(0, 0, gw, gh);
      mc.globalCompositeOperation = "destination-out";
      mc.beginPath();
      if (selection.mask) mc.drawImage(selection.mask, 0, 0);
      else {
        selectionPath(mc);
        mc.fill();
      }
      mask = m.toDataURL("image/png");
    }
    let localMask;
    if (mask) {
      const mc = m.getContext("2d");
      const pixels = mc.getImageData(0, 0, gw, gh);
      for (let i = 0; i < pixels.data.length; i += 4) {
        const value = 255 - pixels.data[i + 3];
        pixels.data[i] = value;
        pixels.data[i + 1] = value;
        pixels.data[i + 2] = value;
        pixels.data[i + 3] = 255;
      }
      mc.putImageData(pixels, 0, 0);
      localMask = m.toDataURL("image/png");
    }
    const payload = {
      prompt,
      image,
      mask: localMask,
      width: gw,
      height: gh,
      endpoint: localAIEndpoint(),
    };
    let data;
    if (desktop) {
      data = await desktop.generate(payload);
    } else {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      data = await res.json();
    }
    if (data.error) throw new Error(data.error);
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = data.image;
    });
    save();
    if (genMode === "expand") {
      const dx = (gw - canvas.width) / 2,
        dy = (gh - canvas.height) / 2;
      for (const old of layers) {
        const c = document.createElement("canvas");
        c.width = gw;
        c.height = gh;
        c.getContext("2d").drawImage(old.canvas, old.x + dx, old.y + dy);
        old.canvas = c;
        if (old.mask) {
          const m = document.createElement("canvas");
          m.width = gw;
          m.height = gh;
          m.getContext("2d").drawImage(old.mask, old.x + dx, old.y + dy);
          old.mask = m;
        }
        if (old.path)
          old.path = transformPath(old.path, (p) => ({
            x: p.x + dx,
            y: p.y + dy,
          }));
        old.x = 0;
        old.y = 0;
      }
      canvas.width = gw;
      canvas.height = gh;
    }
    const l = layer("Generative · " + prompt.slice(0, 24), nextId++);
    l.canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    layers.unshift(l);
    activeId = l.id;
    selection = null;
    fit();
    render();
    renderLayers();
    $("#generation-message").textContent =
      "Created on a new layer. Your original is preserved.";
    toast("Generation complete");
  } catch (err) {
    $("#generation-message").textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.innerHTML =
      icon("sparkles") +
      " Generate <span>" +
      icon("arrow-up-right") +
      "</span>";
    createIcons({ icons });
  }
};
function modal(title, body) {
  $("#modal-content").innerHTML =
    `<span class="modal-icon">${icon("aperture")}</span><h2>${title}</h2>${body}`;
  createIcons({ icons });
  $("#modal").showModal();
}
$("#close-modal").onclick = () => $("#modal").close();
$("#shortcuts").onclick = () =>
  modal(
    "Make yourself at home",
    '<p>A familiar workspace. A fresh perspective.</p><div class="shortcut-list">' +
      tools
        .map(
          ([, name, key]) => `<div><span>${name}</span><kbd>${key}</kbd></div>`,
        )
        .join("") +
      "<div><span>Undo / Redo</span><kbd>Ctrl Z / Ctrl Shift Z</kbd></div><div><span>Open / Export PNG</span><kbd>Ctrl O / Ctrl Shift E</kbd></div></div>",
  );
$(".avatar").onclick = () =>
  modal(
    "Your offline creative space",
    "<p>Prism Studio is a Windows desktop image editor. Editing, project files, and PNG exports work without the internet. Save a .prism project to keep editable layers.</p><p>Subject selection and content-aware removal use bundled local models on CPU. Text-prompt generation connects to a separately installed Stable Diffusion model on your computer. Native PSD files and the complete Photoshop feature set are not supported.</p>",
  );

const menuActions = {
  file: [
    ["Open image…", () => $("#file-input").click()],
    ["Save project…", saveProject],
    ["Export as PNG", exportImage],
  ],
  edit: [
    ["Undo", () => restore(history, future)],
    ["Redo", () => restore(future, history)],
  ],
  type: [["Text tool", () => setTool("Text")]],
  filter: [
    ["Brightness / Contrast…", () => workspaceUI.showProperties("adjustments")],
    ["Reset image adjustments", () => $("#reset-adjustments").click()],
  ],
  window: [],
  image: [
    ["Image adjustments", () => workspaceUI.showProperties("adjustments")],
    ["Fit to screen", fit],
    [
      "Resize canvas",
      () => {
        workspaceUI.showProperties("properties");
        $("#doc-width").focus();
      },
    ],
  ],
  layer: [
    ["New layer", () => $("#new-layer").click()],
    ["Duplicate layer", () => $("#layer-link").click()],
    ["Delete layer", () => $("#delete-layer").click()],
  ],
  select: [
    ["Marquee selection", () => setTool("Marquee select")],
    [
      "Select all",
      () => {
        selection = { x: 0, y: 0, w: canvas.width, h: canvas.height };
        updateSelection();
      },
    ],
    [
      "Deselect",
      () => {
        selection = null;
        updateSelection();
      },
    ],
  ],
  view: [
    ["Fit to screen", fit],
    [
      "Actual size",
      () => {
        zoom = 1;
        syncSize();
      },
    ],
    ["Keyboard shortcuts", () => $("#shortcuts").click()],
  ],
  help: [
    ["Keyboard shortcuts", () => $("#shortcuts").click()],
    ["About Prism", () => $(".avatar").click()],
    ["Offline AI setup", openAISettings],
  ],
};
$$("[data-menu]").forEach(
  (b) =>
    (b.onclick = (e) => {
      e.stopPropagation();
      const menu = $("#menu-popover");
      menu.innerHTML = "";
      for (const [label, fn] of b.dataset.menu === "window"
        ? workspaceUI.windowMenu()
        : menuActions[b.dataset.menu]) {
        const item = document.createElement("button");
        item.textContent = label;
        item.onclick = () => {
          menu.hidden = true;
          fn();
        };
        menu.append(item);
      }
      menu.style.left = b.getBoundingClientRect().left + "px";
      menu.style.top = b.getBoundingClientRect().bottom + 2 + "px";
      menu.hidden = false;
    }),
);
document.addEventListener("click", () => ($("#menu-popover").hidden = true));
$("#more-tools").onclick = () => setTool("Marquee select");
$("#new-group").onclick = () =>
  modal(
    "Layer organization",
    "<p>Use named layers to organize your work. Double-click a layer to rename it, and use the eye icon to toggle visibility.</p><p>Layer → Group selected layer accepts nested paths such as Portrait/Hair. Folder controls manage collapse, visibility, opacity and blend.</p>",
  );
$("#layer-options").onclick = () => $("#layer-link").click();
document.addEventListener("keydown", (e) => {
  if (
    ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName) ||
    $("#modal").open
  )
    return;
  if (e.ctrlKey || e.metaKey) {
    if (
      ["z", "s", "o"].includes(e.key.toLowerCase()) ||
      (e.shiftKey && e.key.toLowerCase() === "e")
    )
      e.preventDefault();
    if (e.key.toLowerCase() === "z")
      restore(e.shiftKey ? future : history, e.shiftKey ? history : future);
    if (e.key.toLowerCase() === "s") saveProject();
    if (e.shiftKey && e.key.toLowerCase() === "e") exportImage();
    if (e.key.toLowerCase() === "o") $("#file-input").click();
    return;
  }
  const t = tools.find(
    ([, name, key]) => key.toLowerCase() === e.key.toLowerCase(),
  );
  if (t) {
    e.preventDefault();
    $(`[data-tool="${t[1]}"]`).click();
  }
  if (e.key === "Escape") {
    selection = null;
    updateSelection();
  }
});

workspaceUI = initWorkspace({
  getState: () => ({
    canvas,
    layers,
    active: active(),
    tool,
    zoom,
    selection,
    history,
    future,
  }),
  tools,
  icon,
  refreshIcons: () => createIcons({ icons }),
  actions: {
    fit,
    chooseTool: setTool,
    modal,
    crop: cropSelection,
    setZoom: (value) => {
      zoom = value;
      syncSize();
    },
    undo: () => restore(history, future),
    redo: () => restore(future, history),
    restoreTo: (index) => {
      while (history.length > index) restore(history, future);
    },
    deselect: () => {
      selection = null;
      updateSelection();
    },
    moveLayer: (axis, value) => {
      const layer = active();
      if (
        !layer ||
        layer.locked ||
        !Number.isFinite(value) ||
        Math.abs(value) > 100000
      )
        return;
      save();
      layer[axis] = value;
      render();
      renderLayers();
    },
  },
});
workspaceUI.sync();
bookTools = initBookTools({
  getState: () => ({
    canvas,
    layers,
    active: active(),
    activeId,
    tool,
    zoom,
    selection,
    history,
    future,
    adjustments,
    ppi,
  }),
  desktop,
  menus: menuActions,
  modal,
  askText,
  save,
  render,
  renderLayers,
  fit,
  updateSelection,
  exportPng: exportImage,
  chooseTool: setTool,
  setForeground: (hex) => workspaceUI.setForeground(hex),
  createLayer: (name) => {
    if (canvas.width * canvas.height * (layers.length + 1) > 100_000_000)
      throw new Error(
        "Layer memory limit reached; merge layers or resize first",
      );
    return layer(name, nextId++);
  },
  replaceState: (patch) => {
    if (patch.width !== undefined) canvas.width = patch.width;
    if (patch.height !== undefined) canvas.height = patch.height;
    if (patch.layers) layers = patch.layers;
    if (patch.activeId !== undefined) activeId = patch.activeId;
    if (patch.selection !== undefined) selection = patch.selection;
    if (patch.ppi !== undefined) ppi = patch.ppi;
    if (patch.name !== undefined) $("#document-name").textContent = patch.name;
    if (patch.adjustments) adjustments = patch.adjustments;
    syncSize();
  },
  toast,
});
bookTools.sync();
// Starter image is served locally so canvas editing and exports remain origin-clean.
const img = new Image();
img.onload = () => {
  canvas.width = 1800;
  canvas.height = 1200;
  const base = layer("Coastal escape", 1);
  base.canvas.getContext("2d").drawImage(img, 0, 0, 1800, 1200);
  const edits = layer("Your creative touches", 2);
  layers = [edits, base];
  activeId = 2;
  fit();
  render();
  renderLayers();
};
img.onerror = () => {
  const base = layer("Background", 1);
  const c = base.canvas.getContext("2d");
  const gradient = c.createLinearGradient(0, 0, 1800, 1200);
  gradient.addColorStop(0, "#827b98");
  gradient.addColorStop(0.5, "#edb18f");
  gradient.addColorStop(1, "#547a82");
  c.fillStyle = gradient;
  c.fillRect(0, 0, 1800, 1200);
  layers = [layer("Your creative touches", 2), base];
  activeId = 2;
  fit();
  render();
  renderLayers();
  toast("Starter photo unavailable. Open an image to begin.");
};
img.src = "./coast.jpg";
$(".saved span").textContent = desktop ? "Offline desktop" : "Local workspace";
window.addEventListener("resize", fit);

async function saveProject() {
  try {
    const name =
      $("#document-name").textContent.replace(/\.[^.]+$/, "") + ".prism";
    const data = serializeProject({
      canvas,
      layers,
      adjustments,
      activeId,
      name: $("#document-name").textContent,
      ppi,
    });
    if (desktop) {
      if (await desktop.saveFile({ name, data, type: "prism" })) {
        desktop.setDirty(false);
        toast("Editable project saved");
      }
    } else {
      const url = URL.createObjectURL(
        new Blob([data], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast("Editable project saved");
    }
  } catch (error) {
    toast("Save failed: " + error.message);
  }
}
async function openProject(file) {
  try {
    if (file.size > 150_000_000)
      throw new Error("Project files must be smaller than 150 MB");
    const data = await deserializeProject(await file.text());
    save();
    canvas.width = data.width;
    canvas.height = data.height;
    layers = data.layers.map((l) => ({ ...l, id: nextId++ }));
    activeId = layers[data.activeIndex].id;
    adjustments = data.adjustments;
    ppi = data.ppi || 72;
    selection = null;
    for (const id of Object.keys(adjustments)) {
      $("#" + id).value = adjustments[id];
      $("#" + id + "-value").value = adjustments[id] - 100;
    }
    $("#document-name").textContent = file.name;
    fit();
    render();
    renderLayers();
    desktop?.setDirty?.(false);
    toast("Editable project opened");
  } catch (error) {
    toast("Cannot open project: " + error.message);
  }
}
function openAISettings() {
  modal(
    "Create offline, on your PC",
    `<p>Generative fill and expand use a local Stable Diffusion WebUI engine compatible with the AUTOMATIC1111 API. Install the engine and an inpainting model once, then start it with <code>--api</code>. Generation can work without internet after model setup.</p><p>A suitable GPU and enough memory are needed; requirements depend on your model. No text-prompt diffusion checkpoint is included. Bundled subject-selection and object-removal models are available in the AI sidebar.</p><label>Local engine address<input class="ai-address" id="ai-address" placeholder="http://127.0.0.1:7860" spellcheck="false"></label><button id="connect-local-ai" class="primary full" style="padding:10px">Save & check connection</button><div id="ai-settings-status" class="ai-settings-status" role="status">Only local addresses are accepted. No cloud account or API key is used.</div>`,
  );
  $("#ai-address").value = localAIEndpoint();
  $("#connect-local-ai").onclick = async () => {
    const button = $("#connect-local-ai");
    button.disabled = true;
    const endpoint = $("#ai-address").value.trim();
    try {
      const u = new URL(endpoint);
      if (
        u.protocol !== "http:" ||
        !["127.0.0.1", "localhost", "[::1]"].includes(u.hostname) ||
        u.username ||
        u.password ||
        u.pathname !== "/" ||
        u.search ||
        u.hash
      )
        throw new Error(
          "Use a local HTTP address, for example http://127.0.0.1:7860.",
        );
      localStorage.setItem("prism-local-ai-url", u.origin);
      const status = desktop
        ? await desktop.aiStatus(u.origin)
        : await (
            await fetch("/api/status?endpoint=" + encodeURIComponent(u.origin))
          ).json();
      $("#ai-settings-status").textContent = status.available
        ? "Connected. Local model: " + status.model
        : status.error || "Local engine is unavailable.";
    } catch (error) {
      $("#ai-settings-status").textContent = error.message;
    } finally {
      button.disabled = false;
    }
  };
}
$("#ai-settings").onclick = openAISettings;
if (desktop)
  desktop.onCommand((command) =>
    ({
      ...bookTools.commands,
      open: () => $("#file-input").click(),
      save: saveProject,
      export: exportImage,
      undo: () => restore(history, future),
      redo: () => restore(future, history),
      fit,
      shortcuts: () => $("#shortcuts").click(),
      about: () => $(".avatar").click(),
      "ai-settings": openAISettings,
    })[command]?.(),
  );

function askText(title, value = "") {
  return new Promise((resolve) => {
    modal(
      title,
      '<input id="text-entry" class="ai-address" maxlength="200"><button id="text-confirm" class="primary full" style="padding:10px">Apply</button>',
    );
    $("#text-entry").value = value;
    $("#text-entry").focus();
    const dialog = $("#modal");
    let result = null;
    const finish = () => {
      result = $("#text-entry").value;
      dialog.close();
    };
    $("#text-confirm").onclick = finish;
    $("#text-entry").onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        finish();
      }
    };
    dialog.addEventListener("close", () => resolve(result), { once: true });
  });
}
