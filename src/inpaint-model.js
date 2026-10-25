import * as ort from "onnxruntime-web/wasm";
let session;
// MI-GAN Places2, 512px receptive field. Original pixels outside the mask
// are copied exactly; model pixels are blended only through selected alpha.
export async function inpaint(source, mask) {
  const w = source.width,
    h = source.height;
  if (mask.width !== w || mask.height !== h)
    throw new Error("Inpainting mask dimensions differ.");
  const rgba = mask.getContext("2d").getImageData(0, 0, w, h).data;
  let x0 = w,
    y0 = h,
    x1 = -1,
    y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (rgba[(y * w + x) * 4 + 3] > 0) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
  if (x1 < 0) throw new Error("Select an area to remove.");
  const margin = Math.max(64, Math.ceil(Math.max(x1 - x0, y1 - y0) * 0.5));
  x0 = Math.max(0, x0 - margin);
  y0 = Math.max(0, y0 - margin);
  x1 = Math.min(w, x1 + margin + 1);
  y1 = Math.min(h, y1 + margin + 1);
  const cw = x1 - x0,
    ch = y1 - y0,
    size = 512,
    n = size * size;
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.wasmPaths = new URL("runtime/", document.baseURI).href;
  session ||= ort.InferenceSession.create(
    new URL("models/migan.onnx", document.baseURI).href,
    { executionProviders: ["wasm"], graphOptimizationLevel: "all" },
  ).catch((e) => {
    session = null;
    throw e;
  });
  const model = await session,
    small = document.createElement("canvas");
  small.width = small.height = size;
  const c = small.getContext("2d");
  c.drawImage(source, x0, y0, cw, ch, 0, 0, size, size);
  const image = c.getImageData(0, 0, size, size).data;
  c.clearRect(0, 0, size, size);
  c.drawImage(mask, x0, y0, cw, ch, 0, 0, size, size);
  const alpha = c.getImageData(0, 0, size, size).data;
  const input = new Float32Array(4 * n);
  for (let p = 0; p < n; p++) {
    const known = alpha[p * 4 + 3] > 0 ? 0 : 1;
    input[p] = known - 0.5;
    for (let k = 0; k < 3; k++)
      input[(k + 1) * n + p] = ((image[p * 4 + k] * 2) / 255 - 1) * known;
  }
  const outputs = await model.run({
      [model.inputNames[0]]: new ort.Tensor("float32", input, [
        1,
        4,
        size,
        size,
      ]),
    }),
    out = outputs[model.outputNames[0]].data,
    pixels = c.createImageData(size, size);
  for (let p = 0; p < n; p++) {
    for (let k = 0; k < 3; k++)
      pixels.data[p * 4 + k] = (out[k * n + p] * 0.5 + 0.5) * 255;
    pixels.data[p * 4 + 3] = 255;
  }
  c.putImageData(pixels, 0, 0);
  const prediction = document.createElement("canvas");
  prediction.width = w;
  prediction.height = h;
  const pc = prediction.getContext("2d");
  pc.drawImage(small, 0, 0, size, size, x0, y0, cw, ch);
  const src = source.getContext("2d").getImageData(0, 0, w, h),
    fill = pc.getImageData(0, 0, w, h);
  for (let p = 0; p < w * h; p++) {
    const a = rgba[p * 4 + 3] / 255;
    if (!a) continue;
    for (let k = 0; k < 3; k++)
      src.data[p * 4 + k] =
        src.data[p * 4 + k] * (1 - a) + fill.data[p * 4 + k] * a;
    src.data[p * 4 + 3] = Math.max(src.data[p * 4 + 3], rgba[p * 4 + 3]);
  }
  pc.putImageData(src, 0, 0);
  return prediction;
}
