import { processPixels } from "./imaging.js";
export const createCanvas = (width, height) => {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  return c;
};
export function cloneCanvas(canvas) {
  if (!canvas) return null;
  const out = createCanvas(canvas.width, canvas.height);
  out.getContext("2d").drawImage(canvas, 0, 0);
  return out;
}
export function snapshotLayers(layers) {
  return layers.map((l) => ({
    ...l,
    canvas: cloneCanvas(l.canvas),
    mask: cloneCanvas(l.mask),
    effect: l.effect ? { ...l.effect } : undefined,
  }));
}
export function selectionMask(selection, width, height) {
  const out = createCanvas(width, height),
    ctx = out.getContext("2d");
  if (!selection) {
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, width, height);
    return out;
  }
  if (selection.mask) {
    ctx.drawImage(selection.mask, 0, 0);
    return out;
  }
  ctx.fillStyle = "white";
  ctx.beginPath();
  if (selection.points?.length) {
    ctx.moveTo(selection.points[0].x, selection.points[0].y);
    for (const p of selection.points.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.closePath();
  } else ctx.rect(selection.x, selection.y, selection.w, selection.h);
  ctx.fill();
  return out;
}
export function alphaMask(alpha, width, height) {
  const out = createCanvas(width, height),
    ctx = out.getContext("2d"),
    image = ctx.createImageData(width, height);
  for (let i = 0; i < alpha.length; i++) {
    image.data[i * 4] = image.data[i * 4 + 1] = image.data[i * 4 + 2] = 255;
    image.data[i * 4 + 3] = alpha[i];
  }
  ctx.putImageData(image, 0, 0);
  return out;
}
export function getMaskAlpha(mask) {
  const data = mask
      .getContext("2d")
      .getImageData(0, 0, mask.width, mask.height).data,
    out = new Uint8ClampedArray(mask.width * mask.height);
  for (let i = 0; i < out.length; i++) out[i] = data[i * 4 + 3];
  return out;
}
export function maskBounds(mask) {
  const alpha = getMaskAlpha(mask),
    w = mask.width,
    h = mask.height;
  let left = w,
    top = h,
    right = -1,
    bottom = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (alpha[y * w + x] > 0) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
  return right < 0
    ? null
    : { x: left, y: top, w: right - left + 1, h: bottom - top + 1, mask };
}
export function renderLayer(layer, width, height) {
  const out = createCanvas(width, height),
    ctx = out.getContext("2d");
  ctx.drawImage(layer.canvas, layer.x, layer.y);
  if (layer.mask) {
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(layer.mask, layer.x, layer.y);
  }
  return out;
}
export function compositeLayers(layers, width, height) {
  const result = createCanvas(width, height),
    ctx = result.getContext("2d", { willReadFrequently: true });
  for (const l of [...layers].reverse()) {
    if (!l.visible) continue;
    if (l.kind === "adjustment" && l.effect) {
      const before = ctx.getImageData(0, 0, width, height),
        after = processPixels(before.data, width, height, l.effect),
        mask = l.mask ? renderMask(l, width, height) : null;
      for (let i = 0; i < after.length; i += 4) {
        const strength = l.opacity * (mask ? mask[i + 3] / 255 : 1);
        for (let c = 0; c < 3; c++)
          before.data[i + c] =
            before.data[i + c] * (1 - strength) + after[i + c] * strength;
      }
      ctx.putImageData(before, 0, 0);
      continue;
    }
    ctx.globalAlpha = l.opacity;
    ctx.globalCompositeOperation = l.blend;
    ctx.drawImage(
      l.mask ? renderLayer(l, width, height) : l.canvas,
      l.mask ? 0 : l.x,
      l.mask ? 0 : l.y,
    );
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  return result;
}
function renderMask(layer, width, height) {
  const c = createCanvas(width, height);
  c.getContext("2d").drawImage(layer.mask, layer.x, layer.y);
  return c.getContext("2d").getImageData(0, 0, width, height).data;
}
export function drawSelected(
  layer,
  selection,
  width,
  height,
  draw,
  composite = "source-over",
  maskValue = undefined,
) {
  const stroke = createCanvas(width, height),
    ctx = stroke.getContext("2d");
  draw(ctx);
  if (selection) {
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(selectionMask(selection, width, height), 0, 0);
  }
  const target = layer.canvas.getContext("2d");
  if (maskValue !== undefined) {
    const image = target.getImageData(
        0,
        0,
        layer.canvas.width,
        layer.canvas.height,
      ),
      coverage = ctx.getImageData(0, 0, width, height).data;
    for (let y = 0; y < layer.canvas.height; y++)
      for (let x = 0; x < layer.canvas.width; x++) {
        const wx = Math.floor(x + layer.x),
          wy = Math.floor(y + layer.y);
        if (wx < 0 || wy < 0 || wx >= width || wy >= height) continue;
        const strength = coverage[(wy * width + wx) * 4 + 3] / 255;
        if (!strength) continue;
        const i = (y * layer.canvas.width + x) * 4;
        image.data[i] = image.data[i + 1] = image.data[i + 2] = 255;
        image.data[i + 3] =
          image.data[i + 3] * (1 - strength) + maskValue * 255 * strength;
      }
    target.putImageData(image, 0, 0);
    return;
  }
  target.save();
  target.globalCompositeOperation = composite;
  target.drawImage(stroke, -layer.x, -layer.y);
  target.restore();
}
export function applyMask(layer) {
  if (!layer.mask) return;
  const ctx = layer.canvas.getContext("2d");
  ctx.save();
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(layer.mask, 0, 0);
  ctx.restore();
  layer.mask = null;
}
