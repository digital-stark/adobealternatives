export const isRaw = (file) =>
  /\.(dng|cr2|cr3|nef|nrw|arw|sr2|srf|raf|rw2|orf|pef|raw|rwl|3fr|iiq)$/i.test(
    file.name,
  );
// LibRaw's worker and WASM are shipped with the application; no network service.
export async function decodeRaw(file, settings = {}) {
  if (file.size > 150_000_000)
    throw new Error("RAW files must be smaller than 150 MB.");
  const { default: LibRaw } = await import(
    /* @vite-ignore */ new URL("raw/index.js", document.baseURI).href
  );
  const raw = new LibRaw();
  try {
    await raw.open(new Uint8Array(await file.arrayBuffer()), {
      useCameraWb: true,
      outputColor: 1,
      outputBps: 8,
      userQual: 3,
      ...settings,
    });
    const metadata = await raw.metadata();
    const scale = settings.halfSize ? 2 : 1;
    if (
      metadata.width / scale > 8000 ||
      metadata.height / scale > 8000 ||
      (metadata.width * metadata.height) / (scale * scale) > 32_000_000
    )
      throw new Error(
        "RAW exceeds the document limit. Try half-size decoding.",
      );
    const image = await raw.imageData();
    if (
      !image ||
      !image.width ||
      !image.height ||
      image.width > 8000 ||
      image.height > 8000 ||
      image.width * image.height > 32_000_000
    )
      throw new Error(
        "Decoded RAW exceeds the document limit. Try half-size decoding.",
      );
    if (image.bits !== 8 || image.colors < 3)
      throw new Error("Unsupported RAW decoder output.");
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const pixels = new Uint8ClampedArray(image.width * image.height * 4);
    for (let i = 0; i < image.width * image.height; i++) {
      pixels[i * 4] = image.data[i * image.colors];
      pixels[i * 4 + 1] = image.data[i * image.colors + 1];
      pixels[i * 4 + 2] = image.data[i * image.colors + 2];
      pixels[i * 4 + 3] = 255;
    }
    canvas
      .getContext("2d")
      .putImageData(new ImageData(pixels, image.width, image.height), 0, 0);
    return { canvas, metadata };
  } finally {
    raw.dispose();
  }
}
