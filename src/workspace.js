// Workspace structure follows the reference's menu/options/document/panel hierarchy.
// This module controls presentation; image editing remains in main.js.
export function workspaceTemplate(tools, icon) {
  return `
  <header class="topbar">
    <a class="brand" href="#" aria-label="Prism home"><span class="brand-mark">Pr</span><span class="brand-name">Prism Studio</span></a>
    <nav class="menus" aria-label="Application menu">${["File", "Edit", "Image", "Layer", "Type", "Select", "Filter", "View", "Window", "Help"].map((name) => `<button data-menu="${name.toLowerCase()}">${name}</button>`).join("")}</nav>
    <div class="top-actions"><span class="saved">${icon("shield-check")}<span>Offline workspace</span></span><button id="tool-search" title="Find a tool">${icon("search")}</button><button class="avatar" title="About your local workspace" aria-label="About Prism">${icon("info")}</button></div>
  </header>
  <div class="optionsbar" aria-label="Tool options">
    <div class="current-tool"><span id="current-tool-icon">${icon("mouse-pointer-2")}</span><span id="tool-name">Move tool</span></div><span class="divider"></span>
    <div id="move-options" class="tool-options"><label class="check"><input type="checkbox" checked id="auto-select">Auto-select layer</label><label class="check transform-check"><input type="checkbox" id="show-transform">Show transform controls</label></div>
    <div id="paint-options" class="tool-options" hidden><label>Size <input id="brush-size" type="number" min="1" max="500" value="30"><span>px</span></label><label>Opacity <input id="brush-opacity" type="number" min="1" max="100" value="100"><span>%</span></label><span class="option-help" id="paint-help">Paint on the selected layer</span></div>
    <div id="text-options" class="tool-options" hidden><select id="text-font" aria-label="Text font"><option value="Manrope Variable">Manrope</option><option value="Arial">Arial</option><option value="Georgia">Georgia</option></select><label>Size <input id="text-size" type="number" min="8" max="600" value="90"><span>px</span></label><span class="option-help">Click the image to add raster text</span></div>
    <div id="selection-options" class="tool-options" hidden><span id="selection-dimensions">Drag to create a selection</span><button id="options-deselect" class="outline">Deselect</button><button id="apply-crop" class="outline" hidden>Apply crop</button></div>
    <div id="generic-options" class="tool-options" hidden><span class="option-help" id="generic-tool-help"></span></div>
    <div class="option-spacer"></div><button id="undo" title="Undo (Ctrl+Z)">${icon("undo-2")}</button><button id="redo" title="Redo (Ctrl+Shift+Z)">${icon("redo-2")}</button><button id="history-button" title="History">${icon("history")}</button><span class="divider"></span>
    <label class="workspace-picker"><select id="workspace-select" aria-label="Workspace"><option value="essentials">Essentials</option><option value="painting">Painting</option><option value="photography">Photography</option><option value="custom" hidden>Custom</option></select></label><button class="export primary">${icon("upload")} Export</button>
  </div>
  <main class="workspace">
    <aside class="tool-rail" aria-label="Tools"><button id="toolbar-columns" class="rail-collapse" title="Switch to two-column toolbar" aria-label="Switch toolbar columns">${icon("chevrons-right")}</button><div class="tool-list">${tools.map(([ic, name, key], i) => `<button class="tool ${i === 0 ? "active" : ""}" data-tool="${name}" title="${name} (${key})" aria-label="${name}" aria-pressed="${i === 0}">${icon(ic)}${["Lasso select", "Brush", "Pen brush", "Rectangle"].includes(name) ? '<span class="tool-group-mark"></span>' : ""}</button>`).join("")}</div><div class="rail-bottom"><div class="color-swatches"><span class="background-swatch" title="Background color: white"></span><input type="color" value="#b4a0ee" id="color" title="Foreground color"></div><button id="swap-color" title="Reset colors">${icon("arrow-left-right")}</button><button id="shortcuts" title="Keyboard shortcuts">${icon("keyboard")}</button></div></aside>
    <section class="editor" aria-label="Document workspace"><div class="document-tabs"><button class="doc-tab active">${icon("image")}<span id="document-name">Coastal escape.jpg</span><span class="doc-percent">@ <span class="zoom-text">50</span>% (RGB/8)</span><span class="edited-dot" title="Document open"></span></button><button class="add-doc" title="Open image">${icon("plus")}</button><span class="document-hint">LOCAL DOCUMENT</span></div>
      <div class="canvas-area" id="canvas-area"><div class="ruler horizontal" id="ruler-x" aria-hidden="true"></div><div class="ruler vertical" id="ruler-y" aria-hidden="true"></div><span class="ruler-corner"></span><div class="canvas-stage" id="stage"><div class="canvas-wrap" id="canvas-wrap"><canvas id="canvas" width="1800" height="1200" aria-label="Image editing canvas"></canvas><div id="selection"></div><div id="transform-box" hidden></div></div></div>
      <div class="floating-tools" aria-label="Contextual task bar"><span class="task-grip">${icon("grip-vertical")}</span><button id="floating-generate">${icon("sparkles")} Generative fill <span class="new-badge">LOCAL</span></button><span class="task-divider"></span><button id="deselect">${icon("scan")}<span id="selection-label">Select an area</span></button><button id="more-tools" title="More selection options">${icon("ellipsis")}</button></div></div>
      <footer class="statusbar"><div><button id="zoom-out" aria-label="Zoom out">${icon("minus")}</button><button id="zoom-reset" title="Zoom presets"><span class="zoom-text">50</span>% ${icon("chevron-down")}</button><button id="zoom-in" aria-label="Zoom in">${icon("plus")}</button><span class="divider"></span><span id="dimensions">1800 × 1200 px</span><span class="color-profile">72 ppi · RGB/8</span></div><div><span id="status-hint">Drag to move the selected layer</span><button id="fit">Fit on screen</button></div></footer>
    </section>
    <aside class="panel-dock" aria-label="Collapsed panels"><button data-flyout="history" title="History panel" aria-label="History panel">${icon("history")}</button><button data-flyout="navigator" title="Navigator panel" aria-label="Navigator panel">${icon("navigation")}</button><span></span><button data-flyout="generate" title="Local generative AI panel" aria-label="Local generative AI panel">${icon("sparkles")}</button><button id="toggle-panels" title="Hide panels (Tab)" aria-label="Toggle panels">${icon("panel-right-close")}</button></aside>
    <div id="panel-resizer" role="separator" aria-label="Resize panels" aria-orientation="vertical" tabindex="0"></div>
    <aside class="inspector" aria-label="Panels">
      <section class="panel-group color-panel" id="color-panel"><div class="panel-tabs"><button class="selected" data-color-tab="color">Color</button><button data-color-tab="swatches">Swatches</button><button id="collapse-color" class="panel-action" title="Collapse Color panel" aria-label="Collapse Color panel">${icon("chevron-up")}</button></div><div id="color-content"><div class="color-picker-body"><div class="mini-swatches"><span id="foreground-preview"></span><span></span></div><canvas id="color-field" width="240" height="105" aria-label="Choose saturation and brightness" tabindex="0"></canvas><input id="hue" type="range" min="0" max="360" value="263" aria-label="Color hue"></div><div class="hex-row"><span>Foreground</span><label>#<input id="foreground-hex" value="b4a0ee" maxlength="6" aria-label="Foreground hex color"></label></div></div><div id="swatches-content" hidden></div></section>
      <section class="panel-group" id="properties-panel"><div class="inspector-tabs panel-tabs"><button class="selected" data-panel="properties">Properties</button><button data-panel="adjustments">Adjustments</button><button id="panel-more" class="panel-action" title="Collapse Properties panel" aria-label="Collapse Properties panel">${icon("chevron-up")}</button></div><div class="property-content"><section class="properties-section"><div class="section-title"><h3>${icon("image")} Document</h3><span>RGB / 8-bit</span></div><div class="property-grid"><label>W<div><input id="doc-width" type="number" value="1800" min="1" max="8000"><span>px</span></div></label><label>H<div><input id="doc-height" type="number" value="1200" min="1" max="8000"><span>px</span></div></label></div><div class="document-meta"><span>Resolution <b>72 pixels/inch</b></span></div><button class="outline full" id="resize">${icon("maximize")} Resize canvas</button><div class="section-title layer-properties-title"><h3>${icon("layers")} Selected layer</h3></div><div class="property-grid layer-position"><label>X<div><input id="layer-x" type="number" value="0" aria-label="Layer X position"><span>px</span></div></label><label>Y<div><input id="layer-y" type="number" value="0" aria-label="Layer Y position"><span>px</span></div></label></div></section>
      <section class="adjustments-section" hidden><div class="section-title"><h3>Single adjustments</h3></div><div class="adjustment-shortcuts"><button data-adjustment="brightness" title="Brightness / Contrast">${icon("sun")}<span>Brightness</span></button><button data-adjustment="contrast" title="Contrast">${icon("contrast")}<span>Contrast</span></button><button data-adjustment="saturation" title="Hue / Saturation">${icon("palette")}<span>Saturation</span></button></div>${[
        ["brightness", "Brightness"],
        ["contrast", "Contrast"],
        ["saturation", "Saturation"],
      ]
        .map(
          ([id, name]) =>
            `<label class="slider-label">${name}<output id="${id}-value">0</output><input id="${id}" type="range" min="0" max="200" value="100"></label>`,
        )
        .join(
          "",
        )}<button class="outline full" id="reset-adjustments">Reset adjustments</button></section></div></section>
      <section class="layers-section panel-group"><div class="layer-head panel-tabs"><div><button class="selected" id="layers-tab">Layers</button><button id="channels-tab">Channels</button><button id="paths-tab">Paths</button></div><button id="layer-options" class="panel-action" title="Duplicate selected layer">${icon("ellipsis")}</button></div><div class="layers-controls"><label class="layer-search">${icon("search")}<input id="layer-filter" placeholder="Find a layer" aria-label="Find a layer"></label><div class="layer-options"><select id="blend-mode" aria-label="Blend mode"><option value="source-over">Normal</option><option value="multiply">Multiply</option><option value="screen">Screen</option><option value="overlay">Overlay</option></select><label>Opacity <input id="opacity" type="number" min="0" max="100" value="100"><span>%</span></label></div><div class="lock-row"><span>Lock:</span><button id="lock-layer" title="Lock selected layer">${icon("lock-keyhole")}</button><span class="layers-count">2 layers</span></div></div><div id="layer-list"></div><div id="channels-content" hidden><p>RGB channels · read-only previews</p>${["RGB", "Red", "Green", "Blue"].map((c, i) => `<div class="channel-row"><canvas id="channel-${i}" width="60" height="40"></canvas><span>${c}</span>${icon("eye")}</div>`).join("")}</div><div id="paths-content" hidden><p>No vector paths.</p><span>The Pen tool draws raster strokes in this version.</span></div><div class="layer-footer"><button id="layer-link" title="Duplicate layer">${icon("copy")}</button><button id="layer-fx" title="Open adjustments"><em>fx</em></button><button id="add-mask" title="Select region for generative mask">${icon("rectangle-ellipsis")}</button><button id="new-group" title="Layer organization">${icon("folder-plus")}</button><button id="new-layer" title="New layer">${icon("square-plus")}</button><button id="delete-layer" title="Delete selected layer">${icon("trash-2")}</button></div></section>
    </aside>
    <section class="panel-flyout" id="flyout-history" aria-label="History" hidden><div class="flyout-heading"><h3>History</h3><button data-close-flyout aria-label="Close History">${icon("x")}</button></div><div class="history-tools"><button id="history-undo">${icon("undo-2")} Undo</button><button id="history-redo">${icon("redo-2")} Redo</button></div><div id="history-list"></div></section>
    <section class="panel-flyout" id="flyout-navigator" aria-label="Navigator" hidden><div class="flyout-heading"><h3>Navigator</h3><button data-close-flyout aria-label="Close Navigator">${icon("x")}</button></div><div class="navigator-preview"><canvas id="navigator-canvas" width="264" height="176"></canvas></div><label class="navigator-zoom">Zoom <input id="navigator-zoom" type="range" min="10" max="300" value="50"><output id="navigator-zoom-label">50%</output></label><button id="navigator-fit" class="outline full">Fit on screen</button></section>
    <section class="panel-flyout" id="flyout-generate" aria-label="Local generative AI" hidden><div class="flyout-heading"><h3>${icon("sparkles")} Generative AI</h3><button data-close-flyout aria-label="Close Generative AI">${icon("x")}</button></div><section class="generate-section"><span class="beta">LOCAL MODEL</span><p>Create with a model running on your own PC.</p><button class="outline full local-ai-settings" id="ai-settings">Local AI settings ${icon("settings-2")}</button><div class="gen-tabs"><button class="active" data-mode="fill">Generative fill</button><button data-mode="expand">Expand</button></div><label class="prompt-wrap"><textarea id="prompt" placeholder="Describe what you’d like to create…" maxlength="4000"></textarea><span>${icon("sparkles")} Your image stays on this PC.</span></label><div class="suggestions"><button data-prompt="Add a warm golden sunset to the sky, preserving the coastline">Golden sunset</button><button data-prompt="Add soft, dreamy clouds to the sky, preserving the scene">Dreamy clouds</button></div><button class="generate primary full" id="generate">${icon("sparkles")} Generate ${icon("arrow-up-right")}</button><div class="generation-note">${icon("shield-check")}<span>Your original image is always preserved.</span></div><div id="generation-message" role="status"></div></section></section>
  </main><input type="file" id="file-input" accept="image/*,.prism" hidden><div id="toast" role="status"></div><div id="menu-popover" hidden></div><dialog id="modal"><div id="modal-content"></div><button id="close-modal" class="outline">Got it</button></dialog>`;
}

