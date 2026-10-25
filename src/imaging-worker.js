import { processPixels, creativeRemap, refineMask } from "./imaging.js";
self.postMessage({ ready: true });
self.onmessage = ({ data }) => {
  try {
    const pixels = new Uint8ClampedArray(data.pixels),
      result = data.refine
        ? refineMask(pixels, data.width, data.height, data.refine)
        : data.creative
          ? creativeRemap(
              pixels,
              data.width,
              data.height,
              data.creative,
              data.segments,
            )
          : processPixels(pixels, data.width, data.height, data.effect);
    self.postMessage({ id: data.id, pixels: result.buffer }, [result.buffer]);
  } catch (error) {
    self.postMessage({ id: data.id, error: error.message });
  }
};
