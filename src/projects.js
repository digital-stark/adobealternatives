import { validatePath } from "./bezier.js";
import { validateGroups } from "./layer-groups.js";
import { validateEffect } from "./imaging.js";
const blends = new Set([
  "source-over",
  "multiply",
  "screen",
  "overlay",
  "darken",
  "lighten",
  "color-dodge",
  "color-burn",
  "hard-light",
  "soft-light",
  "difference",
  "exclusion",
  "hue",
  "saturation",
  "color",
  "luminosity",
]);
const png = /^data:image\/png;base64,[A-Za-z0-9+/]+=*$/;
export function validateProject(value) {
  if (
    !value ||
    value.format !== "prism-project" ||
    ![1, 2, 3].includes(value.version)
  )
    throw new Error("This is not a supported Prism project.");
  const { width, height, layers, adjustments } = value;
  if (![width, height].every((n) => Number.isInteger(n) && n >= 1 && n <= 8000))
    throw new Error("Invalid project dimensions.");
  if (
    !Array.isArray(layers) ||
    !layers.length ||
    layers.length > 100 ||
    width * height * layers.reduce((n, l) => n + 1 + (l?.mask ? 1 : 0), 0) >
      100_000_000
  )
    throw new Error("This project exceeds the layer or memory limit.");
  if (
    value.ppi !== undefined &&
    (!Number.isFinite(value.ppi) || value.ppi < 1 || value.ppi > 2400)
  )
    throw new Error("Invalid print resolution.");
  for (const l of layers) {
    if (
      !l ||
      typeof l.name !== "string" ||
      l.name.length > 200 ||
      !png.test(l.image) ||
      l.image.length > 100_000_000 ||
      !Number.isFinite(l.x) ||
      !Number.isFinite(l.y) ||
      Math.abs(l.x) > 100000 ||
      Math.abs(l.y) > 100000 ||
      !Number.isFinite(l.opacity) ||
      l.opacity < 0 ||
      l.opacity > 1 ||
      !blends.has(l.blend) ||
      typeof l.visible !== "boolean" ||
      typeof l.locked !== "boolean"
    )
      throw new Error("A project layer is invalid.");
    if (l.mask && (!png.test(l.mask) || l.mask.length > 100_000_000))
      throw new Error("Invalid layer mask.");
    if (l.kind !== undefined && !["pixel", "adjustment"].includes(l.kind))
      throw new Error("Invalid layer kind.");
    if (l.kind === "adjustment") {
      validateEffect(l.effect);
      if (
        ![
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
        ].includes(l.effect.type)
      )
        throw new Error(
          "This filter cannot be stored as an editable adjustment layer",
        );
    }
    if (l.groups !== undefined) validateGroups(l.groups);
    if (
      l.group !== undefined &&
      (typeof l.group !== "string" || l.group.length > 200)
    )
      throw new Error("Invalid layer group.");
    if (l.path !== undefined) validatePath(l.path);
  }
  if (
    !adjustments ||
    !["brightness", "contrast", "saturation"].every(
      (k) =>
        Number.isFinite(adjustments[k]) &&
        adjustments[k] >= 0 &&
        adjustments[k] <= 200,
    )
  )
    throw new Error("Invalid project adjustments.");
  if (
    !Number.isInteger(value.activeIndex) ||
    value.activeIndex < 0 ||
    value.activeIndex >= layers.length
  )
    throw new Error("Invalid active layer.");
  return value;
}
export function serializeProject({
  canvas,
  layers,
  adjustments,
  activeId,
  name,
  ppi = 72,
}) {
  const data = {
    format: "prism-project",
    version: 3,
    name: name || "Untitled",
    width: canvas.width,
    height: canvas.height,
    ppi,
    adjustments: { ...adjustments },
    activeIndex: layers.findIndex((l) => l.id === activeId),
    layers: layers.map((l) => ({
      name: l.name,
      x: l.x,
      y: l.y,
      visible: l.visible,
      locked: l.locked,
      opacity: l.opacity,
      blend: l.blend,
      image: l.canvas.toDataURL("image/png"),
      ...(l.mask ? { mask: l.mask.toDataURL("image/png") } : {}),
      ...(l.kind === "adjustment"
        ? { kind: "adjustment", effect: { ...l.effect } }
        : {}),
      ...(l.group ? { group: l.group } : {}),
      ...(l.groups ? { groups: l.groups.map((g) => ({ ...g })) } : {}),
      ...(l.path
        ? {
            path: l.path.map((p) => ({ ...p })),
            pathClosed: l.pathClosed !== false,
          }
        : {}),
    })),
  };
  validateProject(data);
  return JSON.stringify(data);
}
export async function deserializeProject(text) {
  if (text.length > 150_000_000)
    throw new Error("Project files must be smaller than 150 MB.");
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("This project file is damaged.");
  }
  const data = validateProject(parsed),
    layers = [];
  async function decode(source) {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () =>
        reject(new Error("A project image could not be decoded."));
      img.src = source;
    });
    if (img.naturalWidth !== data.width || img.naturalHeight !== data.height)
      throw new Error("A project layer has inconsistent dimensions.");
    const canvas = document.createElement("canvas");
    canvas.width = data.width;
    canvas.height = data.height;
    canvas.getContext("2d").drawImage(img, 0, 0);
    return canvas;
  }
  for (const l of data.layers)
    layers.push({
      ...l,
      canvas: await decode(l.image),
      mask: l.mask ? await decode(l.mask) : null,
      effect: l.effect ? validateEffect(l.effect) : undefined,
    });
  return { ...data, layers, ppi: data.ppi || 72 };
}
