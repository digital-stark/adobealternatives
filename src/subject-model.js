import * as ort from "onnxruntime-web/wasm";
let session;
export async function selectSubject(canvas, refineHair = false) {
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.wasmPaths = new URL("runtime/", document.baseURI).href;
  session ||= ort.InferenceSession.create(
    new URL("models/u2netp.onnx", document.baseURI).href,
    { executionProviders: ["wasm"], graphOptimizationLevel: "all" },
  ).catch((e) => {
    session = null;
    throw e;
  });
  const model = await session,
    size = 320,
    small = document.createElement("canvas");
  small.width = small.height = size;
  const c = small.getContext("2d");
  c.drawImage(canvas, 0, 0, size, size);
  const rgba = c.getImageData(0, 0, size, size).data,
    input = new Float32Array(3 * size * size);
  let max = 1;
  for (let i = 0; i < rgba.length; i += 4)
    max = Math.max(max, rgba[i], rgba[i + 1], rgba[i + 2]);
  const mean = [0.485, 0.456, 0.406],
    std = [0.229, 0.224, 0.225];
  for (let p = 0; p < size * size; p++)
    for (let k = 0; k < 3; k++)
      input[k * size * size + p] = (rgba[p * 4 + k] / max - mean[k]) / std[k];
  const output = await model.run({
    [model.inputNames[0]]: new ort.Tensor("float32", input, [1, 3, size, size]),
  });
  const data = output[model.outputNames[0]].data;
  let lo = Infinity,
    hi = -Infinity;
  for (const v of data) {
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  if (hi - lo < 1e-8)
    throw new Error("The model could not identify a subject.");
  const image = c.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    image.data[i * 4] = image.data[i * 4 + 1] = image.data[i * 4 + 2] = 255;
    image.data[i * 4 + 3] = (255 * (data[i] - lo)) / (hi - lo);
  }
  c.putImageData(image, 0, 0);
  const mask = document.createElement("canvas");
  mask.width = canvas.width;
  mask.height = canvas.height;
  const ctx = mask.getContext("2d");
  ctx.drawImage(small, 0, 0, mask.width, mask.height);
  if (refineHair) refineMatte(canvas, mask);
  return mask;
}
// Edge-aware colour affinity refines a soft model matte at the original resolution.
// This estimates visible strands; it cannot reconstruct hair absent from the photo.
function refineMatte(source, mask) {
  const w = mask.width,
    h = mask.height,
    ctx = mask.getContext("2d"),
    m = ctx.getImageData(0, 0, w, h),
    rgb = source.getContext("2d").getImageData(0, 0, w, h).data;
  const alpha = new Uint8ClampedArray(w * h);
  for (let p = 0; p < alpha.length; p++) alpha[p] = m.data[p * 4 + 3];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const p = y * w + x,
        a = alpha[p];
      if (a < 8 || a > 247) continue;
      let sum = 0,
        weight = 0;
      for (let dy = -3; dy <= 3; dy++)
        for (let dx = -3; dx <= 3; dx++) {
          const xx = x + dx,
            yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const q = yy * w + xx;
          let distance = 0;
          for (let k = 0; k < 3; k++)
            distance += (rgb[p * 4 + k] - rgb[q * 4 + k]) ** 2;
          const v = Math.exp(-distance / 1200 - (dx * dx + dy * dy) / 12);
          sum += alpha[q] * v;
          weight += v;
        }
      m.data[p * 4 + 3] = sum / weight;
    }
  ctx.putImageData(m, 0, 0);
}