export function initWorkspace({
  getState,
  actions,
  icon,
  refreshIcons,
  tools,
}) {
  const $ = (s) => document.querySelector(s),
    $$ = (s) => [...document.querySelectorAll(s)];
  let flyout = null,
    bottomTab = "layers",
    hue = 263,
    saturation = 0.33,
    value = 0.93,
    rulerFrame;
  let preferences = {
    width: 292,
    columns: 1,
    color: true,
    properties: true,
    workspace: "essentials",
  };
  try {
    const saved = JSON.parse(localStorage.getItem("prism-workspace") || "null");
    if (saved && typeof saved === "object")
      preferences = {
        width: Math.max(250, Math.min(440, Number(saved.width) || 292)),
        columns: saved.columns === 2 ? 2 : 1,
        color: saved.color !== false,
        properties: saved.properties !== false,
        workspace: ["essentials", "painting", "photography", "custom"].includes(
          saved.workspace,
        )
          ? saved.workspace
          : "essentials",
      };
  } catch {
    /* A damaged preference must not prevent opening an image. */
  }
  function remember() {
    try {
      localStorage.setItem("prism-workspace", JSON.stringify(preferences));
    } catch {
      /* Editing still works when storage is full or disabled. */
    }
  }
  function applyPreferences() {
    document.documentElement.style.setProperty(
      "--inspector-width",
      preferences.width + "px",
    );
    document.body.classList.toggle(
      "two-column-tools",
      preferences.columns === 2,
    );
    $("#color-panel").hidden = !preferences.color;
    $("#properties-panel").hidden = !preferences.properties;
    $("#workspace-select").value = preferences.workspace;
    $("#toolbar-columns").title =
      preferences.columns === 1
        ? "Switch to two-column toolbar"
        : "Switch to single-column toolbar";
    remember();
    requestAnimationFrame(actions.fit);
  }
  function customize() {
    preferences.workspace = "custom";
    $("#workspace-select").value = "custom";
    remember();
  }
  function setZoom(z) {
    actions.setZoom(Math.max(0.1, Math.min(3, z)));
  }
  function openFlyout(name) {
    flyout = name;
    $$(".panel-flyout").forEach(
      (el) => (el.hidden = el.id !== "flyout-" + name),
    );
    $$("[data-flyout]").forEach((el) => {
      el.classList.toggle("active", el.dataset.flyout === name);
      el.setAttribute("aria-expanded", String(el.dataset.flyout === name));
    });
    sync();
  }
  function toggleFlyout(name) {
    openFlyout(flyout === name ? null : name);
  }
  $$("[data-flyout]").forEach(
    (button) => (button.onclick = () => toggleFlyout(button.dataset.flyout)),
  );
  $$("[data-close-flyout]").forEach(
    (button) => (button.onclick = () => openFlyout(null)),
  );
  $("#history-button").onclick = () => toggleFlyout("history");
  $("#history-undo").onclick = actions.undo;
  $("#history-redo").onclick = actions.redo;
  $("#navigator-zoom").oninput = (e) => setZoom(Number(e.target.value) / 100);
  $("#navigator-fit").onclick = actions.fit;
  $("#toolbar-columns").onclick = () => {
    preferences.columns = preferences.columns === 1 ? 2 : 1;
    applyPreferences();
  };
  $("#toggle-panels").onclick = togglePanels;
  function togglePanels() {
    document.body.classList.toggle("panels-hidden");
    openFlyout(null);
    requestAnimationFrame(actions.fit);
  }
  function collapse(group, button) {
    const collapsed = $(group).classList.toggle("collapsed");
    $(button).setAttribute("aria-expanded", String(!collapsed));
    $(button).title = (collapsed ? "Expand" : "Collapse") + " panel";
  }
  $("#collapse-color").onclick = () =>
    collapse("#color-panel", "#collapse-color");
  $("#panel-more").onclick = () => collapse("#properties-panel", "#panel-more");
  $$(".panel-group>.panel-tabs").forEach(
    (header) =>
      (header.ondblclick = (e) => {
        if (!e.target.closest("button"))
          header.querySelector(".panel-action")?.click();
      }),
  );
  $("#workspace-select").onchange = (e) => {
    const name = e.target.value;
    if (name === "custom") return;
    preferences.workspace = name;
    preferences.color = name !== "photography";
    preferences.properties = name !== "painting";
    document.body.classList.remove("panels-hidden");
    if (name === "painting") actions.chooseTool("Brush");
    if (name === "photography") {
      document.querySelector('[data-panel="adjustments"]').click();
      actions.chooseTool("Move");
    }
    applyPreferences();
  };
  function resetWorkspace() {
    preferences = {
      width: 292,
      columns: 1,
      color: true,
      properties: true,
      workspace: "essentials",
    };
    document.body.classList.remove("panels-hidden");
    $$(".collapsed").forEach((el) => el.classList.remove("collapsed"));
    document.querySelector('[data-panel="properties"]').click();
    setBottomTab("layers");
    openFlyout(null);
    applyPreferences();
  }
  const resizer = $("#panel-resizer");
  let resizeStart = null;
  resizer.onpointerdown = (e) => {
    resizeStart = { x: e.clientX, width: preferences.width };
    resizer.setPointerCapture(e.pointerId);
    document.body.classList.add("resizing-panels");
  };
  resizer.onpointermove = (e) => {
    if (!resizeStart) return;
    preferences.width = Math.max(
      250,
      Math.min(440, resizeStart.width + resizeStart.x - e.clientX),
    );
    document.documentElement.style.setProperty(
      "--inspector-width",
      preferences.width + "px",
    );
  };
  resizer.onpointerup = resizer.onpointercancel = () => {
    if (!resizeStart) return;
    resizeStart = null;
    document.body.classList.remove("resizing-panels");
    customize();
    actions.fit();
  };
  resizer.onkeydown = (e) => {
    if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
    e.preventDefault();
    preferences.width = Math.max(
      250,
      Math.min(440, preferences.width + (e.key === "ArrowLeft" ? 10 : -10)),
    );
    customize();
    applyPreferences();
  };
  $("#options-deselect").onclick = actions.deselect;
  $("#apply-crop").onclick = actions.crop;
  for (const id of ["brush-size", "brush-opacity", "text-size"])
    $("#" + id).onchange = (e) => {
      const low = Number(e.target.min),
        high = Number(e.target.max);
      e.target.value = Math.max(
        low,
        Math.min(high, Number(e.target.value) || low),
      );
    };
  $("#layer-x").onchange = (e) =>
    actions.moveLayer("x", Number(e.target.value));
  $("#layer-y").onchange = (e) =>
    actions.moveLayer("y", Number(e.target.value));
  $$("[data-adjustment]").forEach(
    (button) =>
      (button.onclick = () => $("#" + button.dataset.adjustment).focus()),
  );
  $("#layer-filter").oninput = filterLayers;
  function filterLayers() {
    const query = $("#layer-filter").value.trim().toLowerCase();
    $$(".layer-row").forEach(
      (row) =>
        (row.hidden = !row
          .querySelector(".layer-name")
          .textContent.toLowerCase()
          .includes(query)),
    );
  }
  function setBottomTab(name) {
    bottomTab = name;
    ["layers", "channels", "paths"].forEach((tab) => {
      $("#" + tab + "-tab").classList.toggle("selected", name === tab);
      $("#" + tab + "-tab").setAttribute("aria-selected", String(name === tab));
    });
    $(".layers-controls").hidden = name !== "layers";
    $("#layer-list").hidden = name !== "layers";
    $(".layer-footer").hidden = name !== "layers";
    $("#channels-content").hidden = name !== "channels";
    $("#paths-content").hidden = name !== "paths";
    sync();
  }
  $("#layers-tab").onclick = () => setBottomTab("layers");
  $("#channels-tab").onclick = () => setBottomTab("channels");
  $("#paths-tab").onclick = () => setBottomTab("paths");
  function hsvToHex(h, s, v) {
    const f = (n) => {
      const k = (n + h / 60) % 6;
      return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255)
        .toString(16)
        .padStart(2, "0");
    };
    return "#" + f(5) + f(3) + f(1);
  }
  function drawColorField() {
    const c = $("#color-field"),
      ctx = c.getContext("2d");
    ctx.fillStyle = `hsl(${hue} 100% 50%)`;
    ctx.fillRect(0, 0, c.width, c.height);
    let g = ctx.createLinearGradient(0, 0, c.width, 0);
    g.addColorStop(0, "white");
    g.addColorStop(1, "#ffffff00");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
    g = ctx.createLinearGradient(0, 0, 0, c.height);
    g.addColorStop(0, "#00000000");
    g.addColorStop(1, "black");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.beginPath();
    ctx.arc(saturation * c.width, (1 - value) * c.height, 4, 0, Math.PI * 2);
    ctx.strokeStyle = "black";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = "white";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  function setForeground(hex, updateHue = true) {
    if (!/^#[\da-f]{6}$/i.test(hex)) return;
    $("#color").value = hex;
    $("#foreground-preview").style.background = hex;
    $("#foreground-hex").value = hex.slice(1);
    if (updateHue) {
      const [r, g, b] = hex
          .slice(1)
          .match(/../g)
          .map((v) => parseInt(v, 16) / 255),
        max = Math.max(r, g, b),
        min = Math.min(r, g, b),
        d = max - min;
      value = max;
      saturation = max === 0 ? 0 : d / max;
      if (d) {
        hue =
          60 *
          (max === r
            ? ((g - b) / d + 6) % 6
            : max === g
              ? (b - r) / d + 2
              : (r - g) / d + 4);
        $("#hue").value = hue;
      }
    }
    drawColorField();
  }
  function pickColor(e) {
    const c = $("#color-field"),
      r = c.getBoundingClientRect();
    saturation = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    value = 1 - Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
    setForeground(hsvToHex(hue, saturation, value), false);
  }
  $("#color-field").onpointerdown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pickColor(e);
  };
  $("#color-field").onpointermove = (e) => {
    if (e.buttons === 1) pickColor(e);
  };
  $("#color-field").onkeydown = (e) => {
    const dx =
        e.key === "ArrowLeft" ? -0.02 : e.key === "ArrowRight" ? 0.02 : 0,
      dy = e.key === "ArrowUp" ? 0.02 : e.key === "ArrowDown" ? -0.02 : 0;
    if (dx || dy) {
      e.preventDefault();
      saturation = Math.max(0, Math.min(1, saturation + dx));
      value = Math.max(0, Math.min(1, value + dy));
      setForeground(hsvToHex(hue, saturation, value), false);
    }
  };
  $("#hue").oninput = (e) => {
    hue = Number(e.target.value);
    setForeground(hsvToHex(hue, saturation, value), false);
  };
  $("#color").addEventListener("input", (e) => setForeground(e.target.value));
  $("#foreground-hex").onchange = (e) => {
    if (/^[\da-f]{6}$/i.test(e.target.value))
      setForeground("#" + e.target.value);
    else e.target.value = $("#color").value.slice(1);
  };
  $("#swap-color").onclick = () => setForeground("#000000");
  const swatches = [
    "#000000",
    "#3b3b3b",
    "#777777",
    "#b2b2b2",
    "#dddddd",
    "#ffffff",
    "#b4a0ee",
    "#8061bd",
    "#3856b8",
    "#3d8cdd",
    "#2bb8cc",
    "#36b9a5",
    "#39814e",
    "#83b747",
    "#c6ce50",
    "#f7d570",
    "#eeae66",
    "#e7774e",
    "#cb535f",
    "#b03c70",
    "#684269",
    "#463b57",
    "#283641",
    "#334f59",
    "#708a8e",
    "#aeb0a1",
    "#d1bbae",
    "#f1d9c0",
  ];
  $("#swatches-content").innerHTML = swatches
    .map(
      (color) =>
        `<button style="background:${color}" title="${color}" aria-label="Set foreground ${color}" data-swatch="${color}"></button>`,
    )
    .join("");
  $$("[data-swatch]").forEach(
    (b) => (b.onclick = () => setForeground(b.dataset.swatch)),
  );
  $$("[data-color-tab]").forEach(
    (b) =>
      (b.onclick = () => {
        $$("[data-color-tab]").forEach((x) =>
          x.classList.toggle("selected", x === b),
        );
        $("#color-content").hidden = b.dataset.colorTab !== "color";
        $("#swatches-content").hidden = b.dataset.colorTab !== "swatches";
      }),
  );
  function showMenu(anchor, items) {
    const menu = $("#menu-popover");
    menu.replaceChildren();
    for (const [label, run] of items) {
      const button = document.createElement("button");
      button.textContent = label;
      button.onclick = () => {
        menu.hidden = true;
        run();
      };
      menu.append(button);
    }
    const r = anchor.getBoundingClientRect();
    menu.style.left = Math.min(r.left, innerWidth - 200) + "px";
    menu.style.top = Math.min(r.bottom + 2, innerHeight - 250) + "px";
    menu.hidden = false;
  }
  $("#zoom-reset").onclick = (e) => {
    e.stopPropagation();
    showMenu(e.currentTarget, [
      ["25%", () => setZoom(0.25)],
      ["50%", () => setZoom(0.5)],
      ["100%", () => setZoom(1)],
      ["200%", () => setZoom(2)],
      ["Fit on screen", actions.fit],
    ]);
  };
  $("#tool-search").onclick = () => {
    actions.modal(
      "Find a tool",
      '<input id="command-search" class="ai-address" placeholder="Search tools…" aria-label="Search tools"><div id="command-results"></div>',
    );
    function results() {
      const q = $("#command-search").value.toLowerCase();
      $("#command-results").replaceChildren();
      for (const [, name, key] of tools.filter((t) =>
        t[1].toLowerCase().includes(q),
      )) {
        const b = document.createElement("button");
        b.textContent = name + "  ·  " + key;
        b.onclick = () => {
          $("#modal").close();
          actions.chooseTool(name);
        };
        $("#command-results").append(b);
      }
    }
    $("#command-search").oninput = results;
    results();
    $("#command-search").focus();
  };
  const groups = {
    Brush: ["Brush", "Pen brush", "Clone brush"],
    "Lasso select": ["Marquee select", "Lasso select"],
    "Pen brush": ["Pen brush", "Brush"],
    Rectangle: ["Rectangle", "Gradient"],
  };
  $$(".tool").forEach((button) => {
    if (!groups[button.dataset.tool]) return;
    button.title += " · Right-click for related tools";
    button.oncontextmenu = (e) => {
      e.preventDefault();
      showMenu(
        button,
        groups[button.dataset.tool].map((name) => [
          name,
          () => actions.chooseTool(name),
        ]),
      );
    };
  });
  document.addEventListener("keydown", (e) => {
    if (
      e.key === "Tab" &&
      !["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(
        document.activeElement.tagName,
      ) &&
      !$("#modal").open
    ) {
      e.preventDefault();
      togglePanels();
    }
    if (e.key === "Escape") openFlyout(null);
  });
  $("#stage").addEventListener("scroll", () => {
    cancelAnimationFrame(rulerFrame);
    rulerFrame = requestAnimationFrame(drawRulers);
  });
  function drawRulers() {
    const { zoom } = getState(),
      canvas = $("#canvas").getBoundingClientRect(),
      area = $("#canvas-area").getBoundingClientRect();
    const step = zoom < 0.3 ? 500 : zoom < 0.7 ? 200 : 100;
    for (const [id, origin, size] of [
      ["#ruler-x", canvas.left - area.left - 20, area.width - 20],
      ["#ruler-y", canvas.top - area.top - 20, area.height - 20],
    ]) {
      const horizontal = id === "#ruler-x",
        container = $(id);
      container.replaceChildren();
      const start = Math.floor(-origin / (step * zoom)) * step;
      for (
        let n = start, limit = 0;
        origin + n * zoom < size && limit < 200;
        n += step, limit++
      ) {
        const span = document.createElement("span");
        span.textContent = n;
        span.style[horizontal ? "left" : "top"] = origin + n * zoom + "px";
        container.append(span);
      }
    }
  }
  function sync() {
    const state = getState(),
      { canvas, zoom, tool, selection, active, history, future } = state;
    const paint = ["Brush", "Pen brush", "Eraser", "Clone brush"].includes(
        tool,
      ),
      isSelection = [
        "Marquee select",
        "Lasso select",
        "Crop to selection",
        "Generative fill",
      ].includes(tool);
    $("#move-options").hidden = tool !== "Move";
    $("#paint-options").hidden = !paint;
    $("#text-options").hidden = tool !== "Text";
    $("#selection-options").hidden = !isSelection;
    $("#generic-options").hidden =
      tool === "Move" || paint || isSelection || tool === "Text";
    $("#generic-tool-help").textContent =
      {
        Gradient: "Drag to draw with the foreground color",
        Rectangle: "Drag to draw a filled rectangle",
        Hand: "Drag to pan at a larger zoom",
        Zoom: "Click the image to zoom in",
        Eyedropper: "Click the image to sample a color",
      }[tool] || "";
    $("#paint-help").textContent =
      tool === "Clone brush"
        ? "Alt-click to set a clone source"
        : tool === "Eraser"
          ? "Erase on the selected layer"
          : "Paint on the selected layer";
    $("#selection-dimensions").textContent = selection
      ? `${Math.round(selection.w)} × ${Math.round(selection.h)} px selected`
      : "Drag to create a selection";
    $("#options-deselect").disabled = !selection;
    $("#apply-crop").hidden = tool !== "Crop to selection";
    $("#apply-crop").disabled = !selection;
    $("#current-tool-icon").innerHTML = icon(
      tools.find((t) => t[1] === tool)?.[0] || "mouse-pointer-2",
    );
    $$(".tool").forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.tool === tool)),
    );
    $("#layer-x").value = Math.round(active?.x || 0);
    $("#layer-y").value = Math.round(active?.y || 0);
    $("#layer-x").disabled = $("#layer-y").disabled = !active || active.locked;
    $("#lock-layer").setAttribute(
      "aria-pressed",
      String(active?.locked || false),
    );
    $("#undo").disabled = $("#history-undo").disabled = !history.length;
    $("#redo").disabled = $("#history-redo").disabled = !future.length;
    $("#navigator-zoom").value = Math.round(zoom * 100);
    $("#navigator-zoom-label").value = Math.round(zoom * 100) + "%";
    if (flyout === "navigator") {
      const c = $("#navigator-canvas"),
        ctx = c.getContext("2d");
      c.height = Math.max(
        1,
        Math.round((c.width * canvas.height) / canvas.width),
      );
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(canvas, 0, 0, c.width, c.height);
    }
    if (flyout === "history") {
      $("#history-list").replaceChildren();
      history.forEach((snapshot, index) => {
        const b = document.createElement("button");
        b.innerHTML = icon("history") + "<span></span>";
        b.querySelector("span").textContent =
          `Before edit ${index + 1} · ${snapshot.layers.length} layers`;
        b.onclick = () => actions.restoreTo(index);
        $("#history-list").append(b);
      });
      const current = document.createElement("div");
      current.className = "current-history";
      current.textContent =
        "Current document · " + state.layers.length + " layers";
      $("#history-list").append(current);
    }
    if (bottomTab === "channels")
      for (let i = 0; i < 4; i++) {
        const c = $("#channel-" + i),
          ctx = c.getContext("2d");
        ctx.drawImage(canvas, 0, 0, c.width, c.height);
        if (i) {
          const data = ctx.getImageData(0, 0, c.width, c.height);
          for (let j = 0; j < data.data.length; j += 4) {
            const color = data.data[j + i - 1];
            data.data[j] = data.data[j + 1] = data.data[j + 2] = color;
          }
          ctx.putImageData(data, 0, 0);
        }
      }
    filterLayers();
    if ($("#foreground-hex").value.toLowerCase() !== $("#color").value.slice(1))
      setForeground($("#color").value);
    document.title = $("#document-name").textContent + " — Prism Studio";
    cancelAnimationFrame(rulerFrame);
    rulerFrame = requestAnimationFrame(drawRulers);
    refreshIcons();
  }
  setForeground($("#color").value);
  if (preferences.workspace === "painting") actions.chooseTool("Brush");
  if (preferences.workspace === "photography")
    document.querySelector('[data-panel="adjustments"]').click();
  applyPreferences();
  return {
    showProperties: (tab = "properties") => {
      if (!preferences.properties) {
        preferences.properties = true;
        customize();
        applyPreferences();
      }
      $("#properties-panel").classList.remove("collapsed");
      document.querySelector(`[data-panel="${tab}"]`).click();
    },
    sync,
    openFlyout,
    toggleFlyout,
    togglePanels,
    resetWorkspace,
    setForeground,
    windowMenu: () => [
      [
        preferences.color ? "Hide Color panel" : "Show Color panel",
        () => {
          preferences.color = !preferences.color;
          customize();
          applyPreferences();
        },
      ],
      [
        preferences.properties
          ? "Hide Properties panel"
          : "Show Properties panel",
        () => {
          preferences.properties = !preferences.properties;
          customize();
          applyPreferences();
        },
      ],
      [
        "Layers",
        () => {
          document.body.classList.remove("panels-hidden");
          setBottomTab("layers");
          actions.fit();
        },
      ],
      ["History", () => openFlyout("history")],
      ["Navigator", () => openFlyout("navigator")],
      ["Local generative AI", () => openFlyout("generate")],
      ["Hide / show panels", togglePanels],
      ["Reset Essentials", resetWorkspace],
    ],
  };
}
